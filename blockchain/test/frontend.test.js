const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers');
const {formatUnits}=require('ethers');

test('browser transaction adapter checks chain and wallet, limits approval, and resumes funded orders without a second debit',async t=>{
  const f=await fixture(t);
  const {fundSkillPayment,changeSkillPayment,ensurePaymentNetwork,readSkillBalance}=await import('../../yunbarter-app/src/services/blockchain.js');
  const {q,signature}=await f.quote();
  const payment={paymentId:q.paymentId,quote:q,signature,chainId:1337,tokenAddress:await f.token.getAddress(),escrowAddress:await f.escrow.getAddress()};
  await assert.rejects(ensurePaymentNetwork(f.actors[1],11155111),/Sepolia/);
  await assert.rejects(fundSkillPayment({signer:f.actors[3],payment}),/學生地址不同/);
  await (await f.token.connect(f.actors[1]).approve(payment.escrowAddress,0)).wait();
  const before=await f.token.balanceOf(q.student);
  let submitted=0;
  const receipts=[];
  assert.ok(await fundSkillPayment({signer:f.actors[1],payment,onSubmitted:()=>{submitted++;},onReceipt:async r=>{receipts.push(r);}}));
  assert.equal(receipts.length,2,'approval and funding each expose their real receipt for backup');
  assert.ok(receipts.every(r=>r.status===1));
  assert.equal(await f.token.allowance(q.student,payment.escrowAddress),0n);
  assert.equal(await f.token.balanceOf(q.student),before-BigInt(q.amount));
  assert.equal(await fundSkillPayment({signer:f.actors[1],payment}),null);
  assert.equal(submitted,1);
  await assert.rejects(changeSkillPayment({signer:f.actors[2],payment,action:'cancel'}),/原本的收付款錢包/);
  await changeSkillPayment({signer:f.actors[1],payment,action:'cancel'});
  assert.equal(await f.token.balanceOf(q.student),before);
  await (await f.token.transfer(q.student,1n)).wait();
  assert.equal(await readSkillBalance(f.provider,q.student,payment.tokenAddress),formatUnits(before+1n,18),'balances retain the last wei without conversion to Number');
});

test('a network change uses a fresh browser session and rejects an RPC with missing project contracts',async t=>{
  const f=await fixture(t);
  const {createWalletSession,switchPaymentNetwork,ensurePaymentNetwork}=await import('../../yunbarter-app/src/services/blockchain.js');
  let chain='0x1';
  const ethereum={async request(req){
    if(req.method==='eth_chainId')return chain;
    if(req.method==='wallet_switchEthereumChain'){chain=req.params[0].chainId;return null;}
    if(['eth_accounts','eth_requestAccounts'].includes(req.method))return [f.wallets[1].address];
    return f.rpc.request(req);
  }};
  const previous=globalThis.window;globalThis.window={ethereum};
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  const old=await createWalletSession();t.after(()=>old.provider.destroy());
  assert.equal((await old.provider.getNetwork()).chainId,1n);
  const config={enabled:true,chainId:1337,tokenAddress:await f.token.getAddress(),escrowAddress:await f.escrow.getAddress()};
  await switchPaymentNetwork(config);
  const fresh=await createWalletSession();t.after(()=>fresh.provider.destroy());
  assert.equal(await fresh.signer.getAddress(),f.wallets[1].address);
  await ensurePaymentNetwork(fresh.signer,config);
  await assert.rejects(ensurePaymentNetwork(fresh.signer,{...config,escrowAddress:f.wallets[3].address}),/網路編號正確，但找不到本專案合約/);
});

test('4100 during approval is surfaced without retrying the financial request',async t=>{
  const f=await fixture(t);
  const {connectAuthorizedWallet,fundSkillPayment,walletErrorCode,walletErrorMessage}=await import('../../yunbarter-app/src/services/blockchain.js');
  const {q,signature}=await f.quote();
  const config={enabled:true,chainId:1337,tokenAddress:await f.token.getAddress(),escrowAddress:await f.escrow.getAddress()};
  await(await f.token.connect(f.actors[1]).approve(config.escrowAddress,0)).wait();
  let sends=0,permissions=0;
  const ethereum={async request(req){
    if(['eth_accounts','eth_requestAccounts'].includes(req.method))return [q.student];
    if(req.method==='wallet_requestPermissions'){permissions++;assert.fail('Sending a transaction must not automatically retry permissions');}
    if(req.method==='eth_sendTransaction'){sends++;throw Object.assign(new Error('The requested account and/or method has not been authorized by the user.'),{code:4100});}
    return f.rpc.request(req);
  }};
  const previous=globalThis.window;globalThis.window={ethereum};
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  const session=await connectAuthorizedWallet({expectedAddress:q.student,paymentNetwork:config});t.after(()=>session.provider.destroy());
  const before=await f.token.balanceOf(q.student);
  await assert.rejects(fundSkillPayment({signer:session.signer,payment:{...config,paymentId:q.paymentId,quote:q,signature}}),error=>{
    assert.equal(walletErrorCode(error),4100);assert.match(walletErrorMessage(error),/重新授權綁定錢包/);return true;
  });
  assert.equal(sends,1);assert.equal(permissions,0);
  assert.equal(await f.token.balanceOf(q.student),before);assert.equal(Number((await f.escrow.getPayment(q.paymentId)).state),0);
});
