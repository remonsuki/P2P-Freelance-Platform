const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createHash}=require('node:crypto');
const {JsonRpcProvider,Wallet,NonceManager,Contract,ContractFactory,parseUnits,formatUnits}=require('ethers');
const db=require('../db');
const {createApp}=require('../server');
const {createChainService}=require('../chain');
const {compile}=require('../../blockchain/scripts/compile');
const protocol=require('../../blockchain/protocol.json');
const directory=path.join(__dirname,'../../.local-backups/chain-test');
const stateFile=path.join(directory,'report.json');
const deploymentFile=path.join(directory,'deployment.json');
const scenarios=[
  {key:'S1-T1',student:'student1@yunbarter.test',teacher:'teacher1@yunbarter.test',slot:'Morning',outcome:'released',action:'complete'},
  {key:'S1-T2',student:'student1@yunbarter.test',teacher:'teacher2@yunbarter.test',slot:'Afternoon',outcome:'refunded',action:'cancel'},
  {key:'S2-T1',student:'student2@yunbarter.test',teacher:'teacher1@yunbarter.test',slot:'Afternoon',outcome:'refunded',action:'dispute-refund'},
  {key:'S2-T2',student:'student2@yunbarter.test',teacher:'teacher2@yunbarter.test',slot:'Morning',outcome:'released',action:'complete'},
];
const readJson=async file=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const writeJson=(file,data)=>fs.writeFile(file,JSON.stringify(data,null,2)+'\n');

