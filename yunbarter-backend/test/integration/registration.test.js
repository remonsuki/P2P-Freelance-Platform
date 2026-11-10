const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {once}=require('node:events');
const {Wallet}=require('ethers');
const {Pool}=require('pg');
const {connectionOptions,assertConfigured}=require('../../db');
const {migrate}=require('../../scripts/migrate');
const {createApp}=require('../../server');
const {registerAccount}=require('../helpers/register');

test('account registration requires a proven, unique and permanent wallet without enabling chain payments',async t=>{
  const env=process.env.TEST_DATABASE_URL?{DATABASE_URL:process.env.TEST_DATABASE_URL}:process.env;
  assertConfigured(env);
  const pool=new Pool(connectionOptions(env));
  const schema='yunbarter_registration_'+randomBytes(8).toString('hex');
  let server;
  t.after(async()=>{
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    try{await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await pool.end();}
  });
  await pool.query(`CREATE SCHEMA "${schema}"`);
  const db={async connect(){const c=await pool.connect();try{await c.query("SELECT set_config('search_path',$1,false)",[schema]);return c;}catch(e){c.release();throw e;}},async query(sql,values){const c=await db.connect();try{return await c.query(sql,values);}finally{c.release();}}};
  await migrate(db);await migrate(db);
  server=createApp({db,chain:null,secureCookies:false}).listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(method,route,body,cookie,origin='http://localhost:5173'){
    const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,body:await r.json(),cookie:r.headers.getSetCookie()[0]?.split(';')[0],headers:r.headers};
  }
  const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
  const payload={email:'wallet@example.com',password:'wallet-password-123',userName:'Wallet User'};
  const wallet=Wallet.createRandom();
  const stranger=Wallet.createRandom();
  const count=async()=>Number((await db.query('SELECT COUNT(*) n FROM users')).rows[0].n);
  async function challenge(email=payload.email,w=wallet){const c=await request('POST','/api/auth/register/wallet-challenge',{email,walletAddress:w.address});ok(c);return c;}
  const proof=async(c,w=wallet)=>({challengeId:c.body.challengeId,signature:await w.signMessage(c.body.message)});
  let account;

  await t.test('missing, forged and wrong-browser proofs create no accounts',async()=>{
    assert.equal((await request('POST','/api/auth/register',payload)).status,400);
    const c=await challenge();
    assert.match(c.headers.get('set-cookie'),/HttpOnly/);assert.match(c.headers.get('set-cookie'),/SameSite=Lax/);
    assert.equal((await request('POST','/api/auth/register',{...payload,walletProof:await proof(c,stranger)},c.cookie)).status,403);
    assert.equal((await request('POST','/api/auth/register',{...payload,walletProof:await proof(c)})).status,409);
    assert.equal(await count(),0);
  });
  await t.test('proof binds email and origin, and expires',async()=>{
    const c=await challenge();const signed=await proof(c);
    assert.equal((await request('POST','/api/auth/register',{...payload,email:'changed@example.com',walletProof:signed},c.cookie)).status,409);
    assert.equal((await request('POST','/api/auth/register',{...payload,walletProof:signed},c.cookie,'http://127.0.0.1:5173')).status,409);
    await db.query("UPDATE registration_wallet_challenges SET expires_at=NOW()-INTERVAL '1 second' WHERE challenge_id=$1",[c.body.challengeId]);
    assert.equal((await request('POST','/api/auth/register',{...payload,walletProof:signed},c.cookie)).status,409);
    assert.equal(await count(),0);
  });
  await t.test('registration atomically creates a session and a verified wallet; proof replay is rejected',async()=>{
    const c=await challenge();const signed=await proof(c);
    account=await request('POST','/api/auth/register',{...payload,walletProof:signed},c.cookie);ok(account,201);
    assert.equal(account.body.walletAddress,wallet.address.toLowerCase());
    assert.match(account.cookie,/^yunbarter_session=/);
    const view=ok(await request('GET','/api/user/wallet',undefined,account.cookie));assert.equal(view.verifiedWalletAddress,wallet.address.toLowerCase());
    assert.equal((await request('POST','/api/auth/register',{...payload,walletProof:signed},c.cookie)).status,409);
    assert.equal(await count(),1);
  });
  await t.test('one wallet cannot create a second account, including concurrent registration',async()=>{
    assert.equal((await request('POST','/api/auth/register/wallet-challenge',{email:'second@example.com',walletAddress:wallet.address})).status,409);
    const raceWallet=Wallet.createRandom();
    const a=await challenge('race-a@example.com',raceWallet),b=await challenge('race-b@example.com',raceWallet);
    const results=await Promise.all([request('POST','/api/auth/register',{...payload,email:'race-a@example.com',walletProof:await proof(a,raceWallet)},a.cookie),request('POST','/api/auth/register',{...payload,email:'race-b@example.com',walletProof:await proof(b,raceWallet)},b.cookie)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(await count(),2);
  });
  await t.test('bound accounts reject replacement through verification, legacy sync and direct database updates',async()=>{
    assert.equal((await request('POST','/api/chain/wallet/challenge',{walletAddress:stranger.address},account.cookie)).status,409);
    assert.equal((await request('POST','/api/user/wallet/sync',{walletAddress:stranger.address},account.cookie)).status,409);
    const synced=ok(await request('POST','/api/user/wallet/sync',{walletAddress:wallet.address,cachedPoints:99999},account.cookie));assert.equal(Object.hasOwn(synced,'balance'),false);
    await assert.rejects(db.query('UPDATE users SET verified_wallet_address=$1 WHERE user_id=$2',[stranger.address.toLowerCase(),account.body.userId]),e=>e.constraint==='users_wallet_binding_immutable');
    await assert.rejects(db.query('UPDATE users SET verified_wallet_address=NULL WHERE user_id=$1',[account.body.userId]),e=>e.constraint==='users_wallet_binding_immutable');
    assert.equal(ok(await request('GET','/api/user/profile',undefined,account.cookie)).walletAddress,wallet.address.toLowerCase());
  });
  await t.test('existing accounts can bind exactly once even when chain payments are disabled',async()=>{
    await db.query("INSERT INTO users(email,password_hash,username) SELECT 'legacy@example.com',password_hash,'Legacy' FROM users WHERE user_id=$1",[account.body.userId]);
    const login=await request('POST','/api/auth/login',{email:'legacy@example.com',password:payload.password});ok(login);
    const c=ok(await request('POST','/api/chain/wallet/challenge',{walletAddress:stranger.address},login.cookie));
    ok(await request('POST','/api/chain/wallet/verify',{signature:await stranger.signMessage(c.message)},login.cookie));
    assert.equal((await request('POST','/api/chain/wallet/challenge',{walletAddress:Wallet.createRandom().address},login.cookie)).status,409);
    assert.equal((await request('POST','/api/chain/wallet/verify',{signature:await stranger.signMessage(c.message)},login.cookie)).status,409);
  });
  await t.test('failed account creation rolls back proof consumption and does not bind a second wallet',async()=>{
    const extra=Wallet.createRandom();
    assert.equal((await registerAccount(request,payload,extra)).status,409);
    assert.equal((await db.query('SELECT 1 FROM users WHERE verified_wallet_address=$1',[extra.address.toLowerCase()])).rowCount,0);
    assert.equal((await db.query('SELECT 1 FROM registration_wallet_challenges WHERE wallet_address=$1',[extra.address.toLowerCase()])).rowCount,1);
  });
});
