const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: wait } = require('node:timers/promises');
const { parse } = require('dotenv');
const {
  Contract, FetchRequest, JsonRpcProvider, Transaction, Wallet, formatEther, formatUnits,
  getAddress, parseUnits,
} = require('ethers');

const chainId = 11155111n;
const bookings = 3n;
const approvalGas = 150_000n;
const escrowFundingGas = 1_250_000n;
const completionGas = 200_000n;
const gasPerBooking = approvalGas + escrowFundingGas + completionGas;
const bookingGas = bookings * gasPerBooking;
const senderFeeFloor = parseUnits('0.2', 9);
const senderTipFloor = parseUnits('0.001', 9);
const tokenAbi = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
];
const usage = 'node scripts/top-up-booking-wallets.js [--eth-target <ETH> | --max-fee-gwei <GWEI>] [--eth-only] [--batch <label>] [--send | --verify]';

class FundingError extends Error {}

function requireCondition(condition, message) {
  if (!condition) throw new FundingError(message);
}

function parseArguments(args) {
  const options = { send: false, verify: false, help: false, ethOnly: false, batch: '' };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--send') options.send = true;
    else if (flag === '--verify') options.verify = true;
    else if (flag === '--help') options.help = true;
    else if (flag === '--eth-only') options.ethOnly = true;
    else if (flag === '--batch') {
      const label = args[++index];
      requireCondition(!options.batch && /^[a-z0-9][a-z0-9-]{0,59}$/.test(label || ''),
        '--batch 需要單一標籤，限 1 至 60 個小寫英文字母、數字或連字號。');
      options.batch = label;
    } else if (flag === '--eth-target' || flag === '--max-fee-gwei') {
      requireCondition(!options.targetFlag, '請擇一指定 --eth-target 或 --max-fee-gwei。');
      const input = args[++index];
      requireCondition(/^\d+(?:\.\d+)?$/.test(input || ''), `${flag} 需要正數。`);
      const decimals = flag === '--eth-target' ? 18 : 9;
      requireCondition((input.split('.')[1] || '').length <= decimals, `${flag} 小數位數過多。`);
      const amount = parseUnits(input, decimals);
      requireCondition(amount > 0n, `${flag} 需要正數。`);
      options.targetFlag = flag;
      options.pinnedAmount = amount;
    } else throw new FundingError('無法辨識參數。請使用 --help。');
  }
  requireCondition(!options.send || !options.verify, '請擇一使用 --send 或 --verify。');
  requireCondition(options.help || !(options.send || options.verify) || options.targetFlag,
    '發送或驗證交易前請先用 --eth-target 或 --max-fee-gwei 固定 ETH 補給門檻。');
  requireCondition(options.help || !options.ethOnly || options.targetFlag === '--eth-target',
    '--eth-only 需搭配 --eth-target。');
  return options;
}

async function loadSettings(env, options) {
  requireCondition(env.CHAIN_ID === String(chainId), '補給僅支援設定為 Ethereum Sepolia 的後端。');
  const rpc = env.TOPUP_RPC_URL || env.CHAIN_RPC_URL;
  requireCondition(rpc, '請設定 CHAIN_RPC_URL 或 TOPUP_RPC_URL。');
  const confirmations = Number(env.CHAIN_CONFIRMATIONS || 2);
  requireCondition(Number.isSafeInteger(confirmations) && confirmations >= 1, 'CHAIN_CONFIRMATIONS 必須為正整數。');
  const tokenAddress = getAddress(env.SKILL_TOKEN_ADDRESS);
  const escrowAddress = getAddress(env.SKILL_ESCROW_ADDRESS);
  let donorKey = env.TOPUP_PRIVATE_KEY;
  if (!donorKey) {
    const deployerEnv = parse(await fs.readFile(path.join(__dirname, '../../blockchain/.env')));
    requireCondition(deployerEnv.CHAIN_ID === String(chainId)
      && getAddress(deployerEnv.SKILL_TOKEN_ADDRESS) === tokenAddress, '部署錢包的網路與 SKILL 設定不相符。');
    donorKey = deployerEnv.DEPLOYER_PRIVATE_KEY;
  }
  requireCondition(donorKey, '請在本機設定補給錢包。');
  const donor = new Wallet(donorKey);
  if (env.CHAIN_QUOTE_PRIVATE_KEY) {
    requireCondition(donor.address !== new Wallet(env.CHAIN_QUOTE_PRIVATE_KEY).address, '補給錢包須與報價簽章錢包分開。');
  }
  const progressDir = path.join(__dirname, '../../.local-backups/booking-wallet-topups');
  const batchSuffix = options.batch ? `-${options.batch}` : '';
  const progressPath = path.join(progressDir, `${chainId}-${tokenAddress.toLowerCase()}-${donor.address.toLowerCase()}${batchSuffix}.json`);
  if (options.send) await fs.mkdir(progressDir, { recursive: true });
  return { rpc, confirmations, tokenAddress, escrowAddress, donor, progressPath };
}

