# Google Sheets + Apps Script 多人同步：部署與授權設定

> 不設定也可以使用：未設定 `GAS_URL` 時網站自動以「單人模式」運作。

## 1. 建立試算表與後端

1. 用**機構指定的 Google 帳號**建立新的 Google 試算表，例如「心靈充電所資料庫」。
2. 試算表選單 → 擴充功能 → Apps Script。
3. 刪除預設的 `Code.gs` 內容，貼上本 repo 的 [`gas/Code.gs`](../gas/Code.gs) 全文並儲存。
4. 在編輯器上方函式選單選 `setup` → 執行。第一次會要求授權（試算表存取），同意即可。
   完成後試算表會出現 `Rooms`、`HostApplications`、`HostPermissions`、`DailyMessages`、`Announcements`、`Settings`、`ActivitySummary` 七個工作表，並建立預設房間 `temple-1`、`church-1`（每房上限 25 人）。

## 2. 部署為網頁應用程式

1. 右上角「部署」→「新增部署作業」→ 類型選「網頁應用程式」。
2. 設定：
   - **執行身分：我**（以建立者身分讀寫試算表與快取）
   - **誰可以存取：任何人**（訪客不需登入；GitHub Pages 前端以匿名方式呼叫）
3. 部署後複製網址（`https://script.google.com/macros/s/…/exec`）。
4. 之後修改 `Code.gs` 時，請用「管理部署作業」→ 編輯 → 版本選「新版本」，網址才會維持不變。

> 機構的 Google Workspace 管理員可能限制「任何人」存取；若無法選擇，請洽資訊單位。

## 3. 讓前端使用這個網址

GitHub repo → Settings → Secrets and variables → Actions → **Variables** → New repository variable：

- Name：`GAS_URL`
- Value：上一步的 `/exec` 網址

接著重新執行 Actions 的 *Deploy to GitHub Pages*（或推送任何變更）。左上角會從「單人模式」變成「在線 N 人」。

（網址不是密鑰：它本來就會出現在前端程式中。安全性依靠伺服器端驗證，而不是隱藏網址。）

## 4. 上線前請先做的檢查

1. **跨網域讀取**：部署後在網站上按 F12 開啟主控台，執行
   ```js
   fetch('你的 /exec 網址', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'getRooms' }) }).then(r => r.json()).then(console.log)
   ```
   應看到 `{ ok: true, rooms: [...] }`。Apps Script 會先 302 轉址到 `script.googleusercontent.com`，該網域回應帶有 `Access-Control-Allow-Origin: *`，瀏覽器可讀取。**這一步只能在真正部署後驗證**，目前的測試都在本機模擬器上完成。
2. **實際負載測試**（建議下班時段、先告知管理者）：
   ```bash
   node tools/load-test.mjs --url '你的 /exec 網址' --clients 25 --duration 180
   ```
   把輸出結果貼到 `docs/TEST-PHASE2.md` 的「正式環境」欄位。

## 5. 調整參數

在 `Settings` 工作表修改（約 60 秒後生效）：

| Key | 預設 | 說明 |
| --- | --- | --- |
| `multiplayerEnabled` | true | 多人同步總開關；false 時所有人回到單人模式 |
| `interactionsEnabled` | true | 揮手、祝福泡泡等預設互動開關 |
| `baseSyncMs` | 6000 | 基本輪詢間隔（5000–10000） |
| `maxSyncMs` | 10000 | 人數多時的輪詢上限；每多 5 人增加 1 秒 |

在 `Rooms` 工作表新增房間（例如 `temple-2`），前端在第一個房間額滿時會自動嘗試同場景的下一個房間。

## 安全邊界（請務必理解）

| 可以做到 | 做不到 |
| --- | --- |
| 每位玩家只能用自己的隨機憑證（token）更新自己的狀態，無法覆寫他人 | **無法確認玩家是誰**：匿名訪客的 ID 與 token 都由瀏覽器保存，不是身分驗證 |
| 位置、動作、外觀、暱稱都在伺服器端驗證與過濾；寫入操作只接受 POST | 無法依 IP 限流（Apps Script 取不到用戶端 IP），只能依玩家 token 節流 |
| 同一玩家同步間隔至少 2.5 秒；互動冷卻 8 秒；房間人數上限 | 有人刻意大量建立新玩家時，只能由房間上限與管理員關閉開關因應 |
| 高頻位置只存在快取，不寫入試算表 | CacheService 不保證保存，資料可能提前消失（已設計自動復原） |

管理員功能（審核主持人、發布公告）屬於 Phase 3，將使用**另一個限制 Google 帳號登入的 Apps Script 網頁應用程式**，於伺服器端以 `Session.getActiveUser()` 比對管理員名單，不在前端放任何密碼。

## Apps Script 限制

- 每次請求都是一次 Apps Script 執行，常見回應時間約 0.5–2 秒（實際依 Google 負載而定，需以正式環境測試確認）。
- 帳號有每日執行時間與同時執行數等配額（依 Google 帳號類型不同）。25 人、每 6–10 秒一次，約每秒 3 次請求。
- 這不是即時遊戲伺服器：其他人的位置會延遲數秒，畫面上以平滑移動補間。
