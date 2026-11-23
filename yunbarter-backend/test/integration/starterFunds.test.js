const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const { Wallet, parseEther, parseUnits, toQuantity } = require('ethers');
const { fixture } = require('../../../blockchain/test/helpers');
const { assertConfigured, connectionOptions } = require('../../db');
const { migrate } = require('../../scripts/migrate');
const { createApp } = require('../../server');
const { createStarterFunds } = require('../../starterFunds');

test('verified registration pays one 30 SKILL and one 0.0016 ETH grant across retries and restarts', async (t) => {
  const env = process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : process.env;
  assertConfigured(env);
  const pool = new Pool(connectionOptions(env));
  const schema = 'yunbarter_starter_' + randomBytes(8).toString('hex');
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    try { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await pool.end(); }
  });
  await pool.query(`CREATE SCHEMA "${schema}"`);
  const db = {
    async connect() {
      const client = await pool.connect();
      try {
        await client.query("SELECT set_config('search_path', $1, false)", [schema]);
        return client;
      } catch (error) {
        client.release();
        throw error;
      }
    },
    async query(sql, values) {
      const client = await db.connect();
      try { return await client.query(sql, values); }
      finally { client.release(); }
    },
  };
  await migrate(db);
  const chain = await fixture(t);
  const donor = chain.wallets[0];
  const recipient = Wallet.createRandom();
  const skillAmount = parseUnits('30', 18);
  const ethAmount = parseEther('0.0016');
  const starterEnv = {
    STARTER_FUNDS_ENABLED: 'true',
    STARTER_FUNDS_PRIVATE_KEY: donor.privateKey,
    CHAIN_ID: '1337',
    CHAIN_CONFIRMATIONS: '1',
    SKILL_TOKEN_ADDRESS: await chain.token.getAddress(),
  };
  const startWorker = () => createStarterFunds(starterEnv, { provider: chain.provider });

  server = createApp({ db, chain: null, secureCookies: false }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, body, cookie) {
    const response = await fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.getSetCookie()[0]?.split(';')[0] };
  }
  const payload = { email: 'starter@example.com', password: 'wallet-password-123', userName: 'Starter Test' };
  const challenge = await request('/api/auth/register/wallet-challenge', { email: payload.email, walletAddress: recipient.address });
  assert.equal(challenge.status, 200);
  const walletProof = {
    challengeId: challenge.body.challengeId,
    signature: await recipient.signMessage(challenge.body.message),
  };
  const forgedProof = { ...walletProof, signature: await Wallet.createRandom().signMessage(challenge.body.message) };
  assert.equal((await request('/api/auth/register', { ...payload, walletProof: forgedProof }, challenge.cookie)).status, 403);
  const grants = async () => (await db.query(`
    SELECT 'SKILL' AS asset, user_id, wallet_address, transaction_hash, confirmed_at FROM starter_skill_grants
    UNION ALL
    SELECT 'ETH', eth.user_id, skill.wallet_address, eth.transaction_hash, eth.confirmed_at
    FROM starter_eth_grants eth JOIN starter_skill_grants skill ON skill.user_id=eth.user_id
    ORDER BY asset
  `)).rows;
  assert.deepEqual(await grants(), []);

  const account = await request('/api/auth/register', { ...payload, walletProof }, challenge.cookie);
  assert.equal(account.status, 201);
  assert.equal((await request('/api/auth/register', { ...payload, walletProof }, challenge.cookie)).status, 409);
  const queued = await grants();
  assert.deepEqual(queued.map(grant => grant.asset), ['ETH', 'SKILL']);
  for (const grant of queued) {
    assert.equal(grant.user_id, String(account.body.userId));
    assert.equal(grant.wallet_address, recipient.address.toLowerCase());
    assert.equal(grant.transaction_hash, null);
    assert.equal(grant.confirmed_at, null);
  }
  assert.equal(await chain.token.balanceOf(recipient.address), 0n);
  assert.equal(await chain.provider.getBalance(recipient.address), 0n);

  async function finishAfterInterruptedBroadcast(asset) {
    const worker = startWorker();
    const originalBroadcast = chain.provider.broadcastTransaction;
    let attemptedBroadcast = false;
    chain.provider.broadcastTransaction = async () => {
      attemptedBroadcast = true;
      throw new Error('Simulated connection loss before broadcasting');
    };
    try {
      await assert.rejects(() => worker.processNext(db), /廣播/);
    } finally {
      chain.provider.broadcastTransaction = originalBroadcast;
      await worker.close();
    }
    assert.ok(attemptedBroadcast);
    const pending = (await grants()).find(grant => grant.asset === asset);
    assert.match(pending.transaction_hash, /^0x[\da-f]{64}$/);
    assert.equal(pending.confirmed_at, null);
    assert.equal(await chain.provider.getTransaction(pending.transaction_hash), null);

    const restarted = startWorker();
    try {
      for (const status of ['broadcast', 'confirmed']) {
        const result = await restarted.processNext(db);
        assert.equal(result.status, status);
        assert.equal(result.asset, asset);
        assert.equal(result.transactionHash, pending.transaction_hash);
      }
    } finally {
      await restarted.close();
    }
    return pending.transaction_hash;
  }

  const donorBalance = await chain.provider.getBalance(donor.address);
  await chain.rpc.request({ method: 'evm_setAccountBalance', params: [donor.address, toQuantity(parseEther('0.001'))] });
  const skillHash = await finishAfterInterruptedBroadcast('SKILL');
  assert.equal(await chain.token.balanceOf(recipient.address), skillAmount);
  const lowBalanceWorker = startWorker();
  try {
    await assert.rejects(() => lowBalanceWorker.processNext(db));
  } finally {
    await lowBalanceWorker.close();
  }
  assert.equal((await grants()).find(grant => grant.asset === 'ETH').transaction_hash, null);
  assert.equal(await chain.provider.getBalance(recipient.address), 0n);

  await chain.rpc.request({ method: 'evm_setAccountBalance', params: [donor.address, toQuantity(donorBalance)] });
  const ethHash = await finishAfterInterruptedBroadcast('ETH');

  const restarted = startWorker();
  try {
    assert.equal((await restarted.processNext(db)).status, 'idle');
  } finally {
    await restarted.close();
  }
  const confirmed = await grants();
  assert.deepEqual(confirmed.map(grant => grant.transaction_hash), [ethHash, skillHash]);
  assert.ok(confirmed.every(grant => grant.confirmed_at));
  assert.equal(await chain.provider.getBalance(recipient.address), ethAmount);
  const ethTransfer = await chain.provider.getTransaction(ethHash);
  assert.equal(ethTransfer.from, donor.address);
  assert.equal(ethTransfer.to, recipient.address);
  assert.equal(ethTransfer.value, ethAmount);
  assert.equal((await chain.provider.getTransactionReceipt(ethHash)).status, 1);
  assert.equal(await chain.token.balanceOf(recipient.address), skillAmount);
  const transfers = await chain.token.queryFilter(chain.token.filters.Transfer(donor.address, recipient.address));
  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].transactionHash, skillHash);
  assert.equal(transfers[0].args.value, skillAmount);
});
