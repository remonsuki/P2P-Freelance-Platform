const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ==================== 模擬資料庫資料 ====================
let userName = "Yun";
let balance = 100.5;

let userProfile = {
    userName: "Yun",
    department: "資訊管理系 | 學號：B1100001",
    bio: "熱愛程式與音樂，目前在鑽研網頁設計與吉他指彈。"
};

let registeredUsers = [
    { email: 'test@email.com', password: '123', userName: 'Yun' }
];

let transactions = [
    { id: 1, type: '上課支出', amount: -2.0, date: '2024-05-20', note: '阿弦老師 - 吉他指彈教學' },
    { id: 2, type: '教學收入', amount: 3.0, date: '2024-05-18', note: '教小明 - 網頁開發' },
    { id: 3, type: '儲值', amount: 50.0, date: '2024-05-15', note: '模擬綠界科技 - 信用卡入金' }
];

let teachers = [
    { id: 1, name: '阿弦', skill: '吉他指彈教學', price: 2.0, category: '音樂' },
    { id: 2, name: '林克', skill: '網頁開發', price: 3.5, category: '程式' },
    { id: 3, name: '田中櫻', skill: '日文 N3 考前衝刺', price: 1.5, category: '語言' }
];

// ==================== API 路由設計 ====================

// 💰 [全新] 處理儲值入金
app.post('/api/wallet/deposit', (req, res) => {
    const { amount } = req.body;
    if (amount === undefined || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "無效的儲值金額" });
    }

    balance += parseFloat(amount);

    const newTransaction = {
        id: Date.now(),
        type: '儲值',
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        note: '信用卡支付成功'
    };

    transactions.unshift(newTransaction);
    res.json({ success: true, balance, newTransaction });
});

// 💰 [全新] 處理提領出金
app.post('/api/wallet/withdraw', (req, res) => {
    const { amount } = req.body;
    if (amount === undefined || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "無效的提領金額" });
    }

    if (balance < amount) {
        return res.status(400).json({ error: "餘額不足以進行提領" });
    }

    balance -= parseFloat(amount);

    const newTransaction = {
        id: Date.now(),
        type: '提領',
        amount: -parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        note: '提領至 台灣銀行 (帳號 ****123)'
    };

    transactions.unshift(newTransaction);
    res.json({ success: true, balance, newTransaction });
});

// 🤖 模擬 AI 文案生成路由
app.post('/api/ai/generate', (req, res) => {
    const { skill, style } = req.body;
    if (!skill) return res.status(400).json({ error: "缺少技能名稱" });

    let title = '';
    let description = '';
    let price = (Math.random() * 3 + 1).toFixed(1); 

    if (style === '幽默風趣') {
        title = `保證不打瞌睡的${skill}大師班`;
        description = `想學${skill}卻總是半途而廢嗎？別擔心，跟著我學，保證讓你笑著學會！我會用最生活化的比喻，把複雜的觀念變成一塊小蛋糕。上完這堂課，你不但能掌握${skill}，還能順便練腹肌喔！`;
    } else if (style === '熱血推銷') {
        title = `【極速上手】${skill}特訓營，突破你的極限！`;
        description = `給自己一個改變的機會！這堂${skill}課程專為渴望進步的你設計。我們沒有廢話，只有滿滿的實戰技巧。只要你肯練，我保證把你教到會！現在就加入，讓我們一起稱霸${skill}的領域！`;
    } else {
        title = `基礎與進階：${skill}全方位解析`;
        description = `本課程致力於提供系統化的${skill}教學。我們將從核心基礎觀念著手，逐步深入至進階應用技巧。適合希望建立紮實基礎、並尋求專業指導的學習者。課程內容包含理論講解與實務演練。`;
    }
    res.json({ title, price, description });
});

// 👤 獲取個人檔案
app.get('/api/user/profile', (req, res) => {
    res.json(userProfile);
});

