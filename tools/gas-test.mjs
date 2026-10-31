/**
 * 後端自動測試：在模擬器中同時載入公開 API（gas/Code.gs）與管理後台（gas/admin/Admin.gs），
 * 共用同一份記憶體試算表，驗證主持人申請 → 管理員核准 → 主持人登入 → 集體靜心邀請等完整流程與權限。
 *   node tools/gas-test.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cache, createSandbox, sandbox as pub } from './gas-emulator.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminFile = path.join(here, '../gas/admin/Admin.gs');
const adminProps = new Map([
  ['ADMIN_EMAILS', 'admin@hospital.org, second@hospital.org'],
  ['SPREADSHEET_ID', 'test'],
]);
const admin = createSandbox(adminFile, { session: 'admin@hospital.org', props: adminProps });
const stranger = createSandbox(adminFile, { session: 'someone@gmail.com', props: adminProps });

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
};
const post = (body) => JSON.parse(pub.doPost({ postData: { contents: JSON.stringify(body) } }).s);
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch (e) {
    return e.message || true;
  }
};
const flush = () => ['Rooms', 'Settings', 'HostPermissions', 'DailyMessages', 'Announcements'].forEach((n) => cache.remove('sheet:' + n));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
const avatar = { wardrobe: 'monk' };

// 1. 主持人申請
ok('申請：資料不完整被拒', post({ action: 'submitHostApplication', nickname: '小雲', scene: 'temple', requestedDate: today, introduction: '' }).error === 'invalid');
ok('申請：日期超過 90 天被拒', post({ action: 'submitHostApplication', nickname: '小雲', scene: 'temple', requestedDate: '2099-01-01', introduction: '我想陪大家休息一下' }).error === 'invalid_date');
const app = post({ action: 'submitHostApplication', nickname: '小雲', scene: 'temple', requestedDate: today, introduction: '我是護理師，想陪大家休息' });
ok('申請：成功送出', app.ok && /^A\d+/.test(app.applicationId), app.applicationId);
const inj = post({ action: 'submitHostApplication', nickname: '=HYPERLINK("x")', scene: 'church', requestedDate: today, introduction: '+cmd 測試注入內容' });
const raw = pub.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HostApplications').raw;
ok('申請：試算表公式注入被中和（以 \' 前綴寫入，試算表會當成純文字）', inj.ok && raw.some((r) => String(r[1]).startsWith("'=")) && raw.some((r) => String(r[4]).startsWith("'+")));
ok('申請：以 GET 呼叫被拒', JSON.parse(pub.doGet({ parameter: { action: 'submitHostApplication' } }).s).error === 'method_not_allowed');

// 2. 管理後台授權
ok('後台：非管理員無法讀取', !!throws(() => stranger.getDashboard()));
ok('後台：非管理員看到未授權頁面', !!stranger.doGet().h);
ok('後台：管理員可讀取申請', admin.getDashboard().applications.length === 2);
ok('後台：正式職稱未確認身分時不可核准', String(throws(() => admin.approveHost(app.applicationId, '虛擬住持', '', false))).includes('正式'));
ok('後台：非管理員不能核准', !!throws(() => stranger.approveHost(app.applicationId, '值日陪伴員', '', false)));
const approved = admin.approveHost(app.applicationId, '值日陪伴員', 'nurse@hospital.org', false);
ok('後台：核准後回傳一次性金鑰', /^[0-9a-f-]{36}$/.test(approved.hostKey) && approved.hostId.startsWith('h_'));
const permRows = pub.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HostPermissions').rows;
ok('後台：試算表只存雜湊，不存金鑰', !JSON.stringify(permRows).includes(approved.hostKey));
ok('後台：同一申請不能重複核准', !!throws(() => admin.approveHost(app.applicationId, '值日陪伴員', '', false)));
ok('後台：操作寫入 AdminLog', pub.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AdminLog').rows.length >= 2);

// 3. 主持人登入與邀請
flush();
const host = post({ action: 'joinRoom', roomId: 'temple-1', nickname: '小雲', avatar, hostKey: approved.hostKey });
ok('主持人：金鑰正確可登入並取得角色', host.ok && host.hostRole === '值日陪伴員');
ok('主持人：錯誤金鑰被拒', post({ action: 'joinRoom', roomId: 'temple-1', nickname: '假的', avatar, hostKey: 'nope' }).error === 'bad_host_key');
ok('主持人：佛堂金鑰不能用在教堂', post({ action: 'joinRoom', roomId: 'church-1', nickname: '小雲', avatar, hostKey: approved.hostKey }).error === 'bad_host_key');
const guest = post({ action: 'joinRoom', roomId: 'temple-1', nickname: '訪客', avatar });
ok('一般玩家看得到主持人角色', guest.players.some((p) => p.id === host.playerId && p.h === '值日陪伴員'));
ok('一般玩家不能發邀請', post({ action: 'sendInvitation', roomId: 'temple-1', playerId: guest.playerId, token: guest.token, minutes: 3 }).error === 'not_host');
ok('主持人：用他人 token 無效', post({ action: 'sendInvitation', roomId: 'temple-1', playerId: host.playerId, token: guest.token, minutes: 3 }).error === 'invalid_token');
ok('主持人：發送三分鐘靜心邀請', post({ action: 'sendInvitation', roomId: 'temple-1', playerId: host.playerId, token: host.token, minutes: 3 }).ok);
ok('主持人：5 分鐘內不能重複邀請', post({ action: 'sendInvitation', roomId: 'temple-1', playerId: host.playerId, token: host.token, minutes: 3 }).error === 'cooldown');
cache.remove('t:' + guest.playerId);
const synced = post({ action: 'syncRoomState', roomId: 'temple-1', playerId: guest.playerId, token: guest.token, hb: true, sinceEvent: 0 });
ok('一般玩家收到邀請事件', synced.events.some((e) => e.preset === 'invite' && e.minutes === 3 && e.from === host.playerId));

// 4. 每日一句、公告、移除
const mid = admin.publishDailyMessage('temple', today, '今天辛苦了，願你的心比昨天輕一點。', '值日陪伴員 小雲');
admin.publishAnnouncement('all', '本週五 12:30 有三分鐘集體靜心', null, null);
flush();
ok('每日一句：公開 API 取得', JSON.parse(pub.doGet({ parameter: { action: 'getDailyMessage', scene: 'temple' } }).s).message?.content === '今天辛苦了，願你的心比昨天輕一點。');
ok('每日一句：其他場景看不到', JSON.parse(pub.doGet({ parameter: { action: 'getDailyMessage', scene: 'church' } }).s).message === null);
ok('公告：全部場景可見', JSON.parse(pub.doGet({ parameter: { action: 'getAnnouncements', scene: 'church' } }).s).announcements.length === 1);
admin.removeContent('DailyMessages', mid);
flush();
ok('移除不適當內容後不再顯示', JSON.parse(pub.doGet({ parameter: { action: 'getDailyMessage', scene: 'temple' } }).s).message === null);
ok('公告內容不可夾帶 HTML', !!admin.publishAnnouncement('all', '<script>alert(1)</script>', null, null) && !JSON.stringify(pub.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Announcements').rows).includes('<script'));

// 5. 停用主持人、暱稱過濾、功能開關
admin.disableHost(approved.hostId);
flush();
ok('停用後主持人金鑰失效', post({ action: 'joinRoom', roomId: 'temple-1', nickname: '小雲', avatar, hostKey: approved.hostKey }).error === 'bad_host_key');
ok('設定：不允許修改白名單外的鍵', !!throws(() => admin.updateSettings('ADMIN_EMAILS', 'x')));
admin.updateSettings('blockedWords', '測試髒話,壞人');
flush();
ok('設定：含禁用字的暱稱被拒', post({ action: 'joinRoom', roomId: 'temple-1', nickname: '我是壞人', avatar }).error === 'bad_nickname');
admin.updateSettings('multiplayerEnabled', 'false');
flush();
ok('設定：關閉多人同步', post({ action: 'joinRoom', roomId: 'temple-1', nickname: '訪客二', avatar }).error === 'disabled');
admin.updateSettings('multiplayerEnabled', 'true');
admin.updateRoom('church-1', false, 10);
flush();
ok('房間：停用後無法加入', post({ action: 'joinRoom', roomId: 'church-1', nickname: '訪客三', avatar }).error === 'room_not_found');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
