// 資料庫連線設定（第 2 步新增）
// 連線資訊放在 .env，不要直接寫在程式裡，密碼才不會被上傳
require('dotenv').config();
const { Pool } = require('pg');

// Pool（連線池）：先開好幾條連線重複使用，不用每次查詢都重新連線
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

module.exports = pool;
