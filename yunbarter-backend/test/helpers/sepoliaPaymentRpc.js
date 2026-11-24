const assert = require('node:assert/strict');
const { Interface, Wallet, ZeroAddress, ZeroHash, toBeHex } = require('ethers');
const protocol = require('../../../blockchain/protocol.json');

// Each observation is an in-memory RPC response. No node, provider connection, or transaction is created.
function sepoliaPaymentRpc() {
  const signer = Wallet.createRandom();
  const tokenAddress = '0x' + '1'.repeat(40);
  const escrowAddress = '0x' + '2'.repeat(40);
  const escrow = new Interface(protocol.abi);
  const token = new Interface([
    'function decimals() view returns(uint8)', 'function symbol() view returns(string)',
    'function approve(address spender,uint256 value)',
    'event Approval(address indexed owner,address indexed spender,uint256 value)',
    'event Transfer(address indexed from,address indexed to,uint256 value)',
  ]);
  const payments = new Map();
  const transactions = new Map();
  const blocks = new Map();
  let head = { number: 1, timestamp: Math.floor(Date.now() / 1000), hash: toBeHex(1, 32) };
  blocks.set(0, { number: 0, timestamp: head.timestamp - 12, hash: ZeroHash });
  blocks.set(head.number, head);

  function advance(timestamp = head.timestamp + 12) {
    const number = head.number + 1;
    head = { number, timestamp: Math.max(timestamp, head.timestamp + 1), hash: toBeHex(number, 32) };
    blocks.set(number, head);
  }

  function recordReceipt(from, to, data, events) {
    advance();
    const hash = toBeHex(1000 + head.number, 32);
    const logs = events.map(({ address, event }, index) => ({ ...event, address, index, transactionHash: hash }));
    const tx = { hash, from, to, value: 0n, data };
    const receipt = { hash, from, to, blockNumber: head.number, blockHash: head.hash, status: 1, logs,
      gasUsed: 100000n, gasPrice: 10n, fee: 1000000n, contractAddress: null };
    transactions.set(hash, { tx, receipt });
  }

  function observePayment(method, quote, signature) {
    const state = { fund: 1, dispute: 2, complete: 3, cancel: 4, refund: 4 }[method];
    assert.ok(state);
    const { student, teacher, paymentId, amount } = quote;
    const actor = method === 'refund' ? teacher : student;
    const args = protocol.types.Quote.map(field => quote[field.name]);
    if (method === 'fund') {
      recordReceipt(student, tokenAddress, token.encodeFunctionData('approve', [escrowAddress, amount]), [
        { address: tokenAddress, event: token.encodeEventLog('Approval', [student, escrowAddress, amount]) },
      ]);
    }
    const events = [{ address: escrowAddress, event: escrow.encodeEventLog('PaymentStateChanged', [paymentId, state, actor]) }];
    const transfer = {
      fund: [student, escrowAddress], complete: [escrowAddress, teacher], cancel: [escrowAddress, student], refund: [escrowAddress, student],
    }[method];
    if (transfer) events.push({ address: tokenAddress, event: token.encodeEventLog('Transfer', [...transfer, amount]) });
    const history = payments.get(paymentId) ?? [];
    recordReceipt(actor, escrowAddress, escrow.encodeFunctionData(method, method === 'fund' ? [args, signature] : [paymentId]), events);
    history.push({ args, state, fundedBlock: history[0]?.fundedBlock ?? head.number, changedBlock: head.number });
    payments.set(paymentId, history);
  }

  const provider = {
    async getNetwork() { return { chainId: 11155111n }; },
    async getCode() { return '0x01'; },
    async getBlockNumber() { return head.number; },
    async getBlock(tag) { return tag === 'latest' ? head : blocks.get(tag); },
    async getTransaction(hash) {
      const tx = transactions.get(hash)?.tx;
      return tx ? { ...tx, toJSON: () => tx } : null;
    },
    async getTransactionReceipt(hash) {
      const receipt = transactions.get(hash)?.receipt;
      return receipt ? { ...receipt, toJSON: () => receipt } : null;
    },
    async getLogs({ address, fromBlock, toBlock, topics }) {
      return [...transactions.values()].flatMap(({ receipt }) => {
        if (receipt.blockNumber < fromBlock || receipt.blockNumber > toBlock) return [];
        return receipt.logs.filter(log => log.address === address && topics.every((topic, i) => !topic || topic === log.topics[i]));
      });
    },
    async call({ data, to, blockTag }) {
      const abi = to === escrowAddress ? escrow : token;
      const fn = abi.getFunction(data.slice(0, 10));
      if (fn.name === 'getPayment') {
        const [id] = abi.decodeFunctionData(fn, data);
        const current = payments.get(id)?.findLast(payment => payment.changedBlock <= Number(blockTag));
        const empty = [ZeroHash, ZeroHash, ZeroAddress, ZeroAddress, 0n, 0n, 0n, 0n];
        return abi.encodeFunctionResult(fn, [current ? [current.args, current.state, current.fundedBlock, current.changedBlock] : [empty, 0, 0, 0]]);
      }
      const values = { version: 1n, token: tokenAddress, quoteSigner: signer.address, decimals: 18, symbol: 'SKILL' };
      return abi.encodeFunctionResult(fn, [values[fn.name]]);
    },
  };
  return { provider, signer, tokenAddress, escrowAddress, advance, observePayment };
}

module.exports = { sepoliaPaymentRpc };
