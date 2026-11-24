const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Wallet } = require('ethers');
const { walletNetwork } = require('../walletNetwork');
const { createChainService } = require('../chain');
const { createStarterFunds } = require('../starterFunds');

const remote = 'https://ethereum-sepolia-rpc.publicnode.com';

test('wallet metadata uses Sepolia, native ETH, and the configured public RPC', () => {
  const network = walletNetwork({ CHAIN_WALLET_RPC_URL: remote });
  assert.equal(network.chainId, '0xaa36a7');
  assert.equal(network.chainName, 'Sepolia');
  assert.deepEqual(network.rpcUrls, [remote + '/']);
  assert.deepEqual(network.nativeCurrency, { name: 'Ether', symbol: 'ETH', decimals: 18 });
  assert.deepEqual(network.blockExplorerUrls, ['https://sepolia.etherscan.io']);
});

test('backend RPC credentials are never reused as public wallet settings', () => {
  for (const url of ['https://rpc.provider.com/private-api-key', 'https://name:secret@rpc.provider.com', 'https://rpc.provider.com/?key=secret']) {
    const network = walletNetwork({ CHAIN_RPC_URL: url });
    assert.deepEqual(network.rpcUrls, []);
    assert.equal(JSON.stringify(network).includes('secret'), false);
  }
});

test('wallet metadata rejects embedded credentials and local RPC endpoints', () => {
  assert.throws(() => walletNetwork({ CHAIN_WALLET_RPC_URL: 'https://user:secret@rpc.provider.com' }), /無帳密/);
  for (const url of ['http://localhost:8545', 'https://127.0.0.1:8545', 'https://[::1]:8545', 'https://chain.local']) {
    assert.throws(() => walletNetwork({ CHAIN_WALLET_RPC_URL: url }), /CHAIN_WALLET_RPC_URL/);
  }
});

test('payments and starter grants reject a non-Sepolia chain ID before using RPC', () => {
  for (const chainId of ['1', '1337', '31337']) {
    assert.throws(() => createChainService({ CHAIN_ENABLED: 'true', CHAIN_ID: chainId }), /Sepolia/);
    assert.throws(() => createStarterFunds({ STARTER_FUNDS_ENABLED: 'true', CHAIN_ID: chainId }), /Sepolia/);
  }
});

test('a remote RPC reporting the wrong network never reaches contract checks', async () => {
  let checkedContract = false;
  const provider = {
    async getNetwork() { return { chainId: 1n }; },
    async getCode() { checkedContract = true; return '0x01'; },
  };
  const chain = createChainService({ CHAIN_ENABLED: 'true', CHAIN_RPC_URL: remote,
    CHAIN_QUOTE_PRIVATE_KEY: Wallet.createRandom().privateKey,
    SKILL_TOKEN_ADDRESS: '0x' + '1'.repeat(40), SKILL_ESCROW_ADDRESS: '0x' + '2'.repeat(40) }, { provider });
  await assert.rejects(() => chain.ready(), { status: 503 });
  assert.equal(checkedContract, false);
});
