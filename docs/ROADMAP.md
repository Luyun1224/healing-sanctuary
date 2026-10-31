# 後續階段設計方向（尚未實作）

以下為後續階段的規劃，**尚未實作、未測試**。

## Phase 2：Google Sheets + Apps Script 多人同步

已實作，見 [GAS-SETUP.md](GAS-SETUP.md) 與 [TEST-PHASE2.md](TEST-PHASE2.md)。待辦：正式 GAS 部署後的 CORS 驗證與 5／10／25 人實測。

## Phase 3：值日陪伴員

- 申請表寫入 `HostApplications`；管理後台使用**受 Google 帳號限制的獨立 GAS Web App**（以 `Session.getActiveUser()` 於伺服器端比對管理員名單），不在前端放任何密碼。

## Phase 4：療癒功能

煩惱寄放所（不上傳）、呼吸練習、今日心情（僅本機）、50 則以上溫暖小語抽卡、貓咪／魚池／祈願樹、天氣擴充。
