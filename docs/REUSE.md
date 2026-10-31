# 從 OSCE Island 沿用與調整的部分

檢查 https://github.com/Luyun1224/OSCE-island 原始碼（README、package.json、vite.config.ts、.github/workflows/deploy.yml、src/router.ts、src/components/scene/*、src/audio/islandMusic.ts）後的整理：

| OSCE Island | 本專案 |
| --- | --- |
| 相同版本組合：React 18.3.1、three 0.169、@react-three/fiber 8.17.10、@react-three/drei 9.117.3、Vite 5.4、Tailwind 3.4、TypeScript 5.6 | 沿用（已證實可部署） |
| `src/router.ts` 輕量 hash 路由（`navigate`、`useHashPath`、`matchPath`） | 原樣沿用 |
| `vite.config.ts` 使用 `base: './'` | 依需求改為 `base: '/healing-sanctuary/'` |
| `.github/workflows/deploy.yml`（Node 22、npm ci、upload-pages-artifact、deploy-pages） | 沿用，移除瀏覽次數 API 檢查，加入 404.html |
| `components/scene/primitives.tsx` 低多邊形元件（Box、Cyl、Cone、Ball、GableRoof…） | 改寫為 `world/env/prims.tsx`，新增四坡屋頂、柔光精靈 |
| `components/scene/timeOfDay.tsx` 白天／深夜 SkyRig（顏色 lerp、月亮、Stars、Sparkles） | 擴充為清晨／白天／黃昏／夜晚四時段，加上漸層天空著色器、依臺灣時區自動切換 |
| `components/scene/CameraControls.tsx`（OrbitControls＋阻尼飛行） | 改為跟隨玩家的第三人稱鏡頭 |
| `audio/islandMusic.ts` Web Audio 合成音樂排程 | 擴充為多匯流排音效引擎（自然音、音樂、互動音效、木魚） |
| `lib/practiceLog.ts` 以 `no-cors` sendBeacon 傳送到 GAS | **不沿用**：`no-cors` 無法讀取回應，不適合多人同步；Phase 2 另行設計 |
