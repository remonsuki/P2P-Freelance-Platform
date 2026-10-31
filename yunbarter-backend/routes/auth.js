const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { route } = require('../lib/http');
const { setCurrentUserId } = require('../lib/session');

const router = express.Router();

// 🔑 登入
router.post('/login', route(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !password || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: '電子郵件或密碼錯誤！' });
  }
  setCurrentUserId(user.user_id);
  res.json({ success: true, userName: user.username, userId: user.user_id });
}));

// 🔑 註冊
router.post('/register', route(async (req, res) => {
  const { email, password, userName: frontendUserName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '電子郵件與密碼為必填' });
  }

  const newUserName = frontendUserName || email.split('@')[0];
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3)
       RETURNING user_id`,
      [email, passwordHash, newUserName]
    );
    setCurrentUserId(rows[0].user_id);
    res.status(201).json({ success: true, userName: newUserName, userId: rows[0].user_id });
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(400).json({ error: '該電子郵件已被註冊！' });
    }
    throw err;
  }
}));

module.exports = router;