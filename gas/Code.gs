/**
 * 心靈充電所｜Healing Sanctuary — Google Apps Script 後端（Phase 2：多人同步）
 *
 * 部署方式見 docs/GAS-SETUP.md。重點：
 * - Google Sheets 只存放低頻資料（房間、主持人、祝福、公告、設定）。
 * - 玩家的即時狀態（位置、動作、心跳）只放 CacheService，不寫入 Sheets。
 * - 每位玩家一個快取項目（p:<房間>:<玩家>），房間名單另存一個索引（idx:<房間>），
 *   只有索引變動時才取得 LockService，避免所有玩家搶同一把鎖。
 * - 快取可能被提前清除：房間索引在 PropertiesService 另存備份；玩家項目遺失時前端自動重新加入。
 * - 身分邊界：訪客沒有登入，joinRoom 時伺服器發放隨機「能力憑證」(token)，
 *   之後只有持有 token 的請求能更新該玩家狀態。這能防止任意覆寫他人資料，
 *   但「不能」證明使用者是誰；請勿把訪客 ID 當成可信帳號。
 */

var SHEETS = {
  Rooms: ['RoomID', 'Scene', 'RoomName', 'Capacity', 'Enabled', 'CreatedAt'],
  HostApplications: ['ApplicationID', 'Nickname', 'Scene', 'RequestedDate', 'Introduction', 'Status', 'CreatedAt'],
  HostPermissions: ['HostID', 'VerifiedIdentity', 'Scene', 'Role', 'Status', 'ApprovedAt'],
  DailyMessages: ['MessageID', 'Scene', 'PublishDate', 'Content', 'Author', 'Status'],
  Announcements: ['AnnouncementID', 'Scene', 'Content', 'StartAt', 'EndAt', 'Status'],
  Settings: ['Key', 'Value', 'Description', 'UpdatedAt'],
  ActivitySummary: ['Date', 'Scene', 'Joins', 'PeakOnline', 'UpdatedAt'],
};

var CFG = {
  OFFLINE_MS: 75 * 1000, // 超過此時間沒有心跳視為離線
  PLAYER_TTL_S: 150, // 玩家快取保存秒數
  TOKEN_TTL_S: 6 * 3600,
  INDEX_TTL_S: 6 * 3600,
  MIN_SYNC_MS: 2500, // 同一玩家兩次同步的最短間隔（節流）
  INTERACT_COOLDOWN_MS: 8000,
  EVENTS_KEEP: 40,
  EVENTS_TTL_S: 300,
  LOCK_WAIT_MS: 4000,
  BOUNDS: 40,
  PUBLIC_CACHE_S: 60,
};

var SCENES = ['temple', 'church'];
var ANIMS = ['idle', 'walk', 'sit', 'pray', 'bow', 'handsTogether', 'meditate', 'wave', 'happy', 'fishDrum'];
var PRESETS = {
  wave: '👋',
  palms: '🙏',
  smile: '😊',
  heart: '💗',
  thanks: '辛苦了！',
  peace: '願你平安。',
  great: '今天也很棒！',
  rest: '一起休息一下吧！',
};

/* ============================== 初始化 ============================== */

/** 在試算表的 Apps Script 編輯器中手動執行一次：建立工作表與預設資料（重複執行不會覆蓋既有資料） */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold');
    }
  });
  var now = new Date();
  var rooms = ss.getSheetByName('Rooms');
  if (rooms.getLastRow() === 1) {
    rooms.appendRow(['temple-1', 'temple', '山林大廳', 25, true, now]);
    rooms.appendRow(['church-1', 'church', '花園禮拜堂', 25, true, now]);
  }
  var settings = ss.getSheetByName('Settings');
  if (settings.getLastRow() === 1) {
    settings.appendRow(['multiplayerEnabled', 'true', '多人同步總開關', now]);
    settings.appendRow(['baseSyncMs', '6000', '基本輪詢間隔（毫秒），人數多時自動拉長', now]);
    settings.appendRow(['maxSyncMs', '10000', '輪詢間隔上限（毫秒）', now]);
    settings.appendRow(['interactionsEnabled', 'true', '玩家預設互動（揮手、祝福泡泡）開關', now]);
  }
  return 'setup done';
}

/* ============================== 進入點 ============================== */

function doGet(e) {
  var p = (e && e.parameter) || {};
  return respond(handle(p.action || 'ping', p, true));
}

