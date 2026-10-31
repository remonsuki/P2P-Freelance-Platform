const express = require('express');

const router = express.Router();

// 🤖 AI 文案生成
router.post('/generate', (req, res) => {
  const { skill, style } = req.body;
  if (!skill) return res.status(400).json({ error: '缺少技能名稱' });

  let title = '';
  let description = '';
  const price = (Math.random() * 3 + 1).toFixed(1);

  if (style === '幽默風趣') {
    title = `保證不打瞌睡的${skill}大師班`;
    description = `想學${skill}卻總是半途而廢嗎？別擔心，跟著我學，保證讓你笑著學會！`;
  } else if (style === '熱血推銷') {
    title = `【極速上手】${skill}特訓營，突破你的極限！`;
    description = `給自己一個改變的機會！這堂${skill}課程專為渴望進步的你設計。`;
  } else {
    title = `基礎與進階：${skill}全方位解析`;
    description = `本課程致力於提供系統化的${skill}教學，適合希望建立紮實基礎的學習者。`;
  }
  res.json({ title, price, description });
});

module.exports = router;