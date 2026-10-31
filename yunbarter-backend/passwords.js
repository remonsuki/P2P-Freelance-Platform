const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);
const PARAMETERS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const PREFIX = 'scrypt$131072$8$1$';

function isPasswordHash(value) {
  return typeof value === 'string'
    && /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64, PARAMETERS);
  return `${PREFIX}${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  // Legacy plaintext is upgraded by db:migrate, never accepted by the login API.
  if (!isPasswordHash(storedHash)) return false;
  const [, , , , salt, expectedHex] = storedHash.split('$');
  const actual = await scrypt(password, salt, 64, PARAMETERS);
  return timingSafeEqual(actual, Buffer.from(expectedHex, 'hex'));
}

module.exports = { hashPassword, verifyPassword, isPasswordHash };
