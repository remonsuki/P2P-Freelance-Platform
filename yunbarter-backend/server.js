const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ==================== 模擬資料庫（依 file/sql.io ERD） ====================

let nextId = {
  user: 4,
  transaction: 4,
  skill: 4,
  entitySkill: 4,
  class: 5,
  booking: 3,
  review: 1,
};

/** @type {Array} users 使用者表 */
let users = [
  {
    user_id: 1,
    email: 'test@email.com',
    password_hash: '123456',
    username: '大帥哥',
    avatar_url: null,
    role: 'student',
    category: null,
    hourly_points: null,
    student_rating: 5.0,
    teacher_rating: 5.0,
    wallet_address: null,
    cached_points: 94,
  },
  {
    user_id: 2,
    email: 'axian@email.com',
    password_hash: '123456',
    username: '阿弦',
    avatar_url: null,
    role: 'teacher',
    category: '音樂',
    hourly_points: 2,
    student_rating: 5.0,
    teacher_rating: 4.8,
    wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
    cached_points: 50,
  },
  {
    user_id: 3,
    email: 'link@email.com',
    password_hash: '123456',
    username: '林克',
    avatar_url: null,
    role: 'teacher',
    category: '程式',
    hourly_points: 4,
    student_rating: 5.0,
    teacher_rating: 4.9,
    wallet_address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    cached_points: 80,
  },
];

/** @type {Array} skills 技能科目表 */
let skills = [
  { skill_id: 1, category: '音樂', name: '吉他指彈教學' },
  { skill_id: 2, category: '程式', name: '網頁開發實戰' },
  { skill_id: 3, category: '程式', name: 'Java 基礎入門' },
];

/** @type {Array} entity_skills 使用者與技能關聯 */
let entitySkills = [
  { entity_skill_id: 1, owner_type: 'user', owner_id: 2, skill_id: 1, skill_level: '高級' },
  { entity_skill_id: 2, owner_type: 'user', owner_id: 3, skill_id: 2, skill_level: '高級' },
  { entity_skill_id: 3, owner_type: 'user', owner_id: 3, skill_id: 3, skill_level: '中級' },
];

/** @type {Array} classes 可預約課程時段 */
let classes = [
  {
    class_id: 1,
    teacher_id: 2,
    skill_id: 1,
    class_date: '2026-06-20',
    slot_type: 'morning',
    start_time: '09:00',
    end_time: '10:00',
    is_booked: true,
  },
  {
    class_id: 2,
    teacher_id: 2,
    skill_id: 1,
    class_date: '2026-06-21',
    slot_type: 'afternoon',
    start_time: '14:00',
    end_time: '15:00',
    is_booked: false,
  },
  {
    class_id: 3,
    teacher_id: 3,
    skill_id: 2,
    class_date: '2026-06-25',
    slot_type: 'morning',
    start_time: '09:00',
    end_time: '10:00',
    is_booked: true,
  },
  {
    class_id: 4,
    teacher_id: 3,
    skill_id: 2,
    class_date: '2026-06-26',
    slot_type: 'afternoon',
    start_time: '14:00',
    end_time: '15:00',
    is_booked: false,
  },
];

/** @type {Array} bookings 預約紀錄 */
let bookings = [
  {
    booking_id: 1,
    student_id: 1,
    class_id: 1,
    points_spent: 2,
    status: 'confirmed',
    payment_status: 'escrowed',
    tx_hash: null,
  },
  {
    booking_id: 2,
    student_id: 1,
    class_id: 3,
    points_spent: 4,
    status: 'confirmed',
    payment_status: 'escrowed',
    tx_hash: null,
  },
];

/** @type {Array} reviews 雙向評價 */
let reviews = [];

/** @type {Array} point_transactions 點數流水帳 */
let pointTransactions = [
  {
    transaction_id: 1,
    user_id: 1,
    amount: 100,
    transaction_type: 'charge',
    description: '初始儲值',
    created_at: '2026-06-01T10:00:00.000Z',
    tx_hash: null,
    tx_status: 'success',
  },
  {
    transaction_id: 2,
    user_id: 1,
    amount: -2,
    transaction_type: 'consume',
    description: '阿弦老師 - 吉他指彈教學',
    created_at: '2026-06-05T14:30:00.000Z',
    tx_hash: null,
    tx_status: 'success',
  },
  {
    transaction_id: 3,
    user_id: 1,
    amount: -4,
    transaction_type: 'consume',
    description: '林克老師 - 網頁開發實戰',
    created_at: '2026-06-08T09:00:00.000Z',
    tx_hash: null,
    tx_status: 'success',
  },
];

// 目前登入的使用者 ID（模擬 Session）
let currentUserId = 1;

// ==================== 輔助函式 ====================

