const { randomBytes } = require('node:crypto');
const { Contract, JsonRpcProvider, Wallet, Interface, getAddress, parseUnits, TypedDataEncoder, solidityPackedKeccak256 } = require('ethers');
const protocol = require('../blockchain/protocol.json');
const {createChainHistory,historyForUser}=require('./chainHistory');
const {walletNetwork}=require('./walletNetwork');
const { transaction } = require('./db');
const { HttpError, slot, id } = require('./marketplace');

const states = ['quoted','funded','disputed','released','refunded'];
const active = "('quoted','funded','disputed')";
const reference = value => {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value)) throw new HttpError(400,'付款編號格式不正確');
  return value;
};

function createChainService(env = process.env, overrides = {}) {
  if (env.CHAIN_ENABLED !== 'true') return null;
  const chainId = Number(env.CHAIN_ID || 11155111);
  const confirmations = Number(env.CHAIN_CONFIRMATIONS || 2);
  if (![11155111,1337,31337].includes(chainId)) throw new Error('交易測試版只允許 Sepolia 或本機測試鏈');
  if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 64) throw new Error('CHAIN_CONFIRMATIONS 必須為 1 至 64');
  if (!env.CHAIN_RPC_URL || !env.CHAIN_QUOTE_PRIVATE_KEY) throw new Error('請設定鏈上 RPC 與報價簽章金鑰');
  const provider = overrides.provider || new JsonRpcProvider(env.CHAIN_RPC_URL, undefined, { cacheTimeout: -1 });
  const signer = new Wallet(env.CHAIN_QUOTE_PRIVATE_KEY);
  const tokenAddress = getAddress(env.SKILL_TOKEN_ADDRESS);
  const escrowAddress = getAddress(env.SKILL_ESCROW_ADDRESS);
  const escrow = new Contract(escrowAddress, protocol.abi, provider);
  const domain = { name: protocol.name, version: protocol.version, chainId, verifyingContract: escrowAddress };
  const abi = new Interface(protocol.abi);
  const browserNetwork=walletNetwork(env,chainId);
  const startBlock=Number(env.CHAIN_START_BLOCK||0);
  if(!Number.isSafeInteger(startBlock)||startBlock<0) throw new Error('CHAIN_START_BLOCK 格式不正確');
  const history=createChainHistory({provider,chainId,confirmations,tokenAddress,escrowAddress,startBlock});
  let readiness;
  async function ready() {
    if (!readiness) readiness = (async () => {
      if ((await provider.getNetwork()).chainId !== BigInt(chainId)) throw new Error('RPC 網路與 CHAIN_ID 不符');
      if (await provider.getCode(escrowAddress) === '0x' || await provider.getCode(tokenAddress) === '0x') throw new Error('找不到代幣或託管合約');
      if (await escrow.version() !== 1n || getAddress(await escrow.token()) !== tokenAddress || getAddress(await escrow.quoteSigner()) !== signer.address) throw new Error('託管合約、代幣或報價簽章地址不符');
      const token = new Contract(tokenAddress, ['function decimals() view returns(uint8)','function symbol() view returns(string)'], provider);
      if (await token.decimals() !== 18n || await token.symbol() !== 'SKILL') throw new Error('目前付款只支援 18 位小數的 SKILL');
    })().catch(() => { readiness = undefined; throw new HttpError(503, '鏈上設定尚未就緒，請由管理者確認 RPC、網路、代幣與託管合約設定'); });
    await readiness;
  }
  function config() { return { enabled:true, chainId, confirmations, tokenAddress, escrowAddress, symbol:'SKILL', decimals:18,
    explorer:chainId===11155111?'https://sepolia.etherscan.io':'', quoteSigner:signer.address,walletNetwork:browserNetwork }; }
  function dto(p, userId) {
    return { paymentId:p.payment_id, courseId:Number(p.course_id), courseTitle:p.course_title, teacherName:p.teacher_name, studentName:p.student_name,
      amount:String(p.price), status:p.status, role:String(p.student_id)===String(userId)?'student':'teacher',
      chainId:Number(p.chain_id), tokenAddress:p.token_address, escrowAddress:p.escrow_address, quote:p.quote, signature:p.signature,
      expiresAt:p.expires_at, txHash:p.last_tx_hash, fundedTxHash:p.funded_tx_hash, disputeReason:p.dispute_reason || '' };
  }
  async function eventTransaction(paymentId, blockNumber, state) {
    const logs = await provider.getLogs({ address:escrowAddress, fromBlock:blockNumber, toBlock:blockNumber,
      topics:[abi.getEvent('PaymentStateChanged').topicHash,paymentId] });
    const log = logs.findLast(l => Number(abi.parseLog(l).args.state) === state);
    if (!log) throw new HttpError(502,'找不到託管合約的付款狀態事件');
    const receipt = await provider.getTransactionReceipt(log.transactionHash);
    const block = await provider.getBlock(blockNumber);
    if (!receipt || receipt.status !== 1 || receipt.blockHash !== block.hash || getAddress(receipt.to) !== escrowAddress) throw new HttpError(502,'鏈上收據尚未確認或不屬於託管合約');
    return receipt.hash;
  }
  async function sync(db, paymentId, userId = null) {
    await ready();
    const { rows:[original] } = await db.query('SELECT * FROM chain_payments WHERE payment_id=$1',[reference(paymentId)]);
    if (!original) throw new HttpError(404,'找不到鏈上付款');
    if (userId !== null && ![String(original.student_id),String(original.teacher_id)].includes(String(userId))) throw new HttpError(403,'無法查看其他人的付款');
    if (Number(original.chain_id)!==chainId || getAddress(original.escrow_address)!==escrowAddress || getAddress(original.token_address)!==tokenAddress) throw new HttpError(409,'請恢復此筆付款原本的鏈與合約設定後再同步');
    const head = await provider.getBlock('latest');
    const blockNumber = Math.max(0, head.number - confirmations + 1);
    const confirmedBlock = await provider.getBlock(blockNumber);
    const payment = await escrow.getPayment(paymentId,{blockTag:blockNumber});
    const state = Number(payment.state);
    if (state > 0) {
      const actual = Object.fromEntries(protocol.types.Quote.map(f=>[f.name,payment.quote[f.name].toString()]));
      if (TypedDataEncoder.hash(domain,protocol.types,actual) !== TypedDataEncoder.hash(domain,protocol.types,original.quote)) throw new HttpError(502,'鏈上付款的金額、時段或收付款地址與報價不符');
    }
    const txHash = state ? await eventTransaction(paymentId,Number(payment.changedBlock),state) : null;
    const fundedHash = state ? await eventTransaction(paymentId,Number(payment.fundedBlock),1) : null;
    if(state) {
      await history.payment(db,paymentId,original.created_block,blockNumber);
      await history.syncWallet(db,original.student_id);
    }
    const status = state ? states[state] : confirmedBlock.timestamp > Number(original.quote.deadline) ? 'expired' : 'quoted';
    return transaction(db,async client=>{
      await client.query('SELECT user_id FROM users WHERE user_id=ANY($1::bigint[]) ORDER BY user_id FOR UPDATE',[[original.student_id,original.teacher_id]]);
      const {rows:[p]}=await client.query('SELECT * FROM chain_payments WHERE payment_id=$1 FOR UPDATE',[paymentId]);
      if (Number(p.synced_block)>blockNumber) return dto(p,userId);
      if (p.status==='expired' && state>0) throw new HttpError(502,'付款確認出現超出確認深度的鏈重組，請人工核對');
      await client.query('UPDATE chain_payments SET status=$2,last_tx_hash=$3,funded_tx_hash=$4,synced_block=$5,updated_at=NOW() WHERE payment_id=$1', [paymentId,status,txHash,fundedHash,blockNumber]);
      if (status === 'expired') {
        await client.query(`UPDATE classes SET is_booked=FALSE WHERE class_id=$1
          AND NOT EXISTS(SELECT 1 FROM bookings WHERE class_id=$1 AND archived_at IS NULL AND status IN ('confirmed','disputed','completed'))
          AND NOT EXISTS(SELECT 1 FROM chain_payments WHERE class_id=$1 AND status IN ('quoted','funded','disputed','released'))`,[p.class_id]);
      } else if (state>0) {
        const bookingStatus={funded:'confirmed',disputed:'disputed',released:'completed',refunded:'cancelled'}[status];
        const paymentStatus={funded:'escrowed',disputed:'escrowed',released:'released',refunded:'refunded'}[status];
        await client.query(`INSERT INTO bookings(student_id,teacher_id,class_id,points_spent,course_title,teacher_name,student_name,scheduled_date,slot_type,payment_method,chain_payment_id,status,payment_status,tx_hash)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'skill',$10,$11,$12,$13)
          ON CONFLICT(chain_payment_id) DO UPDATE SET status=EXCLUDED.status,payment_status=EXCLUDED.payment_status,tx_hash=EXCLUDED.tx_hash,
            completed_at=CASE WHEN EXCLUDED.status='completed' THEN COALESCE(bookings.completed_at,NOW()) ELSE bookings.completed_at END,
            refunded_at=CASE WHEN EXCLUDED.status='cancelled' THEN COALESCE(bookings.refunded_at,NOW()) ELSE bookings.refunded_at END,updated_at=NOW()`,
          [p.student_id,p.teacher_id,p.class_id,p.price,p.course_title,p.teacher_name,p.student_name,p.scheduled_date,p.slot_type,p.payment_id,bookingStatus,paymentStatus,txHash]);
        // The contract settles funds; the database stores order and receipt backups only.
      }
      return dto({...p,status,last_tx_hash:txHash,funded_tx_hash:fundedHash},userId);
    });
  }
  async function reconcile(db, userId = null) {
    const {rows}=await db.query(`SELECT payment_id FROM chain_payments WHERE status IN ${active}
      AND ($1::bigint IS NULL OR student_id=$1 OR teacher_id=$1) ORDER BY updated_at LIMIT 50`,[userId]);
    const errors=[];
    for(const p of rows) { try { await sync(db,p.payment_id,userId); } catch(e) { errors.push(e.message); } }
    return errors;
  }
  async function quote(db,userId,body) {
    await ready();
    const chosen=slot(body.timeSlot),courseId=id(body.courseId);
    const errors=await reconcile(db);
    if(errors.length) throw new HttpError(503,'鏈上付款尚未完成同步，暫停新增付款以保護時段；請稍後再試');
    const head=await provider.getBlock('latest');
    return transaction(db,async client=>{
      const {rows:[ref]}=await client.query('SELECT teacher_id FROM courses WHERE course_id=$1',[courseId]);
      if(!ref) throw new HttpError(404,'找不到課程');
      await client.query('SELECT user_id FROM users WHERE user_id=ANY($1::bigint[]) ORDER BY user_id FOR UPDATE',[[ref.teacher_id,userId]]);
      const {rows:[student]}=await client.query('SELECT * FROM users WHERE user_id=$1',[userId]);
      const {rows:[teacher]}=await client.query('SELECT * FROM users WHERE user_id=$1',[ref.teacher_id]);
      if(String(userId)===String(ref.teacher_id)) throw new HttpError(400,'不能預約自己的課程');
      if(!student.verified_wallet_address || !teacher.verified_wallet_address) throw new HttpError(409,'學生與老師都必須先至錢包頁簽章驗證交易錢包');
      if(student.verified_wallet_address===teacher.verified_wallet_address) throw new HttpError(400,'收付款錢包不可相同');
      const {rows:[existing]}=await client.query("SELECT * FROM chain_payments WHERE student_id=$1 AND course_id=$2 AND scheduled_date=$3 AND slot_type=$4 AND status='quoted'",[userId,courseId,chosen.date,chosen.type]);
      if(existing) return dto(existing,userId);
      const {rows:[course]}=await client.query('SELECT * FROM courses WHERE course_id=$1 AND is_active FOR UPDATE',[courseId]);
      if(!course) throw new HttpError(404,'課程已下架');
      const {rows:[c]}=await client.query(`SELECT c.*,EXTRACT(EPOCH FROM (c.class_date+c.start_time) AT TIME ZONE 'Asia/Taipei')::bigint AS starts,
        EXTRACT(EPOCH FROM (c.class_date+c.end_time) AT TIME ZONE 'Asia/Taipei')::bigint AS ends
        FROM classes c JOIN teacher_availability a ON a.teacher_id=c.teacher_id AND a.available_date=c.class_date AND a.slot_type=c.slot_type
        WHERE c.course_id=$1 AND c.class_date=$2 AND c.slot_type=$3 AND NOT c.is_booked
        AND NOT EXISTS(SELECT 1 FROM classes busy WHERE busy.teacher_id=c.teacher_id AND busy.class_date=c.class_date AND busy.slot_type=c.slot_type AND busy.is_booked)
        FOR UPDATE OF c`,[courseId,chosen.date,chosen.type]);
      if(!c || Number(c.starts)<=head.timestamp+30) throw new HttpError(409,'時段已無法預約');
      if((await client.query("SELECT 1 FROM bookings WHERE student_id=$1 AND archived_at IS NULL AND scheduled_date=$2 AND slot_type=$3 AND status IN ('confirmed','disputed','completed')",[userId,chosen.date,chosen.type])).rowCount) throw new HttpError(409,'此時段已有預約');
      const paymentId='0x'+randomBytes(32).toString('hex');
      const q={paymentId,slotKey:solidityPackedKeccak256(['uint256','string'],[ref.teacher_id,chosen.key]),student:getAddress(student.verified_wallet_address),teacher:getAddress(teacher.verified_wallet_address),amount:parseUnits(String(course.price),18).toString(),startsAt:String(c.starts),endsAt:String(c.ends),deadline:String(Math.min(head.timestamp+600,Number(c.starts)-1))};
      const signature=await signer.signTypedData(domain,protocol.types,q);
      const {rows:[p]}=await client.query(`INSERT INTO chain_payments(payment_id,student_id,teacher_id,course_id,class_id,scheduled_date,slot_type,course_title,teacher_name,student_name,price,chain_id,token_address,escrow_address,quote,signature,created_block,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,to_timestamp($18)) RETURNING *`,
        [paymentId,userId,ref.teacher_id,courseId,c.class_id,chosen.date,chosen.type,course.title,teacher.username,student.username,course.price,chainId,tokenAddress,escrowAddress,q,signature,head.number,q.deadline]);
      await client.query('UPDATE classes SET is_booked=TRUE WHERE class_id=$1',[c.class_id]);
      return dto(p,userId);
    });
  }
  return {config,ready,quote,sync,reconcile,provider,history};
}