function ethTarget(options, maxFeePerGas) {
  if (options.targetFlag === '--eth-target') return options.pinnedAmount;
  return bookingGas * (options.pinnedAmount || maxFeePerGas);
}

function transferRequest(token, action, amount) {
  if (action.asset === 'ETH') return { to: action.recipient, value: amount, data: '0x' };
  return { to: token.target, value: 0n, data: token.interface.encodeFunctionData('transfer', [action.recipient, amount]) };
}

function actionBalance(provider, token, asset, address) {
  return asset === 'ETH' ? provider.getBalance(address) : token.balanceOf(address);
}

function positiveDeficit(target, balance) {
  return target > balance ? target - balance : 0n;
}

function baselineGas(asset) {
  return asset === 'ETH' ? 21_000n : 65_000n;
}

async function estimateActionGas(provider, token, donor, action, amount, gasFloor = baselineGas(action.asset)) {
  const estimate = await provider.estimateGas({ from: donor.address, ...transferRequest(token, action, amount) });
  const buffered = (estimate * 125n + 99n) / 100n;
  return buffered > gasFloor ? buffered : gasFloor;
}

function budget(actions, maxFeePerGas) {
  let eth = 0n;
  let skill = 0n;
  let fees = 0n;
  for (const action of actions) {
    if (action.asset === 'ETH') eth += BigInt(action.amount);
    else skill += BigInt(action.amount);
    fees += BigInt(action.gasLimit) * maxFeePerGas;
  }
  return { eth, skill, fees };
}

function checkTransferLimits(progress, env) {
  const totals = budget(progress.actions, BigInt(progress.maxFeePerGas));
  for (const [name, total] of [
    ['TOPUP_LIMIT_SKILL', totals.skill],
    ['TOPUP_LIMIT_ETH', totals.eth],
    ['TOPUP_LIMIT_GAS_ETH', totals.fees],
  ]) {
    if (env[name] !== undefined) {
      requireCondition(total <= parseUnits(env[name], 18), `補給計畫超出 ${name} 核准的上限。`);
    }
  }
}

async function accountList(client) {
  const { rows: users } = await client.query('SELECT verified_wallet_address FROM users ORDER BY user_id');
  const recipients = [...new Set(users.filter(u => u.verified_wallet_address).map(u => getAddress(u.verified_wallet_address)))];
  return { users: users.length, unbound: users.filter(u => !u.verified_wallet_address).length, recipients };
}