/**
 * 前端以 Content-Type: text/plain 傳送 JSON（屬於「簡單請求」，不會觸發 CORS 預檢）。
 * Apps Script 回應會 302 轉址到 script.googleusercontent.com，該網域回應帶有
 * Access-Control-Allow-Origin: *，因此 fetch 可以讀取 JSON 回應。
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return respond({ ok: false, error: 'bad_json' });
  }
  return respond(handle(String(body.action || ''), body, false));
}

function respond(obj) {
  obj.serverTime = Date.now();
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle(action, p, isGet) {
  try {
    // 公開讀取：GET / POST 皆可
    if (action === 'ping') return { ok: true, service: 'healing-sanctuary', version: 2 };
    if (action === 'getRooms') return { ok: true, rooms: getRooms_() };
    if (action === 'getSettings') return { ok: true, settings: publicSettings_() };
    if (action === 'getDailyMessage') return { ok: true, message: getDailyMessage_(p.scene) };
    if (action === 'getAnnouncements') return { ok: true, announcements: getAnnouncements_(p.scene) };
    // 寫入操作只接受 POST（GET 可能被快取、記錄在網址或被嵌入他站觸發）
    if (isGet) return { ok: false, error: 'method_not_allowed' };
    if (action === 'joinRoom') return joinRoom_(p);
    if (action === 'syncRoomState') return syncRoomState_(p);
    if (action === 'leaveRoom') return leaveRoom_(p);
    if (action === 'sendPresetInteraction') return sendPresetInteraction_(p);
    return { ok: false, error: 'unknown_action' };
  } catch (err) {
    console.error(action, err && err.stack ? err.stack : err);
    return { ok: false, error: 'server_error' };
  }
}

/* ============================== 公開讀取（Sheets＋快取） ============================== */

function cache_() {
  return CacheService.getScriptCache();
}

function readSheet_(name) {
  var key = 'sheet:' + name;
  var hit = cache_().get(key);
  if (hit) return JSON.parse(hit);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var rows = [];
  if (sh && sh.getLastRow() > 1) {
    var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var head = values[0];
    for (var i = 1; i < values.length; i++) {
      var o = {};
      for (var j = 0; j < head.length; j++) o[head[j]] = values[i][j] instanceof Date ? values[i][j].getTime() : values[i][j];
      rows.push(o);
    }
  }
  try {
    cache_().put(key, JSON.stringify(rows), CFG.PUBLIC_CACHE_S);
  } catch (err) {
    // 超過快取大小上限時直接回傳
  }
  return rows;
}

function truthy_(v) {
  return v === true || String(v).toLowerCase() === 'true';
}

function getRooms_() {
  return readSheet_('Rooms')
    .filter(function (r) {
      return truthy_(r.Enabled) && SCENES.indexOf(String(r.Scene)) >= 0;
    })
    .map(function (r) {
      return { roomId: String(r.RoomID), scene: String(r.Scene), name: String(r.RoomName), capacity: Math.min(50, Number(r.Capacity) || 25) };
    });
}

function settingsMap_() {
  var m = {};
  readSheet_('Settings').forEach(function (r) {
    m[String(r.Key)] = String(r.Value);
  });
  return m;
}

function publicSettings_() {
  var s = settingsMap_();
  return {
    multiplayerEnabled: s.multiplayerEnabled !== 'false',
    interactionsEnabled: s.interactionsEnabled !== 'false',
    baseSyncMs: clamp_(Number(s.baseSyncMs) || 6000, 5000, 10000),
    maxSyncMs: clamp_(Number(s.maxSyncMs) || 10000, 6000, 20000),
  };
}

function todayKey_() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
}

function getDailyMessage_(scene) {
  var today = todayKey_();
  var rows = readSheet_('DailyMessages').filter(function (r) {
    var d = typeof r.PublishDate === 'number' ? Utilities.formatDate(new Date(r.PublishDate), 'Asia/Taipei', 'yyyy-MM-dd') : String(r.PublishDate);
    return String(r.Status) === 'published' && d === today && (String(r.Scene) === scene || String(r.Scene) === 'all');
  });
  if (!rows.length) return null;
  var r = rows[rows.length - 1];
  return { content: String(r.Content).slice(0, 120), author: String(r.Author).slice(0, 20) };
}

