const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Interface, Wallet, ZeroAddress, ZeroHash } = require('ethers');
const protocol = require('../../blockchain/protocol.json');
const { createChainService } = require('../chain');

const signer = Wallet.createRandom();
const student = { id: '1', username: 'Student', verified_wallet_address: '0x' + '1'.repeat(40) };
const teacher = { id: '2', username: 'Teacher', verified_wallet_address: '0x' + '2'.repeat(40) };
const tokenAddress = '0x' + '3'.repeat(40);
const escrowAddress = '0x' + '4'.repeat(40);
const body = { courseId: 3, timeSlot: '2030-01-04|Morning' };
const timestamp = 1904288000;
const paymentId = '0x' + '5'.repeat(64);
const expired = {
  payment_id: paymentId, class_id: '9', student_id: '7', teacher_id: teacher.id,
  chain_id: '11155111', escrow_address: escrowAddress, token_address: tokenAddress,
  quote: { deadline: String(timestamp - 100) }, status: 'quoted', synced_block: 0,
};

function fixture({ conflict, confirmedTime = timestamp, latestFailures = 0, studentConflict = false, onReserve = () => {} } = {}) {
  const escrow = new Interface(protocol.abi);
  const token = new Interface(['function decimals() view returns(uint8)', 'function symbol() view returns(string)']);
  const calls = { sql: [], latest: 0, state: [], syncStatus: [], inserted: 0 };
  let status = conflict?.status;
  const provider = {
    async getNetwork() { return { chainId: 11155111n }; },
    async getCode() { return '0x01'; },
    async getBlock(tag) {
      if (tag === 'latest' && ++calls.latest <= latestFailures) {
        throw Object.assign(new Error('private RPC details'), { code: 'TIMEOUT' });
      }
      return { number: tag === 'latest' ? 100 : tag, timestamp: tag === 'latest' ? timestamp : confirmedTime };
    },
    async call(request) {
      const abi = request.to === escrowAddress ? escrow : token;
      const fn = abi.getFunction(request.data.slice(0, 10));
      const values = { version: 1n, token: tokenAddress, quoteSigner: signer.address, decimals: 18, symbol: 'SKILL' };
      if (fn.name === 'getPayment') {
        const [id] = abi.decodeFunctionData(fn, request.data);
        calls.state.push({ id, block: request.blockTag });
        return abi.encodeFunctionResult(fn, [[[ZeroHash, ZeroHash, ZeroAddress, ZeroAddress, 0n, 0n, 0n, 0n], 0, 0n, 0n]]);
      }
      return abi.encodeFunctionResult(fn, [values[fn.name]]);
    },
  };
  const row = value => ({ rows: value ? [value] : [], rowCount: value ? 1 : 0 });
  const db = {
    async connect() { return { query: this.query, release() {} }; },
    async query(sql, args) {
      calls.sql.push(sql);
      if (sql.startsWith('SELECT teacher_id FROM courses')) return row({ teacher_id: teacher.id });
      if (sql.startsWith('SELECT payment_id FROM chain_payments')) {
        assert.match(sql, /scheduled_date=\$1 AND slot_type=\$2 AND \(teacher_id=\$3 OR student_id=\$4\)/);
        assert.deepEqual(args, ['2030-01-04', 'morning', teacher.id, student.id]);
        return row(conflict);
      }
      if (sql.startsWith('SELECT * FROM chain_payments WHERE payment_id=')) return row({ ...conflict, status });
      if (sql.startsWith('UPDATE chain_payments SET status=')) {
        status = args[1];
        calls.syncStatus.push(status);
        return row();
      }
      if (sql.startsWith('SELECT * FROM users')) return row(args[0] === student.id ? student : teacher);
      if (sql.startsWith('SELECT * FROM courses')) return row({ teacher_id: teacher.id, price: '1', title: 'QA course' });
      if (sql.startsWith('SELECT * FROM chain_payments')) return row();
      if (sql.startsWith('SELECT c.*')) return row(status === 'quoted' ? null : { class_id: '9', starts: timestamp + 1800, ends: timestamp + 5400 });
      if (sql.startsWith('SELECT 1 FROM bookings')) {
        assert.match(sql, /UNION ALL SELECT 1 FROM chain_payments WHERE student_id=\$1/);
        return row(studentConflict);
      }
      if (sql.startsWith('INSERT INTO chain_payments')) {
        calls.inserted++;
        return row({ payment_id: args[0], student_id: args[1], course_id: args[3], quote: args[14], status: 'quoted' });
      }
      if (sql.startsWith('UPDATE classes SET is_booked=TRUE')) onReserve();
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('SELECT user_id FROM users') || sql.startsWith('UPDATE classes SET is_booked=')) return row();
      assert.fail('Unexpected SQL: ' + sql);
    },
  };
  const chain = createChainService({ CHAIN_ENABLED: 'true', CHAIN_ID: '11155111', CHAIN_RPC_URL: 'https://rpc.example.invalid',
    CHAIN_QUOTE_PRIVATE_KEY: signer.privateKey, SKILL_TOKEN_ADDRESS: tokenAddress, SKILL_ESCROW_ADDRESS: escrowAddress }, { provider });
  return { request: signal => chain.quote(db, student.id, body, signal), calls };
}