function getCurrentUser() {
  return users.find((u) => u.user_id === currentUserId);
}

function getSkillById(skillId) {
  return skills.find((s) => s.skill_id === skillId);
}

function getUserById(userId) {
  return users.find((u) => u.user_id === userId);
}

/** 將 classes + users + skills 聚合為前端 teachers 格式 */
function buildTeachersList() {
  const slotLabel = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Night' };

  return classes.map((cls) => {
    const teacher = getUserById(cls.teacher_id);
    const skill = getSkillById(cls.skill_id);
    if (!teacher || !skill) return null;

    const teacherClasses = classes.filter(
      (c) => c.teacher_id === cls.teacher_id && c.skill_id === cls.skill_id && !c.is_booked
    );
    const availableTimes = [...new Set(
      teacherClasses.map((c) => `${c.class_date}|${slotLabel[c.slot_type] || c.slot_type}`)
    )];

    return {
      id: cls.class_id,
      classId: cls.class_id,
      jobId: cls.class_id,
      teacherId: teacher.user_id,
      name: teacher.username,
      skill: skill.name,
      price: teacher.hourly_points,
      category: skill.category,
      description: getCourseDescription(skill.name, teacher.username),
      availableTimes,
      isBooked: cls.is_booked,
    };
  }).filter(Boolean);
}

