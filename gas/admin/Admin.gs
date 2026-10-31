/**
 * 心靈充電所｜管理後台（獨立的 Apps Script 專案，部署方式見 docs/ADMIN-GUIDE.md）
 *
 * 授權（全部在伺服器端確認，前端沒有任何密碼）：
 * 1. 部署設定「執行身分：存取網頁應用程式的使用者」＋「存取權：擁有 Google 帳戶的任何使用者（或機構網域）」，
 *    因此每個操作都以「登入者本人」的 Google 權限讀寫試算表——沒有試算表編輯權的人根本無法修改資料。
 * 2. 另外比對指令碼屬性 ADMIN_EMAILS（逗號分隔的管理員 Email 名單），不在名單內一律拒絕。
 * 指令碼屬性：SPREADSHEET_ID（資料庫試算表 ID）、ADMIN_EMAILS。
 */

var ROLES = ['值日陪伴員', '虛擬住持', '神父', '牧師'];
var FORMAL = ['虛擬住持', '神父', '牧師'];
var SCENES = ['temple', 'church', 'all'];
var SETTING_KEYS = {
  multiplayerEnabled: 'bool',
  interactionsEnabled: 'bool',
  baseSyncMs: 'num',
  maxSyncMs: 'num',
  blockedWords: 'text',
};

function doGet() {
  try {
    requireAdmin_();
  } catch (err) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:24px">此頁面僅限心靈充電所管理員使用。若您是管理員，請確認已用正確的 Google 帳號登入。</p>').setTitle('未授權');
  }
  return HtmlService.createHtmlOutputFromFile('Admin').setTitle('心靈充電所｜管理後台').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function requireAdmin_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var allow = String(PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '')
    .toLowerCase()
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(String);
  if (!email || allow.indexOf(email) < 0) throw new Error('未授權');
  return email;
}

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('尚未設定 SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function rows_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var head = v[0];
  return v.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) {
      o[h] = r[j] instanceof Date ? Utilities.formatDate(r[j], 'Asia/Taipei', 'yyyy-MM-dd HH:mm') : r[j];
    });
    return o;
  });
}

function setCell_(name, row, header, value) {
  var sh = ss_().getSheetByName(name);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = head.indexOf(header) + 1;
  if (col < 1) throw new Error('找不到欄位 ' + header);
  sh.getRange(row, col).setValue(value);
}

function clean_(v, max) {
  var s = String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function log_(email, action, detail) {
  var ss = ss_();
  var sh = ss.getSheetByName('AdminLog');
  if (!sh) {
    sh = ss.insertSheet('AdminLog');
    sh.appendRow(['Time', 'Admin', 'Action', 'Detail']);
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), email, action, clean_(detail, 300)]);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('系統忙碌，請稍後再試');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ============================== 讀取 ============================== */

function getDashboard() {
  requireAdmin_();
  return {
    applications: rows_('HostApplications').reverse().slice(0, 100),
    hosts: rows_('HostPermissions').reverse(),
    dailyMessages: rows_('DailyMessages').reverse().slice(0, 40),
    announcements: rows_('Announcements').reverse().slice(0, 40),
    settings: rows_('Settings'),
    rooms: rows_('Rooms'),
  };
}

function getApplications() {
  requireAdmin_();
  return rows_('HostApplications').reverse();
}

/* ============================== 主持人審核 ============================== */

function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    })
    .join('');
}

/**
 * 核准申請：產生一次性顯示的主持人金鑰（只回傳給管理員一次，試算表只存雜湊）。
 * 正式宗教職稱（住持、神父、牧師）必須由管理員勾選「已確認具正式身分或授權」。
 */
function approveHost(applicationId, role, verifiedIdentity, formalConfirmed) {
  var email = requireAdmin_();
  if (ROLES.indexOf(role) < 0) throw new Error('角色不正確');
  if (FORMAL.indexOf(role) >= 0 && formalConfirmed !== true) throw new Error('正式宗教職稱需確認具正式身分或授權；一般同事請使用「值日陪伴員」');
  return withLock_(function () {
    var app = rows_('HostApplications').filter(function (r) {
      return String(r.ApplicationID) === String(applicationId);
    })[0];
    if (!app) throw new Error('找不到申請');
    if (String(app.Status) !== 'pending') throw new Error('此申請已處理過');
    var key = Utilities.getUuid();
    var hostId = 'h_' + sha256Hex_('healing-sanctuary:' + key).slice(0, 24);
    ss_().getSheetByName('HostPermissions').appendRow([hostId, clean_(verifiedIdentity || email + ' 核准', 120), app.Scene, role, 'active', new Date()]);
    setCell_('HostApplications', app._row, 'Status', 'approved');
    log_(email, 'approveHost', applicationId + ' → ' + hostId + ' ' + role);
    return { hostId: hostId, hostKey: key, nickname: app.Nickname, scene: app.Scene, role: role };
  });
}

