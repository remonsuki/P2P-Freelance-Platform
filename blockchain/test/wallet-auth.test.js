const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Wallet}=require('ethers');
const adapter=()=>import('../../yunbarter-app/src/services/blockchain.js');
const unauthorized=()=>Object.assign(new Error('The requested account and/or method has not been authorized by the user.'),{code:4100});

function walletMock(t,{accounts=[],grant,requestError,readError,codeError,permissionError}={}) {
  const previous=globalThis.window,calls=[];
  let allowed=accounts,granted=false;
  globalThis.window={ethereum:{async request(req){
    calls.push(req.method);
    if(req.method==='wallet_requestPermissions') {
      assert.deepEqual(req.params,[{eth_accounts:{}}]);
      if(permissionError)throw permissionError;
      allowed=grant??allowed;granted=true;return [{parentCapability:'eth_accounts'}];
    }
    if(req.method==='eth_requestAccounts') {if(requestError&&!granted)throw requestError;return allowed;}
    if(req.method==='eth_accounts') {if(readError&&!granted)throw readError;return allowed;}
    if(req.method==='eth_chainId')return '0x539';
    if(req.method==='eth_getCode') {if(codeError&&!granted)throw codeError;return '0x6000';}
    assert.fail('Connection must not request signatures or send transactions: '+req.method);
  }}};
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  return calls;
}

test('an already authorized binding uses that address even when another account is first',async t=>{
  const bound=Wallet.createRandom(),other=Wallet.createRandom();
  const calls=walletMock(t,{accounts:[other.address,bound.address]});
  const session=await(await adapter()).connectAuthorizedWallet({expectedAddress:bound.address});
  try {assert.equal(await session.signer.getAddress(),bound.address);assert.equal(session.address,bound.address);assert.ok(!calls.includes('wallet_requestPermissions'));}
  finally {session.provider.destroy();}
});

test('4100 during account access opens one permission request and rechecks the bound address',async t=>{
  const bound=Wallet.createRandom();
  const calls=walletMock(t,{requestError:unauthorized(),grant:[bound.address]});
  const session=await(await adapter()).connectAuthorizedWallet({expectedAddress:bound.address});
  try {assert.equal(session.address,bound.address);assert.equal(calls.filter(m=>m==='wallet_requestPermissions').length,1);assert.equal(calls.filter(m=>m==='eth_requestAccounts').length,1);}
  finally {session.provider.destroy();}
});

test('a permission failure while creating a signer is recovered before any payment',async t=>{
  const bound=Wallet.createRandom();
  const calls=walletMock(t,{accounts:[bound.address],readError:unauthorized(),grant:[bound.address]});
  const session=await(await adapter()).connectAuthorizedWallet({expectedAddress:bound.address});
  try {assert.equal(session.address,bound.address);assert.equal(calls.filter(m=>m==='wallet_requestPermissions').length,1);}
  finally {session.provider.destroy();}
});

test('an ethers-wrapped permission failure during network checks is recovered before a payment quote',async t=>{
  const bound=Wallet.createRandom(),token=Wallet.createRandom(),escrow=Wallet.createRandom();
  const calls=walletMock(t,{accounts:[bound.address],codeError:unauthorized(),grant:[bound.address]});
  const session=await(await adapter()).connectAuthorizedWallet({expectedAddress:bound.address,paymentNetwork:{enabled:true,chainId:1337,tokenAddress:token.address,escrowAddress:escrow.address}});
  try {assert.equal(session.address,bound.address);assert.equal(calls.filter(m=>m==='wallet_requestPermissions').length,1);}
  finally {session.provider.destroy();}
});

test('reauthorizing the wrong account cannot replace the permanent binding or create a signer',async t=>{
  const bound=Wallet.createRandom(),other=Wallet.createRandom();
  const calls=walletMock(t,{accounts:[other.address],grant:[other.address]});
  const {connectAuthorizedWallet,walletErrorCode}=await adapter();
  await assert.rejects(connectAuthorizedWallet({expectedAddress:bound.address}),e=>(walletErrorCode(e)===4100&&/重新授權綁定錢包/.test(e.message)));
  assert.equal(calls.filter(m=>m==='wallet_requestPermissions').length,1);assert.ok(!calls.includes('eth_chainId'));
});

test('rejecting explicit reauthorization stops without sending account or transaction requests',async t=>{
  const calls=walletMock(t,{permissionError:Object.assign(new Error('Rejected'),{code:4001})});
  await assert.rejects((await adapter()).connectAuthorizedWallet({reauthorize:true}),/已取消 MetaMask 操作/);
  assert.deepEqual(calls,['wallet_requestPermissions']);
});

test('background session creation never opens a permission prompt when access is missing',async t=>{
  const calls=walletMock(t);
  await assert.rejects((await adapter()).createWalletSession(),e=>e.code===4100);
  assert.deepEqual(calls,['eth_accounts']);
});

test('nested ethers wrappers preserve the original 4100 error instead of could not coalesce error',async()=>{
  const {walletErrorCode,walletErrorMessage}=await adapter();
  for(const error of [
    {code:'UNKNOWN_ERROR',shortMessage:'could not coalesce error',error:unauthorized()},
    {code:'UNKNOWN_ERROR',shortMessage:'could not coalesce error',info:{error:{code:-32603,data:{originalError:unauthorized()}}}},
    new Error('could not coalesce error',{cause:unauthorized()}),
  ]) {assert.equal(walletErrorCode(error),4100);assert.match(walletErrorMessage(error),/4100.*重新授權綁定錢包/);}
  assert.equal(walletErrorMessage(new Error('此時段已無法預約')),'此時段已無法預約');
});
