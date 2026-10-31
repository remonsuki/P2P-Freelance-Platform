const { randomBytes, createHash } = require('node:crypto');

const COOKIE_NAME = 'yunbarter_session';
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function readToken(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const cookie = cookies.map((entry) => entry.trim()).find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  const token = cookie?.slice(COOKIE_NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}

function createAuth(db, { secureCookies = false, sessionHours = 168 } = {}) {
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/api' };
  const ttl = sessionHours * 60 * 60 * 1000;

  async function issueSession(req, res, userId, client = db) {
    const previousToken = readToken(req);
    if (previousToken) await client.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(previousToken)]);
    const token = randomBytes(32).toString('hex');
    await client.query(
      'INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [hashToken(token), userId, new Date(Date.now() + ttl)],
    );
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ttl });
  }

  async function requireUser(req, res, next) {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: '請先登入' });
    const { rows } = await db.query(
      `SELECT u.user_id, u.email, u.username, u.role, u.category, u.hourly_points,
              u.cached_points, u.wallet_address, u.department, u.bio
         FROM user_sessions s JOIN users u ON u.user_id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hashToken(token)],
    );
    if (!rows[0]) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      return res.status(401).json({ error: '登入已過期，請重新登入' });
    }
    req.user = rows[0];
    return next();
  }

  async function logout(req, res) {
    const token = readToken(req);
    if (token) await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ success: true });
  }

  return { issueSession, requireUser, logout };
}

module.exports = { createAuth };
