const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { Pool } = require('pg');

function connectionOptions(env = process.env) {
  const common = { connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, max: 10 };
  if (env.DATABASE_URL) return { ...common, connectionString: env.DATABASE_URL };
  return {
    ...common,
    host: env.PGHOST || 'localhost',
    port: Number(env.PGPORT || 5432),
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
  };
}

function assertConfigured(env = process.env) {
  if (!env.DATABASE_URL && (!env.PGUSER || !env.PGDATABASE)) {
    throw new Error('請先依 .env.example 設定 yunbarter-backend/.env 的 PostgreSQL 連線資訊。');
  }
}

const pool = new Pool(connectionOptions());
pool.on('error', (error) => console.error('PostgreSQL 連線池錯誤:', error.code || 'CONNECTION_ERROR'));

async function transaction(db, work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.connectionOptions = connectionOptions;
module.exports.assertConfigured = assertConfigured;
module.exports.transaction = transaction;
