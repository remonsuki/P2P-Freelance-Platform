// 目前登入的使用者（模擬 Session，下一步改成 JWT）
const pool = require('../db');

let currentUserId = null;

function setCurrentUserId(id) {
  currentUserId = id;
}

async function getCurrentUser(db = pool) {
  if (!currentUserId) return null;
  const { rows } = await db.query('SELECT * FROM users WHERE user_id = $1', [currentUserId]);
  return rows[0] || null;
}

module.exports = { setCurrentUserId, getCurrentUser };