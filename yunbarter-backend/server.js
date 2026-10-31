const express = require('express');
const cors = require('cors');
const pool = require('./db'); // PostgreSQL 連線池

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ==================== API 路由 ====================
// 每個功能一個檔案，放在 routes/；這裡的前綴 + router 裡的路徑 = 完整網址
app.use('/api/auth', require('./routes/auth'));         // /api/auth/login、/register
app.use('/api/user', require('./routes/user'));         // /api/user/profile、/wallet、/wallet/sync
app.use('/api/wallet', require('./routes/wallet'));     // /api/wallet/deposit、/withdraw
app.use('/api/teachers', require('./routes/teachers')); // /api/teachers、/api/teachers/:id
app.use('/api/bookings', require('./routes/bookings')); // /api/bookings
app.use('/api/ai', require('./routes/ai'));             // /api/ai/generate

// 🩺 健康檢查：測試後端能不能連上資料庫
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, db: 'connected', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================== 啟動 ====================
app.listen(PORT, () => {
  console.log(`🚀 YunBarter 後端已安全啟動在 http://localhost:${PORT}`);
});