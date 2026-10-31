const pool = require('../db');
const { slotLabel } = require('../lib/slots');

function getCourseDescription(skillName, teacherName) {
  const map = {
    '吉他指彈教學': `${teacherName} 老師擁有十年吉他演奏經驗，專精指彈技巧。課程從基礎和弦到進階編曲，適合各程度學員。`,
    '網頁開發實戰': `跟著 ${teacherName} 老師從零打造完整 Web 應用，涵蓋 React、Node.js 與區塊鏈整合實作。`,
    'Java 基礎入門': `${teacherName} 老師以淺顯易懂的方式講解 Java 核心概念，搭配實作練習快速上手。`,
  };
  return map[skillName] || '歡迎預約體驗這堂精彩課程！';
}

/** 將 classes + users + skills 聚合為前端 teachers 格式 */
async function buildTeachersList() {
  const { rows } = await pool.query(`
    SELECT c.class_id, c.teacher_id, c.skill_id, c.class_date, c.slot_type, c.is_booked,
           u.username, u.hourly_points, s.name AS skill_name, s.category
    FROM classes c
    JOIN users u ON u.user_id = c.teacher_id
    JOIN skills s ON s.skill_id = c.skill_id
    ORDER BY c.class_id DESC
  `);

  return rows.map((cls) => {
    const teacherClasses = rows.filter(
      (c) => c.teacher_id === cls.teacher_id && c.skill_id === cls.skill_id && !c.is_booked
    );
    const availableTimes = [...new Set(
      teacherClasses.map((c) => `${c.class_date}|${slotLabel[c.slot_type] || c.slot_type}`)
    )];

    return {
      id: cls.class_id,
      classId: cls.class_id,
      jobId: cls.class_id,
      teacherId: cls.teacher_id,
      name: cls.username,
      skill: cls.skill_name,
      price: cls.hourly_points,
      category: cls.category,
      description: getCourseDescription(cls.skill_name, cls.username),
      availableTimes,
      isBooked: cls.is_booked,
    };
  });
}

/** 去重：同一老師同一技能只保留一筆卡片 */
async function getUniqueTeacherCards() {
  const list = await buildTeachersList();
  const seen = new Set();
  return list.filter((t) => {
    const key = `${t.teacherId}-${t.skill}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { buildTeachersList, getUniqueTeacherCards };