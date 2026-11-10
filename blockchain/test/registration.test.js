const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Wallet,getBytes,verifyMessage}=require('ethers');

async function mockRegistration(t,{rejectConnection=false,rejectSignature=false,switchAfterCreation=false}={}) {
  const wallet=Wallet.createRandom(),other=Wallet.createRandom();
  let current=wallet.address;
  const calls=[];
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;});
  globalThis.window={dispatchEvent(){},ethereum:{async request({method,params}){
    if(method==='eth_requestAccounts') {calls.push('connect');if(rejectConnection)throw Object.assign(new Error('Rejected'),{code:4001});return [current];}
    if(method==='eth_accounts')return [current];
    if(method==='eth_chainId')return '0xaa36a7';
    if(method==='personal_sign') {calls.push('sign');if(rejectSignature)throw Object.assign(new Error('Rejected'),{code:4001});return wallet.signMessage(getBytes(params[0]));}
    throw new Error('Unexpected RPC '+method);
  }}};
  const message='Bind this wallet permanently. No token transfer.';
  globalThis.fetch=async(path,options)=>{
    const body=JSON.parse(options.body);assert.equal(options.credentials,'include');
    if(path==='/api/auth/register/wallet-challenge') {calls.push('challenge');assert.equal(body.walletAddress,wallet.address);return Response.json({challengeId:'a'.repeat(64),message});}
    if(path==='/api/auth/register') {
      calls.push('register');assert.equal(verifyMessage(message,body.walletProof.signature),wallet.address);
      if(switchAfterCreation)current=other.address;
      return Response.json({userId:1,userName:'Alice',walletAddress:wallet.address.toLowerCase()},{status:201});
    }
    throw new Error('Unexpected request '+path);
  };
  const {registerWithWallet}=await import('../../yunbarter-app/src/services/registration.js');
  return {registerWithWallet,calls,wallet};
}
const payload={email:'alice@example.com',password:'password-123',userName:'Alice'};
test('registration connects, signs and only then creates an account while retaining the wallet session',async t=>{
  const f=await mockRegistration(t);
  const result=await f.registerWithWallet(payload);
  assert.deepEqual(f.calls,['connect','challenge','sign','register']);
  assert.equal(result.data.walletAddress,f.wallet.address.toLowerCase());
  assert.equal(await result.session.signer.getAddress(),f.wallet.address);
  result.session.provider.destroy();
});
test('rejecting MetaMask connection never creates an account',async t=>{
  const f=await mockRegistration(t,{rejectConnection:true});
  await assert.rejects(f.registerWithWallet(payload));assert.deepEqual(f.calls,['connect']);
});
test('rejecting the signature never submits account registration',async t=>{
  const f=await mockRegistration(t,{rejectSignature:true});
  await assert.rejects(f.registerWithWallet(payload));assert.deepEqual(f.calls,['connect','challenge','sign']);
});
test('an account switch after successful registration does not report failure or attach another wallet',async t=>{
  const f=await mockRegistration(t,{switchAfterCreation:true});
  const result=await f.registerWithWallet(payload);assert.equal(result.data.userId,1);assert.equal(result.session,null);
});