async function plan(client, provider, token, settings, options, accounts) {
  let mostExpensive = 0n;
  if (!options.ethOnly) {
    const { rows: [course] } = await client.query('SELECT MAX(price)::text AS highest FROM courses WHERE is_active');
    requireCondition(course.highest, '沒有啟用中的課程，無法計算三次預約所需 SKILL。');
    mostExpensive = parseUnits(course.highest, 18);
  }
  const feeData = await provider.getFeeData();
  requireCondition(feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null, 'RPC 未提供 EIP-1559 費率。');
  const feeCap = feeData.maxFeePerGas > senderFeeFloor ? feeData.maxFeePerGas : senderFeeFloor;
  const priorityFee = feeData.maxPriorityFeePerGas > senderTipFloor ? feeData.maxPriorityFeePerGas : senderTipFloor;
  requireCondition(feeCap >= priorityFee, '補給錢包的費率上限低於優先費。');
  const targetETH = ethTarget(options, feeCap);
  const targetSKILL = mostExpensive * bookings;
  const targets = balanceTargets({ ethOnly: options.ethOnly, targetETH, targetSKILL });
  const donorIsUser = accounts.recipients.includes(settings.donor.address);
  const reserveDonorETH = donorIsUser ? targetETH : 0n;
  const reserveDonorSKILL = donorIsUser ? targetSKILL : 0n;
  const actions = [];
  for (const recipient of accounts.recipients) {
    if (recipient === settings.donor.address) continue;
    const balances = await Promise.all(targets.map(([asset]) => actionBalance(provider, token, asset, recipient)));
    for (const [index, [asset, target]] of targets.entries()) {
      const amount = positiveDeficit(target, balances[index]);
      if (amount > 0n) actions.push({ asset, recipient, amount: String(amount), gasLimit: String(baselineGas(asset)) });
    }
  }
  const [donorETH, donorSKILL = 0n] = await Promise.all(targets.map(([asset]) =>
    actionBalance(provider, token, asset, settings.donor.address)));
  const minimum = budget(actions, feeCap);
  const estimated = donorETH >= minimum.eth + minimum.fees + reserveDonorETH
    && donorSKILL >= minimum.skill + reserveDonorSKILL;
  if (estimated) {
    for (const action of actions) {
      action.gasLimit = String(await estimateActionGas(provider, token, settings.donor, action, BigInt(action.amount)));
    }
  }
  const required = budget(actions, feeCap);
  const ethShortfall = positiveDeficit(required.eth + required.fees + reserveDonorETH, donorETH);
  const skillShortfall = positiveDeficit(required.skill + reserveDonorSKILL, donorSKILL);
  console.log(JSON.stringify({
    mode: options.send ? 'send' : 'dry-run', chainId: Number(chainId), users: accounts.users,
    verifiedWallets: accounts.recipients.length, unboundUsers: accounts.unbound,
    ...(options.ethOnly ? {
      gasUnitsPerBooking: Number(gasPerBooking),
    } : {
      pricePerBookingSKILL: formatUnits(mostExpensive, 18),
      targetSKILL: formatUnits(targetSKILL, 18),
      gasUnitsForThreeBookings: Number(bookingGas), supportedGasPriceGwei: formatUnits(targetETH / bookingGas, 9),
    }),
    targetETH: formatEther(targetETH),
    suggestedSenderMaxFeeGwei: formatUnits(feeCap, 9),
    ethRecipients: actions.filter(a => a.asset === 'ETH').length,
    skillRecipients: actions.filter(a => a.asset === 'SKILL').length,
    totalTopUpETH: formatEther(required.eth), totalTopUpSKILL: formatUnits(required.skill, 18),
    senderETH: formatEther(donorETH),
    ...(options.ethOnly ? {} : { senderSKILL: formatUnits(donorSKILL, 18) }),
    senderIsUser: donorIsUser,
    senderFeeReserveETH: formatEther(required.fees), senderFeesEstimated: estimated,
    senderETHShortfall: formatEther(ethShortfall), senderSKILLShortfall: formatUnits(skillShortfall, 18),
  }, null, 2));
  if (options.send) {
    requireCondition(!ethShortfall && !skillShortfall, '補給錢包餘額不足以完成整批轉帳。');
  }
  return {
    version: 1, chainId: String(chainId), tokenAddress: settings.tokenAddress, donorAddress: settings.donor.address,
    batch: options.batch, ethOnly: options.ethOnly,
    targetFlag: options.targetFlag, pinnedAmount: String(options.pinnedAmount || 0n),
    targetETH: String(targetETH), targetSKILL: String(targetSKILL),
    reserveDonorETH: String(reserveDonorETH), reserveDonorSKILL: String(reserveDonorSKILL),
    maxFeePerGas: String(feeCap), maxPriorityFeePerGas: String(priorityFee), actions,
  };
}

function balanceTargets(progress) {
  const targets = [['ETH', BigInt(progress.targetETH)]];
  if (!progress.ethOnly) targets.push(['SKILL', BigInt(progress.targetSKILL)]);
  return targets;
}

