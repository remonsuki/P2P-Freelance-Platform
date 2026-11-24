const assert = require('node:assert/strict');
const { test } = require('node:test');
const { FetchRequest, FetchResponse } = require('ethers');
const { main } = require('../scripts/deploy');
const { SEPOLIA_CHAIN_ID, sepoliaRpcUrl } = require('../sepolia');

const env = {
  CHAIN_ID: String(SEPOLIA_CHAIN_ID),
  CHAIN_RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  SKILL_TOKEN_ADDRESS: '0x2000000000000000000000000000000000000002',
  QUOTE_SIGNER_ADDRESS: '0x3000000000000000000000000000000000000003',
};

test('deployment rejects non-Sepolia chain IDs and local endpoints before requesting RPC', async t => {
  const send = t.mock.method(FetchRequest.prototype, 'send', () => assert.fail('Unexpected RPC request'));
  for (const CHAIN_ID of ['1', '1337', '31337']) {
    await assert.rejects(main({ env: { ...env, CHAIN_ID }, args: ['--send'] }), /CHAIN_ID.*Sepolia/);
  }
  for (const CHAIN_RPC_URL of ['http://ethereum-sepolia-rpc.publicnode.com', 'https://localhost',
    'https://rpc.localhost.', 'https://rpc.internal', 'https://127.0.0.1', 'https://[::1]']) {
    await assert.rejects(main({ env: { ...env, CHAIN_RPC_URL }, args: ['--send'] }), /CHAIN_RPC_URL.*remote HTTPS/);
  }
  assert.equal(send.mock.callCount(), 0);
  assert.equal(sepoliaRpcUrl(env.CHAIN_RPC_URL).hostname, 'ethereum-sepolia-rpc.publicnode.com');
});

test('deployment stops when the remote RPC reports a different network', async t => {
  const methods = [];
  t.mock.method(FetchRequest.prototype, 'send', async function () {
    const request = JSON.parse(Buffer.from(this.body).toString());
    const replies = [request].flat().map(message => {
      methods.push(message.method);
      assert.equal(message.method, 'eth_chainId');
      return { id: message.id, jsonrpc: '2.0', result: '0x1' };
    });
    const body = Buffer.from(JSON.stringify(Array.isArray(request) ? replies : replies[0]));
    return new FetchResponse(200, 'OK', { 'content-type': 'application/json' }, body, this);
  });

  await assert.rejects(main({ env, args: ['--send'] }), /network changed|RPC.*Sepolia chain ID/);
  assert.ok(methods.length > 0);
});
