// 互動煙霧測試（需先執行 npm run dev）。用法：node scripts/e2e-interactions.cjs temple '[{"tp":[-2.8,-7.6]},{"click":"敲木魚"}]'
// 透過開發模式的 window.__hs 傳送玩家位置，點擊互動面板按鈕並截圖。
const { chromium } = require('playwright');
(async () => {
  const scene = process.argv[2] || 'temple';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  const base = 'http://localhost:5173/healing-sanctuary/';
  await page.goto(base + '#/create/' + scene);
  await page.waitForTimeout(3000);
  await page.fill('input[aria-label="暱稱"]', '平安就好');
  await page.click('button.btn-primary');
  await page.waitForTimeout(6000);
  const close = page.locator('text=開始散步'); if (await close.count()) await close.click();
  const tp = async (x, z) => { await page.evaluate(([x, z]) => { const w = window.__hs.worldStore; w.set({ seat: null, baseAnim: "idle", fishAuto: false, meditation: null }); window.__hs.player.pos.set(x, 0.5, z); }, [x, z]); await page.waitForTimeout(1500); };
  const steps = JSON.parse(process.argv[3]);
  let i = 0;
  for (const st of steps) {
    if (st.tp) await tp(st.tp[0], st.tp[1]);
    if (st.click) { await page.click(`button:has-text("${st.click}")`); await page.waitForTimeout(st.wait || 1500); }
    if (st.eval) console.log(await page.evaluate(st.eval));
    if (st.shot) await page.screenshot({ path: `${scene}-i${i++}.png` });
  }
  await browser.close();
})();
