/**
 * Phase 3＋4 瀏覽器驗收測試（Playwright）
 * 先啟動：node tools/gas-emulator.mjs --latency 300
 *        VITE_GAS_URL=http://localhost:8787/exec npm run dev
 * 再執行：SHOTS=/tmp node tools/e2e-phase34.cjs
 */
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:5173/healing-sanctuary/';
const emu = process.env.EMU_URL || 'http://localhost:8787';
const shots = process.env.SHOTS || '/tmp';
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
};
const admin = async (fn, ...args) => (await fetch(`${emu}/__admin?fn=${fn}&args=${encodeURIComponent(JSON.stringify(args))}`)).json();

async function open(browser, nick) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(nick, 'pageerror', e.message));
  await page.goto(base + '#/');
  await page.evaluate((nick) => {
    localStorage.setItem('healing-sanctuary:profile:temple', JSON.stringify({ nickname: nick, avatar: { wardrobe: 'monk', primary: '#9b8fb0' } }));
    localStorage.setItem('healing-sanctuary:ui', JSON.stringify({ helpSeen: true }));
    localStorage.setItem('healing-sanctuary:settings', JSON.stringify({ quality: 'low', timeMode: 'day' }));
  }, nick);
  await page.goto(base + '#/world/temple');
  await page.waitForFunction(() => window.__net && window.__net.netStore.get().status === 'online', null, { timeout: 30000 });
  return { ctx, page };
}
const tp = (page, x, z) =>
  page.evaluate(([x, z]) => {
    window.__hs.worldStore.set({ seat: null, baseAnim: 'idle', walking: false, moveTarget: null });
    window.__hs.player.pos.set(x, 0, z);
  }, [x, z]);
