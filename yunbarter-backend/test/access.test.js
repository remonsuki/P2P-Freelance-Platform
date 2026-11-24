const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../server');

test('stale chain configuration disables payments but preserves health and wallet registration', async (t) => {
  const config = { CHAIN_ENABLED: 'true', CHAIN_ID: '1337', CHAIN_RPC_URL: 'http://test:private-rpc-token@127.0.0.1:8545' };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  const diagnostics = t.mock.method(console, 'error', () => {});
  const db = {
    async query(sql) {
      if (sql.includes('FROM user_sessions')) return { rows: [{ user_id: '1' }] };
      assert.match(sql, /^(SELECT 1|DELETE FROM registration_wallet_challenges|INSERT INTO registration_wallet_challenges)/);
      return { rows: [], rowCount: 0 };
    },
  };
  let app;
  Object.assign(process.env, config);
  try { app = createApp({ db }); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', database: 'postgresql' });
  const chain = await fetch(base + '/api/chain/config');
  assert.equal((await chain.json()).enabled, false);
  const quote = await fetch(base + '/api/chain/quotes', {
    method: 'POST', headers: { Cookie: 'yunbarter_session=' + 'a'.repeat(64) },
  });
  assert.equal(quote.status, 503);
  const walletAddress = '0x' + '1'.repeat(40);
  const challenge = await fetch(base + '/api/auth/register/wallet-challenge', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'registration@example.com', walletAddress }),
  });
  assert.equal(challenge.status, 200);
  assert.equal((await challenge.json()).walletAddress, walletAddress);
  assert.equal(diagnostics.mock.callCount(), 1);
  assert.match(diagnostics.mock.calls[0].arguments.join(' '), /Sepolia/);
  assert.doesNotMatch(diagnostics.mock.calls[0].arguments.join(' '), /private-rpc-token|127\.0\.0\.1/);
});

test('the public course catalog responds while a shared chain reconciliation is pending', async (t) => {
  const db = {
    async query() {
      return {
        rows: [{
          course_id: '1', teacher_id: '2', username: 'Teacher', title: 'Test course',
          price: '1', category: '程式', rating: null, slots: [],
        }],
      };
    },
  };
  const reconciliation = Promise.withResolvers();
  let syncCalls = 0;
  const chain = {
    reconcile() {
      syncCalls += 1;
      return reconciliation.promise;
    },
  };
  const server = createApp({ db, chain }).listen(0, '127.0.0.1');
  t.after(async () => {
    reconciliation.resolve([]);
    await new Promise(resolve => server.close(resolve));
  });
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/api/teachers';

  for (let request = 0; request < 2; request += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    const courses = await response.json();
    assert.equal(courses.length, 1);
    assert.equal(courses[0].skill, 'Test course');
  }
  assert.equal(syncCalls, 1);
});

test('authenticated SKILL lists return saved records while Sepolia refreshes once in the background', async (t) => {
  const paymentRefresh = Promise.withResolvers();
  const walletRefresh = Promise.withResolvers();
  const calls = { payments: 0, wallet: 0 };
  const payment = { payment_id: 'payment-1', student_id: '1', status: 'funded', chain_id: 11155111 };
  const receipt = { tx_hash: 'receipt-1' };
  const db = {
    async query(sql) {
      if (sql.includes('FROM user_sessions')) return { rows: [{ user_id: '1' }] };
      if (sql.includes('SELECT * FROM chain_payments')) return { rows: [payment] };
      if (sql.includes('FROM chain_transaction_records')) return { rows: [receipt] };
      throw new Error('Unexpected query in SKILL list test');
    },
  };
  const chain = {
    async ready() {},
    matchesPayment: () => true,
    reconcile() { calls.payments += 1; return paymentRefresh.promise; },
    history: { syncWallet() { calls.wallet += 1; return walletRefresh.promise; } },
  };
  const server = createApp({ db, chain }).listen(0, '127.0.0.1');
  t.after(async () => {
    paymentRefresh.resolve([]);
    walletRefresh.resolve({ complete: true });
    await new Promise(resolve => server.close(resolve));
  });
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = async route => {
    const response = await fetch(base + route, {
      headers: { Cookie: 'yunbarter_session=' + 'a'.repeat(64) },
      signal: AbortSignal.timeout(3000),
    });
    assert.equal(response.status, 200);
    return response.json();
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const results = await Promise.all([get('/api/chain/payments'), get('/api/chain/transactions')]);
    assert.equal(results[0].payments[0].status, 'funded');
    assert.deepEqual(results[1].transactions, [receipt]);
  }
  assert.deepEqual(calls, { payments: 1, wallet: 1 });
  payment.status = 'released';
  paymentRefresh.resolve([]);
  walletRefresh.resolve({ complete: true });
  assert.equal((await get('/api/chain/payments')).payments[0].status, 'released');
  assert.deepEqual((await get('/api/chain/transactions')).syncState, { complete: true });
  assert.deepEqual(calls, { payments: 1, wallet: 1 });
});

test('private APIs reject missing, forged and expired sessions', async (t) => {
  let queries = 0;
  const db = { async query() { queries += 1; return { rows: [], rowCount: 0 }; } };
  const server = createApp({ db }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const routes = [
    ['GET', '/api/user/wallet'], ['GET', '/api/user/profile'], ['PUT', '/api/user/profile'],
    ['POST', '/api/teachers'], ['PUT', '/api/teachers/1'], ['DELETE', '/api/teachers/1'],
    ['POST', '/api/bookings'], ['POST', '/api/wallet/deduct'], ['POST', '/api/wallet/deposit'],
    ['POST', '/api/wallet/withdraw'], ['POST', '/api/user/wallet/sync'], ['POST', '/api/ai/generate'],
    ['GET','/api/bookings'], ['POST','/api/bookings/1/cancel'], ['POST','/api/bookings/1/complete'],
    ['POST','/api/bookings/1/dispute'], ['POST','/api/bookings/1/refund'],
    ['POST','/api/chain/wallet/challenge'], ['POST','/api/chain/wallet/verify'], ['POST','/api/chain/quotes'],
    ['GET','/api/chain/transactions'], ['POST','/api/chain/transactions/sync'], ['GET','/api/chain/payments'], ['POST','/api/chain/payments/invalid/sync'], ['POST','/api/chain/payments/invalid/review'],
  ];
  for (const [method, route] of routes) {
    const response = await fetch(base + route, { method, headers: { 'x-user-id': '1', Cookie: 'yunbarter_session=1' } });
    assert.equal(response.status, 401, `${method} ${route}`);
  }
  assert.equal(queries, 0, 'forged IDs never reach the database');
  const expired = await fetch(base + '/api/user/wallet', { headers: { Cookie: `yunbarter_session=${'a'.repeat(64)}` } });
  assert.equal(expired.status, 401);
  assert.match(expired.headers.get('set-cookie'), /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
});

test('untrusted browser origins cannot send authenticated mutations', async (t) => {
  const db = { async query() { throw new Error('must not query database'); } };
  const server = createApp({ db }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('login does not fall back to a legacy plaintext password comparison', async (t) => {
  const db = { async query() { return { rows: [{ user_id: '1', username: 'Legacy', password_hash: '123456' }] }; } };
  const server = createApp({ db }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'legacy@example.com', password: '123456' }),
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
});
