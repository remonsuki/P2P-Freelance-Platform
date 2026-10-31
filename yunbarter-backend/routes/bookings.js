const express = require('express');
const { route, withTransaction, HttpError } = require('../lib/http');
const { parseTimeSlot } = require('../lib/slots');
const { getCurrentUser } = require('../lib/session');
const { insertTransaction } = require('../services/transactions');

const router = express.Router();

// 🎯 建立預約（鏈上交易完成後由前端呼叫）
router.post('/', route(async (req, res) => {
  const { classId, timeSlot, txHash } = req.body;
  const student = await getCurrentUser();
  if (!student) return res.status(404).json({ error: '找不到使用者' });

  const result = await withTransaction(async (client) => {
    const { rows: baseRows } = await client.query('SELECT * FROM classes WHERE class_id = $1', [classId]);
    const base = baseRows[0];
    const parsed = parseTimeSlot(timeSlot);

    // FOR UPDATE 鎖住這堂課，避免兩個人同時預約到同一個時段
    let targetClass = null;
    if (base && parsed) {
      // 指定時段：找同一位老師、同一個技能在那個時段的空堂
      const { rows } = await client.query(
        `SELECT * FROM classes
         WHERE teacher_id = $1 AND skill_id = $2 AND class_date = $3 AND slot_type = $4
           AND is_booked = FALSE
         LIMIT 1 FOR UPDATE`,
        [base.teacher_id, base.skill_id, parsed.class_date, parsed.slot_type]
      );
      targetClass = rows[0];
    } else if (base) {
      const { rows } = await client.query(
        'SELECT * FROM classes WHERE class_id = $1 AND is_booked = FALSE FOR UPDATE',
        [classId]
      );
      targetClass = rows[0];
    }
    if (!targetClass) throw new HttpError(404, '找不到可預約的課程時段');
    if (targetClass.teacher_id === student.user_id) throw new HttpError(400, '不能預約自己的課程');

    const { rows: info } = await client.query(
      `SELECT u.username, u.hourly_points, s.name AS skill_name
       FROM users u, skills s WHERE u.user_id = $1 AND s.skill_id = $2`,
      [targetClass.teacher_id, targetClass.skill_id]
    );
    const { username: teacherName, hourly_points, skill_name: skillName } = info[0];
    const points = hourly_points ?? 0; // 以資料庫的價格為準，不信任前端傳來的 amount

    const { rows: balanceRows } = await client.query(
      `UPDATE users SET cached_points = cached_points - $1
       WHERE user_id = $2 AND cached_points >= $1 RETURNING cached_points`,
      [points, student.user_id]
    );
    if (balanceRows.length === 0) throw new HttpError(400, '餘額不足');

    await client.query('UPDATE classes SET is_booked = TRUE WHERE class_id = $1', [targetClass.class_id]);

    const { rows: bookingRows } = await client.query(
      `INSERT INTO bookings (student_id, class_id, points_spent) VALUES ($1, $2, $3)
       RETURNING *`,
      [student.user_id, targetClass.class_id, points]
    );

    const newTransaction = await insertTransaction(client, {
      userId: student.user_id,
      amount: -points,
      type: 'consume',
      description: `${teacherName}老師 - ${skillName}`,
      txHash: txHash || null,
      txStatus: txHash ? 'success' : 'pending',
    });

    return {
      balance: balanceRows[0].cached_points,
      booking: { ...bookingRows[0], tx_hash: txHash || null },
      newTransaction,
    };
  });

  res.status(201).json({ success: true, ...result });
}));

module.exports = router;