async function readProgress(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function saveProgress(file, progress) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(progress, null, 2) + '\n');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, file);
}

function checkProgress(progress, settings, options, accounts) {
  requireCondition(progress.version === 1 && progress.chainId === String(chainId)
    && progress.tokenAddress === settings.tokenAddress && progress.donorAddress === settings.donor.address,
  '已儲存的補給紀錄與當前網路或錢包不相符。');
  requireCondition(progress.targetFlag === options.targetFlag && progress.pinnedAmount === String(options.pinnedAmount)
    && (progress.batch ?? '') === options.batch && (progress.ethOnly ?? false) === options.ethOnly
    && (options.targetFlag !== '--eth-target' || BigInt(progress.targetETH) === options.pinnedAmount),
    '請使用原補給參數繼續已儲存的計畫。');
  const targets = new Map(balanceTargets(progress));
  const seen = new Set();
  for (const action of progress.actions) {
    const id = `${action.asset}:${action.recipient}`;
    requireCondition(targets.has(action.asset) && accounts.recipients.includes(action.recipient)
      && action.recipient !== settings.donor.address
      && BigInt(action.amount) > 0n && BigInt(action.amount) <= targets.get(action.asset) && !seen.has(id), '已儲存的補給紀錄格式不符。');
    seen.add(id);
  }
}

function validateTransaction(token, settings, progress, action) {
  const { raw, hash, amount } = action.signed;
  const tx = Transaction.from(raw);
  const expected = transferRequest(token, action, BigInt(amount));
  requireCondition(tx.hash === hash && tx.from === settings.donor.address && tx.chainId === chainId
    && tx.to === expected.to && tx.data === expected.data && tx.value === expected.value
    && BigInt(amount) > 0n && BigInt(amount) <= BigInt(action.amount)
    && tx.gasLimit <= BigInt(action.gasLimit) && tx.maxFeePerGas === BigInt(progress.maxFeePerGas)
    && tx.maxPriorityFeePerGas === BigInt(progress.maxPriorityFeePerGas), '已儲存的交易內容與補給計畫不符。');
  return tx;
}

function reserveFunds(available, action, value, gasLimit, maxFeePerGas) {
  available.eth -= gasLimit * maxFeePerGas + (action.asset === 'ETH' ? value : 0n);
  if (action.asset === 'SKILL') available.skill -= value;
  requireCondition(available.eth >= 0n && available.skill >= 0n, '補給錢包的餘額已低於整批交易需求。');
}

async function prepareTransactions(provider, token, settings, progress) {
  const unsigned = progress.actions.filter(action => !action.signed && !action.skipped);
  if (!unsigned.length) return;
  const { donor } = settings;
  const [latest, pending, eth, skill] = await Promise.all([
    provider.getTransactionCount(donor.address, 'latest'), provider.getTransactionCount(donor.address, 'pending'),
    provider.getBalance(donor.address), progress.ethOnly ? 0n : token.balanceOf(donor.address),
  ]);
  const available = { eth: eth - BigInt(progress.reserveDonorETH), skill: skill - BigInt(progress.reserveDonorSKILL) };
  const maxFeePerGas = BigInt(progress.maxFeePerGas);
  const maxPriorityFeePerGas = BigInt(progress.maxPriorityFeePerGas);
  const existing = new Set();
  let nonce = pending;
  for (const action of progress.actions.filter(item => item.signed && !item.confirmed && !item.failed)) {
    const tx = validateTransaction(token, settings, progress, action);
    if (tx.nonce < latest) continue;
    requireCondition(!existing.has(tx.nonce), '已儲存的交易使用重複 nonce。');
    existing.add(tx.nonce);
    nonce = Math.max(nonce, tx.nonce + 1);
    reserveFunds(available, action, BigInt(action.signed.amount), tx.gasLimit, maxFeePerGas);
  }
  for (let reserved = latest; reserved < nonce; reserved += 1) {
    requireCondition(existing.has(reserved), '補給錢包已有其他未確認交易。');
  }
  for (const action of unsigned) {
    const target = BigInt(action.asset === 'ETH' ? progress.targetETH : progress.targetSKILL);
    const deficit = positiveDeficit(target, await actionBalance(provider, token, action.asset, action.recipient));
    const amount = deficit < BigInt(action.amount) ? deficit : BigInt(action.amount);
    if (amount === 0n) {
      action.skipped = true;
      continue;
    }
    const gasLimit = BigInt(action.gasLimit);
    const estimatedGas = await provider.estimateGas({ from: donor.address, ...transferRequest(token, action, amount) });
    requireCondition(estimatedGas <= gasLimit, '收款地址的 gas 需求高於已驗證的費用預算。');
    reserveFunds(available, action, amount, gasLimit, maxFeePerGas);
    const raw = await donor.signTransaction({
      ...transferRequest(token, action, amount), nonce, chainId, type: 2, gasLimit, maxFeePerGas, maxPriorityFeePerGas,
    });
    action.signed = { raw, hash: Transaction.from(raw).hash, amount: String(amount) };
    nonce += 1;
  }
  await saveProgress(settings.progressPath, progress);
}