function getAnnouncements_(scene) {
  var now = Date.now();
  return readSheet_('Announcements')
    .filter(function (r) {
      return String(r.Status) === 'published' && (String(r.Scene) === scene || String(r.Scene) === 'all') && (!r.StartAt || Number(r.StartAt) <= now) && (!r.EndAt || Number(r.EndAt) >= now);
    })
    .slice(-3)
    .map(function (r) {
      return { id: String(r.AnnouncementID), content: String(r.Content).slice(0, 200) };
    });
}

/* ============================== 驗證工具 ============================== */

function clamp_(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function num_(v, a, b) {
  var n = Number(v);
  if (!isFinite(n)) return null;
  return clamp_(n, a, b);
}

function str_(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function nickname_(v) {
  // 以 code point 計算，最多 12 字
  return Array.from(str_(v, 64)).slice(0, 12).join('');
}

var HEX = /^#[0-9a-fA-F]{6}$/;
function avatar_(a) {
  a = a || {};
  var pick = function (v, list, d) {
    return list.indexOf(v) >= 0 ? v : d;
  };
  var color = function (v, d) {
    return HEX.test(String(v)) ? String(v) : d;
  };
  return {
    wardrobe: pick(a.wardrobe, ['monk', 'formal'], 'monk'),
    skin: color(a.skin, '#f6d1ad'),
    expression: pick(a.expression, ['smile', 'calm', 'joy'], 'smile'),
    primary: color(a.primary, '#d99a4e'),
    secondary: color(a.secondary, '#b8462e'),
    monkStyle: pick(a.monkStyle, ['plain', 'beads', 'sash'], 'plain'),
    outfit: pick(a.outfit, ['shirt', 'blazer', 'dress', 'knit'], 'knit'),
    hair: pick(a.hair, ['short', 'bob', 'long', 'bun', 'curly'], 'short'),
    hairColor: color(a.hairColor, '#4a3427'),
  };
}

/** 驗證並整理位置與動作；不合理的資料（超出邊界、非數字、未知動作）直接拒絕或夾到範圍內 */
function state_(s) {
  if (!s) return null;
  var x = num_(s.x, -CFG.BOUNDS, CFG.BOUNDS);
  var y = num_(s.y, -2, 6);
  var z = num_(s.z, -CFG.BOUNDS, CFG.BOUNDS);
  var r = num_(s.r, -100, 100);
  if (x === null || y === null || z === null || r === null) return null;
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    z: Math.round(z * 100) / 100,
    r: Math.round(r * 100) / 100,
    a: ANIMS.indexOf(s.a) >= 0 ? s.a : 'idle',
    e: !!s.e,
    q: s.q === 's' || s.q === 'm' ? s.q : '',
  };
}

function findRoom_(roomId) {
  var rooms = getRooms_();
  for (var i = 0; i < rooms.length; i++) if (rooms[i].roomId === roomId) return rooms[i];
  return null;
}

/* ============================== 房間狀態（CacheService） ============================== */

function idxKey_(roomId) {
  return 'idx:' + roomId;
}
function pKey_(roomId, pid) {
  return 'p:' + roomId + ':' + pid;
}

/**
 * 房間索引：主要存在 CacheService，另在 PropertiesService 保存備份。
 * 備份只在名單變動（加入、離開、清除逾時）時寫入；快取遺失時才讀取備份並補回快取。
 */
function readIndex_(roomId) {
  var raw = cache_().get(idxKey_(roomId));
  if (!raw) {
    raw = PropertiesService.getScriptProperties().getProperty(idxKey_(roomId));
    if (raw) cache_().put(idxKey_(roomId), raw, CFG.INDEX_TTL_S);
  }
  if (!raw) return [];
  try {
    var a = JSON.parse(raw);
    return Array.isArray(a) ? a : [];
  } catch (err) {
    return [];
  }
}

function writeIndex_(roomId, ids) {
  var raw = JSON.stringify(ids);
  cache_().put(idxKey_(roomId), raw, CFG.INDEX_TTL_S);
  PropertiesService.getScriptProperties().setProperty(idxKey_(roomId), raw);
}

/** 在鎖內修改房間索引 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(CFG.LOCK_WAIT_MS)) return { ok: false, error: 'busy', retryAfter: 3000 };
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** 讀取房間內所有有效玩家（順便回報已逾時者） */
function readPlayers_(roomId, index) {
  var now = Date.now();
  var keys = index.map(function (pid) {
    return pKey_(roomId, pid);
  });
  var got = keys.length ? cache_().getAll(keys) : {};
  var alive = [];
  var stale = [];
  index.forEach(function (pid) {
    var raw = got[pKey_(roomId, pid)];
    if (!raw) {
      stale.push(pid);
      return;
    }
    var p = JSON.parse(raw);
    if (now - p.seen > CFG.OFFLINE_MS) stale.push(pid);
    else alive.push(p);
  });
  return { alive: alive, stale: stale };
}

function syncInterval_(online) {
  var s = publicSettings_();
  // 人數越多輪詢越慢：每多 5 人增加 1 秒
  return clamp_(s.baseSyncMs + Math.floor(Math.max(0, online - 5) / 5) * 1000, s.baseSyncMs, s.maxSyncMs);
}

function checkToken_(p) {
  var pid = str_(p.playerId, 64);
  var token = str_(p.token, 64);
  if (!pid || !token) return null;
  var saved = cache_().get('tok:' + pid);
  if (!saved || saved !== token) return null;
  return pid;
}

function joinRoom_(p) {
  var settings = publicSettings_();
  if (!settings.multiplayerEnabled) return { ok: false, error: 'disabled' };
  var room = findRoom_(str_(p.roomId, 40));
  if (!room) return { ok: false, error: 'room_not_found' };
  var nickname = nickname_(p.nickname);
  if (!nickname) return { ok: false, error: 'bad_nickname' };
  var st = state_(p.state) || { x: 0, y: 0, z: 21, r: Math.PI, a: 'idle', e: false };

  // 同一分頁重新整理：持有有效 token 時沿用原本的玩家 ID
  var pid = checkToken_(p);
  var token = pid ? str_(p.token, 64) : Utilities.getUuid();
  if (!pid) pid = Utilities.getUuid().slice(0, 12);

  var res = withLock_(function () {
    var index = readIndex_(room.roomId);
    var cur = readPlayers_(room.roomId, index);
    var ids = cur.alive.map(function (x) {
      return x.id;
    });
    if (ids.indexOf(pid) < 0 && ids.length >= room.capacity) return { ok: false, error: 'room_full' };
    if (ids.indexOf(pid) < 0) ids.push(pid);
    writeIndex_(room.roomId, ids);
    return { ok: true, online: ids.length };
  });
  if (!res.ok) return res;

  var now = Date.now();
  var rec = { id: pid, n: nickname, av: avatar_(p.avatar), s: st, seen: now, v: 1 };
  cache_().put(pKey_(room.roomId, pid), JSON.stringify(rec), CFG.PLAYER_TTL_S);
  cache_().put('tok:' + pid, token, CFG.TOKEN_TTL_S);
  bumpSummary_(room.scene, res.online);
  var snapshot = roomSnapshot_(room.roomId, pid, 0);
  snapshot.playerId = pid;
  snapshot.token = token;
  snapshot.room = room;
  return snapshot;
}

/** 回傳房間內其他玩家與最近事件 */
function roomSnapshot_(roomId, selfId, sinceEvent) {
  var index = readIndex_(roomId);
  var cur = readPlayers_(roomId, index);
  // 快取遺失復原：自己不在索引中時補回（需取得鎖）
  if (selfId && index.indexOf(selfId) < 0) {
    withLock_(function () {
      var idx = readIndex_(roomId);
      if (idx.indexOf(selfId) < 0) {
        idx.push(selfId);
        writeIndex_(roomId, idx);
      }
      return { ok: true };
    });
  }
  // 清除逾時玩家（偶爾執行即可，取不到鎖就下次再清）
  if (cur.stale.length) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(500)) {
      try {
        var idx2 = readIndex_(roomId).filter(function (id) {
          return cur.stale.indexOf(id) < 0;
        });
        writeIndex_(roomId, idx2);
      } finally {
        lock.releaseLock();
      }
    }
  }
  var others = cur.alive
    .filter(function (x) {
      return x.id !== selfId;
    })
    .map(function (x) {
      return { id: x.id, n: x.n, av: x.av, s: x.s, seen: x.seen, v: x.v };
    });
  var online = cur.alive.length + (selfId && !cur.alive.some(function (x) { return x.id === selfId; }) ? 1 : 0);
  return { ok: true, online: online, players: others, events: readEvents_(roomId, sinceEvent), interval: syncInterval_(online) };
}

