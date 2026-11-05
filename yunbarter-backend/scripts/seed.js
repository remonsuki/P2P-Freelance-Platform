const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../db');
const { assertConfigured, transaction } = require('../db');

async function seed(db = pool) {
  if (process.env.NODE_ENV === 'production') throw new Error('正式環境不可匯入開發測試帳號');
  await transaction(db, async (client) => {
    await client.query('LOCK TABLE users, skills, courses, teacher_availability, classes, entity_skills, bookings, point_transactions, reviews IN ACCESS EXCLUSIVE MODE');
    const { rows: [state] } = await client.query(`SELECT EXISTS (
      SELECT 1 FROM users UNION ALL SELECT 1 FROM skills UNION ALL SELECT 1 FROM classes
      UNION ALL SELECT 1 FROM entity_skills UNION ALL SELECT 1 FROM bookings
      UNION ALL SELECT 1 FROM point_transactions UNION ALL SELECT 1 FROM reviews
      UNION ALL SELECT 1 FROM courses UNION ALL SELECT 1 FROM teacher_availability
    ) AS has_data`);
    if (state.has_data) throw new Error('資料庫已有資料，已停止匯入；不會清空既有資料。');
    for (const table of ['users', 'skills', 'courses', 'classes', 'entity_skills', 'bookings', 'point_transactions', 'reviews']) {
      await client.query("SELECT setval(pg_get_serial_sequence($1, $2), 1, false)",
        [table, { users: 'user_id', skills: 'skill_id', courses: 'course_id', classes: 'class_id', entity_skills: 'entity_skill_id',
          bookings: 'booking_id', point_transactions: 'transaction_id', reviews: 'review_id' }[table]]);
    }
    await client.query(await fs.readFile(path.join(__dirname, '../../db/seed.sql'), 'utf8'));
  });
}

if (require.main === module) {
  (async () => {
    try {
      assertConfigured();
      await seed();
      console.log('開發測試資料匯入完成；既有資料庫不會被清空。');
    } catch (error) {
      console.error('測試資料匯入失敗:', error.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
}

module.exports = { seed };
