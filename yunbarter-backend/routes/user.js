const express = require('express');
const pool = require('../db');
const { route } = require('../lib/http');
const { toPoints } = require('../lib/points');
const { slotLabel } = require('../lib/slots');
const { getCurrentUser } = require('../lib/session');
const { formatTransactionsForFrontend } = require('../services/transactions');

const router = express.Router();

// 👤 個人檔案
router.get('/profile', route(async (req, res) => {
  const user = await getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  const { rows: myClasses } = await pool.query(
    `SELECT class_date, slot_type FROM classes
     WHERE teacher_id = $1 AND is_booked = FALSE ORDER BY class_date`,
    [user.user_id]
  );
  const availableTimes = myClasses.map((c) => `${c.class_date}|${slotLabel[c.slot_type]}`);

  res.json({
    userName: user.username,
    department: user.category ? `專長：${user.category}` : '尚未填寫系所',
    bio: user.role === 'teacher' ? `我是 ${user.username}，歡迎預約我的課程！` : '熱愛學習新技能的大學生。',
    role: user.role,
    walletAddress: user.wallet_address,
    availableTimes,
  });
}));

router.put('/profile', route(async (req, res) => {
  const { userName: newName, department, bio } = req.body;
  const user = await getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });
  if (!newName) return res.status(400).json({ error: '姓名不可為空！' });

  await pool.query('UPDATE users SET username = $1 WHERE user_id = $2', [newName, user.user_id]);
  res.json({
    userName: newName,
    department: department || user.category,
    bio: bio || '',
  });
}));

// 💰 錢包資訊
router.get('/wallet', route(async (req, res) => {
  const user = await getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  res.json({
    userName: user.username,
    balance: user.cached_points,
    walletAddress: user.wallet_address,
    transactions: await formatTransactionsForFrontend(user.user_id),
  });
}));

// 🔗 同步鏈上錢包地址與餘額快取
router.post('/wallet/sync', route(async (req, res) => {
  const { walletAddress, cachedPoints } = req.body;
  const user = await getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  const points = cachedPoints === undefined ? NaN : toPoints(cachedPoints);
  const { rows } = await pool.query(
    `UPDATE users SET
       wallet_address = COALESCE($1, wallet_address),
       cached_points = COALESCE($2, cached_points)
     WHERE user_id = $3
     RETURNING wallet_address, cached_points`,
    [walletAddress || null, Number.isNaN(points) ? null : points, user.user_id]
  );

  res.json({
    success: true,
    walletAddress: rows[0].wallet_address,
    balance: rows[0].cached_points,
  });
}));

module.exports = router;