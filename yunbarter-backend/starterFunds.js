const {
  Contract, FetchRequest, Interface, JsonRpcProvider, Transaction, Wallet,
  ZeroAddress, getAddress, parseUnits,
} = require('ethers');
const { sepoliaChainId, sepoliaRpcUrl } = require('../blockchain/sepolia');

const STARTER_SKILL_AMOUNT = parseUnits('30', 18);
const STARTER_ETH_AMOUNT = parseUnits('0.0016', 18);
const GRANT_TABLES = { SKILL: 'starter_skill_grants', ETH: 'starter_eth_grants' };
const SEPOLIA_FEE_CAP_FLOOR = parseUnits('0.2', 'gwei');
const SEPOLIA_TIP_FLOOR = parseUnits('0.001', 'gwei');
const TOKEN_ABI = new Interface([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const WORKER_LOCK = 92610432;

function configuredWallet(key) {
  try {
    return new Wallet(key);
  } catch {
    throw new Error('STARTER_FUNDS_PRIVATE_KEY 必須設定為有效的發放錢包金鑰');
  }
}

function createStarterFunds(env = process.env, { provider } = {}) {
  if (env.STARTER_FUNDS_ENABLED !== 'true') return null;

  const chainId = sepoliaChainId(env.CHAIN_ID);
  const confirmations = Number(env.CHAIN_CONFIRMATIONS || 2);
  if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 64) {
    throw new Error('CHAIN_CONFIRMATIONS 必須為 1 至 64');
  }
  const tokenAddress = getAddress(env.SKILL_TOKEN_ADDRESS);
  if (tokenAddress === ZeroAddress) throw new Error('請設定 SKILL_TOKEN_ADDRESS');
  const wallet = configuredWallet(env.STARTER_FUNDS_PRIVATE_KEY);
  if (env.CHAIN_QUOTE_PRIVATE_KEY && env.CHAIN_QUOTE_PRIVATE_KEY.toLowerCase().replace(/^0x/, '') === wallet.privateKey.slice(2).toLowerCase()) {
    throw new Error('起始 SKILL 發放錢包須獨立於報價簽章錢包');
  }

  let rpc = provider;
  if (!rpc) {
    const rpcUrl = env.STARTER_FUNDS_RPC_URL
      ? sepoliaRpcUrl(env.STARTER_FUNDS_RPC_URL, 'STARTER_FUNDS_RPC_URL')
      : sepoliaRpcUrl(env.CHAIN_RPC_URL, 'CHAIN_RPC_URL');
    const request = new FetchRequest(rpcUrl.href);
    request.timeout = 15000;
    rpc = new JsonRpcProvider(request, chainId, { cacheTimeout: -1, batchMaxCount: 1 });
  }

  const token = new Contract(tokenAddress, TOKEN_ABI, rpc);
  const signer = wallet.connect(rpc);
  let readiness;

  async function ready() {
    if (!readiness) {
      readiness = (async () => {
        if ((await rpc.getNetwork()).chainId !== BigInt(chainId)) throw new Error('起始 SKILL RPC 網路與 CHAIN_ID 不符');
        if (await rpc.getCode(tokenAddress) === '0x' || await token.decimals() !== 18n || await token.symbol() !== 'SKILL') {
          throw new Error('起始資金需要 18 位小數的 SKILL 合約');
        }
      })().catch(error => {
        readiness = undefined;
        throw error;
      });
    }
    await readiness;
  }

  function grantTransfer(grant) {
    const recipient = getAddress(grant.wallet_address);
    if (grant.asset === 'ETH') return { to: recipient, value: STARTER_ETH_AMOUNT, data: '0x' };
    return { to: tokenAddress, value: 0n, data: TOKEN_ABI.encodeFunctionData('transfer', [recipient, STARTER_SKILL_AMOUNT]) };
  }

  function savedTransaction(grant) {
    const transaction = Transaction.from(grant.signed_transaction);
    const { to, value, data } = grantTransfer(grant);
    if (!transaction.isSigned() || transaction.hash !== grant.transaction_hash || transaction.chainId !== BigInt(chainId)
      || transaction.to !== to || transaction.value !== value || transaction.data !== data) {
      throw new Error(`待發放交易與起始 ${grant.asset} 記錄不符`);
    }
    return transaction;
  }

  async function broadcast(grant) {
    let sent;
    try {
      sent = await rpc.broadcastTransaction(grant.signed_transaction);
    } catch (error) {
      // The RPC can accept a transaction and lose the response before it reaches the caller.
      if (!await rpc.getTransaction(grant.transaction_hash) && !await rpc.getTransactionReceipt(grant.transaction_hash)) {
        const failure = new Error(`無法確認起始 ${grant.asset} 交易已廣播`);
        failure.code = error.code;
        throw failure;
      }
      return;
    }
    if (sent.hash !== grant.transaction_hash) throw new Error(`起始 ${grant.asset} 廣播回傳的交易雜湊不符`);
  }

  async function inspectSignedGrant(client, grant, result) {
    const transaction = savedTransaction(grant);
    const receipt = await rpc.getTransactionReceipt(grant.transaction_hash);
    if (!receipt) {
      if (await rpc.getTransaction(grant.transaction_hash)) return result('pending');
      await broadcast(grant);
      return result('broadcast');
    }

    const [head, block] = await Promise.all([rpc.getBlockNumber(), rpc.getBlock(receipt.blockNumber)]);
    if (head - receipt.blockNumber + 1 < confirmations || block?.hash !== receipt.blockHash) return result('pending');

    if (receipt.hash !== grant.transaction_hash || receipt.to !== transaction.to || receipt.from !== transaction.from) {
      throw new Error(`起始 ${grant.asset} 收據與已簽署交易不符`);
    }
    const table = GRANT_TABLES[grant.asset];
    if (receipt.status === 0) {
      await client.query(`UPDATE ${table} SET signed_transaction=NULL, transaction_hash=NULL
        WHERE user_id=$1 AND transaction_hash=$2`, [grant.user_id, grant.transaction_hash]);
      return result('retry');
    }
    if (receipt.status !== 1) throw new Error(`起始 ${grant.asset} 收據無法確認交易成功`);
    if (grant.asset === 'SKILL') {
      const recipient = getAddress(grant.wallet_address);
      const matchingTransfer = receipt.logs.some(log => {
        if (getAddress(log.address) !== tokenAddress || log.topics[0] !== TOKEN_ABI.getEvent('Transfer').topicHash) return false;
        const { args } = TOKEN_ABI.parseLog(log);
        return args.from === transaction.from && args.to === recipient && args.value === STARTER_SKILL_AMOUNT;
      });
      if (!matchingTransfer) throw new Error('起始 SKILL 收據缺少正確的 30 SKILL 轉帳事件');
    }

    await client.query(`UPDATE ${table} SET confirmed_at=NOW()
      WHERE user_id=$1 AND transaction_hash=$2`, [grant.user_id, grant.transaction_hash]);
    return result('confirmed');
  }

  async function prepareGrant(grant) {
    const request = { ...grantTransfer(grant), chainId };
    if (grant.asset === 'SKILL' && await token.balanceOf(wallet.address) < STARTER_SKILL_AMOUNT) {
      throw new Error('發放錢包的 SKILL 不足');
    }
    const balance = await rpc.getBalance(wallet.address);
    if (balance <= request.value) throw new Error('發放錢包的 ETH 不足以支付起始資金與 Gas');
    const { maxFeePerGas, maxPriorityFeePerGas } = await rpc.getFeeData();
    request.maxPriorityFeePerGas = maxPriorityFeePerGas > SEPOLIA_TIP_FLOOR ? maxPriorityFeePerGas : SEPOLIA_TIP_FLOOR;
    request.maxFeePerGas = (maxFeePerGas > SEPOLIA_FEE_CAP_FLOOR ? maxFeePerGas : SEPOLIA_FEE_CAP_FLOOR)
      + request.maxPriorityFeePerGas;
    const unsigned = await signer.populateTransaction(request);
    const fee = (unsigned.maxFeePerGas ?? unsigned.gasPrice) * unsigned.gasLimit;
    if (balance < request.value + fee) throw new Error('發放錢包的 ETH 不足以支付起始資金與 Gas');
    return unsigned;
  }

  async function processNext(db) {
    const client = await db.connect();
    let acquired = false;
    let unlockError;
    try {
      const { rows: [lock] } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [WORKER_LOCK]);
      acquired = lock.acquired;
      if (!acquired) return { status: 'busy' };

      const { rows: grants } = await client.query(`
        WITH skill AS (
          SELECT 'SKILL' AS asset, user_id, wallet_address, signed_transaction, transaction_hash
          FROM starter_skill_grants WHERE confirmed_at IS NULL
          ORDER BY (signed_transaction IS NULL), user_id LIMIT 1
        ), eth AS (
          SELECT 'ETH' AS asset, eth.user_id, skill.wallet_address, eth.signed_transaction, eth.transaction_hash
          FROM starter_eth_grants eth JOIN starter_skill_grants skill USING (user_id)
          WHERE eth.confirmed_at IS NULL
          ORDER BY (eth.signed_transaction IS NULL), eth.user_id LIMIT 1
        )
        SELECT * FROM (SELECT * FROM skill UNION ALL SELECT * FROM eth) grants
        ORDER BY (signed_transaction IS NULL), CASE asset WHEN 'SKILL' THEN 0 ELSE 1 END`);
      if (grants.length === 0) return { status: 'idle' };
      await ready();
      let deferred;
      for (const grant of grants) {
        const result = status => ({ status, asset: grant.asset, userId: grant.user_id, transactionHash: grant.transaction_hash });
        if (grant.signed_transaction) return await inspectSignedGrant(client, grant, result);

        let unsigned;
        try {
          unsigned = await prepareGrant(grant);
        } catch (error) {
          // Nothing has been signed, so the other asset can still be processed safely.
          deferred ??= error;
          continue;
        }
        grant.signed_transaction = await signer.signTransaction(unsigned);
        grant.transaction_hash = Transaction.from(grant.signed_transaction).hash;

        // Commit the exact signed payload before any RPC may publish it.
        const saved = await client.query(`UPDATE ${GRANT_TABLES[grant.asset]}
          SET signed_transaction=$2, transaction_hash=$3 WHERE user_id=$1`,
        [grant.user_id, grant.signed_transaction, grant.transaction_hash]);
        if (saved.rowCount !== 1) throw new Error(`無法保存已簽署的起始 ${grant.asset} 交易`);
        await broadcast(grant);
        return result('broadcast');
      }
      throw deferred;
    } finally {
      if (acquired) {
        try {
          await client.query('SELECT pg_advisory_unlock($1)', [WORKER_LOCK]);
        } catch (error) {
          unlockError = error;
        }
      }
      client.release(unlockError);
    }
  }

  function close() {
    if (!provider) rpc.destroy();
  }

  return { processNext, close };
}

module.exports = { createStarterFunds };
