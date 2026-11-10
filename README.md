# YunBarter 校園技能交換平台

React / Vite 前端、Express API 與 PostgreSQL。後端的使用者、課程、時段、預約、鏈上交易備份及登入 Session 均存入 PostgreSQL，不再使用記憶體模擬資料庫。

## 啟動環境

- Node.js 24（目前使用的驗證環境）。
- 已啟動的 PostgreSQL，以及可連線的資料庫帳號。
- 註冊時需使用 MetaMask 連線並簽章綁定錢包；會員登入仍使用電子郵件及密碼。

## 後端與資料庫

1. 先建立空白 PostgreSQL 資料庫，例如在 pgAdmin 建立 `yunbarter`。已有資料庫可直接使用，遷移會保留既有資料。
2. 安裝依賴並設定環境：

   ```powershell
   cd yunbarter-backend
   npm install
   Copy-Item .env.example .env
   ```

3. 編輯 `yunbarter-backend/.env`，填入實際的 `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD`。也可改用 `DATABASE_URL`。`.env` 已被 Git 忽略，請勿提交密碼。
4. 執行資料庫遷移，再啟動 API：

   ```powershell
   npm run db:migrate
   npm start
   ```

   `db:migrate` 會在空白資料庫建立原有七張資料表，套用 `db/migrations`，新增登入 Session、個人資料及課程價格欄位，並將既有明碼密碼轉成加鹽 scrypt 雜湊。整個遷移使用資料庫交易，可重複執行；不會清空資料，也不會在登入時回退使用明碼比較。若既有帳號的信箱／錢包地址在大小寫正規化後重複，遷移會停止並回復，需先整理重複資料。

5. 檢查 `http://localhost:5000/api/health`，成功會回傳 `database: "postgresql"`。

API 啟動前會確認資料庫及 Session 資料表可用；連線失敗會明確停止，不會退回假資料。

## 選用的開發測試資料

完成遷移後，空白的開發資料庫可以執行：

```powershell
npm run db:seed
```

這個指令只接受空白資料庫；已有資料會停止，不會執行 TRUNCATE。正式環境禁止匯入。測試帳號為 `test@email.com`、`axian@email.com`、`link@email.com`，開發密碼皆為 `123456`，SQL 中已儲存為不同的 scrypt 雜湊。一般新註冊帳號密碼至少 8 個字元。

需要在已有資料的開發資料庫建立具備永久錢包綁定的測試帳號，可在後端執行 `npm run db:create-test-accounts`。它會先套用遷移，再建立 2 位學生、2 位老師與範例課程，每個帳號透過一次性簽章註冊、分別綁定獨立測試錢包。帳號工具不發放代幣或建立資料庫餘額；重跑不會重設密碼或既有排班。登入資料與 MetaMask 匯入用私鑰保存於已被 Git 忽略的 `.local-backups/test-accounts/accounts.json`；公開摘要在同目錄 `README.md`。測試錢包不含 Sepolia ETH 或 SKILL，此工具不會發送鏈上交易。

這次本機鏈驗收另提供 `blockchain` 中的 `npm run local:prepare`、`npm run local:node`，以及後端的 `npm run test:local-transactions`。它們只使用持久化的 Ganache 本機鏈（RPC `http://127.0.0.1:18545`、Chain ID `1337`），讓 4 個測試帳號各參與 2 筆課程交易並查驗付款、完課撥款、取消與爭議退款；結果與收據在 `.local-backups/chain-test/report.md` 和 `report.json`。完成後後端會切換至此本機鏈，錢包與預約管理頁會明確顯示網路。這不代表已完成 Sepolia 公開測試網驗收。

## 前端

另開終端機：

```powershell
cd yunbarter-app
npm install
npm run dev
```

預設網址為 `http://localhost:5173`。請使用與 API 相同的主機名稱，例如兩邊都使用 `localhost`，或兩邊都使用 `127.0.0.1`。開發時 API 預設使用目前前端主機的 5000 port，所有 API 請求會自動傳送登入 Cookie。

若前端使用其他網址或 port，請將完整來源加入後端 `.env` 的 `FRONTEND_ORIGINS`，以逗號分隔。正式部署建議將 `/api` 反向代理到後端並使用 HTTPS；設定後端 `NODE_ENV=production` 會啟用 Secure Cookie。若需要獨立 API 網址，可在前端 `.env.local` 設定 `VITE_API_BASE_URL`；前後端應部署於相同 site，才能使用目前的 SameSite=Lax Cookie。

## 區塊鏈程式碼

鏈上操作集中在獨立的 [blockchain.js](yunbarter-app/src/services/blockchain.js)，不依賴 React 或後端 API。其餘檔案分工如下：

| 檔案 | 用途 |
| --- | --- |
| `yunbarter-app/src/services/blockchain.js` | MetaMask 授權、Provider / Signer、帳戶與網路事件、代幣餘額、SKILL 託管付款與結算。 |
| `yunbarter-app/src/config/contracts.js` | ERC-20 ABI；餘額與付款使用後端提供的鏈與代幣地址。 |
| `yunbarter-app/src/context/WalletContext.jsx` | React 錢包狀態、登入後手動連線、登出時清除連線，以及呼叫後端同步地址。 |
| `yunbarter-app/src/context/walletState.js`、`yunbarter-app/src/hooks/useWallet.js` | 共用 Context 與讀取錢包狀態的 Hook；與 Provider 元件分檔。 |
| `yunbarter-app/src/hooks/useSkillTrade.js` | React 交易進度、執行中狀態。 |
| `file/SkillToken.sol` | ERC-20 智慧合約原始碼。 |
| `blockchain/contracts/SkillEscrow.sol` | SKILL 簽章報價、付款託管、完課撥款、取消、爭議退款與逾期領款合約。 |
| `blockchain/protocol.json` | 前後端共用的 EIP-712 型別及託管 ABI。 |
| `yunbarter-backend/chain.js` | 錢包持有者驗證、付款報價、鏈上收據查驗與資料庫同步。 |