function rejectHost(applicationId) {
  var email = requireAdmin_();
  return withLock_(function () {
    var app = rows_('HostApplications').filter(function (r) {
      return String(r.ApplicationID) === String(applicationId);
    })[0];
    if (!app) throw new Error('找不到申請');
    setCell_('HostApplications', app._row, 'Status', 'rejected');
    log_(email, 'rejectHost', applicationId);
    return true;
  });
}

/** 停用主持人資格（立即生效於下一次加入房間；公開 API 快取約 60 秒） */
function disableHost(hostId) {
  var email = requireAdmin_();
  return withLock_(function () {
    var h = rows_('HostPermissions').filter(function (r) {
      return String(r.HostID) === String(hostId);
    })[0];
    if (!h) throw new Error('找不到主持人');
    setCell_('HostPermissions', h._row, 'Status', 'disabled');
    log_(email, 'disableHost', hostId);
    return true;
  });
}

/* ============================== 每日一句與公告 ============================== */

function publishDailyMessage(scene, date, content, author) {
  var email = requireAdmin_();
  if (SCENES.indexOf(scene) < 0) throw new Error('場景不正確');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('日期格式應為 yyyy-MM-dd');
  var text = clean_(content, 120);
  if (text.length < 2) throw new Error('內容太短');
  return withLock_(function () {
    var id = 'M' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
    ss_().getSheetByName('DailyMessages').appendRow([id, scene, "'" + date, text, clean_(author || '管理員', 20), 'published']);
    log_(email, 'publishDailyMessage', id + ' ' + text);
    return id;
  });
}

function publishAnnouncement(scene, content, startAt, endAt) {
  var email = requireAdmin_();
  if (SCENES.indexOf(scene) < 0) throw new Error('場景不正確');
  var text = clean_(content, 200);
  if (text.length < 2) throw new Error('內容太短');
  var s = startAt ? new Date(startAt) : new Date();
  var e = endAt ? new Date(endAt) : new Date(Date.now() + 7 * 86400000);
  if (!(s < e)) throw new Error('結束時間需晚於開始時間');
  return withLock_(function () {
    var id = 'N' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
    ss_().getSheetByName('Announcements').appendRow([id, scene, text, s, e, 'published']);
    log_(email, 'publishAnnouncement', id + ' ' + text);
    return id;
  });
}

/** 移除不適當內容（每日一句或公告）：狀態改為 removed，保留紀錄 */
function removeContent(sheetName, id) {
  var email = requireAdmin_();
  var idCol = { DailyMessages: 'MessageID', Announcements: 'AnnouncementID' }[sheetName];
  if (!idCol) throw new Error('不支援的工作表');
  return withLock_(function () {
    var r = rows_(sheetName).filter(function (x) {
      return String(x[idCol]) === String(id);
    })[0];
    if (!r) throw new Error('找不到資料');
    setCell_(sheetName, r._row, 'Status', 'removed');
    log_(email, 'removeContent', sheetName + ' ' + id);
    return true;
  });
}

/* ============================== 設定與房間 ============================== */

function updateSettings(key, value) {
  var email = requireAdmin_();
  var type = SETTING_KEYS[key];
  if (!type) throw new Error('不允許修改的設定');
  var v = String(value);
  if (type === 'bool' && v !== 'true' && v !== 'false') throw new Error('請輸入 true 或 false');
  if (type === 'num' && !/^\d{4,5}$/.test(v)) throw new Error('請輸入毫秒數字');
  if (type === 'text') v = clean_(v, 500);
  return withLock_(function () {
    var r = rows_('Settings').filter(function (x) {
      return String(x.Key) === key;
    })[0];
    if (r) {
      setCell_('Settings', r._row, 'Value', v);
      setCell_('Settings', r._row, 'UpdatedAt', new Date());
    } else {
      ss_().getSheetByName('Settings').appendRow([key, v, '', new Date()]);
    }
    log_(email, 'updateSettings', key + '=' + v);
    return true;
  });
}

function updateRoom(roomId, enabled, capacity) {
  var email = requireAdmin_();
  var cap = Math.max(2, Math.min(50, Number(capacity) || 25));
  return withLock_(function () {
    var r = rows_('Rooms').filter(function (x) {
      return String(x.RoomID) === String(roomId);
    })[0];
    if (!r) throw new Error('找不到房間');
    setCell_('Rooms', r._row, 'Enabled', enabled === true);
    setCell_('Rooms', r._row, 'Capacity', cap);
    log_(email, 'updateRoom', roomId + ' enabled=' + enabled + ' cap=' + cap);
    return true;
  });
}

function addRoom(roomId, scene, name, capacity) {
  var email = requireAdmin_();
  if (!/^[a-z]+-\d{1,2}$/.test(String(roomId))) throw new Error('房間 ID 格式例如 temple-2');
  if (['temple', 'church'].indexOf(scene) < 0) throw new Error('場景不正確');
  return withLock_(function () {
    if (rows_('Rooms').some(function (x) { return String(x.RoomID) === roomId; })) throw new Error('房間已存在');
    ss_().getSheetByName('Rooms').appendRow([roomId, scene, clean_(name, 20), Math.max(2, Math.min(50, Number(capacity) || 25)), true, new Date()]);
    log_(email, 'addRoom', roomId);
    return true;
  });
}
