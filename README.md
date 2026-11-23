# YunBarter 校園技能交換平台

YunBarter 讓校園成員發佈技能課程、安排授課時段，也能選課、預約和在課後留下評價。前端使用 React / Vite，後端使用 Express 與 PostgreSQL，課程付款使用 Ethereum Sepolia 上的 SKILL 託管合約。

## 快速開始

準備 Node.js 24 和可連線的 PostgreSQL。首次啟動前，先建立 `yunbarter` 資料庫。已有開發資料庫時，可直接使用該資料庫。需要 pgAdmin 操作步驟時，請參考 [PostgreSQL 初次使用](docs/PostgreSQL-初次使用.md)。

### 1. 啟動後端

在專案根目錄開啟 PowerShell。

```powershell
cd yunbarter-backend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

編輯 `yunbarter-backend/.env`，填寫 `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD`，或改填 `DATABASE_URL`。專案以 `DATABASE_URL` 優先，連線憑證留在本機 `.env`。

```powershell
npm run db:migrate
npm start
```

遷移會建立或更新資料表並保留既有資料。開啟 [API 健康檢查](http://localhost:5000/api/health)，確認回傳 `"status":"ok"` 與 `"database":"postgresql"`。

### 2. 啟動前端

另開一個 PowerShell，在專案根目錄執行以下指令。

```powershell
cd yunbarter-app
npm install
npm run dev
```

開啟 [前端首頁](http://localhost:5173)。前端與 API 請使用同一個主機名稱，例如都使用 `localhost`，讓登入 Cookie 能正常運作。

## 開發與展示

| 操作 | 後端指令或設定 |
| --- | --- |
| 在空白開發庫匯入範例會員與課程 | 完成遷移後執行 `npm run db:seed`。 |
| 建立四個具備獨立綁定錢包的固定測試帳號 | 執行 `npm run db:create-test-accounts`。測試帳號與錢包備份位於 `.local-backups/test-accounts/accounts.json`。 |
| 使用本機的展示帳號 | 在 `.local-backups/test-accounts/README.md` 查看清單，在 `accounts.json` 的 `users` 查看完整資料。這份本機備份由 Git 忽略。 |

新會員註冊時以 MetaMask 簽章永久綁定錢包，之後使用電子郵件與密碼登入。若要驗證付款，需設定 Sepolia 合約與 RPC，並準備 SKILL 以及支付 Gas 的 Sepolia ETH。設定步驟見 [SKILL 鏈上交易與部署](docs/SKILL-交易與部署.md)。

## 常用驗證指令

| 目錄 | 指令 | 用途 |
| --- | --- | --- |
| `yunbarter-backend` | `npm test` | 密碼、Session 與 API 存取驗證 |
| `yunbarter-backend` | `npm run test:integration` | 使用獨立 PostgreSQL schema 與本機測試鏈驗證流程 |
| `yunbarter-backend` | `npm run db:audit` | 唯讀檢查資料庫 |
| `yunbarter-app` | `npm run lint`、`npm run build` | 檢查程式碼與建置前端 |

執行後端整合測試前，先在 `blockchain` 執行 `npm ci`。專案更新後若有新遷移，請先執行 `npm run db:migrate` 再重啟後端。

## 延伸文件

| 文件 | 內容 |
| --- | --- |
| [PostgreSQL 初次使用](docs/PostgreSQL-初次使用.md) | 建立本機資料庫、設定 pgAdmin 與檢查資料 |
| [開發與維運](docs/開發與維運.md) | 團隊共用資料庫、前端部署、登入與預約規則 |
| [SKILL 鏈上交易與部署](docs/SKILL-交易與部署.md) | Sepolia 設定、付款流程、鏈上驗證與排錯 |
| [資料庫結構檢查與同步](docs/資料庫結構檢查與同步.md) | 遷移 002、003 的結構與歷史資料檢查 |
