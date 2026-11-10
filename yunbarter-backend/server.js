const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { transaction, assertConfigured } = require('./db');
const { createAuth } = require('./auth');
const { hashPassword, verifyPassword } = require('./passwords');
const { installMarketplace, courseCards, HttpError } = require('./marketplace');
const { createChainService, installChainRoutes } = require('./chain');
const { createWalletBinding } = require('./walletBinding');

// A missing account still performs the same password derivation as a failed login.
const DUMMY_HASH = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function text(value, name, maxLength, required = true) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > maxLength) {
    throw new HttpError(400, `${name}格式不正確`);
  }
  return value.trim();
}

function createApp({ db = pool, allowedOrigins, secureCookies = process.env.NODE_ENV === 'production',
  chain = createChainService(),
  sessionHours = Number(process.env.SESSION_TTL_HOURS || 168) } = {}) {
  if (!Number.isFinite(sessionHours) || sessionHours <= 0 || sessionHours > 720) throw new Error('SESSION_TTL_HOURS 必須介於 0 與 720 之間');
  const origins = new Set(allowedOrigins || (process.env.FRONTEND_ORIGINS
    || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim()).filter(Boolean));
  const app = express();
  const auth = createAuth(db, { secureCookies, sessionHours });
  const walletBinding = createWalletBinding(db, {secureCookies});
  app.disable('x-powered-by');
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || origins.has(origin)), credentials: true }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Credentials are accepted only from the configured frontend origins.
    if (req.headers.origin && !origins.has(req.headers.origin)) return res.status(403).json({ error: '不允許的請求來源' });
    return next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'postgresql' });
  });

  app.post('/api/auth/register/wallet-challenge',walletBinding.registrationChallenge);
  app.post('/api/auth/register', async (req, res) => {
    const body = req.body || {};
    const email = text(body.email, '電子郵件', 255).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, '電子郵件格式不正確');
    const userName = text(body.userName || email.split('@')[0], '名稱', 100);
    if (typeof body.password !== 'string' || body.password.length < 8 || Buffer.byteLength(body.password) > 1024) {
      throw new HttpError(400, '密碼至少需要 8 個字元，且不可超過 1024 bytes');
    }
    if (!body.walletProof) throw new HttpError(400,'建立帳號前請先連接 MetaMask 並完成錢包簽章');
    const passwordHash = await hashPassword(body.password);
    const user = await transaction(db, async (client) => {
      const walletAddress = await walletBinding.consumeRegistrationProof(client,req,email,body.walletProof);
      const { rows: [created] } = await client.query(
        'INSERT INTO users (email, password_hash, username,verified_wallet_address) VALUES ($1, $2, $3,$4) RETURNING user_id, username,verified_wallet_address',
        [email, passwordHash, userName,walletAddress],
      );
      await auth.issueSession(req, res, created.user_id, client);
      return created;
    });
    walletBinding.clearRegistrationCookie(res);
    res.status(201).json({ success: true, userName: user.username, userId: Number(user.user_id),walletAddress:user.verified_wallet_address });
  });

  app.post('/api/auth/login', async (req, res) => {
    const body = req.body || {};
    const email = text(body.email, '電子郵件', 255).toLowerCase();
    if (typeof body.password !== 'string' || !body.password.length || Buffer.byteLength(body.password) > 1024) {
      throw new HttpError(400, '密碼格式不正確');
    }
    const { rows: [user] } = await db.query('SELECT user_id, username, password_hash FROM users WHERE email = $1', [email]);
    const valid = await verifyPassword(body.password, user?.password_hash || DUMMY_HASH);
    if (!user || !valid) throw new HttpError(401, '電子郵件或密碼錯誤！');
    await transaction(db, (client) => auth.issueSession(req, res, user.user_id, client));
    res.json({ success: true, userName: user.username, userId: Number(user.user_id) });
  });

  app.post('/api/auth/logout', auth.logout);

  app.get('/api/chain/config', async (req, res) => {
    if (!chain) return res.json({enabled:false,message:'SKILL 託管交易尚未啟用'});
    try { await chain.ready(); res.json(chain.config()); }
    catch { res.json({enabled:false,message:'SKILL 託管交易暫時無法使用，請檢查後端鏈上設定'}); }
  });
  app.get('/api/teachers', async (req, res) => {
    if (chain) await chain.reconcile(db);
    res.json(await courseCards(db));
  });

  // Everything below this point requires a database-backed session.
  app.use('/api', auth.requireUser);

  installMarketplace(app, db);
  walletBinding.installAccountRoutes(app);
  installChainRoutes(app, db, chain);

  app.get('/api/user/wallet', async (req, res) => {
    res.json({ userId: Number(req.user.user_id), userName: req.user.username,
      walletAddress: req.user.verified_wallet_address, verifiedWalletAddress:req.user.verified_wallet_address });
  });

  app.post('/api/user/wallet/sync', async (req, res) => {
    const walletAddress = req.body?.walletAddress;
    if (typeof walletAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) throw new HttpError(400, '錢包地址格式不正確');
    if (!req.user.verified_wallet_address) throw new HttpError(409,'請先簽章綁定錢包');
    if (walletAddress.toLowerCase()!==req.user.verified_wallet_address) throw new HttpError(409,'此帳號只能使用原本綁定的錢包，無法更換');
    res.json({ success: true, walletAddress: req.user.verified_wallet_address });
  });

  app.post(['/api/wallet/deposit','/api/wallet/withdraw'], () => {
    throw new HttpError(410,'平台點數儲值與提領已停用，請使用 MetaMask 進行 SKILL 鏈上交易');
  });

  app.post('/api/ai/generate', (req, res) => {
    const skill = text(req.body?.skill, '技能名稱', 100);
    const style = req.body?.style;
    const price = (Math.random() * 3 + 1).toFixed(1);
    if (style === '幽默風趣') return res.json({ title: `保證不打瞌睡的${skill}大師班`, price, description: `想學${skill}卻總是半途而廢嗎？別擔心，跟著我學，保證讓你笑著學會！` });
    if (style === '熱血推銷') return res.json({ title: `【極速上手】${skill}特訓營，突破你的極限！`, price, description: `給自己一個改變的機會！這堂${skill}課程專為渴望進步的你設計。` });
    return res.json({ title: `基礎與進階：${skill}全方位解析`, price, description: `本課程致力於提供系統化的${skill}教學，適合希望建立紮實基礎的學習者。` });
  });

  app.use((req, res) => res.status(404).json({ error: '找不到此 API' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON 格式不正確' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: '請求資料過大' });
    if (error.constraint === 'users_verified_wallet_unique') return res.status(409).json({error:'此錢包已綁定其他帳號，請使用原帳號登入'});
    if (error.code === '23505') return res.status(409).json({ error: '資料已存在，電子郵件、交易或授課時段不可重複，請重新整理' });
    if (error.constraint === 'users_wallet_binding_immutable') return res.status(409).json({error:'帳號已綁定錢包，無法更換或解除綁定'});
    if (error.code === '23514') return res.status(400).json({ error: '資料違反金額、狀態或時間限制' });
    if (error.code === '23503') return res.status(409).json({ error: '資料仍有其他紀錄使用，無法刪除或修改' });
    if (['22P02', '22003', '22007', '22008'].includes(error.code)) return res.status(400).json({ error: '資料格式或數值不正確' });
    console.error('API 執行失敗:', error.code || error.name);
    return res.status(500).json({ error: '伺服器暫時無法完成請求' });
  });
  return app;
}

async function start() {
  assertConfigured();
  await pool.query('SELECT token_hash FROM user_sessions LIMIT 0');
  await pool.query('SELECT course_id FROM courses LIMIT 0');
  await pool.query('SELECT chain_payment_id FROM bookings LIMIT 0');
  await pool.query('SELECT challenge_id FROM registration_wallet_challenges LIMIT 0');
  await pool.query('SELECT tx_hash FROM chain_transaction_records LIMIT 0');
  const port = Number(process.env.PORT || 5000);
  const server = createApp().listen(port, () => console.log(`YunBarter API 已連線 PostgreSQL：http://localhost:${port}`));
  server.on('error', async (error) => {
    console.error('後端啟動失敗:', error.code);
    await pool.end();
    process.exitCode = 1;
  });
  return server;
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error('後端啟動失敗，請確認 .env 並先執行 npm run db:migrate。', error.code || error.message);
    await pool.end();
    process.exitCode = 1;
  });
}

module.exports = { createApp, start };
