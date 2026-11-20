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

## 團隊共用資料庫

若要讓大家使用同一批課程、會員和預約，讓每位組員的 Express 後端連到同一座 PostgreSQL 開發庫。GitHub 用來同步程式、`db/migrations/` 和 `db/seed.sql`。請將連線憑證留在各自的 `yunbarter-backend/.env`，資料庫備份留在 `.local-backups/`。

### 雲端共用開發庫

1. 建立獨立的 PostgreSQL 開發庫，例如以 Neon Free 建立 `yunbarter_team` 專案，資料庫名稱以 Neon Connect 畫面為準。由資料庫負責人用管理帳號執行 `npm run db:migrate`，需要範例時，對空庫執行一次 `npm run db:seed`。[Neon Free 方案與用量限制](https://neon.com/pricing)
2. 從服務商取得啟用 TLS 的連線字串，透過私下管道發給有權限的組員。團隊可為每位組員建立獨立的登入角色，日常執行後端使用可讀寫專案資料的角色，遷移由資料表擁有者執行。
3. 每位組員在 `yunbarter-backend/.env` 設定 `DATABASE_URL`，接著執行 `npm start`，前端照原本方式啟動。`DATABASE_URL` 優先於 `PGHOST` 等設定。環境中若已設定 `DATABASE_URL`，或同一設定已填在優先載入的 `.env.chain.local`，也要確認它指向預期的開發庫。
4. 後端啟動後檢查 `http://localhost:5000/api/health`，再由一位組員新增測試課程，另一位重新整理課程列表確認可見。套用新的 migration 時，請先同步 `main`，由負責人更新共用庫。

需要保留本機已有的資料時，先確認哪些紀錄適合共用，再用 `pg_dump` 備份要搬的資料並還原到新的空庫。開發庫建議使用測試或去識別化資料，並排除現有登入 Session 與一次性錢包驗證資料。還原後再執行 `npm run db:migrate`。若要切換現有測試資料，請在最後一次匯出和連線切換期間暫停寫入。[Neon 匯入指南](https://neon.com/docs/import/migrate-from-postgres)

### 共用 Windows 主機上的 `yunbarter`

這個方式直接使用主機現有的 `yunbarter` 資料。主機要保持開機，並執行 PostgreSQL 和 Tailscale。組員可以各自在自己的電腦啟動前端和後端，或用 pgAdmin 連線。

1. 主機安裝並登入 Tailscale。在管理後台將主機分享給指定組員，每人使用一個單次邀請。存取政策對受邀者僅開放主機的 `15432/TCP`，並確認沒有其他規則授予他們額外的存取權。[Tailscale 裝置分享](https://tailscale.com/docs/features/sharing) · [Tailscale 存取規則](https://tailscale.com/docs/features/access-control/grants)
2. PostgreSQL 繼續使用本機 `5432`。在主機 PowerShell 將 Tailscale 的 `15432/TCP` 轉送至 `127.0.0.1:5432`。這個轉送只在 Tailscale 私有網路使用。[Tailscale Serve 指令](https://tailscale.com/docs/reference/tailscale-cli/serve)

   ```powershell
   tailscale serve --bg --tcp=15432 tcp://127.0.0.1:5432
   tailscale serve status
   ```

3. 主機私下交付各自的 PostgreSQL 帳號。組員在 `yunbarter-backend/.env` 設 `PGHOST` 為主機的 Tailscale IP、`PGPORT=15432`、`PGDATABASE=yunbarter`，並填入自己的 `PGUSER` 和 `PGPASSWORD`。若原本的設定有 `DATABASE_URL`，請移除它以使用這組 `PG` 設定。pgAdmin 可填入同一組連線資料。
4. 在 `yunbarter-backend` 執行 `npm start`，開啟 `http://localhost:5000/api/health` 驗證，再照原本步驟啟動前端。共用庫的 `npm run db:migrate` 由主機管理者執行。若新遷移新增資料表或序列，管理者也要授予 `yunbarter_team_access` 所需的權限。
5. 結束分享時，在主機執行 `tailscale serve --bg --tcp=15432 off`。若只停用一位組員，可撤銷該組員的裝置分享並停用其 PostgreSQL 登入角色。

如果大家只需要相同的表結構和初始測試資料，各自建立本機開發庫，再執行 `npm run db:migrate` 與 `npm run db:seed` 即可。後續各自新增的資料會留在各自的資料庫。

## 選用的開發測試資料

完成遷移後，空白的開發資料庫可以執行：

```powershell
npm run db:seed
```

這個指令只接受空白資料庫；已有資料會停止，不會執行 TRUNCATE。正式環境禁止匯入。測試帳號為 `test@email.com`、`axian@email.com`、`link@email.com`，開發密碼皆為 `123456`，SQL 中已儲存為不同的 scrypt 雜湊。一般新註冊帳號密碼至少 8 個字元。

需要在已有資料的開發資料庫建立具備永久錢包綁定的測試帳號，可在後端執行 `npm run db:create-test-accounts`。它會先套用遷移，再建立 2 位學生、2 位老師與範例課程，每個帳號透過一次性簽章註冊、分別綁定獨立測試錢包。重跑會沿用既有密碼和排班。登入資料與 MetaMask 匯入用私鑰保存在 Git 忽略的 `.local-backups/test-accounts/accounts.json`。若要在 Sepolia 測試付款，請另行準備 SKILL 與支付網路費用的 Sepolia ETH。

平台的交易環境使用 **Ethereum Sepolia（Chain ID `11155111`）**。先驗證代幣和託管合約並設定後端，再啟用 SKILL 付款，完整步驟見 [SKILL 交易與 Sepolia 部署](docs/SKILL-交易與部署.md)。舊 Ganache 驗收報告位於 `.local-backups/chain-test/`，已備份的交易可在錢包與預約管理查閱。自動化測試使用隔離的 Ganache 測試鏈。

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

新增前端 ethers 或 MetaMask 操作時，請放在 `services/blockchain.js`，頁面透過 Context / Hook 使用。所有新交易只使用鏈上 SKILL。餘額由 MetaMask Provider 直接讀取。後端驗證足夠確認深度的合約狀態、事件與收據後才同步預約，並備份完整收據、轉帳、授權及 Gas 費。舊 YTC 紀錄封存供查閱，點數交易 API 回傳 `410`。

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
