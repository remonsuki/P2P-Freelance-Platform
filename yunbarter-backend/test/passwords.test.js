const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, isPasswordHash } = require('../passwords');

test('passwords are salted, verified, and never accepted as plaintext hashes', async () => {
  const password = '測試密碼-with-a-long-passphrase';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(isPasswordHash(first));
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect', first), false);
  assert.equal(await verifyPassword(password, password), false);
  assert.equal(await verifyPassword(password, 'scrypt$131072$8$1$bad$bad'), false);
});

test('SQL development seeds contain valid salted password hashes', async () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const sql = await fs.readFile(path.join(__dirname, '../../db/seed.sql'), 'utf8');
  const hashes = [...sql.matchAll(/'(scrypt\$[^']+)'/g)].map((match) => match[1]);
  assert.equal(hashes.length, 3);
  for (const hash of hashes) assert.equal(await verifyPassword('123456', hash), true);
  assert.equal(new Set(hashes).size, 3);
  assert.doesNotMatch(sql, /TRUNCATE/i);
});
