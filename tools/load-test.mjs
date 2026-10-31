/**
 * 多人同步負載測試：模擬 N 位玩家依伺服器建議的間隔同步（與前端相同的請求格式）。
 *
 *   node tools/load-test.mjs --url <GAS Web App 網址或模擬器網址> --clients 25 --duration 180
 *
 * 輸出：請求數、成功率、錯誤類型、回應時間 p50/p95/max、每位玩家看到的在線人數範圍。
 * 對正式 GAS 測試時請在非上班尖峰進行，並先告知管理者（會產生實際的 Apps Script 執行次數）。
 */
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const URL_ = args.url || 'http://localhost:8787/exec';
const N = Number(args.clients || 5);
const DURATION = Number(args.duration || 120) * 1000;
const ROOM = args.room || 'temple-1';

const lat = [];
const errors = {};
let requests = 0;
let ok = 0;

async function call(body) {
  const t = Date.now();
  requests++;
  try {
    const res = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const json = await res.json();
    lat.push(Date.now() - t);
    if (json.ok) ok++;
    else errors[json.error] = (errors[json.error] || 0) + 1;
    return json;
  } catch (e) {
    errors[e.name] = (errors[e.name] || 0) + 1;
    return { ok: false, error: e.name };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function client(i, end) {
  await sleep(Math.random() * 3000);
  const avatar = { wardrobe: 'monk', skin: '#f6d1ad', expression: 'smile', primary: '#d99a4e', secondary: '#b8462e', monkStyle: 'beads' };
  let me = await call({ action: 'joinRoom', roomId: ROOM, nickname: `測試${i}`, avatar, state: { x: 0, y: 0, z: 21, r: 3.1, a: 'idle', e: false, q: '' } });
  const seen = [];
  let interval = me.interval || 6000;
  let x = (Math.random() - 0.5) * 20;
  let z = (Math.random() - 0.5) * 20;
  let since = 0;
  while (Date.now() < end) {
    await sleep(interval);
    if (!me.ok) {
      me = await call({ action: 'joinRoom', roomId: ROOM, nickname: `測試${i}`, avatar });
      continue;
    }
    const moving = Math.random() < 0.6;
    if (moving) {
      x = Math.max(-30, Math.min(30, x + (Math.random() - 0.5) * 6));
      z = Math.max(-30, Math.min(30, z + (Math.random() - 0.5) * 6));
    }
    const res = await call({
      action: 'syncRoomState',
      roomId: ROOM,
      playerId: me.playerId,
      token: me.token,
      state: moving ? { x, y: 0, z, r: 0, a: moving ? 'walk' : 'idle', e: false, q: '' } : undefined,
      hb: true,
      sinceEvent: since,
    });
    if (res.ok) {
      seen.push(res.online);
      interval = res.interval;
      for (const e of res.events) since = Math.max(since, e.seq);
      if (Math.random() < 0.05) await call({ action: 'sendPresetInteraction', roomId: ROOM, playerId: me.playerId, token: me.token, preset: 'wave' });
    } else if (res.error === 'expired' || res.error === 'invalid_token') {
      me = { ok: false };
    } else if (res.retryAfter) {
      interval = res.retryAfter;
    }
  }
  if (me.ok) await call({ action: 'leaveRoom', roomId: ROOM, playerId: me.playerId, token: me.token });
  return { min: Math.min(...seen), max: Math.max(...seen), samples: seen.length, interval };
}

const end = Date.now() + DURATION;
const started = Date.now();
const results = await Promise.all(Array.from({ length: N }, (_, i) => client(i, end)));
lat.sort((a, b) => a - b);
const q = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))];
const secs = (Date.now() - started) / 1000;
console.log(
  JSON.stringify(
    {
      url: URL_.replace(/\/macros\/s\/[^/]+/, '/macros/s/***'),
      clients: N,
      durationSec: Math.round(secs),
      requests,
      reqPerSec: +(requests / secs).toFixed(2),
      successRate: +((ok / requests) * 100).toFixed(1),
      errors,
      latencyMs: { p50: q(0.5), p95: q(0.95), max: lat[lat.length - 1] },
      onlineSeen: { min: Math.min(...results.map((r) => r.min)), max: Math.max(...results.map((r) => r.max)) },
      finalInterval: results[0]?.interval,
    },
    null,
    2,
  ),
);
