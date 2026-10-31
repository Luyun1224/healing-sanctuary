/**
 * 兩個瀏覽器的多人同步驗收測試（Playwright）
 * 先啟動：node tools/gas-emulator.mjs --latency 300
 *        VITE_GAS_URL=http://localhost:8787/exec npm run dev
 * 再執行：node tools/e2e-multiplayer.cjs
 * 驗證：互相看見、位置與坐下／敲木魚同步、預設互動泡泡、正常離開清除、異常斷線逾時移除、斷線時不崩潰。
 */
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:5173/healing-sanctuary/';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const shots = process.env.SHOTS || '/tmp';

async function open(browser, nick, avatar) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(nick, 'pageerror', e.message));
  await page.goto(base + '#/');
  await page.evaluate(
    ([nick, avatar]) => {
      localStorage.setItem('healing-sanctuary:profile:temple', JSON.stringify({ nickname: nick, avatar }));
      localStorage.setItem('healing-sanctuary:ui', JSON.stringify({ helpSeen: true }));
      localStorage.setItem('healing-sanctuary:settings', JSON.stringify({ quality: 'low' }));
    },
    [nick, avatar],
  );
  await page.goto(base + '#/world/temple');
  return { ctx, page };
}

const net = (page) =>
  page.evaluate(() => {
    if (!window.__net) return { status: 'loading', online: 0, ids: 0, remotes: [] };
    const n = window.__net.netStore.get();
    return {
      status: n.status,
      online: n.online,
      ids: n.ids.length,
      remotes: [...window.__net.remotes.values()].map((r) => ({ n: r.nickname, x: +r.target.x.toFixed(1), z: +r.target.z.toFixed(1), a: r.anim, q: r.seated })),
    };
  });

async function waitFor(page, fn, ms = 30000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const s = await net(page);
    if (fn(s)) return { ...s, ok: true, sec: +((Date.now() - t) / 1000).toFixed(1) };
    await page.waitForTimeout(500);
  }
  return { ...(await net(page)), ok: false, sec: +((Date.now() - t) / 1000).toFixed(1) };
}

const monk = (skin, primary, style) => ({ wardrobe: 'monk', skin, expression: 'smile', primary, secondary: '#b8462e', monkStyle: style, outfit: 'knit', hair: 'short', hairColor: '#4a3427' });

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const A = await open(browser, '小小雲朵', monk('#f6d1ad', '#d99a4e', 'beads'));
  const B = await open(browser, '平安就好', monk('#c98f66', '#7f8a6a', 'sash'));

  log('1. A sees B:', JSON.stringify(await waitFor(A.page, (s) => s.online === 2 && s.ids === 1)));
  log('   B sees A:', JSON.stringify(await waitFor(B.page, (s) => s.online === 2 && s.ids === 1)));

  await B.page.evaluate(() => window.__hs.player.pos.set(-2.8, 0.5, -7.6));
  await B.page.waitForTimeout(800);
  await B.page.click('button:has-text("敲木魚")');
  log('2/3. A sees B at wooden fish:', JSON.stringify(await waitFor(A.page, (s) => s.remotes[0] && s.remotes[0].a === 'fishDrum' && s.remotes[0].x < -2)));

  await B.page.evaluate(() => {
    window.__hs.worldStore.set({ seat: null, baseAnim: 'idle', fishAuto: false });
    window.__hs.player.pos.set(1.1, 0.5, -6.1);
  });
  await B.page.waitForTimeout(800);
  await B.page.click('button:has-text("坐上蒲團")');
  log('3. A sees B meditating on cushion:', JSON.stringify(await waitFor(A.page, (s) => s.remotes[0] && s.remotes[0].a === 'meditate' && s.remotes[0].q === 'm')));

  await A.page.evaluate(() => window.__hs.player.pos.set(0.4, 0.5, -5.2));
  await A.page.waitForTimeout(6000);
  await A.page.screenshot({ path: `${shots}/multi-A.png` });

  await A.page.click('button[aria-label="打招呼"]');
  await A.page.click('button:has-text("願你平安。")');
  let t0 = Date.now();
  let bubble = false;
  while (Date.now() - t0 < 25000 && !bubble) {
    bubble = await B.page.evaluate(() => window.__net.netStore.get().bubbles.some((b) => b.playerId !== 'self'));
    if (!bubble) await B.page.waitForTimeout(400);
  }
  log(`   greeting bubble received by B: ${bubble} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  await B.page.screenshot({ path: `${shots}/multi-B.png` });

  await B.page.click('button[aria-label="返回首頁"]');
  log('4. B left normally, A sees:', JSON.stringify(await waitFor(A.page, (s) => s.online === 1 && s.ids === 0)));

  await B.page.goto(base + '#/world/temple');
  await waitFor(A.page, (s) => s.online === 2);
  log('   B rejoined; cutting B network (simulated crash, no leave request)');
  await B.ctx.route('**/exec', (r) => r.abort());
  log('5. A after B crash:', JSON.stringify(await waitFor(A.page, (s) => s.online === 1 && s.ids === 0, 180000)));
  log('9/10. B while offline:', JSON.stringify(await net(B.page)));
  // 斷線中仍可使用單人功能
  await B.page.evaluate(() => {
    window.__hs.worldStore.set({ seat: null, baseAnim: 'idle' });
    window.__hs.player.pos.set(-2.8, 0.5, -7.6);
  });
  await B.page.waitForTimeout(800);
  await B.page.click('button:has-text("敲木魚")');
  log('   B solo wooden fish while offline, count =', await B.page.evaluate(() => window.__hs.worldStore.get().fishCount));
  await B.page.screenshot({ path: `${shots}/multi-B-offline.png` });
  await browser.close();
})();
