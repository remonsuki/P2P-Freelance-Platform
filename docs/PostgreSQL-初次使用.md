# YunBarter 的 PostgreSQL 初次使用

本機已確認安裝 PostgreSQL 17.11，服務 `postgresql-x64-17` 正在執行，`localhost:5432` 可接受連線。

本機已完成 `.env` 連線設定、建立 `yunbarter` 資料庫、套用遷移，以及匯入開發範例資料。最新結構共 11 張表，新增 `courses` 儲存課程內容、`teacher_availability` 儲存教師排班；原有會員、時段與預約仍保留。最新驗證與資料品質問題見 [資料庫結構檢查與同步](資料庫結構檢查與同步.md)。

**日常使用可直接從第 5、6 節開始。** 前面建立資料庫與填設定的步驟，是供之後換電腦或建立另一個環境時參考，不必每次開發都重新執行。

## 先分清楚三件事

- **PostgreSQL**：實際存放資料的服務，Windows 開機後通常由服務自動啟動。
- **pgAdmin 4**：管理 PostgreSQL 的視窗介面，用來建立資料庫、查看資料表及執行 SQL。
- **YunBarter 網站**：透過後端 API 讀寫資料。網站會員帳號與 PostgreSQL 的 `postgres` 管理帳號是不同的帳號。

## 1. 用 pgAdmin 連上本機

1. 從 Windows 開始功能表開啟 **pgAdmin 4**。
2. 展開左側 **Servers → PostgreSQL 17**，輸入安裝 PostgreSQL 時設定的 `postgres` 密碼。
3. 如果左側沒有 PostgreSQL 17：對 **Servers** 按右鍵，選 **Register → Server**。
4. 在 General 的 Name 填 `本機 PostgreSQL`；Connection 填：

   | 欄位 | 值 |
   |---|---|
   | Host name/address | `localhost` |
   | Port | `5432` |
   | Maintenance database | `postgres` |
   | Username | `postgres` |
   | Password | 安裝時設定的資料庫密碼 |

5. 按 **Save**。pgAdmin 若另行要求 Master Password，那是保護已儲存連線密碼的密碼，不等同於網站會員密碼。

## 2. 建立本專案的資料庫

1. 展開 PostgreSQL 17。
2. 對 **Databases** 按右鍵，選 **Create → Database**。
3. Database 填 `yunbarter`，Owner 選 `postgres`，按 **Save**。
4. 若已經有 `yunbarter`，直接使用現有資料庫即可。

先建立資料庫就好，專案的遷移指令會建立需要的資料表。

## 3. 填寫後端連線資訊

已由範本建立以下檔案，並確認它被 Git 忽略：

`D:\二技專題\P2P-Freelance-Platform\yunbarter-backend\.env`

用編輯器開啟，確認：

```dotenv
PGHOST=localhost
PGPORT=5432
PGDATABASE=yunbarter
PGUSER=postgres
PGPASSWORD=在這裡填入安裝時設定的資料庫密碼
```

修改實際的 `.env`，不要把密碼填在這份教學文件，也不要貼到聊天或提交到 Git。

## 4. 建立資料表與開發資料

在 PowerShell 執行，每個指令成功後再執行下一個：

```powershell
Set-Location -LiteralPath 'D:\二技專題\P2P-Freelance-Platform\yunbarter-backend'
npm run db:migrate
```

遷移會建立資料表與補充欄位，並將既有的明碼密碼轉成雜湊。如果只手動執行 `db/schema.sql`，會缺少登入 Session 等新欄位，所以請使用上面的遷移指令。

如果是全新的空白資料庫，需要範例會員及課程時，再執行：

```powershell
npm run db:seed
```

`db:seed` 會拒絕匯入已有資料的資料庫，避免覆蓋資料。測試網站帳號為 `test@email.com`、`axian@email.com`、`link@email.com`；開發測試密碼均為 `123456`。這些是網站登入帳號，不是 pgAdmin 連線帳號。

## 5. 啟動網站

在後端終端機執行：

```powershell
npm start
```

瀏覽 `http://localhost:5000/api/health`，成功時會顯示：

```json
{"status":"ok","database":"postgresql"}
```

再開另一個 PowerShell：

```powershell
Set-Location -LiteralPath 'D:\二技專題\P2P-Freelance-Platform\yunbarter-app'
npm run dev
```

打開終端機顯示的網址，預設為 `http://localhost:5173`。

## 6. 在 pgAdmin 查看資料

1. 對 `yunbarter` 按右鍵 **Refresh**。
2. 展開 **Schemas → public → Tables**。
3. 對資料表按右鍵，選 **View/Edit Data → All Rows**。

常用資料表：

| 資料表 | 內容 |
|---|---|
| `users` | 網站會員、密碼雜湊、點數餘額 |
| `skills`、`entity_skills` | 技能及會員與技能的關聯 |
| `classes` | 老師、課程價格與可預約時段 |
| `courses` | 課程名稱、價格、說明與上架狀態 |
| `teacher_availability` | 老師可授課的日期／時段 |
| `bookings` | 真正由 API 建立的預約 |
| `point_transactions` | 點數異動紀錄 |
| `reviews` | 預留的評價資料表，目前尚未串接完整流程 |
| `user_sessions` | 登入 Session |
| `schema_migrations` | 已套用的資料庫遷移版本 |

也可對 `yunbarter` 按右鍵開啟 **Query Tool**，執行以下唯讀查詢：

```sql
SELECT user_id, email, username, role, cached_points
FROM users
ORDER BY user_id;
```

## 常見訊息

| 訊息 | 處理方式 |
|---|---|
| `password authentication failed` | 檢查 `.env` 的使用者與密碼，應填 PostgreSQL 安裝時的密碼 |
| `database "yunbarter" does not exist` | 先在 pgAdmin 建立 `yunbarter` |
| `relation "user_sessions" does not exist` | 在後端資料夾執行 `npm run db:migrate` |
| `ECONNREFUSED` | 確認 PostgreSQL 服務執行中，主機與 port 正確 |
| 找不到 `psql` 指令 | 本機 PostgreSQL 的 bin 尚未加入 PATH；可使用 pgAdmin，或指定完整執行檔路徑 |

本機完整指令範例：

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -p 5432 -U postgres -d yunbarter
```

輸入 SQL 查詢後可用 `\q` 離開。

官方參考：[建立資料庫](https://www.pgadmin.org/docs/pgadmin4/latest/database_dialog.html)、[連線到伺服器](https://www.pgadmin.org/docs/pgadmin4/latest/connecting.html)、[查看資料](https://www.pgadmin.org/docs/pgadmin4/latest/editgrid.html)。