test('quote skips unrelated payments and retries a transient latest-block read once', async () => {
  const { request, calls } = fixture({ latestFailures: 1 });
  const payment = await request();
  assert.equal(payment.status, 'quoted');
  assert.equal(calls.latest, 2);
  assert.equal(calls.inserted, 1);
  assert.deepEqual(calls.state, []);
});

test('quote expires a conflicting hold only when the confirmed chain block proves it is unpaid and expired', async () => {
  const { request, calls } = fixture({ conflict: expired });
  await request();
  assert.deepEqual(calls.state, [{ id: paymentId, block: 99 }]);
  assert.deepEqual(calls.syncStatus, ['expired']);
  const expire = calls.sql.findIndex(sql => sql.startsWith('UPDATE chain_payments SET status='));
  const insert = calls.sql.findIndex(sql => sql.startsWith('INSERT INTO chain_payments'));
  assert.ok(expire >= 0 && expire < insert);
});

test('quote cannot expire a hold when only the latest, unconfirmed block is past its deadline', async () => {
  const { request, calls } = fixture({ conflict: expired, confirmedTime: timestamp - 101 });
  await assert.rejects(request(), { status: 409, message: /時段已無法預約/ });
  assert.deepEqual(calls.syncStatus, ['quoted']);
  assert.equal(calls.inserted, 0);
});

test('quote fails closed for a relevant hold when two RPC reads time out, with no reservation', async () => {
  const { request, calls } = fixture({ conflict: expired, latestFailures: 2 });
  await assert.rejects(request(), { status: 503, message: /此時段的鏈上付款/ });
  assert.equal(calls.latest, 2);
  assert.equal(calls.inserted, 0);
  assert.ok(!calls.sql.includes('BEGIN'));
});

test('exhausted latest-block retries produce an actionable RPC error without a new reservation', async () => {
  const { request, calls } = fixture({ latestFailures: 2 });
  await assert.rejects(request(), { status: 503, message: /鏈上 RPC/ });
  assert.equal(calls.latest, 2);
  assert.equal(calls.inserted, 0);
});

test('student payment conflicts are checked again after taking the database locks', async () => {
  const { request, calls } = fixture({ studentConflict: true });
  await assert.rejects(request(), { status: 409, message: /待付款紀錄/ });
  assert.ok(calls.sql.includes('ROLLBACK'));
  assert.equal(calls.inserted, 0);
});

test('client interruption during slot reservation rolls back the new quote', async () => {
  const controller = new AbortController();
  const { request, calls } = fixture({ onReserve: () => controller.abort() });
  await assert.rejects(request(controller.signal), { name: 'AbortError' });
  assert.equal(calls.inserted, 1);
  assert.equal(calls.sql.at(-1), 'ROLLBACK');
  assert.ok(!calls.sql.includes('COMMIT'));
});
