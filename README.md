# 心靈充電所｜Healing Sanctuary

> 世界有點吵，來這裡安靜一下。
> 今天辛苦了，為自己留一點喘息的時間。

給醫療院所行政與醫事同仁的 Q 版 3D 療癒山林世界：在山谷裡散步，走進**靜心佛堂**敲木魚、點平安燈、在蒲團上靜坐，或走進**平安教堂**在長椅坐下禱告、點祝福蠟燭、聽一段琴聲。
本站尊重不同信仰，也歡迎沒有信仰的人；所有互動皆為自願參與，不做績效、不排名。

- 預計網址：https://luyun1224.github.io/healing-sanctuary/ （需完成下方「部署」步驟後才會上線）
- 技術：React 18 · TypeScript · Vite 5 · Three.js · React Three Fiber · Drei · Tailwind CSS · Web Audio API · Hash Router · GitHub Pages / Actions
- 架構沿用自 [OSCE Island](https://github.com/Luyun1224/OSCE-island)（見 [docs/REUSE.md](docs/REUSE.md)），為全新獨立專案，未修改原專案。

## 目前進度

| 階段 | 內容 | 狀態 |
| --- | --- | --- |
| Phase 1 | 山谷入口、佛堂、教堂、Q 版角色建立、移動與碰撞、10 種動作、木魚、蒲團靜坐、平安燈、長椅禱告、祝福蠟燭、自然音效、晝夜、Pages 部署設定 | ✅ 已實作，測試紀錄見 [docs/TEST-PHASE1.md](docs/TEST-PHASE1.md) |
| Phase 2 | Google Sheets + GAS 多人同步 | ⏳ 未開始（設計方向見 [docs/ROADMAP.md](docs/ROADMAP.md)） |
| Phase 3 | 值日陪伴員、每日一句、公告、集體靜心邀請 | ⏳ 未開始 |
| Phase 4 | 煩惱寄放所、呼吸練習、心情、抽卡、小動物 | ⏳ 未開始 |

目前為**單人模式**：畫面左上角顯示「單人模式」，不顯示任何在線人數（不使用模擬數字）。

## 本機執行

需求：Node.js 18 以上（建議 22）

```bash
npm install
npm run dev        # http://localhost:5173/healing-sanctuary/
npm run build      # 型別檢查＋產出 dist/
npm run preview    # http://localhost:4173/healing-sanctuary/
```

## 部署到 GitHub Pages

1. 在 GitHub 建立 `healing-sanctuary` repository 並推送程式碼到 `main`。
2. Settings → Pages → **Source 選「GitHub Actions」**。
3. 推送到 `main`（或在 Actions 頁手動執行 *Deploy to GitHub Pages*），完成後網站位於 `https://luyun1224.github.io/healing-sanctuary/`。

`vite.config.ts` 的 `base` 固定為 `/healing-sanctuary/`；所有 3D 物件、貼圖與音效都在程式中即時產生，沒有外部模型或音檔需要載入。若 repository 改名，請同步修改 `base`。

## 操作說明

| | 桌機 | 手機／平板 |
| --- | --- | --- |
| 移動 | WASD／方向鍵，或點擊地面 | 左下虛擬搖桿，或點一下地面 |
| 鏡頭 | 滑鼠拖曳旋轉、滾輪縮放、Q／E 旋轉 | 單指拖曳旋轉、雙指縮放 |
| 互動 | 走近物件，下方出現互動面板 | 同左 |
| 動作 | 下方動作列：揮手、開心、鞠躬、合掌／禱告、坐下、靜坐／默禱 | 同左（只顯示圖示） |

**佛堂**：木魚（手動、每秒一次自動慢敲、停止、木魚音量；次數只存在本機）、佛像前合掌／鞠躬、蒲團靜坐（1／3／5／10 分鐘，可暫停、提前結束）、平安燈（逐盞由暗漸亮＋祝福語）、寺院鐘、木造涼亭、溪邊長椅、瀑布觀景、竹林。
**教堂**：8 張長椅（坐下、雙手交握禱告、閉眼默禱）、祭壇前禱告、祝福蠟燭、鋼琴角落（柔和鋼琴／管風琴和聲）、今日祝福看板、鐘樓、花園涼亭、噴水池、花園長椅。
**設定**：聲音預設關閉，右上角「開啟聲音」後才播放；總音量、自然音、背景音樂、互動音效、木魚音量、只聽自然音、細雨聲。時段可自動（依臺灣時間 Asia/Taipei：清晨／白天／黃昏／夜晚）或手動；畫質高／省電；減少動畫。

## 專案結構

```
src/
  config/scenes.ts        場景註冊表（佛堂、教堂；道觀保留但未啟用）
  data/                   角色外觀、暱稱、原創祝福語
  audio/engine.ts         Web Audio 合成音效引擎
  world/
    layouts/              場景配置資料（碰撞、地面高度、座位、互動點共用同一份資料）
    scenes/               佛堂、教堂、入口簡化模型
    env/                  天空晝夜、山脈、雲霧、溪流瀑布、植被（InstancedMesh＋GPU 風擺）、小動物
    character/Chibi.tsx   Q 版角色與程序化動畫
    Player.tsx            本機玩家控制、鏡頭跟隨、鄰近互動判定
    actions.ts            所有玩家動作（Phase 2 起由此串接同步）
  pages/                  首頁、角色建立、3D 世界
  ui/                     HUD、互動面板、動作列、計時器、搖桿、設定
```

新增第三個場景（例如祈福道觀）：在 `config/scenes.ts` 加入設定並設 `enabled: true`、在 `world/layouts/` 建立配置、在 `world/scenes/` 建立場景元件、在 `WorldCanvas.tsx` 註冊，並為 `data/avatar.ts` 增加對應服裝。

## 隱私

不需真實姓名或員工編號；角色、暱稱、設定、木魚次數只存在使用者瀏覽器（localStorage）。目前版本不傳送任何資料到伺服器。完整說明見首頁「隱私說明」。素材來源見 [docs/ASSETS.md](docs/ASSETS.md)。
