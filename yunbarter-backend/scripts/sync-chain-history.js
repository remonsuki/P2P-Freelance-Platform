const pool=require('../db');
const {assertConfigured}=require('../db');
const {createChainService}=require('../chain');

async function syncHistory(db=pool,chain=createChainService()) {
  if(!chain)throw new Error('請先啟用並設定 SKILL 鏈上交易');
  await chain.ready();
  const config=chain.config();
  const {rows:payments}=await db.query("SELECT payment_id FROM chain_payments WHERE chain_id=$1 AND LOWER(token_address)=LOWER($2) AND LOWER(escrow_address)=LOWER($3) ORDER BY created_at",[config.chainId,config.tokenAddress,config.escrowAddress]);
  for(const p of payments)await chain.sync(db,p.payment_id);
  const {rows:users}=await db.query('SELECT user_id FROM users WHERE verified_wallet_address IS NOT NULL ORDER BY user_id');
  let pendingWallets=0;
  for(const u of users) {
    let result;
    for(let attempt=0;attempt<100;attempt++) {result=await chain.history.syncWallet(db,u.user_id);if(result.complete)break;}
    if(!result.complete)pendingWallets++;
  }
  const {rows:[totals]}=await db.query('SELECT COUNT(*)::int receipts FROM chain_transaction_records WHERE chain_id=$1',[config.chainId]);
  return {chainId:config.chainId,payments:payments.length,wallets:users.length,receipts:totals.receipts,pendingWallets};
}
if(require.main===module) {
  (async()=>{
    let chain;
    try {assertConfigured();chain=createChainService();console.log(JSON.stringify(await syncHistory(pool,chain),null,2));}
    catch(error){console.error('鏈上備份未完成：',error.shortMessage||error.message);process.exitCode=1;}
    finally {chain?.provider.destroy();await pool.end();}
  })();
}
module.exports={syncHistory};
