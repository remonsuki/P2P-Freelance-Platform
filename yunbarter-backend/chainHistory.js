const { Interface, zeroPadValue } = require('ethers');
const protocol = require('../blockchain/protocol.json');
const { HttpError } = require('./marketplace');
const tokenAbi = new Interface([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'event Approval(address indexed owner,address indexed spender,uint256 value)',
  'function transfer(address to,uint256 amount)', 'function approve(address spender,uint256 amount)',
]);
const escrowAbi = new Interface(protocol.abi);
const lower = value => value?.toLowerCase() || null;
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);

function createChainHistory({provider,chainId,confirmations,tokenAddress,escrowAddress,startBlock=0}) {
  const token=lower(tokenAddress),escrow=lower(escrowAddress);
  async function backup(db,txHash,userId=null) {
    if(typeof txHash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new HttpError(400,'交易雜湊格式不正確');
    const receipt=await provider.getTransactionReceipt(txHash);
    if(!receipt || await provider.getBlockNumber()-receipt.blockNumber+1<confirmations) return {pending:true,txHash:lower(txHash)};
    const [block,tx]=await Promise.all([provider.getBlock(receipt.blockNumber),provider.getTransaction(txHash)]);
    if(!block||!tx||block.hash!==receipt.blockHash) throw new HttpError(502,'交易收據與目前區塊不符，請重新同步');
    const transfers=[],approvals=[],paymentIds=[];
    for(const log of receipt.logs) {
      if(lower(log.address)===token) {
        let event;try {event=tokenAbi.parseLog(log);}catch {continue;}
        if(event?.name==='Transfer') transfers.push({from:lower(event.args.from),to:lower(event.args.to),amountRaw:event.args.value.toString(),logIndex:log.index});
        if(event?.name==='Approval') approvals.push({owner:lower(event.args.owner),spender:lower(event.args.spender),amountRaw:event.args.value.toString(),logIndex:log.index});
      } else if(lower(log.address)===escrow) {
        let event;try {event=escrowAbi.parseLog(log);}catch {continue;}
        if(event?.name==='PaymentStateChanged') paymentIds.push(lower(event.args.paymentId));
      }
    }
    if(![token,escrow].includes(lower(tx.to))&&![token,escrow].includes(lower(receipt.contractAddress))&&!transfers.length&&!approvals.length) throw new HttpError(400,'此交易不屬於目前的 SKILL 合約');
    const {rows:payments}=await db.query('SELECT payment_id,student_id,teacher_id FROM chain_payments WHERE payment_id=ANY($1::text[]) AND chain_id=$2 AND LOWER(escrow_address)=$3',[paymentIds,chainId,escrow]);
    if(userId!==null) {
      const {rows:[user]}=await db.query('SELECT verified_wallet_address FROM users WHERE user_id=$1',[userId]);
      const wallet=user?.verified_wallet_address;
      if(!wallet||!(lower(tx.from)===wallet||transfers.some(t=>t.from===wallet||t.to===wallet)||approvals.some(a=>a.owner===wallet)||payments.some(p=>[String(p.student_id),String(p.teacher_id)].includes(String(userId))))) throw new HttpError(403,'無法備份其他人的交易');
    }
    let action=receipt.contractAddress?'deploy':'contract';
    try {action=(lower(tx.to)===token?tokenAbi:escrowAbi).parseTransaction({data:tx.data,value:tx.value})?.name||action;}catch {/* Other token operations still retain their verified receipt. */}
    const {rows:[existing]}=await db.query('SELECT block_hash FROM chain_transaction_records WHERE chain_id=$1 AND tx_hash=$2',[chainId,lower(txHash)]);
    if(existing&&existing.block_hash!==block.hash) throw new HttpError(502,'已備份交易發生鏈重組，請核對原始收據');
    await db.query(`INSERT INTO chain_transaction_records(chain_id,tx_hash,block_number,block_hash,block_time,from_address,to_address,contract_address,token_address,action,payment_id,status,native_value_wei,gas_used,gas_price_wei,fee_wei,token_transfers,approvals,receipt_json,transaction_json)
      VALUES($1,$2,$3,$4,to_timestamp($5),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT(chain_id,tx_hash) DO NOTHING`,
      [chainId,lower(txHash),receipt.blockNumber,block.hash,block.timestamp,lower(tx.from),lower(tx.to),lower(receipt.contractAddress),token,action,payments[0]?.payment_id||null,receipt.status,tx.value.toString(),receipt.gasUsed.toString(),receipt.gasPrice.toString(),receipt.fee.toString(),json(transfers),json(approvals),json(receipt.toJSON()),json(tx.toJSON())]);
    return {pending:false,txHash:lower(txHash),status:receipt.status,blockNumber:receipt.blockNumber};
  }
  async function payment(db,paymentId,fromBlock,toBlock) {
    for(let from=Number(fromBlock);from<=toBlock;from+=2000) {
      const logs=await provider.getLogs({address:escrowAddress,fromBlock:from,toBlock:Math.min(from+1999,toBlock),topics:[escrowAbi.getEvent('PaymentStateChanged').topicHash,paymentId]});
      for(const hash of new Set(logs.map(l=>l.transactionHash))) await backup(db,hash);
    }
  }
  async function syncWallet(db,userId) {
    const {rows:[u]}=await db.query('SELECT verified_wallet_address FROM users WHERE user_id=$1',[userId]);
    if(!u?.verified_wallet_address) return {complete:true};
    const wallet=u.verified_wallet_address;
    const {rows:[cursor]}=await db.query('SELECT block_number FROM chain_history_cursors WHERE chain_id=$1 AND token_address=$2 AND wallet_address=$3',[chainId,token,wallet]);
    const last=Math.max(0,await provider.getBlockNumber()-confirmations+1);
    const begin=Math.max(startBlock,Number(cursor?.block_number??startBlock)-12);
    const end=Math.min(last,begin+19999),topic=zeroPadValue(wallet,32);
    for(let from=begin;from<=end;from+=2000) {
      const range={address:tokenAddress,fromBlock:from,toBlock:Math.min(from+1999,end)};
      const batches=await Promise.all([
        provider.getLogs({...range,topics:[tokenAbi.getEvent('Transfer').topicHash,topic]}),
        provider.getLogs({...range,topics:[tokenAbi.getEvent('Transfer').topicHash,null,topic]}),
        provider.getLogs({...range,topics:[tokenAbi.getEvent('Approval').topicHash,topic]}),
      ]);
      for(const hash of new Set(batches.flat().map(l=>l.transactionHash))) await backup(db,hash,userId);
      await db.query(`INSERT INTO chain_history_cursors(chain_id,token_address,wallet_address,block_number) VALUES($1,$2,$3,$4)
        ON CONFLICT(chain_id,token_address,wallet_address) DO UPDATE SET block_number=GREATEST(chain_history_cursors.block_number,EXCLUDED.block_number)`,[chainId,token,wallet,range.toBlock]);
    }
    return {complete:end>=last,throughBlock:end};
  }
  return {backup,payment,syncWallet};
}

async function historyForUser(db,userId) {
  const {rows}=await db.query(`SELECT r.chain_id,r.tx_hash,r.block_number,r.block_time,r.from_address,r.to_address,r.action,r.payment_id,r.status,
    r.gas_used::text,r.gas_price_wei::text,r.fee_wei::text,r.token_transfers,r.approvals
    FROM chain_transaction_records r JOIN users u ON u.user_id=$1
    LEFT JOIN chain_payments p ON p.payment_id=r.payment_id
    WHERE r.from_address=u.verified_wallet_address OR p.student_id=$1 OR p.teacher_id=$1
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.token_transfers) t WHERE t->>'from'=u.verified_wallet_address OR t->>'to'=u.verified_wallet_address)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.approvals) a WHERE a->>'owner'=u.verified_wallet_address)
    ORDER BY r.block_time DESC,r.block_number DESC,r.tx_hash LIMIT 300`,[userId]);
  return rows;
}
module.exports={createChainHistory,historyForUser};