新增前端 ethers 或 MetaMask 操作時，請放在 `services/blockchain.js`，頁面透過 Context / Hook 使用。所有新交易只使用鏈上 SKILL。餘額由 MetaMask Provider 直接讀取，資料庫沒有餘額欄位。後端驗證足夠確認深度的合約狀態、事件與收據後才同步預約，並備份完整收據、轉帳、授權及 Gas 費。舊 YTC 紀錄封存供查閱。SKILL 預設關閉，需先遷移資料庫、部署測試網託管合約並設定後端。完整操作見 [SKILL 交易與 Sepolia 部署](docs/SKILL-交易與部署.md)。

## 本次登入與權限規則

- 每個瀏覽器使用獨立的隨機 Session Token，Cookie 為 HttpOnly、SameSite=Lax；資料庫只儲存 Token 的 SHA-256 雜湊。有效期預設 168 小時，可用 `SESSION_TTL_HOURS` 調整。
- 登入會輪替目前瀏覽器的 Session；登出會撤銷該 Session。其他瀏覽器／使用者的 Session 不受影響。同一瀏覽器內的分頁會依標準 Cookie 行為共用目前登入帳號。
- 個人檔案、錢包與課程異動均驗證 Session，未登入回傳 401。
- 註冊按鈕會先要求 MetaMask 連線與簽章，再原子地建立帳號、綁定錢包及簽發 Session；取消、驗證失敗或錢包已被使用時不會建立帳號。
- 一個帳號只能永久綁定一個錢包，一個錢包只能綁一個帳號。驗證地址存在 `users.verified_wallet_address`，資料庫唯一索引及不可更換的觸發器共同限制；舊的未驗證 `wallet_address` 不作為綁定依據。
- 未綁定的既有帳號仍可登入，並在錢包頁補綁一次。錢包綁定不依賴 SKILL 付款啟用或合約部署；綁定後切換 MetaMask 帳戶不會換綁。
- 課程修改／下架只允許 `courses.teacher_id` 對應的擁有者，其他使用者回傳 403。仍有未結束預約的課程不能下架；下架保留歷史資料。
- 課程內容存在 `courses`，授課時段存在 `classes`，教師排班存在 `teacher_availability`。編輯課程不會改動其他老師，也不會改寫既有預約的名稱及成交金額快照。
- MetaMask 連線本身不會建立會員登入狀態，避免用未驗證的錢包地址冒充會員。簽章式 Web3 登入仍待後續整合。

## 預約、排班與內容同步

更新程式後，先在後端執行 `npm run db:migrate`，再重啟後端與前端。本次本機資料庫已完成遷移；其他開發環境也需要執行，不能只匯入基礎 `db/schema.sql`。

- `GET /api/bookings` 只回傳登入者作為學生或老師參與的預約。
- `POST /api/chain/quotes` 產生綁定學生、老師、時段及 SKILL 金額的報價。
- MetaMask 呼叫 `approve`、`fund` 完成授權與託管付款，再由 `POST /api/chain/payments/:id/sync` 核對鏈上結果。
- 取消、完課撥款、爭議、退款及逾期領款都呼叫託管合約；舊點數異動 API 回傳 410。
- `GET /api/chain/transactions` 讀取已確認交易備份並同步錢包事件。RPC 暫停時仍可查看已備份紀錄。
- `POST /api/chain/transactions/sync` 只接受交易雜湊提示，由後端自行驗證收據，不能用客戶端金額宣告付款。
- `npm run db:sync-chain` 補齊既有付款的所有階段（含爭議）及錢包授權／轉帳紀錄，可重複執行。
- 個人頁可儲存排班與編輯課名、價格、課程說明；已預約的時段不能刪除。空白排班代表暫不接受預約。
- 操作成功後重新讀取相關資料；預約列表及錢包／課程在切回視窗、操作後、可見期間每 15 秒更新，跨瀏覽器變更也會被讀取。

課程價格與交易金額保留在資料庫，剩餘 SKILL／ETH 只存在鏈上。遷移 006 會移除 `users.cached_points`，將 `point_transactions` 改為唯讀用途的 `legacy_point_transactions`，並封存舊 YTC 預約。時間規則採 `Asia/Taipei`，目前固定為早上 09:00–10:00、下午 14:00–15:00、晚上 19:00–20:00。

驗證與資料檢查（完整整合測試也需先在 `blockchain` 執行 `npm ci` 安裝本機鏈與編譯器）：

```powershell
npm test
npm run test:integration
npm run db:audit
```

整合測試僅使用隨機命名的獨立測試 schema，結束後移除，不會覆蓋既有資料。`db:audit` 是唯讀檢查，顯示帳務差額、舊資料缺漏、過期 Session 及資料表容量。詳細結構與尚待處理的儲存問題見 [資料庫結構檢查與同步](docs/資料庫結構檢查與同步.md)。
