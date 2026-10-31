const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../server');

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
