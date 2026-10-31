// 資料庫連線設定（第 2 步新增）
// 連線資訊放在 .env，不要直接寫在程式裡，密碼才不會被上傳
require('dotenv').config();
const { Pool, types } = require('pg');

// pg 預設把 BIGINT / NUMERIC 回傳成字串、DATE 轉成 JS Date（會有時區偏移）
// 這裡統一轉成前端好用的格式：數字就是數字，日期維持 'YYYY-MM-DD'
types.setTypeParser(20, Number);              // BIGINT（各表的 id）
types.setTypeParser(1700, parseFloat);        // NUMERIC（評分）
types.setTypeParser(1082, (value) => value);  // DATE

// Pool（連線池）：先開好幾條連線重複使用，不用每次查詢都重新連線
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

module.exports = pool;