function syncRoomState_(p) {
  var pid = checkToken_(p);
  if (!pid) return { ok: false, error: 'invalid_token' };
  var roomId = str_(p.roomId, 40);
  if (!findRoom_(roomId)) return { ok: false, error: 'room_not_found' };

  // 節流：同一玩家請求過於頻繁時要求退避
  var now = Date.now();
  var tKey = 't:' + pid;
  var last = Number(cache_().get(tKey) || 0);
  if (now - last < CFG.MIN_SYNC_MS) return { ok: false, error: 'too_frequent', retryAfter: CFG.MIN_SYNC_MS };
  cache_().put(tKey, String(now), 60);

  var key = pKey_(roomId, pid);
  var raw = cache_().get(key);
  var rec = raw ? JSON.parse(raw) : null;
  if (!rec) {
    // 玩家快取遺失（逾時或被清除）：請前端重新加入
    return { ok: false, error: 'expired' };
  }
  var st = state_(p.state);
  // 只有狀態改變或心跳到期時才寫入快取
  if (st || p.hb) {
    if (st) {
      rec.s = st;
      rec.v = (rec.v || 0) + 1;
    }
    rec.seen = now;
    cache_().put(key, JSON.stringify(rec), CFG.PLAYER_TTL_S);
  }
  return roomSnapshot_(roomId, pid, Number(p.sinceEvent) || 0);
}

