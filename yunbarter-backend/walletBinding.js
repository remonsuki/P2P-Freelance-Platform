const {randomBytes,createHash}=require('node:crypto');
const {getAddress,verifyMessage,ZeroAddress}=require('ethers');
const {transaction}=require('./db');
const {HttpError}=require('./marketplace');

const COOKIE='yunbarter_registration';
const hash=value=>createHash('sha256').update(value).digest('hex');
function address(value) {
  try {const result=getAddress(value);if(result===ZeroAddress) throw new Error();return result.toLowerCase();}
  catch {throw new HttpError(400,'錢包地址格式不正確');}
}
function email(value) {
  if(typeof value!=='string'||value.trim().length>255||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new HttpError(400,'電子郵件格式不正確');
  return value.trim().toLowerCase();
}
function recover(message,signature) {
  try {return verifyMessage(message,signature).toLowerCase();}
  catch {throw new HttpError(400,'錢包簽章格式不正確');}
}
function registrationToken(req) {
  const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  return /^[0-9a-f]{64}$/.test(value||'')?value:null;
}
const sessionHash=req=>hash((req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('yunbarter_session='))||'');

function createWalletBinding(db,{secureCookies=false}={}) {
  const cookieOptions={httpOnly:true,sameSite:'lax',secure:secureCookies,path:'/api'};
  async function registrationChallenge(req,res) {
    const wallet=address(req.body?.walletAddress),normalizedEmail=email(req.body?.email);
    if((await db.query('SELECT 1 FROM users WHERE verified_wallet_address=$1',[wallet])).rowCount) throw new HttpError(409,'此錢包已綁定其他帳號，請使用原帳號登入');
    const token=randomBytes(32).toString('hex'),challengeId=randomBytes(32).toString('hex');
    const origin=req.headers.origin||'YunBarter';
    const expires=new Date(Date.now()+5*60000);
    const message=`YunBarter account registration\nOrigin: ${origin}\nEmail: ${normalizedEmail}\nWallet: ${wallet}\nNonce: ${challengeId}\nExpires: ${expires.toISOString()}\nBind this wallet permanently to one YunBarter account. This signature does not transfer tokens or authorize spending.`;
    await db.query('DELETE FROM registration_wallet_challenges WHERE expires_at<=NOW()');
    await db.query(`INSERT INTO registration_wallet_challenges(challenge_id,browser_hash,email,wallet_address,origin,message,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[challengeId,hash(token),normalizedEmail,wallet,origin,message,expires]);
    res.cookie(COOKIE,token,{...cookieOptions,maxAge:5*60000});
    res.json({challengeId,message,walletAddress:wallet,expiresAt:expires});
  }
  async function consumeRegistrationProof(client,req,normalizedEmail,proof) {
    if(!proof||typeof proof.challengeId!=='string'||!/^[0-9a-f]{64}$/.test(proof.challengeId)) throw new HttpError(400,'建立帳號前請先連接 MetaMask 並完成錢包簽章');
    const token=registrationToken(req);
    if(!token) throw new HttpError(409,'錢包驗證已失效，請重新開始註冊');
    const {rows:[c]}=await client.query('SELECT *,expires_at>NOW() AS valid FROM registration_wallet_challenges WHERE challenge_id=$1 FOR UPDATE',[proof.challengeId]);
    if(!c||!c.valid||c.browser_hash!==hash(token)||c.email!==normalizedEmail||c.origin!==(req.headers.origin||'YunBarter')) throw new HttpError(409,'錢包驗證已失效或註冊資料已變更，請重新簽章');
    if(recover(c.message,proof.signature)!==c.wallet_address) throw new HttpError(403,'錢包簽章與註冊錢包不符');
    await client.query('DELETE FROM registration_wallet_challenges WHERE challenge_id=$1',[c.challenge_id]);
    return c.wallet_address;
  }
  function clearRegistrationCookie(res) {res.clearCookie(COOKIE,cookieOptions);}
  function installAccountRoutes(app) {
    app.post('/api/chain/wallet/challenge',async(req,res)=>{
      const wallet=address(req.body?.walletAddress);
      const expires=new Date(Date.now()+5*60000);
      const message=`YunBarter permanent wallet binding\nOrigin: ${req.headers.origin||'YunBarter'}\nUser: ${req.user.user_id}\nAddress: ${wallet}\nNonce: ${randomBytes(24).toString('hex')}\nExpires: ${expires.toISOString()}\nBind this wallet permanently. This signature does not transfer tokens.`;
      await transaction(db,async client=>{
        const {rows:[u]}=await client.query('SELECT verified_wallet_address FROM users WHERE user_id=$1 FOR UPDATE',[req.user.user_id]);
        if(u.verified_wallet_address&&u.verified_wallet_address!==wallet) throw new HttpError(409,'帳號已綁定錢包，無法更換；請連接原本的錢包');
        if((await client.query('SELECT 1 FROM users WHERE verified_wallet_address=$1 AND user_id<>$2',[wallet,req.user.user_id])).rowCount) throw new HttpError(409,'此錢包已綁定其他帳號');
        await client.query(`INSERT INTO wallet_challenges(user_id,wallet_address,session_hash,message,expires_at) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(user_id) DO UPDATE SET wallet_address=$2,session_hash=$3,message=$4,expires_at=$5`,[req.user.user_id,wallet,sessionHash(req),message,expires]);
      });
      res.json({message,expiresAt:expires});
    });
    app.post('/api/chain/wallet/verify',async(req,res)=>{
      const wallet=await transaction(db,async client=>{
        const {rows:[u]}=await client.query('SELECT verified_wallet_address FROM users WHERE user_id=$1 FOR UPDATE',[req.user.user_id]);
        const {rows:[c]}=await client.query('SELECT *,expires_at>NOW() AS valid FROM wallet_challenges WHERE user_id=$1 FOR UPDATE',[req.user.user_id]);
        if(!c||!c.valid||c.session_hash!==sessionHash(req)) throw new HttpError(409,'簽章要求已失效，請重新驗證');
        if(recover(c.message,req.body?.signature)!==c.wallet_address) throw new HttpError(403,'錢包簽章與要求的地址不符');
        if(u.verified_wallet_address&&u.verified_wallet_address!==c.wallet_address) throw new HttpError(409,'帳號已綁定錢包，無法更換');
        await client.query('UPDATE users SET verified_wallet_address=$1 WHERE user_id=$2',[c.wallet_address,req.user.user_id]);
        await client.query('DELETE FROM wallet_challenges WHERE user_id=$1',[req.user.user_id]);
        return c.wallet_address;
      });
      res.json({verifiedWalletAddress:wallet});
    });
  }
  return {registrationChallenge,consumeRegistrationProof,clearRegistrationCookie,installAccountRoutes};
}
module.exports={createWalletBinding};
