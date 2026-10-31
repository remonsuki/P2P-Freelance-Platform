const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { connectionOptions, assertConfigured } = require('../../db');
const { migrate } = require('../../scripts/migrate');
const { seed } = require('../../scripts/seed');
const { createApp } = require('../../server');
const { isPasswordHash, verifyPassword } = require('../../passwords');

test('PostgreSQL: migrations, independent sessions, ownership and durable API data', async (t) => {
  // A real PostgreSQL connection is required. Business tables live only in a random test schema.
  const env = process.env.TEST_DATABASE_URL
    ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : process.env;
  assertConfigured(env);
  const pool = new Pool(connectionOptions(env));
  const schema = `yunbarter_test_${randomBytes(8).toString('hex')}`;
  const createdSchemas = [];
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    try {
      for (const name of createdSchemas.reverse()) await pool.query(`DROP SCHEMA "${name}" CASCADE`);
    } finally {
      await pool.end();
    }
  });

  async function scopedDatabase(name) {
    await pool.query(`CREATE SCHEMA "${name}"`);
    createdSchemas.push(name);
    const db = {
      async connect() {
        const client = await pool.connect();
        try {
          // Explicitly omit public so migrations can never discover or modify application tables.
          await client.query("SELECT set_config('search_path', $1, false)", [name]);
          return client;
        } catch (error) {
          client.release();
          throw error;
        }
      },
      async query(sql, values) {
        const client = await db.connect();
        try { return await client.query(sql, values); } finally { client.release(); }
      },
    };
    return db;
  }

  const db = await scopedDatabase(schema);
  // Start from the old schema and a plaintext account to exercise the upgrade path.
  await db.query(await fs.readFile(path.join(__dirname, '../../../db/schema.sql'), 'utf8'));
  await db.query("INSERT INTO users (email, password_hash, username, cached_points) VALUES ('LEGACY@example.com', 'old-password', 'Legacy', 42)");
  const firstMigration = await migrate(db);
  assert.equal(firstMigration.upgradedPasswords, 1);
  const { rows: [legacy] } = await db.query('SELECT * FROM users WHERE username = $1', ['Legacy']);
  assert.equal(legacy.email, 'legacy@example.com');
  assert.equal(Number(legacy.cached_points), 42);
  assert.ok(isPasswordHash(legacy.password_hash));
  assert.equal(await verifyPassword('old-password', legacy.password_hash), true);
  assert.equal((await migrate(db)).upgradedPasswords, 0);

  async function startServer() {
    server = createApp({ db, secureCookies: false, demoPayments: true }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  }
  let base = await startServer();
  async function request(method, route, body, cookie) {
    const response = await fetch(base + route, {
      method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(),
      cookie: response.headers.getSetCookie()[0]?.split(';')[0], headers: response.headers };
  }
  const password = 'same-password-123';
  const a = await request('POST', '/api/auth/register', { email: 'a@example.com', password, userName: '同名老師' });
  const b = await request('POST', '/api/auth/register', { email: 'b@example.com', password, userName: '同名老師' });
  const student = await request('POST', '/api/auth/register', { email: 'student@example.com', password, userName: 'Student' });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(student.status, 201);
  await db.query('UPDATE users SET cached_points = 50 WHERE user_id = $1', [a.body.userId]);
  await db.query('UPDATE users SET cached_points = 30 WHERE user_id = $1', [b.body.userId]);
  await db.query('UPDATE users SET cached_points = 20 WHERE user_id = $1', [student.body.userId]);

  await t.test('sessions, salts and private data are independent for two accounts', async () => {
    assert.notEqual(a.cookie, b.cookie);
    assert.match(a.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(a.headers.get('set-cookie'), /SameSite=Lax/i);
    assert.equal(a.headers.get('access-control-allow-credentials'), 'true');
    const walletA = await request('GET', '/api/user/wallet', undefined, a.cookie);
    const walletB = await request('GET', '/api/user/wallet', undefined, b.cookie);
    assert.equal(walletA.body.userId, a.body.userId);
    assert.equal(walletA.body.balance, 50);
    assert.equal(walletB.body.userId, b.body.userId);
    assert.equal(walletB.body.balance, 30);
    assert.equal((await request('GET', '/api/user/wallet')).status, 401);
    const { rows } = await db.query('SELECT password_hash FROM users WHERE user_id = ANY($1::bigint[]) ORDER BY user_id', [[a.body.userId, b.body.userId]]);
    assert.notEqual(rows[0].password_hash, rows[1].password_hash);
    assert.ok(rows.every((row) => isPasswordHash(row.password_hash)));
    assert.equal((await request('POST', '/api/auth/login', { email: 'a@example.com', password: 'incorrect' })).status, 401);
    assert.equal((await request('POST', '/api/auth/register', { email: 'A@example.com', password, userName: 'duplicate' })).status, 409);
    const { rows: sessions } = await db.query('SELECT token_hash FROM user_sessions');
    assert.ok(sessions.every((row) => !a.cookie.includes(row.token_hash)));
  });

  const courseA = await request('POST', '/api/teachers', { skill: 'Shared subject', category: '程式', price: 2.5, name: 'forged owner' }, a.cookie);
  const courseB = await request('POST', '/api/teachers', { skill: 'Other subject', category: '程式', price: 9 }, b.cookie);
  assert.equal(courseA.status, 201);
  assert.equal(courseB.status, 201);
  assert.equal(courseA.body.teacherId, a.body.userId);
  assert.equal(courseB.body.price, 9);

  await t.test('other accounts cannot edit/delete a course by guessing its ID or name', async () => {
    assert.equal((await request('PUT', `/api/teachers/${courseA.body.id}`, { skill: 'Hijacked', price: 1, userId: a.body.userId }, b.cookie)).status, 403);
    assert.equal((await request('DELETE', `/api/teachers/${courseA.body.id}`, undefined, b.cookie)).status, 403);
    assert.equal((await request('DELETE', `/api/teachers/${courseA.body.id}`)).status, 401);
    const { rows: [row] } = await db.query('SELECT s.name, c.price FROM classes c JOIN skills s USING (skill_id) WHERE class_id = $1', [courseA.body.id]);
    assert.equal(row.name, 'Shared subject');
    assert.equal(Number(row.price), 2.5);
  });

  await t.test('owner edits do not mutate a skill shared with another teacher', async () => {
    const { rows: [shared] } = await db.query(
      `INSERT INTO classes (teacher_id, skill_id, class_date, slot_type, start_time, end_time, price)
       SELECT $1, skill_id, CURRENT_DATE + 8, 'afternoon', '14:00', '15:00', 4.5
       FROM classes WHERE class_id = $2 RETURNING class_id`, [b.body.userId, courseA.body.id]);
    const edited = await request('PUT', `/api/teachers/${courseA.body.id}`, { skill: 'Owner-only subject', price: 3.5 }, a.cookie);
    assert.equal(edited.status, 200);
    assert.equal(edited.body.price, 3.5);
    const { rows: [other] } = await db.query('SELECT s.name, c.price FROM classes c JOIN skills s USING (skill_id) WHERE class_id = $1', [shared.class_id]);
    assert.equal(other.name, 'Shared subject');
    assert.equal(Number(other.price), 4.5);
    const deleted = await request('DELETE', `/api/teachers/${courseB.body.id}`, undefined, b.cookie);
    assert.equal(deleted.status, 200);
  });

  await t.test('profile changes persist and cannot update a different user', async () => {
    const saved = await request('PUT', '/api/user/profile', { userName: 'Updated A', department: 'Dept', bio: 'Saved bio', userId: b.body.userId }, a.cookie);
    assert.equal(saved.status, 200);
    const loaded = await request('GET', '/api/user/profile', undefined, a.cookie);
    const other = await request('GET', '/api/user/profile', undefined, b.cookie);
    assert.equal(loaded.body.department, 'Dept');
    assert.equal(loaded.body.bio, 'Saved bio');
    assert.equal(other.body.userName, '同名老師');
  });

  await t.test('booking locks the slot and uses the database price rather than a forged amount', async () => {
    const [first, second] = await Promise.all([
      request('POST', '/api/bookings', { classId: courseA.body.id, amount: -100 }, student.cookie),
      request('POST', '/api/bookings', { classId: courseA.body.id, amount: 0 }, b.cookie),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [201, 409]);
    const accepted = first.status === 201 ? first : second;
    assert.equal(accepted.body.booking.points_spent, 3.5);
    assert.equal(accepted.body.newTransaction.amount, -3.5);
    const { rows: [count] } = await db.query('SELECT COUNT(*)::int AS total FROM bookings WHERE class_id = $1', [courseA.body.id]);
    assert.equal(count.total, 1);
    assert.equal((await request('PUT', `/api/teachers/${courseA.body.id}`, { price: 100 }, a.cookie)).status, 409);
    assert.equal((await request('DELETE', `/api/teachers/${courseA.body.id}`, undefined, a.cookie)).status, 409);
  });

  await t.test('wallet synchronization cannot replace balances, and duplicate entries roll back', async () => {
    const synced = await request('POST', '/api/user/wallet/sync', { walletAddress: `0x${'a'.repeat(40)}`, cachedPoints: 1000000 }, a.cookie);
    assert.equal(synced.status, 200);
    assert.equal(synced.body.balance, 50);
    const txHash = `0x${'b'.repeat(64)}`;
    assert.equal((await request('POST', '/api/wallet/deposit', { amount: 1, txHash }, a.cookie)).status, 200);
    assert.equal((await request('POST', '/api/wallet/deposit', { amount: 1, txHash }, a.cookie)).status, 409);
    assert.equal((await request('GET', '/api/user/wallet', undefined, a.cookie)).body.balance, 51);
    assert.equal((await request('GET', '/api/user/wallet', undefined, a.cookie)).body.transactions.length, 1);
  });

  await t.test('restarting the API preserves accounts, courses, balances and sessions', async () => {
    await new Promise((resolve) => server.close(resolve));
    base = await startServer();
    const wallet = await request('GET', '/api/user/wallet', undefined, a.cookie);
    assert.equal(wallet.status, 200);
    assert.equal(wallet.body.balance, 51);
    const list = await request('GET', '/api/teachers');
    assert.ok(list.body.some((course) => course.id === courseA.body.id));
  });

  await t.test('login rotates the current session; logout and expiry leave other users intact', async () => {
    const login = await request('POST', '/api/auth/login', { email: 'a@example.com', password }, a.cookie);
    assert.equal(login.status, 200);
    assert.notEqual(login.cookie, a.cookie);
    assert.equal((await request('GET', '/api/user/wallet', undefined, a.cookie)).status, 401);
    assert.equal((await request('GET', '/api/user/wallet', undefined, b.cookie)).status, 200);
    assert.equal((await request('POST', '/api/auth/logout', undefined, login.cookie)).status, 200);
    assert.equal((await request('GET', '/api/user/wallet', undefined, login.cookie)).status, 401);
    assert.equal((await request('GET', '/api/user/wallet', undefined, b.cookie)).status, 200);
    await db.query("UPDATE user_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE user_id = $1", [b.body.userId]);
    assert.equal((await request('GET', '/api/user/wallet', undefined, b.cookie)).status, 401);
  });

  await t.test('optional development seeds only populate an empty database', async () => {
    const empty = await scopedDatabase(`${schema}_seed`);
    await migrate(empty);
    await seed(empty);
    const { rows } = await empty.query('SELECT password_hash FROM users');
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => isPasswordHash(row.password_hash)));
    await assert.rejects(seed(empty), /已有資料/);
    await assert.rejects(seed(db), /已有資料/);
    const { rows: [existing] } = await db.query('SELECT cached_points FROM users WHERE user_id = $1', [legacy.user_id]);
    assert.equal(Number(existing.cached_points), 42);
  });
});