async function run() {
  if(process.env.NODE_ENV==='production')throw new Error('Local transaction tests are disabled in production');
  const config=await readJson(path.join(directory,'node-private.json'));
  const manifest=await readJson(path.join(directory,'../test-accounts/accounts.json'));
  if(!config||!manifest||config.chainId!==1337)throw new Error('Prepare the local node and test accounts first');
  if(process.env.CHAIN_ENABLED==='true'&&process.env.CHAIN_ID!=='1337')throw new Error('An existing non-local chain is enabled; it will not be replaced');
  const provider=new JsonRpcProvider(`http://127.0.0.1:${config.port}`,undefined,{cacheTimeout:-1});provider.pollingInterval=25;
  let server;
  let endSessions;
  const sessions=new Map();
  try {
    assert.equal((await provider.getNetwork()).chainId,1337n);
    const {rows:[identity]}=await db.query('SELECT current_database() AS name');
    const accounts=manifest.accounts;
    const {rows:users}=await db.query('SELECT user_id,email,verified_wallet_address FROM users WHERE email=ANY($1::text[])',[accounts.map(a=>a.email)]);
    assert.equal(users.length,4);
    for(const a of accounts)assert.equal(users.find(u=>u.email===a.email).verified_wallet_address,a.walletAddress.toLowerCase());
    const originalFingerprint=async()=>{
      const {rows}=await db.query('SELECT u.* FROM users u WHERE NOT(email=ANY($1::text[])) ORDER BY user_id',[accounts.map(a=>a.email)]);
      return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    };
    let state=await readJson(stateFile);
    if(!state) {
      const old=await db.query('SELECT 1 FROM chain_payments WHERE student_id=ANY($1::bigint[]) OR teacher_id=ANY($1::bigint[])',[users.map(u=>u.user_id)]);
      if(old.rowCount)throw new Error('Untracked test-account payments already exist; not adding duplicate records');
      state={version:1,network:'local-evm',chainId:1337,rpcUrl:`http://127.0.0.1:${config.port}`,database:identity.name,date:new Date(config.genesisTime).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'}),startedAt:new Date().toISOString(),identityFingerprintV2:await originalFingerprint(),orders:[],transactions:[],fundedWallets:[]};
      await writeJson(stateFile,state);
    }
    assert.equal(state.database,identity.name);
    const save=()=>writeJson(stateFile,state);
    const deployer=new NonceManager(new Wallet(config.accounts[0].secretKey,provider));
    let deployment=await readJson(deploymentFile);
    if(!deployment) {
      const artifacts=compile();
      const token=await new ContractFactory(artifacts.SkillToken.abi,artifacts.SkillToken.evm.bytecode.object,deployer).deploy(await deployer.getAddress());
      await token.waitForDeployment();state.transactions.push({action:'deploy-token',hash:token.deploymentTransaction().hash});await save();
      const quoteSigner=new Wallet(process.env.CHAIN_QUOTE_PRIVATE_KEY);
      const escrow=await new ContractFactory(artifacts.SkillEscrow.abi,artifacts.SkillEscrow.evm.bytecode.object,deployer).deploy(await token.getAddress(),quoteSigner.address);
      await escrow.waitForDeployment();state.transactions.push({action:'deploy-escrow',hash:escrow.deploymentTransaction().hash});await save();
      deployment={chainId:1337,tokenAddress:await token.getAddress(),escrowAddress:await escrow.getAddress(),quoteSigner:quoteSigner.address};
      await writeJson(deploymentFile,deployment);
    }
    state.deployment=deployment;
    const token=new Contract(deployment.tokenAddress,['function transfer(address,uint256) returns(bool)','function balanceOf(address) view returns(uint256)'],deployer);
    const escrow=new Contract(deployment.escrowAddress,protocol.abi,provider);
    const signers=Object.fromEntries(accounts.map(a=>[a.email,new NonceManager(new Wallet(a.privateKey,provider))]));
    const chain=createChainService({CHAIN_ENABLED:'true',CHAIN_ID:'1337',CHAIN_RPC_URL:state.rpcUrl,CHAIN_CONFIRMATIONS:'2',SKILL_TOKEN_ADDRESS:deployment.tokenAddress,SKILL_ESCROW_ADDRESS:deployment.escrowAddress,CHAIN_QUOTE_PRIVATE_KEY:process.env.CHAIN_QUOTE_PRIVATE_KEY},{provider});
    await chain.ready();
    async function record(action,tx,order) {
      const receipt=await tx.wait(1);assert.equal(receipt.status,1);
      state.transactions.push({action,order:order?.key||null,hash:receipt.hash,blockNumber:receipt.blockNumber});await save();return receipt;
    }
    if(!state.completedAt)for(const a of accounts) {
      if(state.fundedWallets.includes(a.email))continue;
      const balance=await token.balanceOf(a.walletAddress);
      if(balance===0n)await record('initial-SKILL',await token.transfer(a.walletAddress,parseUnits('100',18)));
      else assert.equal(balance,parseUnits('100',18));
      state.fundedWallets.push(a.email);await save();
    }
    server=createApp({db,chain,secureCookies:false,allowedOrigins:['http://localhost:5173']}).listen(0,'127.0.0.1');await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}`;
    async function request(method,route,body,email) {
      const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:5173',...(sessions.has(email)?{Cookie:sessions.get(email)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const data=await response.json();
      if(!response.ok)throw new Error(`${route}: ${data.error||response.status}`);
      if(route==='/api/auth/login')sessions.set(email,response.headers.getSetCookie()[0].split(';')[0]);
      return data;
    }
    endSessions=async()=>{for(const email of sessions.keys())await request('POST','/api/auth/logout',undefined,email).catch(()=>{});};
    for(const a of accounts)await request('POST','/api/auth/login',{email:a.email,password:a.password},a.email);
    const mine=()=>provider.send('evm_mine',[]);
    async function sync(p) {await mine();return request('POST',`/api/chain/payments/${p.paymentId}/sync`,{},p.student);}
    async function advanceTo(timestamp) {
      const block=await provider.getBlock('latest');
      if(block.timestamp<Number(timestamp))await provider.send('evm_increaseTime',[Number(timestamp)-block.timestamp+1]);
      await mine();
    }
    const frontend=await import('../../yunbarter-app/src/services/blockchain.js');
    if(!state.completedAt) {
      for(const a of accounts.filter(a=>a.role==='teacher')) {
        const profile=await request('GET','/api/user/profile',undefined,a.email);
        const slots=[...new Set([...profile.availableTimes,state.date+'|Morning',state.date+'|Afternoon'])];
        await request('PUT','/api/user/profile',{userName:profile.userName,availableTimes:slots},a.email);
      }
      for(const scenario of scenarios) {
        let p=state.orders.find(o=>o.key===scenario.key);
        if(!p) {
          const teacher=users.find(u=>u.email===scenario.teacher);
          const {rows:[course]}=await db.query('SELECT course_id FROM courses WHERE teacher_id=$1 AND is_active ORDER BY course_id LIMIT 1',[teacher.user_id]);
          const quote=await request('POST','/api/chain/quotes',{courseId:Number(course.course_id),timeSlot:state.date+'|'+scenario.slot},scenario.student);
          p={...scenario,...quote};state.orders.push(p);await save();
        }
        const payment=await escrow.getPayment(p.paymentId);
        if(Number(payment.state)===0) {
          const before=state.transactions.length;
          const hash=await frontend.fundSkillPayment({signer:signers[p.student],payment:p,onSubmitted:hash=>{p.submittedHash=hash;}});
          if(hash)state.transactions.push({action:'fund',order:p.key,hash});
          // Record approval receipts as well, obtained from the exact allowance consumed by this payment.
          const logs=await provider.getLogs({address:deployment.tokenAddress,fromBlock:Number(p.quoteCreatedBlock||0),toBlock:'latest',topics:[require('ethers').id('Approval(address,address,uint256)'),require('ethers').zeroPadValue(p.quote.student,32),require('ethers').zeroPadValue(deployment.escrowAddress,32)]});
          for(const log of logs)if(!state.transactions.some(t=>t.hash===log.transactionHash))state.transactions.push({action:'approve',order:p.key,hash:log.transactionHash});
          assert.ok(state.transactions.length>before);await save();
        }
        const result=await sync(p);assert.notEqual(result.status,'quoted');
        await assert.rejects(escrow.connect(signers[p.student]).fund.staticCall(p.quote,p.signature));
        p.status=result.status;await save();
      }
      const cancelled=state.orders.find(p=>p.action==='cancel');
      if(Number((await escrow.getPayment(cancelled.paymentId)).state)===1)await record('cancel',await escrow.connect(signers[cancelled.student]).cancel(cancelled.paymentId),cancelled);
      assert.equal((await sync(cancelled)).status,'refunded');
      for(const p of state.orders.filter(p=>p.action==='complete')) {
        await advanceTo(p.quote.endsAt);
        if(Number((await escrow.getPayment(p.paymentId)).state)===1)await record('complete',await escrow.connect(signers[p.student]).complete(p.paymentId),p);
        assert.equal((await sync(p)).status,'released');
        await request('POST',`/api/chain/payments/${p.paymentId}/review`,{rating:5,review:'本機測試鏈：付款、託管及完課撥款均已驗證'},p.student);
      }
      const disputed=state.orders.find(p=>p.action==='dispute-refund');
      await advanceTo(disputed.quote.startsAt);
      if(Number((await escrow.getPayment(disputed.paymentId)).state)===1)await record('dispute',await escrow.connect(signers[disputed.student]).dispute(disputed.paymentId),disputed);
      if(Number((await escrow.getPayment(disputed.paymentId)).state)===2) {
        assert.equal((await sync(disputed)).status,'disputed');
        await request('POST',`/api/chain/payments/${disputed.paymentId}/reason`,{reason:'本機自動測試：確認爭議會凍結撥款，並由老師同意退款'},disputed.student);
        await advanceTo(disputed.quote.endsAt);
        await assert.rejects(escrow.connect(signers[disputed.student]).complete.staticCall(disputed.paymentId));
        await record('refund',await escrow.connect(signers[disputed.teacher]).refund(disputed.paymentId),disputed);
      }
      assert.equal((await sync(disputed)).status,'refunded');
    }
    state.checks={};
    const expected=new Map(accounts.map(a=>[a.email,parseUnits('100',18)]));
    for(const p of state.orders) {
      const result=await request('POST',`/api/chain/payments/${p.paymentId}/sync`,{},p.student);
      assert.equal(result.status,p.outcome);p.status=result.status;p.finalTxHash=result.txHash;
      if(p.outcome==='released') {expected.set(p.student,expected.get(p.student)-BigInt(p.quote.amount));expected.set(p.teacher,expected.get(p.teacher)+BigInt(p.quote.amount));}
      await assert.rejects(escrow.connect(signers[p.student]).fund.staticCall(p.quote,p.signature));
    }
    state.accounts=[];
    for(const a of accounts) {
      const payments=await request('GET','/api/chain/payments',undefined,a.email);
      assert.equal(payments.payments.length,2);assert.equal(payments.syncErrors.length,0);
      const bookings=await request('GET','/api/bookings',undefined,a.email);assert.equal(bookings.filter(b=>b.paymentMethod==='skill').length,2);
      const wallet=await request('GET','/api/user/wallet',undefined,a.email);assert.equal(Object.hasOwn(wallet,'balance'),false);
      const skill=await token.balanceOf(a.walletAddress);assert.equal(skill,expected.get(a.email));
      state.accounts.push({email:a.email,role:a.role,walletAddress:a.walletAddress,transactions:2,skillBalance:formatUnits(skill,18)});
    }
    assert.equal(await token.balanceOf(deployment.escrowAddress),0n);
    for(const tx of state.transactions) {
      const receipt=await provider.getTransactionReceipt(tx.hash);assert.equal(receipt.status,1);assert.ok(await receipt.confirmations()>=2);
      await chain.history.backup(db,tx.hash);
      tx.blockNumber=receipt.blockNumber;tx.status='success';
    }
    const migration=await readJson(path.join(directory,'chain-only-migration.json'));
    const expectedFingerprint=state.identityFingerprintV2||migration?.identityFingerprintV2;
    if(!expectedFingerprint)throw new Error('Verify the pre-migration user backup before validating an older report');
    assert.equal(await originalFingerprint(),expectedFingerprint);
    const {rows:[columns]}=await db.query("SELECT COUNT(*)::int n FROM information_schema.columns WHERE table_schema=current_schema() AND column_name='cached_points'");
    assert.equal(columns.n,0);
    for(const a of accounts) {
      const history=await request('GET','/api/chain/transactions',undefined,a.email);assert.equal(history.syncError,null);assert.ok(history.transactions.length>=3);
    }
    state.checks={twoOrdersPerAccount:true,allReceiptsSuccessful:true,minimumConfirmations:2,replayRejected:true,disputeBlocksCompletion:true,databaseHasNoBalance:true,receiptsBackedUp:true,escrowBalanceZero:true,tokenBalancesExact:true,originalUsersPreserved:true};
    state.completedAt=state.completedAt||new Date().toISOString();state.lastVerifiedAt=new Date().toISOString();await save();
    // Only enable this explicitly labelled local network after all checks have passed.
    const envPath=path.join(__dirname,'../.env');let env=await fs.readFile(envPath,'utf8');
    for(const [key,value] of Object.entries({CHAIN_ENABLED:'true',CHAIN_ID:'1337',CHAIN_RPC_URL:state.rpcUrl,CHAIN_CONFIRMATIONS:'2',SKILL_TOKEN_ADDRESS:deployment.tokenAddress,SKILL_ESCROW_ADDRESS:deployment.escrowAddress})) {
      const pattern=new RegExp('^'+key+'=.*$','m');env=pattern.test(env)?env.replace(pattern,key+'='+value):env.trimEnd()+'\n'+key+'='+value+'\n';
    }
    await fs.writeFile(envPath,env);
    const rows=state.orders.map(p=>`| ${p.student} | ${p.teacher} | ${formatUnits(p.quote.amount,18)} SKILL | ${p.status} | ${p.finalTxHash} |`);
    const report=['# 本機區塊鏈交易測試結果','',`完成時間：${state.completedAt}`,'','此報告驗證的是持久化 Ganache 本機 EVM 測試鏈，並非 Sepolia 公開測試網。',`RPC：${state.rpcUrl}；Chain ID：1337；貨幣：ETH。`,'',`代幣合約：${deployment.tokenAddress}`,`託管合約：${deployment.escrowAddress}`,'','測試使用鏈上時間前進模擬上課與完課，不需實際等待。4 筆課程交易讓每個帳號各參與 2 筆；approve、fund、退款等底層鏈上操作另有獨立收據。','','| 學生 | 老師 | 金額 | 最終狀態 | 結算交易雜湊 |','| --- | --- | --- | --- | --- |',...rows,'','| 帳號 | 交易紀錄 | SKILL |','| --- | --- | --- |',...state.accounts.map(a=>`| ${a.email} | ${a.transactions} | ${a.skillBalance} |`),'',`共 ${state.transactions.length} 筆鏈上交易收據驗證成功，皆至少 2 個確認。已確認重複付款遭拒、爭議凍結撥款、退款正確、託管餘額歸零、資料庫不保存餘額、收據已備份及原使用者資料保留。`,'','所有測試帳號登入密碼：`YunTest!2026`。MetaMask 匯入私鑰在 `../test-accounts/accounts.json`，本報告不包含私鑰。','在 MetaMask 新增本機網路後匯入對應測試私鑰，即可查看該錢包的本機 ETH 與 SKILL。此地址在 Sepolia 上的餘額與本機鏈分開。','',
      '重新開機後，在 blockchain 執行 `npm run local:node` 啟動原測試鏈；資料保存在同目錄 ganache 資料夾。不要刪除該資料夾後繼續使用資料庫內既有合約地址。','後端 .env 已設定為此本機測試網；重啟後端後，錢包與預約管理頁均可查看兩筆 SKILL 紀錄。',''];
    await fs.writeFile(path.join(directory,'report.md'),report.join('\n'));
    console.log(JSON.stringify({network:state.network,chainId:1337,rpcUrl:state.rpcUrl,accounts:state.accounts,courseTransactions:state.orders.length,chainReceipts:state.transactions.length,checks:state.checks,reportPath:path.join(directory,'report.md')},null,2));
  } finally {
    if(server?.listening&&endSessions)await endSessions();
    if(server?.listening)await new Promise(resolve=>server.close(resolve));provider.destroy();await db.end();
  }
}
run().catch(error=>{console.error('本機交易測試未完成：',error.shortMessage||error.message);process.exitCode=1;});
