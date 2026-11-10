const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {once}=require('node:events');
const {Pool}=require('pg');
const {connectionOptions,assertConfigured}=require('../../db');
const {migrate}=require('../../scripts/migrate');
const {audit}=require('../../scripts/audit');
const {createApp}=require('../../server');
const {createChainService}=require('../../chain');
const {fixture}=require('../../../blockchain/test/helpers');
const {Wallet}=require('ethers');
const {registerAccount}=require('../helpers/register');

test('SKILL end-to-end: wallet proofs, reserved quotes, confirmed escrow and recovery with verified receipt backups and no database balances',async t=>{
  const env=process.env.TEST_DATABASE_URL?{DATABASE_URL:process.env.TEST_DATABASE_URL}:process.env;
  assertConfigured(env);
  const pool=new Pool(connectionOptions(env));
  const schema='yunbarter_chain_'+randomBytes(8).toString('hex');
  let server;
  t.after(async()=>{
    if(server?.listening) await new Promise(resolve=>server.close(resolve));
    try{await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await pool.end();}
  });
  await pool.query(`CREATE SCHEMA "${schema}"`);
  const db={async connect(){const c=await pool.connect();try{await c.query("SELECT set_config('search_path',$1,false)",[schema]);return c;}catch(e){c.release();throw e;}},async query(sql,values){const c=await db.connect();try{return await c.query(sql,values);}finally{c.release();}}};
  await migrate(db);
  const f=await fixture(t);
  const chain=createChainService({CHAIN_ENABLED:'true',CHAIN_ID:'1337',CHAIN_RPC_URL:'http://unused.local',CHAIN_CONFIRMATIONS:'2',SKILL_TOKEN_ADDRESS:await f.token.getAddress(),SKILL_ESCROW_ADDRESS:await f.escrow.getAddress(),CHAIN_QUOTE_PRIVATE_KEY:f.signer.privateKey},{provider:f.provider});
  let base;
  async function start(){server=createApp({db,chain,secureCookies:false,demoPayments:true}).listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
  await start();
  async function request(method,route,body,cookie){
    const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,body:await r.json(),cookie:r.headers.getSetCookie()[0]?.split(';')[0]};
  }
  const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
  async function register(email,name,wallet){const r=await registerAccount(request,{email,password:'test-password-123',userName:name},wallet);ok(r,201);return {...r.body,cookie:r.cookie};}
  const student=await register('s@chain.example','Chain Student',f.wallets[1]);
  const teacher=await register('t@chain.example','Chain Teacher',f.wallets[2]);
  const other=await register('o@chain.example','Other',f.wallets[3]);
  async function bind(user,wallet){const result=await request('POST','/api/chain/wallet/challenge',{walletAddress:wallet.address},user.cookie);if(result.status!==200)return result;return request('POST','/api/chain/wallet/verify',{signature:await wallet.signMessage(result.body.message)},user.cookie);}
  const wallet=async u=>ok(await request('GET','/api/user/wallet',undefined,u.cookie));
  const sync=async(p,u=student)=>ok(await request('POST',`/api/chain/payments/${p.paymentId}/sync`,{},u.cookie));
  const mine=()=>f.rpc.request({method:'evm_mine',params:[]});
  const bookings=async u=>ok(await request('GET','/api/bookings',undefined,u.cookie));
  const advanceTo=async timestamp=>{const head=await f.provider.getBlock('latest');await f.advance(Math.max(1,Number(timestamp)-head.timestamp+1));};
  await t.test('configuration is checked and wallet proof is session-bound, single-use and cannot be forged',async()=>{
    const config=ok(await request('GET','/api/chain/config'));
    assert.equal(config.enabled,true);assert.equal(config.walletNetwork.chainId,'0x539');
    assert.equal(config.walletNetwork.nativeCurrency.symbol,'ETH');
    const legacyWallet=Wallet.createRandom();
    await db.query("INSERT INTO users(email,password_hash,username) SELECT 'legacy@chain.example',password_hash,'Legacy' FROM users WHERE user_id=$1",[student.userId]);
    const login=await request('POST','/api/auth/login',{email:'legacy@chain.example',password:'test-password-123'});ok(login);
    const legacy={...login.body,cookie:login.cookie};
    const c=ok(await request('POST','/api/chain/wallet/challenge',{walletAddress:legacyWallet.address},legacy.cookie));
    assert.equal((await request('POST','/api/chain/wallet/verify',{signature:await f.wallets[3].signMessage(c.message)},legacy.cookie)).status,403);
    const signature=await legacyWallet.signMessage(c.message);
    ok(await request('POST','/api/chain/wallet/verify',{signature},legacy.cookie));
    assert.equal((await request('POST','/api/chain/wallet/verify',{signature},legacy.cookie)).status,409);
    assert.equal((await wallet(student)).verifiedWalletAddress,f.wallets[1].address.toLowerCase());
    ok(await bind(teacher,f.wallets[2]));ok(await bind(other,f.wallets[3]));
    const challenge=ok(await request('POST','/api/chain/wallet/challenge',{walletAddress:f.wallets[3].address},other.cookie));
    const loggedIn=await request('POST','/api/auth/login',{email:'o@chain.example',password:'test-password-123'},other.cookie);ok(loggedIn);
    other.cookie=loggedIn.cookie;
    assert.equal((await request('POST','/api/chain/wallet/verify',{signature:await f.wallets[3].signMessage(challenge.message)},other.cookie)).status,409);
    assert.equal((await bind(other,f.wallets[1])).status,409);
  });
  const {rows:[dates]}=await db.query("SELECT ((NOW() AT TIME ZONE 'Asia/Taipei')::date+2)::text d1,((NOW() AT TIME ZONE 'Asia/Taipei')::date+3)::text d2,((NOW() AT TIME ZONE 'Asia/Taipei')::date+4)::text d3");
  const slots=[dates.d1,dates.d2,dates.d3].map(d=>d+'|Morning');
  ok(await request('PUT','/api/user/profile',{userName:'Chain Teacher',availableTimes:slots},teacher.cookie));
  const course=ok(await request('POST','/api/teachers',{skill:'Chain course',category:'程式',price:'2.123456',description:'Escrow test'},teacher.cookie),201);
  const quote=async(timeSlot=slots[0])=>ok(await request('POST','/api/chain/quotes',{courseId:course.id,timeSlot,expectedUserId:student.userId,amount:'0.000001',teacher:f.wallets[3].address},student.cookie),201);
  let p;
  await t.test('server sets exact amount and recipient, reserves the teacher slot, and reuses a resumable quote',async()=>{
    p=await quote();assert.equal(p.quote.amount,'2123456000000000000');assert.equal(p.quote.teacher,f.wallets[2].address);
    assert.equal((await quote()).paymentId,p.paymentId);
    assert.equal((await request('POST','/api/bookings',{courseId:course.id,timeSlot:slots[0]},other.cookie)).status,410);
    assert.equal((await request('POST','/api/bookings',{courseId:course.id,timeSlot:slots[1],txHash:'0x'+'a'.repeat(64)},student.cookie)).status,410);
    assert.equal((await request('POST',`/api/chain/payments/${p.paymentId}/sync`,{},other.cookie)).status,403);
    assert.equal((await request('DELETE',`/api/teachers/${course.id}`,undefined,teacher.cookie)).status,409);
  });
  await t.test('confirmation depth is respected, retries are idempotent, and database contains no balances',async()=>{
    await f.fund(p.quote,p.signature);
    assert.equal((await sync(p)).status,'quoted');
    assert.equal((await bookings(student)).length,0);
    await mine();assert.equal((await sync(p)).status,'funded');
    await Promise.all([sync(p),sync(p)]);
    const orders=await bookings(student);assert.equal(orders.length,1);assert.equal(orders[0].paymentMethod,'skill');
    assert.equal(Object.hasOwn(await wallet(student),'balance'),false);assert.equal(Object.hasOwn(await wallet(teacher),'balance'),false);
    assert.equal(Object.hasOwn(await wallet(student),'transactions'),false);
    assert.equal((await request('POST',`/api/bookings/${orders[0].id}/cancel`,{},student.cookie)).status,410);
    const bad={...p.quote,amount:'1'};await db.query('UPDATE chain_payments SET quote=$1 WHERE payment_id=$2',[bad,p.paymentId]);
    assert.equal((await request('POST',`/api/chain/payments/${p.paymentId}/sync`,{},student.cookie)).status,502);
    await db.query('UPDATE chain_payments SET quote=$1 WHERE payment_id=$2',[p.quote,p.paymentId]);
  });
  await t.test('settlement made while backend is offline is recovered after restart; cancellation refunds once',async()=>{
    await new Promise(resolve=>server.close(resolve));
    await (await f.escrow.connect(f.actors[1]).cancel(p.paymentId)).wait();await mine();
    await start();
    const list=ok(await request('GET','/api/chain/payments',undefined,student.cookie));
    assert.equal(list.payments[0].status,'refunded');
    await sync(p);assert.equal((await bookings(student))[0].status,'REFUNDED');
    assert.equal(Object.hasOwn(await wallet(student),'balance'),false);
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM legacy_point_transactions')).rows[0].n,0);
    const retry=await quote(slots[0]);
    await sync(p);
    assert.equal((await request('POST','/api/bookings',{courseId:course.id,timeSlot:slots[0]},other.cookie)).status,410,'old refund re-sync must not clear a newer quote hold');
    assert.equal((await sync(retry)).status,'quoted');
    assert.equal((await audit(db)).counts.mismatched_slot_flags,0);
  });
  await t.test('unpaid quotes release only after the deadline passes on the confirmed chain',async()=>{
    const expired=await quote(slots[1]);await advanceTo(expired.quote.deadline);await mine();
    assert.equal((await sync(expired)).status,'expired');
    await assert.rejects(f.fund(expired.quote,expired.signature));
    p=await quote(slots[1]);assert.notEqual(p.paymentId,expired.paymentId);
  });
  await t.test('completion releases real tokens, persists review and cannot bypass the contract',async()=>{
    await f.fund(p.quote,p.signature);await mine();await sync(p);
    await advanceTo(p.quote.endsAt);
    await (await f.escrow.connect(f.actors[1]).complete(p.paymentId)).wait();await mine();
    assert.equal((await sync(p)).status,'released');
    const order=(await bookings(student)).find(b=>b.chainPaymentId===p.paymentId);assert.equal(order.status,'COMPLETED');
    ok(await request('POST',`/api/chain/payments/${p.paymentId}/review`,{rating:5,review:'真實鏈上完課'},student.cookie));
    assert.equal((await bookings(student)).find(b=>b.id===order.id).review,'真實鏈上完課');
    assert.equal((await request('POST',`/api/bookings/${order.id}/complete`,{rating:5},student.cookie)).status,410);
    assert.equal(Object.hasOwn(await wallet(teacher),'balance'),false);
    assert.equal(await f.token.balanceOf(f.wallets[2].address),BigInt(p.quote.amount));
  });
  await t.test('disputes and teacher refunds are reconciled without double credit',async()=>{
    const disputed=await quote(slots[2]);await f.fund(disputed.quote,disputed.signature);await mine();await sync(disputed);
    await advanceTo(disputed.quote.startsAt);
    await (await f.escrow.connect(f.actors[1]).dispute(disputed.paymentId)).wait();await mine();
    assert.equal((await sync(disputed)).status,'disputed');
    ok(await request('POST',`/api/chain/payments/${disputed.paymentId}/reason`,{reason:'課程爭議'},student.cookie));
    await (await f.escrow.connect(f.actors[2]).refund(disputed.paymentId)).wait();await mine();
    assert.equal((await sync(disputed)).status,'refunded');await sync(disputed);
    assert.equal(Object.hasOwn(await wallet(student),'balance'),false);assert.equal(Object.hasOwn(await wallet(teacher),'balance'),false);
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM legacy_point_transactions')).rows[0].n,0);
  });
  await t.test('all payment stages and approvals are backed up once; history is private and survives RPC outages',async()=>{
    const hist=ok(await request('GET','/api/chain/transactions',undefined,student.cookie));
    assert.equal(hist.syncError,null);
    assert.ok(hist.transactions.some(r=>r.action==='approve'));
    assert.ok(hist.transactions.some(r=>r.action==='fund'));
    assert.ok(hist.transactions.some(r=>r.action==='dispute'));
    assert.ok(hist.transactions.some(r=>r.action==='refund'));
    assert.ok(hist.transactions.some(r=>r.action==='complete'));
    const row=hist.transactions.find(r=>r.action==='complete');
    assert.ok(BigInt(row.fee_wei)>0n);assert.equal(row.status,1);
    const full=(await db.query('SELECT receipt_json,transaction_json FROM chain_transaction_records WHERE tx_hash=$1',[row.tx_hash])).rows[0];
    assert.equal(full.receipt_json.hash,row.tx_hash);assert.ok(full.receipt_json.logs.length);assert.ok(full.transaction_json.data);
    const count=(await db.query('SELECT COUNT(*)::int n FROM chain_transaction_records')).rows[0].n;
    ok(await request('POST','/api/chain/transactions/sync',{txHash:row.tx_hash,amount:99999,status:0},student.cookie));
    ok(await request('POST','/api/chain/transactions/sync',{txHash:row.tx_hash},student.cookie));
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM chain_transaction_records')).rows[0].n,count);
    assert.equal((await request('POST','/api/chain/transactions/sync',{txHash:row.tx_hash},other.cookie)).status,403);
    assert.deepEqual(ok(await request('GET','/api/chain/transactions',undefined,other.cookie)).transactions,[]);
    const pending=ok(await request('POST','/api/chain/transactions/sync',{txHash:'0x'+'a'.repeat(64)},student.cookie));assert.equal(pending.pending,true);
    assert.equal((await audit(db)).counts.stored_balance_columns,0);
    assert.equal((await audit(db)).counts.payments_missing_funding_backup,0);
    assert.equal((await audit(db)).counts.payments_missing_latest_backup,0);
    await new Promise(resolve=>server.close(resolve));
    server=createApp({db,chain:null,secureCookies:false}).listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
    assert.equal(ok(await request('GET','/api/chain/transactions',undefined,student.cookie)).transactions.length,hist.transactions.length);
  });
});