function installChainRoutes(app,db,chain) {
  const enabled=()=>{if(!chain) throw new HttpError(503,'SKILL 交易尚未啟用，請先部署託管合約並設定後端');};
  app.get('/api/chain/transactions',async(req,res)=>{
    let syncError=null,syncState=null;
    if(chain) { try {await chain.ready();syncState=await chain.history.syncWallet(db,req.user.user_id);} catch(e) {syncError=e.message;} }
    res.json({transactions:await historyForUser(db,req.user.user_id),syncError,syncState});
  });
  app.post('/api/chain/transactions/sync',async(req,res)=>{enabled();await chain.ready();res.json(await chain.history.backup(db,req.body?.txHash,req.user.user_id));});
  app.post('/api/chain/quotes',async(req,res)=>{enabled();res.status(201).json(await chain.quote(db,req.user.user_id,req.body||{}));});
  app.get('/api/chain/payments',async(req,res)=>{
    if(!chain) return res.json({payments:[],syncErrors:[]});
    const syncErrors=await chain.reconcile(db,req.user.user_id);
    const {rows}=await db.query('SELECT * FROM chain_payments WHERE student_id=$1 OR teacher_id=$1 ORDER BY created_at DESC',[req.user.user_id]);
    // Quote/signature are public authorizations bound to the student's wallet, never secret keys.
    res.json({payments:rows.map(p=>({paymentId:p.payment_id,courseTitle:p.course_title,amount:String(p.price),status:p.status,
      role:String(p.student_id)===String(req.user.user_id)?'student':'teacher',quote:p.quote,signature:p.signature,
      chainId:Number(p.chain_id),tokenAddress:p.token_address,escrowAddress:p.escrow_address,expiresAt:p.expires_at,txHash:p.last_tx_hash,
      teacherName:p.teacher_name,studentName:p.student_name,disputeReason:p.dispute_reason||'',explorer:Number(p.chain_id)===11155111?'https://sepolia.etherscan.io':''})),syncErrors});
  });
  app.post('/api/chain/payments/:id/sync',async(req,res)=>{enabled();res.json(await chain.sync(db,req.params.id,req.user.user_id));});
  app.post('/api/chain/payments/:id/review',async(req,res)=>{
    enabled(); await chain.sync(db,req.params.id,req.user.user_id);
    if(!Number.isInteger(req.body?.rating)||req.body.rating<1||req.body.rating>5||typeof(req.body.review||'')!=='string'||(req.body.review||'').length>3000) throw new HttpError(400,'評分須為 1 至 5，評語最多 3000 字');
    await transaction(db,async client=>{
      const {rows:[participants]}=await client.query('SELECT student_id,teacher_id FROM chain_payments WHERE payment_id=$1',[req.params.id]);
      await client.query('SELECT user_id FROM users WHERE user_id=ANY($1::bigint[]) ORDER BY user_id FOR UPDATE',[[participants.student_id,participants.teacher_id]]);
      const {rows:[b]}=await client.query("SELECT * FROM bookings WHERE chain_payment_id=$1 AND student_id=$2 AND status='completed' FOR UPDATE",[reference(req.params.id),req.user.user_id]);
      if(!b) throw new HttpError(409,'只有已完課的學生能留下評價');
      await client.query(`INSERT INTO reviews(booking_id,sender_id,receiver_id,reviewer_role,rating_stars,comment) VALUES($1,$2,$3,'student_to_teacher',$4,$5)
        ON CONFLICT(booking_id,sender_id) DO UPDATE SET rating_stars=$4,comment=$5`,[b.booking_id,b.student_id,b.teacher_id,req.body.rating,req.body.review||'']);
      await client.query("UPDATE users SET teacher_rating=(SELECT AVG(rating_stars) FROM reviews WHERE receiver_id=$1 AND reviewer_role='student_to_teacher') WHERE user_id=$1",[b.teacher_id]);
    });
    res.json({success:true});
  });
  app.post('/api/chain/payments/:id/reason',async(req,res)=>{
    enabled();await chain.sync(db,req.params.id,req.user.user_id);
    if(typeof req.body?.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>3000) throw new HttpError(400,'請填寫最多 3000 字的爭議原因');
    const result=await db.query("UPDATE chain_payments SET dispute_reason=$1 WHERE payment_id=$2 AND student_id=$3 AND status='disputed' RETURNING payment_id",[req.body.reason.trim(),reference(req.params.id),req.user.user_id]);
    if(!result.rowCount) throw new HttpError(409,'鏈上爭議尚未確認或無權操作');
    res.json({success:true});
  });
}
module.exports={createChainService,installChainRoutes};
