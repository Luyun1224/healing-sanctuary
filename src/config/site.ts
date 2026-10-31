/**
 * 多人同步 API（Google Apps Script 網頁應用程式網址）。
 * 這不是密鑰：網址本來就會出現在前端程式中，安全性依靠伺服器端驗證。
 * 優先使用建置時的 VITE_GAS_URL（GitHub repo Variables → GAS_URL）；設為 "off" 可停用多人同步。
 */
export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzlTGj3QbRP6Fu8pIYjB2j1xmjblgvzZU_VH1px5JML0Fa1UzaZ8ycz8fIiaYfAO4wg/exec';
