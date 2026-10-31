const express = require('express');
const pool = require('../db');
const { route, withTransaction } = require('../lib/http');
const { toPoints } = require('../lib/points');
const { slotTimes } = require('../lib/slots');
const { getCurrentUser } = require('../lib/session');
const { buildTeachersList, getUniqueTeacherCards } = require('../services/teachers');

const router = express.Router();

// 📚 教師／課程列表
router.get('/', route(async (req, res) => {
  res.json(await getUniqueTeacherCards());
}));

// 📚 新增技能課程（老師上架）
router.post('/', route(async (req, res) => {
  const { skill, price, category } = req.body;
  const user = await getCurrentUser();
  if (!user) return res.status(401).json({ error: '請先登入' });

  const points = toPoints(price);
  if (!skill || Number.isNaN(points)) {
    return res.status(400).json({ error: '技能名稱與價格為必填' });
  }
  const skillCategory = category || '綜合';

  const classId = await withTransaction(async (client) => {
    // 升級為老師身分
    if (user.role === 'student') {
      await client.query(
        `UPDATE users SET role = 'teacher', category = $1, hourly_points = $2 WHERE user_id = $3`,
        [skillCategory, points, user.user_id]
      );
    }

    let { rows } = await client.query('SELECT skill_id FROM skills WHERE name = $1', [skill]);
    if (rows.length === 0) {
      ({ rows } = await client.query(
        'INSERT INTO skills (category, name) VALUES ($1, $2) RETURNING skill_id',
        [skillCategory, skill]
      ));
    }
    const skillId = rows[0].skill_id;

    await client.query(
      `INSERT INTO entity_skills (owner_type, owner_id, skill_id, skill_level)
       VALUES ('user', $1, $2, '中級')`,
      [user.user_id, skillId]
    );

    const [startTime, endTime] = slotTimes.morning;
    const { rows: classRows } = await client.query(
      `INSERT INTO classes (teacher_id, skill_id, class_date, slot_type, start_time, end_time)
       VALUES ($1, $2, CURRENT_DATE + 7, 'morning', $3, $4)
       RETURNING class_id`,
      [user.user_id, skillId, startTime, endTime]
    );
    return classRows[0].class_id;
  });

  const card = (await buildTeachersList()).find((t) => t.classId === classId);
  res.status(201).json(card);
}));

router.delete('/:id', route(async (req, res) => {
  const deleteId = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await pool.query('DELETE FROM classes WHERE class_id = $1', [deleteId]);
    if (rowCount === 0) {
      return res.status(404).json({ error: '找不到該課程資料' });
    }
    res.json({ success: true, message: '課程已成功刪除' });
  } catch (err) {
    if (err.code === '23503') { // foreign_key_violation：bookings 還有指向這堂課
      return res.status(409).json({ error: '這堂課已有學生預約，無法下架' });
    }
    throw err;
  }
}));

router.put('/:id', route(async (req, res) => {
  const updateId = parseInt(req.params.id, 10);
  const { skill, price } = req.body;

  const { rows } = await pool.query('SELECT * FROM classes WHERE class_id = $1', [updateId]);
  const cls = rows[0];
  if (!cls) return res.status(404).json({ error: '找不到該課程資料更新' });

  await withTransaction(async (client) => {
    if (skill) {
      // 不直接改 skills 的名稱（其他老師可能共用），而是把這位老師的課改指向新名稱的技能
      const { rows: oldSkill } = await client.query('SELECT category FROM skills WHERE skill_id = $1', [cls.skill_id]);
      let { rows: skillRows } = await client.query('SELECT skill_id FROM skills WHERE name = $1', [skill]);
      if (skillRows.length === 0) {
        ({ rows: skillRows } = await client.query(
          'INSERT INTO skills (category, name) VALUES ($1, $2) RETURNING skill_id',
          [oldSkill[0]?.category || '綜合', skill]
        ));
      }
      const newSkillId = skillRows[0].skill_id;
      await client.query(
        'UPDATE classes SET skill_id = $1 WHERE teacher_id = $2 AND skill_id = $3',
        [newSkillId, cls.teacher_id, cls.skill_id]
      );
      await client.query(
        `UPDATE entity_skills SET skill_id = $1
         WHERE owner_type = 'user' AND owner_id = $2 AND skill_id = $3`,
        [newSkillId, cls.teacher_id, cls.skill_id]
      );
    }

    const points = toPoints(price);
    if (price !== undefined && !Number.isNaN(points)) {
      await client.query('UPDATE users SET hourly_points = $1 WHERE user_id = $2', [points, cls.teacher_id]);
    }
  });

  const updated = (await buildTeachersList()).find((t) => t.classId === updateId);
  res.json(updated);
}));

module.exports = router;