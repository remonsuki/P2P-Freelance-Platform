const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../db');
const { assertConfigured, transaction } = require('../db');
const { hashPassword, isPasswordHash } = require('../passwords');

async function migrate(db = pool) {
  return transaction(db, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(92610431)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const { rows: [existing] } = await client.query("SELECT to_regclass('users') AS users_table");
    if (!existing.users_table) {
      await client.query(await fs.readFile(path.join(__dirname, '../../db/schema.sql'), 'utf8'));
    }
    const directory = path.join(__dirname, '../../db/migrations');
    const files = (await fs.readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) continue;
      await client.query(await fs.readFile(path.join(directory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
    // Convert existing plaintext records once, without requiring users to change accounts.
    const { rows } = await client.query('SELECT user_id, password_hash FROM users FOR UPDATE');
    let upgraded = 0;
    for (const user of rows) {
      if (isPasswordHash(user.password_hash)) continue;
      if (!user.password_hash || user.password_hash.startsWith('scrypt$') || /^\$(2|argon2)/.test(user.password_hash)) {
        throw new Error(`使用者 ${user.user_id} 的密碼格式不支援，請先重設該帳號密碼。`);
      }
      await client.query('UPDATE users SET password_hash = $1 WHERE user_id = $2',
        [await hashPassword(user.password_hash), user.user_id]);
      upgraded += 1;
    }
    return { upgradedPasswords: upgraded };
  });
}

if (require.main === module) {
  (async () => {
    try {
      assertConfigured();
      const result = await migrate();
      console.log(`資料庫遷移完成，已轉換 ${result.upgradedPasswords} 筆舊密碼。既有資料已保留。`);
    } catch (error) {
      console.error('資料庫遷移失敗:', error.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
}

module.exports = { migrate };
