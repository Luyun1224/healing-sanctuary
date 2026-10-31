/**
 * GAS 本機模擬器：在 Node 中執行 gas/Code.gs，提供與 Apps Script Web App 相同的 HTTP 介面，
 * 用於開發與多人測試。只模擬本專案用到的 API，不代表 Google 實際的配額、延遲與快取淘汰行為。
 *
 * 用法：node tools/gas-emulator.mjs [--port 8787] [--latency 400] [--evict 0.02]
 *   --latency  每個請求額外延遲（毫秒），模擬 Apps Script 的回應時間
 *   --evict    每個快取項目「每分鐘」被提前清除的機率（例如 0.05），用於測試快取遺失復原
 * 前端：VITE_GAS_URL=http://localhost:8787/exec npm run dev
 */
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const PORT = Number(args.port || 8787);
const LATENCY = Number(args.latency || 0);
const EVICT = Number(args.evict || 0);

// ---- SpreadsheetApp（記憶體中的工作表） ----
const sheets = new Map();
const sheetValue = (v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);
class Range {
  constructor(sh, r, c, nr, nc) {
    Object.assign(this, { sh, r, c, nr, nc });
  }
  getValues() {
    return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sh.rows[this.r - 1 + i]?.[this.c - 1 + j] ?? ''));
  }
  setFontWeight() {
    return this;
  }
  setValue(v) {
    const row = (this.sh.rows[this.r - 1] ||= []);
    row[this.c - 1] = sheetValue(v);
    return this;
  }
}
class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
    /** 程式實際寫入的原始值（含單引號前綴），供測試檢查 */
    this.raw = [];
  }
  getLastRow() {
    return this.rows.length;
  }
  getLastColumn() {
    return Math.max(0, ...this.rows.map((r) => r.length));
  }
  appendRow(row) {
    // 與 Google 試算表相同：開頭的單引號只代表「以文字儲存」，不是值的一部分
    this.raw.push(row);
    this.rows.push(row.map(sheetValue));
  }
  setFrozenRows() {}
  getRange(r, c, nr = 1, nc = 1) {
    return new Range(this, r, c, nr, nc);
  }
}
const ss = {
  getSheetByName: (n) => sheets.get(n) || null,
  insertSheet: (n) => {
    const s = new Sheet(n);
    sheets.set(n, s);
    return s;
  },
};

// ---- CacheService（含 TTL 與隨機遺失） ----
const store = new Map();
const props = new Map();
const stats = { gets: 0, puts: 0, evicted: 0, propWrites: 0, requests: 0, byAction: {} };

const alive = (k) => {
  const e = store.get(k);
  if (!e) return null;
  if (e.exp < Date.now()) {
    store.delete(k);
    return null;
  }
  if (EVICT) {
    const minutes = (Date.now() - (e.checked ?? e.put)) / 60000;
    e.checked = Date.now();
    if (Math.random() < 1 - Math.pow(1 - EVICT, minutes)) {
      store.delete(k);
      stats.evicted++;
      return null;
    }
  }
  return e.v;
};
const cache = {
  get: (k) => {
    stats.gets++;
    return alive(k);
  },
  getAll: (keys) => {
    const o = {};
    for (const k of keys) {
      stats.gets++;
      const v = alive(k);
      if (v !== null) o[k] = v;
    }
    return o;
  },
  put: (k, v, ttl = 600) => {
    stats.puts++;
    if (String(v).length > 100 * 1024) throw new Error('Argument too large');
    store.set(k, { v: String(v), exp: Date.now() + ttl * 1000, put: Date.now() });
  },
  remove: (k) => store.delete(k),
};

const digest = (alg, text) => [...crypto.createHash('sha256').update(String(text), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b));

/** 建立一個 Apps Script 執行環境（共用同一份記憶體試算表）；session 為登入者 Email（管理後台用） */
export function createSandbox(file, { session = '', props: own } = {}) {
  const myProps = own ?? props;
  const box = {
    console, JSON, Math, Date, Array, Object, String, Number, isFinite, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => myProps.get(k) ?? null, setProperty: (k, v) => (stats.propWrites++, myProps.set(k, String(v))) }) },
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Session: { getActiveUser: () => ({ getEmail: () => session }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: digest,
      formatDate: (d, tz, fmt) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
        return fmt.replace('yyyy', p.year).replace('yy', p.year.slice(2)).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
      },
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
    HtmlService: { createHtmlOutput: (h) => ({ h, setTitle() { return this; } }), createHtmlOutputFromFile: (f) => ({ f, setTitle() { return this; }, addMetaTag() { return this; } }) },
  };
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(file, 'utf8'), box, { filename: path.basename(file) });
  return box;
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const sandbox = createSandbox(path.join(here, '../gas/Code.gs'));
export { ss, cache, stats };
sandbox.setup();

let adminBox = null;
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...stats, keys: store.size }));
    return;
  }
  // 僅限本機模擬器：以管理員身分呼叫 gas/admin/Admin.gs 的函式（例如 /__admin?fn=approveHost&args=[...]）
  if (url.pathname === '/__admin') {
    adminBox ??= createSandbox(path.join(here, '../gas/admin/Admin.gs'), { session: 'admin@local.test', props: new Map([['ADMIN_EMAILS', 'admin@local.test'], ['SPREADSHEET_ID', 'local']]) });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    try {
      res.end(JSON.stringify({ ok: true, result: adminBox[url.searchParams.get('fn')](...JSON.parse(url.searchParams.get('args') || '[]')) }));
    } catch (e) {
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }
  if (url.pathname !== '/exec') {
    res.writeHead(404);
    res.end();
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    setTimeout(() => {
      stats.requests++;
      let out;
      let action = url.searchParams.get('action') || '';
      if (req.method === 'POST') {
        try {
          action = JSON.parse(body).action;
        } catch {}
        out = sandbox.doPost({ postData: { contents: body } });
      } else {
        out = sandbox.doGet({ parameter: Object.fromEntries(url.searchParams) });
      }
      stats.byAction[action] = (stats.byAction[action] || 0) + 1;
      // script.googleusercontent.com 回應帶有 ACAO: *；本模擬器直接回傳（不模擬 302 轉址）
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(out.s);
    }, LATENCY);
  });
});
if (isMain) server.listen(PORT, () => console.log(`GAS emulator on http://localhost:${PORT}/exec (latency ${LATENCY}ms, evict ${EVICT})`));
