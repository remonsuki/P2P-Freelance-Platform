const express = require('express');
const { route, withTransaction, HttpError } = require('../lib/http');
const { toPoints } = require('../lib/points');
const { getCurrentUser } = require('../lib/session');
const { insertTransaction } = require('../services/transactions');

const router = express.Router();

// 💰 儲值
router.post('/deposit', route(async (req, res) => {
  const { amount, txHash } = req.body;
  const user = await getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  const points = toPoints(amount);
  if (Number.isNaN(points) || points <= 0) {
    return res.status(400).json({ error: '無效的儲值金額' });
  }

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'UPDATE users SET cached_points = cached_points + $1 WHERE user_id = $2 RETURNING cached_points',
      [points, user.user_id]
    );
    const newTransaction = await insertTransaction(client, {
      userId: user.user_id,
      amount: points,
      type: 'charge',
      description: txHash ? `鏈上儲值 (${txHash.slice(0, 10)}...)` : '信用卡支付成功',
      txHash: txHash || null,
    });
    return { balance: rows[0].cached_points, newTransaction };
  });

  res.json({ success: true, ...result });
}));

// 💰 提領
router.post('/withdraw', route(async (req, res) => {
  const { amount } = req.body;
  const user = await getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  const points = toPoints(amount);
  if (Number.isNaN(points) || points <= 0) {
    return res.status(400).json({ error: '無效的提領金額' });
  }

  const result = await withTransaction(async (client) => {
    // 帶條件扣款：餘額不夠時 UPDATE 不會成功，避免同時提領扣成負數
    const { rows } = await client.query(
      `UPDATE users SET cached_points = cached_points - $1
       WHERE user_id = $2 AND cached_points >= $1 RETURNING cached_points`,
      [points, user.user_id]
    );
    if (rows.length === 0) throw new HttpError(400, '餘額不足以進行提領');

    const newTransaction = await insertTransaction(client, {
      userId: user.user_id,
      amount: -points,
      type: 'withdraw',
      description: '提領至台灣銀行 (帳號 ****1234)',
    });
    return { balance: rows[0].cached_points, newTransaction };
  });

  res.json({ success: true, ...result });
}));

module.exports = router;