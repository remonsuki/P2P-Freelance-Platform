# YunBarter 校園技能交換平台

React / Vite 前端、Express API 與 PostgreSQL。後端的使用者、課程、時段、預約、點數交易及登入 Session 均存入 PostgreSQL，不再使用記憶體模擬資料庫。

## 啟動環境

- Node.js 24（目前使用的驗證環境）。
- 已啟動的 PostgreSQL，以及可連線的資料庫帳號。
- MetaMask 僅供錢包連線；目前會員登入使用電子郵件及密碼。

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

## 前端

另開終端機：

```powershell
cd yunbarter-app
npm install
npm run dev
```

預設網址為 `http://localhost:5173`。請使用與 API 相同的主機名稱，例如兩邊都使用 `localhost`，或兩邊都使用 `127.0.0.1`。開發時 API 預設使用目前前端主機的 5000 port，所有 API 請求會自動傳送登入 Cookie。

若前端使用其他網址或 port，請將完整來源加入後端 `.env` 的 `FRONTEND_ORIGINS`，以逗號分隔。正式部署建議將 `/api` 反向代理到後端並使用 HTTPS；設定後端 `NODE_ENV=production` 會啟用 Secure Cookie。若需要獨立 API 網址，可在前端 `.env.local` 設定 `VITE_API_BASE_URL`；前後端應部署於相同 site，才能使用目前的 SameSite=Lax Cookie。

## 本次登入與權限規則

- 每個瀏覽器使用獨立的隨機 Session Token，Cookie 為 HttpOnly、SameSite=Lax；資料庫只儲存 Token 的 SHA-256 雜湊。有效期預設 168 小時，可用 `SESSION_TTL_HOURS` 調整。
- 登入會輪替目前瀏覽器的 Session；登出會撤銷該 Session。其他瀏覽器／使用者的 Session 不受影響。同一瀏覽器內的分頁會依標準 Cookie 行為共用目前登入帳號。
- 個人檔案、錢包與課程異動均驗證 Session，未登入回傳 401。
- 課程修改／刪除只允許 `classes.teacher_id` 對應的擁有者，其他使用者回傳 403。已有預約紀錄的課程回傳 409，避免破壞歷史資料。
- 編輯技能名稱會建立獨立技能資料，不會修改其他老師共用的技能；價格存在課程時段上，不會改動其他老師的價格。
- MetaMask 連線本身不會建立會員登入狀態，避免用未驗證的錢包地址冒充會員。簽章式 Web3 登入仍待後續整合。