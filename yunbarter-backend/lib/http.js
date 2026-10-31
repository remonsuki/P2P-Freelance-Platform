// 路由共用工具：統一錯誤處理、DB transaction
const pool = require('../db');

/** 業務邏輯錯誤（餘額不足、找不到資料…），帶 HTTP 狀態碼 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** 包裝 async 路由：HttpError 回對應狀態碼，其他錯誤回 500，不讓伺服器崩潰 */
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(`❌ ${req.method} ${req.originalUrl}:`, err.message);
    res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
};

/** 在同一個 DB transaction 裡執行，失敗自動 ROLLBACK */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { HttpError, route, withTransaction };