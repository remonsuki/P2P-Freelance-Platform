/**
 * 初始化資料庫：npm run db:init
 * 1. 資料庫不存在就自動建立
 * 2. 刪除舊資料表 → 依 ../db/schema.sql 重建
 * 3. 寫入測試資料（帳號密碼皆為 123456）
 *
 * ⚠️ 會清空所有資料，只在開發／demo 前重置時使用
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const config = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
};
const dbName = process.env.PGDATABASE || 'yunbarter';

async function ensureDatabase() {
  const admin = new Client({ ...config, database: 'postgres' });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
    console.log(`📦 已建立資料庫 ${dbName}`);
  }
  await admin.end();
}

async function main() {
  await ensureDatabase();

  const db = new Client({ ...config, database: dbName });
  await db.connect();

  console.log('🧹 刪除舊資料表...');
  await db.query(`
    DROP TABLE IF EXISTS reviews, bookings, classes, entity_skills,
      point_transactions, skills, users CASCADE;
  `);

  console.log('🏗️  建立資料表 (db/schema.sql)...');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await db.query(schema);

  console.log('🌱 寫入測試資料...');
  const hash = await bcrypt.hash('123456', 10);

  await db.query(
    `INSERT INTO users (email, password_hash, username, role, category, hourly_points, teacher_rating, wallet_address, cached_points) VALUES
      ('test@email.com',  $1, '大帥哥', 'student', NULL,   NULL, 5.0, NULL, 94),
      ('axian@email.com', $1, '阿弦',   'teacher', '音樂', 2,    4.8, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', 50),
      ('link@email.com',  $1, '林克',   'teacher', '程式', 4,    4.9, '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', 80)`,
    [hash]
  );

  await db.query(`
    INSERT INTO skills (category, name) VALUES
      ('音樂', '吉他指彈教學'),
      ('程式', '網頁開發實戰'),
      ('程式', 'Java 基礎入門');

    INSERT INTO entity_skills (owner_type, owner_id, skill_id, skill_level) VALUES
      ('user', 2, 1, '高級'),
      ('user', 3, 2, '高級'),
      ('user', 3, 3, '中級');

    INSERT INTO classes (teacher_id, skill_id, class_date, slot_type, start_time, end_time, is_booked) VALUES
      (2, 1, '2026-06-20', 'morning',   '09:00', '10:00', TRUE),
      (2, 1, '2026-06-21', 'afternoon', '14:00', '15:00', FALSE),
      (3, 2, '2026-06-25', 'morning',   '09:00', '10:00', TRUE),
      (3, 2, '2026-06-26', 'afternoon', '14:00', '15:00', FALSE);

    INSERT INTO bookings (student_id, class_id, points_spent, status, payment_status) VALUES
      (1, 1, 2, 'confirmed', 'escrowed'),
      (1, 3, 4, 'confirmed', 'escrowed');

    INSERT INTO point_transactions (user_id, amount, transaction_type, description, created_at, tx_status) VALUES
      (1, 100, 'charge',  '初始儲值',                '2026-06-01T10:00:00Z', 'success'),
      (1, -2,  'consume', '阿弦老師 - 吉他指彈教學', '2026-06-05T14:30:00Z', 'success'),
      (1, -4,  'consume', '林克老師 - 網頁開發實戰', '2026-06-08T09:00:00Z', 'success');
  `);

  await db.end();
  console.log(`✅ 完成！資料庫 ${dbName} 已就緒，測試帳號 test@email.com / 123456`);
}

main().catch((err) => {
  console.error('❌ 初始化失敗：', err.message);
  if (err.code === '28P01') console.error('   → 密碼錯誤，請檢查 .env 的 PGPASSWORD');
  if (err.code === 'ECONNREFUSED') console.error('   → 連不到 PostgreSQL，請確認服務有啟動、PGPORT 正確');
  process.exit(1);
});
