# 後續階段設計方向（尚未實作）

以下為 Phase 2–4 的規劃，**皆未實作、未測試**。

## Phase 2：Google Sheets + Apps Script 多人同步

- 同步模式：本機即時移動＋每 5–10 秒合併請求（位置、動作、心跳、讀取房間狀態）＋遠端插值；超過 60–90 秒無心跳視為離線；資料逾期時停止推測遠端行走。
- 在線狀態存 CacheService（每位玩家一個 key，房間索引另存），LockService 保護索引更新；Sheets 只放房間、主持人、公告、設定，不寫入高頻位置。
- 身分邊界：訪客 ID 無法提供可信身分。計畫在 `joinRoom` 由伺服器發放隨機能力憑證（token），之後只有持有 token 的請求可更新該玩家狀態；這只能防止「任意覆寫他人狀態」，**不能證明使用者是誰**。
- 跨網域：需實際驗證 GAS Web App 的 `ContentService` 回應經 302 轉址到 `script.googleusercontent.com` 後，瀏覽器能否以 `fetch`（`Content-Type: text/plain`、避免預檢）讀取回應。驗證結果與限制將寫入測試報告；不使用 `no-cors`，不以 JSONP 處理寫入。
- 前端整合點：`src/world/actions.ts`（所有動作集中處）與 `src/world/worldStore.ts` 的 `player` 狀態。
- 驗收：兩個瀏覽器互見、位置與坐下／敲木魚同步、正常離開與逾時移除、5／10／25 人實測紀錄、斷線不崩潰。

## Phase 3：值日陪伴員

- 申請表寫入 `HostApplications`；管理後台使用**受 Google 帳號限制的獨立 GAS Web App**（以 `Session.getActiveUser()` 於伺服器端比對管理員名單），不在前端放任何密碼。

## Phase 4：療癒功能

煩惱寄放所（不上傳）、呼吸練習、今日心情（僅本機）、50 則以上溫暖小語抽卡、貓咪／魚池／祈願樹、天氣擴充。