// 👤 修改個人檔案
app.put('/api/user/profile', (req, res) => {
    const { userName: newName, department, bio } = req.body;
    if (!newName) return res.status(400).json({ error: "姓名不可為空！" });

    const oldName = userProfile.userName;
    userProfile = { userName: newName, department, bio };
    userName = newName;
    teachers = teachers.map(t => t.name === oldName ? { ...t, name: newName } : t);
    res.json(userProfile);
});

// 🔑 處理登入驗證
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = registeredUsers.find(u => u.email === email && u.password === password);
    if (user) {
        userName = user.userName;
        userProfile.userName = user.userName;
        res.json({ success: true, userName: user.userName });
    } else {
        res.status(401).json({ error: "電子郵件或密碼錯誤！" });
    }
});

// 🔑 處理新帳號註冊
app.post('/api/auth/register', (req, res) => {
    const { email, password, schoolId } = req.body;
    const userExists = registeredUsers.some(u => u.email === email);
    if (userExists) return res.status(400).json({ error: "該電子郵件已被註冊！" });

    const newUserName = email.split('@')[0];
    const newUser = { email, password, userName: newUserName, schoolId };
    registeredUsers.push(newUser);

    userName = newUserName;
    userProfile.userName = newUserName;
    userProfile.department = schoolId ? `學號：${schoolId}` : "尚未填寫系所";
    res.status(201).json({ success: true, userName: newUserName });
});

// 1. 取得錢包與使用者資訊
app.get('/api/user/wallet', (req, res) => {
    res.json({ userName, balance, transactions });
});

// 2. 取得所有教師列表
app.get('/api/teachers', (req, res) => {
    res.json(teachers);
});

// 3. 新增技能課程
app.post('/api/teachers', (req, res) => {
    const { name, skill, price, category } = req.body;
    if (!skill || !price) return res.status(400).json({ error: "技能名稱與價格為必填" });

    const newTeacher = {
        id: Date.now(),
        name: name || userName,
        skill,
        price: parseFloat(price),
        category: category || '綜合'
    };

    teachers.unshift(newTeacher);
    res.status(201).json(newTeacher);
});

// 4. 刪除教師課程
app.delete('/api/teachers/:id', (req, res) => {
    const deleteId = parseInt(req.params.id);
    const initialLength = teachers.length;
    teachers = teachers.filter(t => t.id !== deleteId);

    if (teachers.length === initialLength) return res.status(404).json({ error: "找不到該課程資料" });
    res.json({ success: true, message: "課程已成功刪除" });
});

// 5. 修改教師課程
app.put('/api/teachers/:id', (req, res) => {
    const updateId = parseInt(req.params.id);
    const { skill, price } = req.body;

    let updatedTeacher = null;
    teachers = teachers.map(t => {
        if (t.id === updateId) {
            updatedTeacher = { ...t, skill: skill, price: parseFloat(price) };
            return updatedTeacher;
        }
        return t;
    });

    if (!updatedTeacher) return res.status(404).json({ error: "找不到該課程資料更新" });
    res.json(updatedTeacher);
});

// 6. 處理扣款與交易紀錄
app.post('/api/wallet/deduct', (req, res) => {
    const { amount, teacherName, skillName } = req.body;
    if (amount === undefined || !teacherName || !skillName) return res.status(400).json({ error: "缺少交易必要欄位" });

    if (balance < amount) {
        return res.status(400).json({ error: "伺服器端驗證失敗：餘額不足" });
    }

    balance -= parseFloat(amount);

    const newTransaction = {
        id: Date.now(),
        type: '上課支出',
        amount: -parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        note: `${teacherName}老師 - ${skillName}`
    };

    transactions.unshift(newTransaction);
    res.json({ success: true, balance, newTransaction });
});

// ==================== 啟動 ====================
app.listen(PORT, () => {
    console.log(`🚀 YunBarter 後端已安全啟動在 http://localhost:${PORT}`);
});