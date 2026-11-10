const fs=require('node:fs/promises');
const path=require('node:path');
const {once}=require('node:events');
const {Wallet,getAddress}=require('ethers');
const pool=require('../db');
const {assertConfigured}=require('../db');
const {migrate}=require('./migrate');
const {createApp}=require('../server');
const {verifyPassword}=require('../passwords');

const DEFAULT_PATH=path.join(__dirname,'../../.local-backups/test-accounts/accounts.json');
const DEFINITIONS=[
  {email:'student1@yunbarter.test',name:'測試學生一',role:'student'},
  {email:'student2@yunbarter.test',name:'測試學生二',role:'student'},
  {email:'teacher1@yunbarter.test',name:'測試老師一',role:'teacher',course:{skill:'測試課程：React 網頁入門',category:'程式',price:5,description:'供測試預約、完課、撥款與退款的範例課程。'}},
  {email:'teacher2@yunbarter.test',name:'測試老師二',role:'teacher',course:{skill:'測試課程：吉他基礎',category:'音樂',price:3,description:'供測試不同老師與時段隔離的範例課程。'}},
];

async function loadManifest(file) {
  let manifest;
  try {manifest=JSON.parse(await fs.readFile(file,'utf8'));}
  catch(error) {
    if(error.code!=='ENOENT')throw new Error('測試帳號檔案無法讀取；已停止，避免遺失原綁定錢包');
    manifest={version:1,createdAt:new Date().toISOString(),accounts:DEFINITIONS.map(d=>{
      const wallet=Wallet.createRandom();return {...d,password:'YunTest!2026',walletAddress:wallet.address,privateKey:wallet.privateKey};
    })};
    await fs.mkdir(path.dirname(file),{recursive:true});
    try {await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});}
    catch(error) {if(error.code==='EEXIST')return loadManifest(file);throw error;}
  }
  if(manifest.version!==1||manifest.accounts?.length!==DEFINITIONS.length)throw new Error('測試帳號檔案格式不符，已保留原檔並停止');
  for(const [i,a] of manifest.accounts.entries()) {
    if(a.email!==DEFINITIONS[i].email||a.role!==DEFINITIONS[i].role||typeof a.password!=='string'||a.password.length<8)throw new Error('測試帳號檔案內容不符，已停止');
    try {if(new Wallet(a.privateKey).address!==getAddress(a.walletAddress))throw new Error();}
    catch {throw new Error('測試錢包私鑰與地址不符，已停止');}
  }
  if(new Set(manifest.accounts.map(a=>a.walletAddress.toLowerCase())).size!==DEFINITIONS.length)throw new Error('測試錢包地址不可重複');
  return manifest;
}

