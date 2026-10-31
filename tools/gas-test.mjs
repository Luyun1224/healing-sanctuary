/**
 * 後端自動測試：在模擬器中同時載入公開 API（gas/Code.gs）與管理後台（gas/admin/Admin.gs），
 * 共用同一份記憶體試算表，驗證祈福留言板、集體靜心邀請、每日一句、公告、內容管理與權限。
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
const get = (params) => JSON.parse(pub.doGet({ parameter: params }).s);
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch (e) {
    return e.message || true;
  }
};
const flush = () => ['Rooms', 'Settings', 'DailyMessages', 'Announcements', 'BlessingWall'].forEach((n) => cache.remove('sheet:' + n));
const sheet = (n) => pub.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
const avatar = { wardrobe: 'monk' };

// 1. 祈福留言板（不需任何權限）
ok('初始化：建立 BlessingWall 工作表', !!sheet('BlessingWall'));
ok('初始化：不再建立主持人相關工作表', !sheet('HostApplications') && !sheet('HostPermissions'));
const b1 = post({ action: 'postBlessing', scene: 'temple', nickname: '小雲', content: '願大家今天都平平安安', clientId: 'c-one' });
ok('留言：任何人都可以留言（不需登入）', b1.ok && /^B\d+/.test(b1.id));
ok('留言：同一瀏覽器 60 秒內不能連續留言', post({ action: 'postBlessing', scene: 'temple', nickname: '小雲', content: '再一則', clientId: 'c-one' }).error === 'too_frequent');
ok('留言：只有 1 個字被拒', post({ action: 'postBlessing', scene: 'temple', nickname: 'A', content: '嗨', clientId: 'c-two' }).error === 'invalid');
ok('留言：空白內容被拒', post({ action: 'postBlessing', scene: 'temple', nickname: 'A', content: ' ', clientId: 'c-x' }).error === 'invalid');
ok('留言：缺少場景被拒', post({ action: 'postBlessing', scene: 'mars', nickname: 'A', content: '願平安', clientId: 'c-y' }).error === 'invalid');
const long = post({ action: 'postBlessing', scene: 'church', nickname: '晴天', content: '願'.repeat(80), clientId: 'c-three' });
ok('留言：超過 60 字自動截斷', long.ok && Array.from(sheet('BlessingWall').rows.at(-1)[3]).length === 60);
const inj = post({ action: 'postBlessing', scene: 'church', nickname: '=cmd', content: '=HYPERLINK("http://x")', clientId: 'c-four' });
ok('留言：試算表公式注入被中和', inj.ok && sheet('BlessingWall').raw.at(-1)[3].startsWith("'=") && sheet('BlessingWall').raw.at(-1)[2].startsWith("'="));
const html = post({ action: 'postBlessing', scene: 'church', nickname: '測試', content: '<img src=x onerror=alert(1)>願平安', clientId: 'c-five' });
ok('留言：HTML 標籤被移除', html.ok && !sheet('BlessingWall').rows.at(-1)[3].includes('<'));
ok('留言：以 GET 呼叫被拒', get({ action: 'postBlessing', scene: 'temple', content: 'x' }).error === 'method_not_allowed');
const tList = get({ action: 'getBlessings', scene: 'temple' }).blessings;
const cList = get({ action: 'getBlessings', scene: 'church' }).blessings;
ok('讀取：佛堂、教堂留言分開', tList.length === 1 && cList.length === 3, `temple=${tList.length} church=${cList.length}`);
ok('讀取：最新的留言排在最前面', cList[0].content.includes('願平安') && cList[0].nickname === '測試');
for (let i = 0; i < 25; i++) post({ action: 'postBlessing', scene: 'temple', nickname: 'n' + i, content: '洗版測試' + i, clientId: 'flood-' + i });
const floodRows = sheet('BlessingWall').rows.filter((r) => String(r[3]).startsWith('洗版測試')).length;
ok('防洗版：全站每分鐘最多 20 則', floodRows <= 20, `寫入 ${floodRows} 則`);

// 2. 管理後台：內容管理與權限
ok('後台：非管理員無法讀取', !!throws(() => stranger.getDashboard()));
ok('後台：非管理員看到未授權頁面', !!stranger.doGet().h);
ok('後台：管理員看得到留言', admin.getDashboard().blessings.length >= 4);
ok('後台：非管理員不能移除留言', !!throws(() => stranger.removeContent('BlessingWall', b1.id)));
admin.removeContent('BlessingWall', b1.id);
flush();
ok('後台：移除後玩家看不到該留言', !get({ action: 'getBlessings', scene: 'temple' }).blessings.some((b) => b.id === b1.id));
ok('後台：操作寫入 AdminLog', sheet('AdminLog').rows.length >= 2);
admin.updateSettings('blockedWords', '壞話,病歷號');
flush();
ok('禁用字：留言含禁用字被拒', post({ action: 'postBlessing', scene: 'temple', nickname: '甲', content: '我的病歷號是 123', clientId: 'c-six' }).error === 'blocked');
ok('禁用字：暱稱含禁用字無法進入房間', post({ action: 'joinRoom', roomId: 'temple-1', nickname: '說壞話的人', avatar }).error === 'bad_nickname');
ok('設定：不允許修改白名單外的鍵', !!throws(() => admin.updateSettings('ADMIN_EMAILS', 'x')));

// 3. 集體靜心邀請（任何人都可以）
const p1 = post({ action: 'joinRoom', roomId: 'temple-1', nickname: '小雲', avatar });
const p2 = post({ action: 'joinRoom', roomId: 'temple-1', nickname: '晴天', avatar });
ok('加入房間：不需金鑰或主持人身分', p1.ok && p2.ok && !('hostRole' in p1));
ok('邀請：用他人 token 無效', post({ action: 'sendInvitation', roomId: 'temple-1', playerId: p1.playerId, token: p2.token, minutes: 3 }).error === 'invalid_token');
ok('邀請：一般玩家即可發送', post({ action: 'sendInvitation', roomId: 'temple-1', playerId: p1.playerId, token: p1.token, minutes: 3 }).ok);
ok('邀請：同房間 5 分鐘內不能重複', post({ action: 'sendInvitation', roomId: 'temple-1', playerId: p2.playerId, token: p2.token, minutes: 1 }).error === 'cooldown');
cache.remove('t:' + p2.playerId);
const synced = post({ action: 'syncRoomState', roomId: 'temple-1', playerId: p2.playerId, token: p2.token, hb: true, sinceEvent: 0 });
ok('邀請：同房間玩家收到邀請事件', synced.events.some((e) => e.preset === 'invite' && e.minutes === 3 && e.from === p1.playerId));
ok('已移除：主持人申請 API', post({ action: 'submitHostApplication', nickname: 'x', scene: 'temple', requestedDate: today, introduction: 'xxxxxx' }).error === 'unknown_action');

// 4. 每日一句、公告
const mid = admin.publishDailyMessage('temple', today, '今天辛苦了，願你的心比昨天輕一點。', '心靈充電所');
admin.publishAnnouncement('all', '本週五 12:30 有三分鐘集體靜心', null, null);
flush();
ok('每日一句：公開 API 取得', get({ action: 'getDailyMessage', scene: 'temple' }).message?.content === '今天辛苦了，願你的心比昨天輕一點。');
ok('每日一句：其他場景看不到', get({ action: 'getDailyMessage', scene: 'church' }).message === null);
ok('公告：全部場景可見', get({ action: 'getAnnouncements', scene: 'church' }).announcements.length === 1);
admin.removeContent('DailyMessages', mid);
flush();
ok('每日一句：移除後不再顯示', get({ action: 'getDailyMessage', scene: 'temple' }).message === null);

// 5. 功能開關與房間
admin.updateSettings('multiplayerEnabled', 'false');
flush();
ok('設定：關閉多人同步', post({ action: 'joinRoom', roomId: 'temple-1', nickname: '訪客二', avatar }).error === 'disabled');
admin.updateSettings('multiplayerEnabled', 'true');
admin.updateRoom('church-1', false, 10);
flush();
ok('房間：停用後無法加入', post({ action: 'joinRoom', roomId: 'church-1', nickname: '訪客三', avatar }).error === 'room_not_found');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