/** 去重：同一老師同一技能只保留一筆卡片 */
function getUniqueTeacherCards() {
  const list = buildTeachersList();
  const seen = new Set();
  return list.filter((t) => {
    const key = `${t.teacherId}-${t.skill}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCourseDescription(skillName, teacherName) {
  const map = {
    '吉他指彈教學': `${teacherName} 老師擁有十年吉他演奏經驗，專精指彈技巧。課程從基礎和弦到進階編曲，適合各程度學員。`,
    '網頁開發實戰': `跟著 ${teacherName} 老師從零打造完整 Web 應用，涵蓋 React、Node.js 與區塊鏈整合實作。`,
    'Java 基礎入門': `${teacherName} 老師以淺顯易懂的方式講解 Java 核心概念，搭配實作練習快速上手。`,
  };
  return map[skillName] || '歡迎預約體驗這堂精彩課程！';
}

/** 將 point_transactions 轉為前端交易明細格式 */
function formatTransactionsForFrontend(userId) {
  const typeMap = {
    charge: '儲值',
    consume: '上課支出',
    refund: '退款',
    withdraw: '提領',
  };

  return pointTransactions
    .filter((tx) => tx.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((tx) => ({
      id: tx.transaction_id,
      type: typeMap[tx.transaction_type] || tx.transaction_type,
      amount: tx.amount,
      date: tx.created_at.split('T')[0],
      note: tx.description,
      txHash: tx.tx_hash,
      txStatus: tx.tx_status,
    }));
}

function parseTimeSlot(timeKey) {
  if (!timeKey || !timeKey.includes('|')) return null;
  const [date, slot] = timeKey.split('|');
  const slotMap = { Morning: 'morning', Afternoon: 'afternoon', Night: 'evening', evening: 'evening' };
  return { class_date: date, slot_type: slotMap[slot] || slot.toLowerCase() };
}

// ==================== API 路由 ====================

// 🔑 登入
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password_hash === password);
  if (!user) {
    return res.status(401).json({ error: '電子郵件或密碼錯誤！' });
  }
  currentUserId = user.user_id;
  res.json({ success: true, userName: user.username, userId: user.user_id });
});

// 🔑 註冊
app.post('/api/auth/register', (req, res) => {
  const { email, password, userName: frontendUserName, schoolId } = req.body;

  if (users.some((u) => u.email === email)) {
    return res.status(400).json({ error: '該電子郵件已被註冊！' });
  }

  const newUserName = frontendUserName || email.split('@')[0];
  const newUser = {
    user_id: nextId.user++,
    email,
    password_hash: password,
    username: newUserName,
    avatar_url: null,
    role: 'student',
    category: null,
    hourly_points: null,
    student_rating: 5.0,
    teacher_rating: 5.0,
    wallet_address: null,
    cached_points: 0,
  };
  users.push(newUser);
  currentUserId = newUser.user_id;

  res.status(201).json({ success: true, userName: newUserName, userId: newUser.user_id });
});

// 👤 個人檔案
app.get('/api/user/profile', (req, res) => {
  const user = getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  const myClasses = classes.filter((c) => c.teacher_id === user.user_id && !c.is_booked);
  const slotLabel = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Night' };
  const availableTimes = myClasses.map((c) => `${c.class_date}|${slotLabel[c.slot_type]}`);

  res.json({
    userName: user.username,
    department: user.category ? `專長：${user.category}` : '尚未填寫系所',
    bio: user.role === 'teacher' ? `我是 ${user.username}，歡迎預約我的課程！` : '熱愛學習新技能的大學生。',
    role: user.role,
    walletAddress: user.wallet_address,
    availableTimes,
  });
});

app.put('/api/user/profile', (req, res) => {
  const { userName: newName, department, bio } = req.body;
  const user = getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });
  if (!newName) return res.status(400).json({ error: '姓名不可為空！' });

  user.username = newName;
  res.json({
    userName: user.username,
    department: department || user.category,
    bio: bio || '',
  });
});

// 💰 錢包資訊
app.get('/api/user/wallet', (req, res) => {
  const user = getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  res.json({
    userName: user.username,
    balance: user.cached_points,
    walletAddress: user.wallet_address,
    transactions: formatTransactionsForFrontend(user.user_id),
  });
});

// 🔗 同步鏈上錢包地址與餘額快取
app.post('/api/user/wallet/sync', (req, res) => {
  const { walletAddress, cachedPoints } = req.body;
  const user = getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  if (walletAddress) user.wallet_address = walletAddress;
  if (cachedPoints !== undefined && !isNaN(cachedPoints)) {
    user.cached_points = parseFloat(cachedPoints);
  }

  res.json({
    success: true,
    walletAddress: user.wallet_address,
    balance: user.cached_points,
  });
});

// 💰 儲值
app.post('/api/wallet/deposit', (req, res) => {
  const { amount, txHash } = req.body;
  const user = getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  if (amount === undefined || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: '無效的儲值金額' });
  }

  const parsed = parseFloat(amount);
  user.cached_points += parsed;

  const newTx = {
    transaction_id: nextId.transaction++,
    user_id: user.user_id,
    amount: parsed,
    transaction_type: 'charge',
    description: txHash ? `鏈上儲值 (${txHash.slice(0, 10)}...)` : '信用卡支付成功',
    created_at: new Date().toISOString(),
    tx_hash: txHash || null,
    tx_status: 'success',
  };
  pointTransactions.unshift(newTx);

  res.json({
    success: true,
    balance: user.cached_points,
    newTransaction: formatTransactionsForFrontend(user.user_id)[0],
  });
});

// 💰 提領
app.post('/api/wallet/withdraw', (req, res) => {
  const { amount } = req.body;
  const user = getCurrentUser();
  if (!user) return res.status(404).json({ error: '找不到使用者' });

  if (amount === undefined || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: '無效的提領金額' });
  }
  if (user.cached_points < amount) {
    return res.status(400).json({ error: '餘額不足以進行提領' });
  }

  const parsed = parseFloat(amount);
  user.cached_points -= parsed;

  const newTx = {
    transaction_id: nextId.transaction++,
    user_id: user.user_id,
    amount: -parsed,
    transaction_type: 'withdraw',
    description: '提領至台灣銀行 (帳號 ****1234)',
    created_at: new Date().toISOString(),
    tx_hash: null,
    tx_status: 'success',
  };
  pointTransactions.unshift(newTx);

  res.json({
    success: true,
    balance: user.cached_points,
    newTransaction: formatTransactionsForFrontend(user.user_id)[0],
  });
});

// 📚 教師／課程列表
app.get('/api/teachers', (req, res) => {
  res.json(getUniqueTeacherCards());
});

// 📚 新增技能課程（老師上架）
app.post('/api/teachers', (req, res) => {
  const { name, skill, price, category } = req.body;
  const user = getCurrentUser();
  if (!skill || price === undefined) {
    return res.status(400).json({ error: '技能名稱與價格為必填' });
  }

  // 升級為老師身分
  if (user.role === 'student') {
    user.role = 'teacher';
    user.category = category || '綜合';
    user.hourly_points = parseFloat(price);
  }

  let skillRecord = skills.find((s) => s.name === skill);
  if (!skillRecord) {
    skillRecord = {
      skill_id: nextId.skill++,
      category: category || '綜合',
      name: skill,
    };
    skills.push(skillRecord);
  }

  entitySkills.push({
    entity_skill_id: nextId.entitySkill++,
    owner_type: 'user',
    owner_id: user.user_id,
    skill_id: skillRecord.skill_id,
    skill_level: '中級',
  });

  const newClass = {
    class_id: nextId.class++,
    teacher_id: user.user_id,
    skill_id: skillRecord.skill_id,
    class_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    slot_type: 'morning',
    start_time: '09:00',
    end_time: '10:00',
    is_booked: false,
  };
  classes.unshift(newClass);

  const card = buildTeachersList().find((t) => t.classId === newClass.class_id);
  res.status(201).json(card || {
    id: newClass.class_id,
    classId: newClass.class_id,
    jobId: newClass.class_id,
    teacherId: user.user_id,
    name: name || user.username,
    skill,
    price: parseFloat(price),
    category: category || '綜合',
    availableTimes: [`${newClass.class_date}|Morning`],
  });
});

app.delete('/api/teachers/:id', (req, res) => {
  const deleteId = parseInt(req.params.id, 10);
  const initialLength = classes.length;
  classes = classes.filter((c) => c.class_id !== deleteId);

  if (classes.length === initialLength) {
    return res.status(404).json({ error: '找不到該課程資料' });
  }
  res.json({ success: true, message: '課程已成功刪除' });
});

app.put('/api/teachers/:id', (req, res) => {
  const updateId = parseInt(req.params.id, 10);
  const { skill, price } = req.body;
  const cls = classes.find((c) => c.class_id === updateId);
  if (!cls) return res.status(404).json({ error: '找不到該課程資料更新' });

  const teacher = getUserById(cls.teacher_id);
  const skillRecord = getSkillById(cls.skill_id);

  if (skill && skillRecord) skillRecord.name = skill;
  if (price !== undefined && teacher) teacher.hourly_points = parseFloat(price);

  const updated = buildTeachersList().find((t) => t.classId === updateId);
  res.json(updated);
});

// 🎯 建立預約（鏈上交易完成後由前端呼叫）
app.post('/api/bookings', (req, res) => {
  const { classId, timeSlot, teacherName, skillName, amount, txHash } = req.body;
  const student = getCurrentUser();
  if (!student) return res.status(404).json({ error: '找不到使用者' });

  let targetClass = classes.find((c) => c.class_id === classId && !c.is_booked);

  // 若未指定 classId，依時段尋找
  if (!targetClass && timeSlot) {
    const parsed = parseTimeSlot(timeSlot);
    if (parsed) {
      targetClass = classes.find(
        (c) =>
          !c.is_booked &&
          c.class_date === parsed.class_date &&
          c.slot_type === parsed.slot_type
      );
    }
  }

  if (!targetClass) {
    return res.status(404).json({ error: '找不到可預約的課程時段' });
  }

  const teacher = getUserById(targetClass.teacher_id);
  const skill = getSkillById(targetClass.skill_id);
  const points = amount ?? teacher?.hourly_points ?? 0;

  if (student.cached_points < points) {
    return res.status(400).json({ error: '餘額不足' });
  }

  student.cached_points -= points;
  targetClass.is_booked = true;

  const newBooking = {
    booking_id: nextId.booking++,
    student_id: student.user_id,
    class_id: targetClass.class_id,
    points_spent: points,
    status: 'confirmed',
    payment_status: 'escrowed',
    tx_hash: txHash || null,
  };
  bookings.push(newBooking);

  const newTx = {
    transaction_id: nextId.transaction++,
    user_id: student.user_id,
    amount: -points,
    transaction_type: 'consume',
    description: `${teacherName || teacher?.username}老師 - ${skillName || skill?.name}`,
    created_at: new Date().toISOString(),
    tx_hash: txHash || null,
    tx_status: txHash ? 'success' : 'pending',
  };
  pointTransactions.unshift(newTx);

  res.status(201).json({
    success: true,
    balance: student.cached_points,
    booking: newBooking,
    newTransaction: formatTransactionsForFrontend(student.user_id)[0],
  });
});

// 舊版扣款 API（向後相容）
app.post('/api/wallet/deduct', (req, res) => {
  const { amount, teacherName, skillName, classId, txHash } = req.body;

  req.body.amount = amount;
  req.body.teacherName = teacherName;
  req.body.skillName = skillName;
  req.body.classId = classId;
  req.body.txHash = txHash;

  // 轉發至 bookings 邏輯
  const student = getCurrentUser();
  if (!student) return res.status(404).json({ error: '找不到使用者' });

  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    return res.status(400).json({ error: '無效金額' });
  }
  if (student.cached_points < parsed) {
    return res.status(400).json({ error: '伺服器端驗證失敗：餘額不足' });
  }

  student.cached_points -= parsed;

  const newTx = {
    transaction_id: nextId.transaction++,
    user_id: student.user_id,
    amount: -parsed,
    transaction_type: 'consume',
    description: `${teacherName}老師 - ${skillName}`,
    created_at: new Date().toISOString(),
    tx_hash: txHash || null,
    tx_status: txHash ? 'success' : 'success',
  };
  pointTransactions.unshift(newTx);

  res.json({
    success: true,
    balance: student.cached_points,
    newTransaction: formatTransactionsForFrontend(student.user_id)[0],
  });
});

// 🤖 AI 文案生成
app.post('/api/ai/generate', (req, res) => {
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

// ==================== 啟動 ====================
app.listen(PORT, () => {
  console.log(`🚀 YunBarter 後端已安全啟動在 http://localhost:${PORT}`);
});