async function createTestAccounts({db=pool,manifestPath=DEFAULT_PATH}={}) {
  if(process.env.NODE_ENV==='production')throw new Error('正式環境不可建立開發測試帳號');
  await migrate(db);
  const manifest=await loadManifest(manifestPath);
  // Check every collision before creating any accounts. Existing identities and passwords are never replaced.
  const {rows:existing}=await db.query('SELECT user_id,email,password_hash,verified_wallet_address FROM users WHERE email=ANY($1::text[]) OR verified_wallet_address=ANY($2::text[])',
    [manifest.accounts.map(a=>a.email),manifest.accounts.map(a=>a.walletAddress.toLowerCase())]);
  for(const u of existing) {
    const expected=manifest.accounts.find(a=>a.email===u.email);
    if(!expected||u.verified_wallet_address!==expected.walletAddress.toLowerCase()||!await verifyPassword(expected.password,u.password_hash))throw new Error(`測試帳號或錢包與既有資料衝突（user_id=${u.user_id}），已停止，未重設任何帳號`);
  }
  const server=createApp({db,chain:null,secureCookies:false,demoPayments:true,allowedOrigins:['http://localhost:5173']}).listen(0,'127.0.0.1');
  const results=[];
  try {
    await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}`;
    async function request(method,route,body,cookie) {
      const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const data=await response.json();
      if(!response.ok)throw new Error(`${route}：${data.error||response.status}`);
      return {data,cookie:response.headers.getSetCookie()[0]?.split(';')[0]};
    }
    const {rows:[dates]}=await db.query("SELECT ((NOW() AT TIME ZONE 'Asia/Taipei')::date+1)::text d1,((NOW() AT TIME ZONE 'Asia/Taipei')::date+2)::text d2,((NOW() AT TIME ZONE 'Asia/Taipei')::date+3)::text d3");
    for(const [i,a] of manifest.accounts.entries()) {
      const wasExisting=existing.some(u=>u.email===a.email);
      let session;
      if(!wasExisting) {
        const challenge=await request('POST','/api/auth/register/wallet-challenge',{email:a.email,walletAddress:a.walletAddress});
        const signature=await new Wallet(a.privateKey).signMessage(challenge.data.message);
        session=await request('POST','/api/auth/register',{email:a.email,password:a.password,userName:a.name,walletProof:{challengeId:challenge.data.challengeId,signature}},challenge.cookie);
      } else session=await request('POST','/api/auth/login',{email:a.email,password:a.password});
      const userId=session.data.userId,cookie=session.cookie;
      try {
        if(a.role==='teacher') {
          const {rows:[u]}=await db.query('SELECT schedule_configured FROM users WHERE user_id=$1',[userId]);
          if(!u.schedule_configured)await request('PUT','/api/user/profile',{userName:a.name,availableTimes:[dates.d1+'|Morning',dates.d2+'|Afternoon',dates.d3+'|Night']},cookie);
          const courses=await db.query('SELECT course_id FROM courses WHERE teacher_id=$1 LIMIT 1',[userId]);
          if(!courses.rowCount)await request('POST','/api/teachers',DEFINITIONS[i].course,cookie);
        }
        // Validate a real password login, plus the bound wallet, without spending anything.
        await request('POST','/api/auth/logout',undefined,cookie);
        const verified=await request('POST','/api/auth/login',{email:a.email,password:a.password});
        try {
          const {data:wallet}=await request('GET','/api/user/wallet',undefined,verified.cookie);
          if(wallet.verifiedWalletAddress!==a.walletAddress.toLowerCase())throw new Error('測試帳號錢包驗證失敗');
          results.push({email:a.email,name:a.name,role:a.role,userId,walletAddress:a.walletAddress,created:!wasExisting});
        } finally {await request('POST','/api/auth/logout',undefined,verified.cookie);}
      } finally {
        // Repeated logout is safe, including after a failed setup step.
        await request('POST','/api/auth/logout',undefined,cookie).catch(()=>{});
      }
    }
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
  const report=path.join(path.dirname(manifestPath),'README.md');
  const lines=['# 本機開發測試帳號','',`建立／驗證時間：${new Date().toISOString()}`,'','以下帳號已透過簽章完成永久錢包綁定，所有密碼皆為 `YunTest!2026`。','','| 用途 | 帳號 | 錢包地址 |','| --- | --- | --- |',
    ...results.map(a=>`| ${a.role==='teacher'?'老師':'學生'} | ${a.email} | ${a.walletAddress} |`),'',
    '同目錄的 `accounts.json` 包含測試錢包私鑰，可將個別 privateKey 匯入 MetaMask 後使用對應帳號。請只用於開發測試；此目錄已被 Git 忽略。',
    '本工具只建立帳號、錢包及課程，不會發送鏈上交易。若已執行本機鏈測試，結果見 ../chain-test/report.md；本機 ETH／SKILL 與 Sepolia 餘額分開。',
    '重複執行建立指令不會更換錢包、重設密碼、發放代幣或修改鏈上餘額；既有課程與排班也會保留。',''];
  await fs.writeFile(report,lines.join('\n'),'utf8');
  return {accounts:results,manifestPath,reportPath:report};
}

if(require.main===module) {
  (async()=>{
    try {assertConfigured();const result=await createTestAccounts();console.log(JSON.stringify(result,null,2));}
    catch(error){console.error('建立測試帳號未完成：',error.message);process.exitCode=1;}
    finally {await pool.end();}
  })();
}
module.exports={createTestAccounts};