async function broadcastTransaction(provider, donor, { action, tx }) {
  const { hash, raw } = action.signed;
  const pending = await provider.getTransactionCount(donor.address, 'pending');
  if (pending > tx.nonce) {
    requireCondition(await provider.getTransaction(hash) || await provider.getTransactionReceipt(hash),
      '補給錢包出現同 nonce 的其他交易，已停止發送。');
    return;
  }
  try {
    const sentHash = await provider.send('eth_sendRawTransaction', [raw]);
    requireCondition(sentHash.toLowerCase() === hash, 'RPC 回傳的交易雜湊不符合已簽署交易。');
  } catch (error) {
    if (!await provider.getTransaction(hash) && !await provider.getTransactionReceipt(hash)) throw error;
  }
}

function checkReceiptTransfer(token, donor, action, receipt) {
  if (receipt.status !== 1) return '鏈上交易失敗';
  if (action.asset === 'ETH') return null;
  const amount = BigInt(action.signed.amount);
  const matches = receipt.logs.some(log => {
    if (log.address !== token.target) return false;
    const parsed = token.interface.parseLog(log);
    return parsed?.name === 'Transfer' && parsed.args.from === donor.address
      && parsed.args.to === action.recipient && parsed.args.value === amount;
  });
  return matches ? null : '收據缺少符合預期的 SKILL 轉帳事件';
}

async function confirmTransactions(provider, token, settings, progress, broadcast) {
  let pending = broadcast.map(item => item.action);
  for (let attempt = 0; attempt < 40 && pending.length; attempt += 1) {
    const head = await retryRead(() => provider.getBlockNumber());
    let changed = false;
    for (let offset = 0; offset < pending.length; offset += 6) {
      await Promise.all(pending.slice(offset, offset + 6).map(async action => {
        const receipt = await retryRead(() => provider.getTransactionReceipt(action.signed.hash));
        if (!receipt || head - receipt.blockNumber + 1 < settings.confirmations) return;
        const failure = checkReceiptTransfer(token, settings.donor, action, receipt);
        if (failure) action.failed = failure;
        else {
          action.confirmed = true;
          console.log(`已確認 ${action.asset} 補給交易 ${action.signed.hash}`);
        }
        changed = true;
      }));
    }
    if (changed) await saveProgress(settings.progressPath, progress);
    pending = pending.filter(action => !action.confirmed && !action.failed);
    if (pending.length) await wait(3_000);
  }
  requireCondition(!pending.length, `尚有 ${pending.length} 筆交易未確認。使用相同參數可繼續。`);
}

async function retryRead(read) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= 2 || !['TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR'].includes(error.code)) throw error;
      await wait(1_000 * (attempt + 1));
    }
  }
}