const ws = (page, fn) => page.evaluate(`(${fn})(window.__hs.worldStore.get())`);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const A = await open(browser, '小雲');
  const B = await open(browser, '晴天');
  const pa = A.page;

  // ---------- Phase 4：山林探索 ----------
  await tp(pa, 4.4, 15.4);
  await pa.waitForTimeout(800);
  await pa.click('button:has-text("摸摸貓咪")');
  await pa.waitForTimeout(900);
  ok('貓咪：摸摸後觸發呼嚕動畫與愛心', (await ws(pa, (s) => performance.now() - s.catPetAt < 3000)) && (await pa.locator('.hearts').count()) > 0);
  await pa.screenshot({ path: `${shots}/p4-cat.png` });

  await tp(pa, 13.3, 16);
  await pa.waitForTimeout(800);
  await pa.click('button:has-text("撒飼料餵魚")');
  await pa.waitForTimeout(3500);
  ok('魚池：餵食後魚群游向飼料', await ws(pa, (s) => performance.now() - s.pondFeedAt < 6000));
  await pa.screenshot({ path: `${shots}/p4-pond.png` });

  await tp(pa, -17.4, 5.8);
  await pa.waitForTimeout(800);
  await pa.click('button:has-text("願家人平安健康")');
  await pa.click('button:has-text("願睡個好覺")');
  await pa.waitForTimeout(800);
  ok('祈願樹：掛上兩條祝福', (await ws(pa, (s) => s.wishes.length)) === 2);
  await pa.screenshot({ path: `${shots}/p4-tree.png` });

  await tp(pa, 2.4, 6.1);
  await pa.waitForTimeout(800);
  await pa.click('button:has-text("欣賞蝴蝶")');
  await pa.waitForTimeout(2500);
  ok('花圃：蝴蝶飛來環繞', await ws(pa, (s) => performance.now() - s.butterflyAt < 5000));
  await pa.screenshot({ path: `${shots}/p4-butterfly.png` });

  // 療癒選單
  await pa.click('button[aria-label="療癒小角落"]');
  await pa.click('button:has-text("煩惱寄放所")');
  await pa.fill('textarea', '報告還沒寫完');
  await pa.click('button:has-text("讓煩惱隨風離開")');
  await pa.waitForTimeout(2500);
  ok('煩惱寄放所：樹葉帶著文字飄走', (await pa.locator('text=報告還沒寫完').count()) > 0);
  await pa.screenshot({ path: `${shots}/p4-worry.png` });
  await pa.waitForTimeout(6000);
  ok('煩惱寄放所：結束後文字清除並顯示安慰語', (await ws(pa, (s) => s.leaves.length)) === 0 && (await pa.locator('text=這件事情，現在可以先放一放。').count()) > 0);
  ok('煩惱寄放所：內容未存入 localStorage', !(await pa.evaluate(() => JSON.stringify(localStorage))).includes('報告還沒寫完'));

  await pa.click('button[aria-label="療癒小角落"]');
  await pa.click('button:has-text("今日溫暖小語")');
  await pa.click('button:has-text("抽一張")');
  await pa.waitForTimeout(1200);
  ok('抽卡：翻出一張小語', (await pa.locator('.card-flip').count()) === 1);
  await pa.screenshot({ path: `${shots}/p4-card.png` });
  await pa.click('button:has-text("關閉")');

  await pa.click('button[aria-label="療癒小角落"]');
  await pa.click('button:has-text("今日心情")');
  await pa.click('button:has-text("有點疲憊")');
  ok('今日心情：顯示溫柔回應', (await pa.locator('text=辛苦了。坐下來').count()) > 0);
  await pa.click('button:has-text("做個呼吸練習")');
  await pa.waitForTimeout(2500);
  ok('呼吸練習：圓環與倒數顯示', (await pa.locator('text=/吸氣|吐氣|停留/').count()) > 0);
  await pa.screenshot({ path: `${shots}/p4-breath.png` });
  await pa.click('button:has-text("暫停")');
  ok('呼吸練習：可暫停', (await pa.locator('text=暫停中').count()) > 0);
  await pa.click('button:has-text("提前結束")');

  await tp(pa, 0, 19.5);
  await pa.waitForTimeout(500);
  await pa.click('button[aria-label="療癒小角落"]');
  await pa.click('button:has-text("沿著小徑散步")');
  const start = await pa.evaluate(() => ({ x: window.__hs.player.pos.x, z: window.__hs.player.pos.z }));
  await pa.waitForTimeout(15000);
  const walk = await pa.evaluate(() => ({ x: window.__hs.player.pos.x, z: window.__hs.player.pos.z, i: window.__hs.worldStore.get().walkIdx, on: window.__hs.worldStore.get().walking }));
  ok('沿著小徑散步：自動移動並前往下一路點', walk.on && Math.hypot(walk.x - start.x, walk.z - start.z) > 2, JSON.stringify(walk));
  await pa.keyboard.down('s');
  await pa.waitForTimeout(400);
  await pa.keyboard.up('s');
  ok('沿著小徑散步：按方向鍵即停止', !(await ws(pa, (s) => s.walking)));

  // ---------- Phase 3：值日陪伴員 ----------
  await pa.click('button[aria-label="療癒小角落"]');
  await pa.click('button:has-text("申請成為值日陪伴員")');
  await pa.fill('textarea', '我是護理站的小雲，想陪大家休息');
  await pa.click('button:has-text("送出申請")');
  await pa.waitForSelector('text=申請已送出', { timeout: 15000 });
  const dash = await admin('getDashboard');
  const app = dash.result.applications.find((a) => a.Nickname === '小雲');
  ok('申請：寫入 HostApplications', !!app && app.Status === 'pending');
  await pa.click('button:has-text("關閉")');
  const approved = await admin('approveHost', app.ApplicationID, '值日陪伴員', 'nurse@hospital.test', false);
  ok('管理員核准並取得金鑰', approved.ok && approved.result.hostKey.length === 36);
  await admin('publishDailyMessage', 'all', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date()), '今天辛苦了，願你的心比昨天輕一點。', '值日陪伴員 小雲');
  await admin('publishAnnouncement', 'temple', '週五 12:30 一起三分鐘靜心', null, null);

  await pa.click('button[aria-label="療癒小角落"]');
  await pa.click('button:has-text("主持人登入")');
  await pa.fill('input[placeholder^="xxxx"]', approved.result.hostKey);
  await pa.click('button:has-text("登入")');
  await pa.waitForFunction(() => window.__net.netStore.get().hostRole === '值日陪伴員', null, { timeout: 30000 }).catch(() => {});
  ok('主持人登入：取得值日陪伴員身分', (await pa.evaluate(() => window.__net.netStore.get().hostRole)) === '值日陪伴員');
  ok('主持人登入：金鑰只存在 sessionStorage', !(await pa.evaluate(() => JSON.stringify(localStorage))).includes(approved.result.hostKey));

  // B 看見主持人身分、每日一句與公告（公開快取最多 60 秒）
  await B.page.waitForFunction(() => [...window.__net.remotes.values()].some((r) => r.role === '值日陪伴員'), null, { timeout: 30000 }).catch(() => {});
  ok('其他人看見主持人名牌', await B.page.evaluate(() => [...window.__net.remotes.values()].some((r) => r.role === '值日陪伴員')));
  await B.page.reload();
  await B.page.waitForFunction(() => window.__net && window.__net.netStore.get().daily, null, { timeout: 70000 }).catch(() => {});
  ok('每日一句：顯示主持人發布的內容', (await B.page.locator('text=今天辛苦了，願你的心比昨天輕一點。').count()) > 0);
  ok('主持人公告：顯示在右下角', (await B.page.locator('text=週五 12:30 一起三分鐘靜心').count()) > 0);

  // 集體靜心邀請
  await B.page.waitForFunction(() => window.__net.netStore.get().status === 'online' && window.__net.netStore.get().ids.length > 0, null, { timeout: 30000 });
  await pa.click('button[aria-label="療癒小角落"]');
  await pa.click('button:has-text("主持人工具")');
  await pa.click('button:has-text("3 分鐘")');
  await B.page.waitForSelector('text=3 分鐘靜心即將開始', { timeout: 30000 }).catch(() => {});
  ok('其他人收到集體靜心邀請（可自由選擇）', (await B.page.locator('text=這次先不用').count()) > 0);
  await B.page.screenshot({ path: `${shots}/p3-invite.png` });
  await B.page.click('button:has-text("一起參加")');
  await B.page.waitForTimeout(1500);
  ok('參加後顯示呼吸圓環（等待開始倒數）', (await B.page.locator('text=/秒後開始|吸氣/').count()) > 0);
  await B.page.screenshot({ path: `${shots}/p3-joined.png` });

  // 停用後失效
  await admin('disableHost', approved.result.hostId);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