function leaveRoom_(p) {
  var pid = checkToken_(p);
  if (!pid) return { ok: false, error: 'invalid_token' };
  var roomId = str_(p.roomId, 40);
  cache_().remove(pKey_(roomId, pid));
  cache_().remove('tok:' + pid);
  withLock_(function () {
    var idx = readIndex_(roomId).filter(function (id) {
      return id !== pid;
    });
    writeIndex_(roomId, idx);
    return { ok: true };
  });
  return { ok: true };
}

/* ============================== 預設互動 ============================== */

function readEvents_(roomId, since) {
  var raw = cache_().get('ev:' + roomId);
  if (!raw) return [];
  var list = JSON.parse(raw);
  return list.filter(function (e) {
    return e.seq > since;
  });
}

function sendPresetInteraction_(p) {
  var pid = checkToken_(p);
  if (!pid) return { ok: false, error: 'invalid_token' };
  if (!publicSettings_().interactionsEnabled) return { ok: false, error: 'disabled' };
  var roomId = str_(p.roomId, 40);
  var preset = String(p.preset || '');
  if (!PRESETS.hasOwnProperty(preset)) return { ok: false, error: 'bad_preset' };
  var cdKey = 'cd:' + pid;
  var now = Date.now();
  if (now - Number(cache_().get(cdKey) || 0) < CFG.INTERACT_COOLDOWN_MS) return { ok: false, error: 'cooldown', retryAfter: CFG.INTERACT_COOLDOWN_MS };
  cache_().put(cdKey, String(now), 60);
  var target = p.targetId ? str_(p.targetId, 64) : '';
  return withLock_(function () {
    var raw = cache_().get('ev:' + roomId);
    var list = raw ? JSON.parse(raw) : [];
    var seq = list.length ? list[list.length - 1].seq + 1 : 1;
    list.push({ seq: seq, from: pid, to: target, preset: preset, at: now });
    list = list.slice(-CFG.EVENTS_KEEP);
    cache_().put('ev:' + roomId, JSON.stringify(list), CFG.EVENTS_TTL_S);
    return { ok: true, seq: seq };
  });
}

/* ============================== 匿名彙總（選用） ============================== */

/**
 * 只記錄每日、每場景的加入次數與尖峰人數，不記錄任何玩家識別資料。
 * 以快取累計，每 10 分鐘最多寫入 Sheets 一次。
 */
function bumpSummary_(scene, online) {
  var day = todayKey_();
  var key = 'sum:' + day + ':' + scene;
  var raw = cache_().get(key);
  var s = raw ? JSON.parse(raw) : { joins: 0, peak: 0, flushed: 0 };
  s.joins += 1;
  s.peak = Math.max(s.peak, online);
  var now = Date.now();
  if (now - s.flushed > 10 * 60 * 1000) {
    s.flushed = now;
    try {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ActivitySummary');
      if (sh) sh.appendRow([day, scene, s.joins, s.peak, new Date()]);
    } catch (err) {
      // 彙總失敗不影響主要功能
    }
  }
  cache_().put(key, JSON.stringify(s), 6 * 3600);
}