async function sendPlan(client, provider, token, settings, progress) {
  await prepareTransactions(provider, token, settings, progress);
  const broadcast = progress.actions.filter(action => action.signed && !action.confirmed && !action.failed)
    .map(action => ({ action, tx: validateTransaction(token, settings, progress, action) }))
    .sort((a, b) => a.tx.nonce - b.tx.nonce);
  for (const item of broadcast) {
    await client.query('SELECT 1');
    await broadcastTransaction(provider, settings.donor, item);
  }
  await confirmTransactions(provider, token, settings, progress, broadcast);
  const failures = progress.actions.filter(action => action.failed);
  console.log(JSON.stringify({ confirmedTransfers: progress.actions.filter(a => a.confirmed).length,
    skippedFundedTransfers: progress.actions.filter(a => a.skipped).length, failedTransfers: failures.length }));
  requireCondition(!failures.length, failures.map(action => `${action.failed} ${action.signed.hash}`).join('\n'));
}

async function verifyBalances(provider, token, progress, accounts) {
  const targets = balanceTargets(progress);
  let verified = 0;
  for (const recipient of accounts.recipients) {
    const balances = await Promise.all(targets.map(([asset]) =>
      retryRead(() => actionBalance(provider, token, asset, recipient))));
    if (targets.every(([, amount], index) => balances[index] >= amount)) verified += 1;
  }
  const countKey = progress.ethOnly ? 'walletsAtETHTarget' : 'walletsAtBothTargets';
  console.log(JSON.stringify({ eligibleWallets: accounts.recipients.length, [countKey]: verified,
    unboundUsers: accounts.unbound }));
  requireCondition(verified === accounts.recipients.length, '部分錢包的目前餘額低於原補給門檻。');
}

async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) return console.log(usage);
  const db = require('../db');
  let provider;
  let client;
  try {
    db.assertConfigured();
    const settings = await loadSettings(process.env, options);
    const request = new FetchRequest(settings.rpc);
    request.timeout = 9_000;
    provider = new JsonRpcProvider(request, undefined, { cacheTimeout: -1, batchMaxCount: 1 });
    requireCondition((await provider.getNetwork()).chainId === chainId, 'RPC 連線並非 Ethereum Sepolia。');
    const token = new Contract(settings.tokenAddress, tokenAbi, provider);
    const escrow = new Contract(settings.escrowAddress, ['function token() view returns (address)'], provider);
    const [decimals, symbol, paymentToken] = await Promise.all([token.decimals(), token.symbol(), escrow.token()]);
    requireCondition(decimals === 18n && symbol === 'SKILL' && paymentToken === settings.tokenAddress,
      '設定的代幣與託管合約不符合 SKILL 預約使用的代幣。');
    client = await db.connect();
    if (options.send || options.verify) {
      const lockKey = `skill-funding:${chainId}:${settings.donor.address.toLowerCase()}`;
      const { rows: [lock] } = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lockKey]);
      requireCondition(lock.locked, '已有補給工作正在執行。');
    }
    const accounts = await accountList(client);
    const recorded = options.send || options.verify ? await readProgress(settings.progressPath) : null;
    requireCondition(!options.verify || recorded, '找不到可驗證的補給紀錄。');
    const progress = recorded || await plan(client, provider, token, settings, options, accounts);
    if (options.send || options.verify) {
      checkProgress(progress, settings, options, accounts);
      checkTransferLimits(progress, process.env);
      if (options.send) {
        if (!recorded) await saveProgress(settings.progressPath, progress);
        await sendPlan(client, provider, token, settings, progress);
      } else {
        requireCondition(progress.actions.every(action => action.signed || action.skipped), '補給紀錄仍有未簽署的交易。');
        const pending = progress.actions.filter(action => action.signed && !action.confirmed && !action.failed)
          .map(action => ({ action, tx: validateTransaction(token, settings, progress, action) }));
        await confirmTransactions(provider, token, settings, progress, pending);
        requireCondition(progress.actions.every(action => action.confirmed || action.skipped), '部分補給交易未成功。');
        console.log(JSON.stringify({ confirmedTransfers: progress.actions.filter(action => action.confirmed).length }));
      }
      await verifyBalances(provider, token, progress, accounts);
    }
  } finally {
    client?.release(true);
    provider?.destroy();
    await db.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('補給作業未完成。', error instanceof FundingError ? error.message : (error.code || error.name));
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments, ethTarget, positiveDeficit, budget, bookingGas };
