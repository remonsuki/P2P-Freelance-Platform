const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Interface,Wallet}=require('ethers');
const protocol=require('../protocol.json');
const adapter=()=>import('../../yunbarter-app/src/services/blockchain.js');
const chainId=11155111n;

async function mockPayment({network=chainId,allowance=0n,balance=100000000000000n,afterApprovalBalance=balance,
  afterEstimate,sendError,signal}={}) {
  const {SKILL_TOKEN_ABI}=await import('../../yunbarter-app/src/config/contracts.js');
  const escrowABI=new Interface(protocol.abi),tokenABI=new Interface(SKILL_TOKEN_ABI);
  const quoteSigner=Wallet.createRandom(),student=Wallet.createRandom().address,teacher=Wallet.createRandom().address;
  const tokenAddress=Wallet.createRandom().address,escrowAddress=Wallet.createRandom().address;
  const paymentId='0x'+'11'.repeat(32);
  const quote={paymentId,slotKey:'0x'+'12'.repeat(32),student,teacher,amount:10n,startsAt:1500n,endsAt:1800n,deadline:1400n};
  const signature=await quoteSigner.signTypedData({name:protocol.name,version:protocol.version,chainId,verifyingContract:escrowAddress},protocol.types,quote);
  const payment={paymentId,quote,signature,chainId:Number(chainId),tokenAddress,escrowAddress};
  const sends=[],progress=[],receipts=[],submitted=[];
  let state=0,skill=100n,actor=student;
  const signer={
    provider:{
      getNetwork:async()=>({chainId:network}),
      getBlock:async()=>({timestamp:1000}),
      getBalance:async()=>sends.includes('approve')?afterApprovalBalance:balance,
      getFeeData:async()=>({maxFeePerGas:20000000000n}),
      getTransactionReceipt:async hash=>({hash,status:1,logs:[],gasUsed:50000n,gasPrice:100n}),
    },
    getAddress:async()=>actor,
    call:async tx=>{
      const abi=tx.to===tokenAddress?tokenABI:escrowABI;
      const {name}=abi.parseTransaction(tx);
      const outputs={token:[tokenAddress],quoteSigner:[quoteSigner.address],getPayment:[[quote,state,0,0]],
        balanceOf:[skill],allowance:[allowance],decimals:[18]};
      return abi.encodeFunctionResult(name,outputs[name]);
    },
    estimateGas:async()=>{afterEstimate?.();return 50000n;},
    sendTransaction:async tx=>{
      assert.equal(network,chainId);
      assert.equal(tx.chainId,chainId);
      assert.equal(tx.gasPrice,undefined);
      assert.equal(tx.maxFeePerGas,undefined);
      assert.equal(tx.maxPriorityFeePerGas,undefined);
      const abi=tx.to===tokenAddress?tokenABI:escrowABI;
      const {name,args}=abi.parseTransaction(tx);
      sends.push(name);
      if(sendError) throw sendError;
      if(name==='approve') {
        assert.equal(args[0],escrowAddress);assert.equal(args[1],quote.amount);allowance=args[1];
      } else if(name==='fund') {
        assert.equal(allowance,quote.amount);assert.equal(state,0);allowance-=quote.amount;skill-=quote.amount;state=1;
      } else if(name==='cancel') {
        assert.equal(state,1);skill+=quote.amount;state=4;
      } else assert.fail('Unexpected transaction request '+name);
      return {...tx,hash:'0x'+String(sends.length).repeat(64)};
    },
  };
  const {fundSkillPayment}=await adapter();
  return {signer,payment,sends,progress,receipts,submitted,setActor:value=>{actor=value;},setNetwork:value=>{network=value;},
    get skill(){return skill;},get allowance(){return allowance;},execute:()=>fundSkillPayment({
      signer,payment,signal,onProgress:message=>progress.push(message),onSubmitted:hash=>submitted.push(hash),onReceipt:receipt=>receipts.push(receipt),
    })};
}

test('Sepolia payment checks the wallet, caps approval, and resumes funded orders without a second debit',async()=>{
  const f=await mockPayment();
  const {changeSkillPayment,readSkillBalance}=await adapter();
  const before=f.skill;
  f.setActor(f.payment.quote.teacher);
  await assert.rejects(f.execute(),/學生地址不同/);
  assert.deepEqual(f.sends,[]);
  f.setActor(f.payment.quote.student);
  assert.ok(await f.execute());
  assert.deepEqual(f.sends,['approve','fund']);
  assert.equal(f.receipts.length,2);
  assert.ok(f.receipts.every(r=>r.status===1));
  assert.equal(f.allowance,0n);
  assert.equal(f.skill,before-f.payment.quote.amount);
  assert.equal(await f.execute(),null);
  assert.equal(f.submitted.length,1);
  assert.ok(f.progress.some(message=>/估算的網路費上限.*較低費用選項/.test(message)));
  f.setActor(f.payment.quote.teacher);
  await assert.rejects(changeSkillPayment({...f,action:'cancel'}),/原本的收付款錢包/);
  f.setActor(f.payment.quote.student);
  await changeSkillPayment({...f,action:'cancel'});
  assert.equal(f.skill,before);
  assert.equal(await readSkillBalance(f.signer,f.payment.quote.student,f.payment.tokenAddress),'0.0000000000000001');
});

test('transaction entry points reject non-Sepolia quotes and wallets and recheck after fee estimation',async()=>{
  const {fundSkillPayment,changeSkillPayment}=await adapter();
  const f=await mockPayment({afterEstimate:()=>f.setNetwork(1337n)});
  for(const chainId of [1,1337,31337]) {
    const payment={...f.payment,chainId};
    await assert.rejects(fundSkillPayment({signer:f.signer,payment}),/僅支援 Sepolia/);
    await assert.rejects(changeSkillPayment({signer:f.signer,payment,action:'cancel'}),/僅支援 Sepolia/);
    f.setNetwork(BigInt(chainId));
    await assert.rejects(f.execute(),/切換至 Sepolia/);
    await assert.rejects(changeSkillPayment({...f,action:'cancel'}),/切換至 Sepolia/);
  }
  f.setNetwork(chainId);
  await assert.rejects(f.execute(),/切換至 Sepolia/);
  assert.deepEqual(f.sends,[]);
});

test('gas and abort checks prevent later sends, and 4100 never retries a financial request',async()=>{
  const empty=await mockPayment({afterApprovalBalance:0n});
  await assert.rejects(empty.execute(),/沒有 Sepolia ETH/);
  assert.deepEqual(empty.sends,['approve']);

  const controller=new AbortController();
  const aborted=await mockPayment({signal:controller.signal,afterEstimate:()=>controller.abort()});
  await assert.rejects(aborted.execute(),{name:'AbortError'});
  assert.deepEqual(aborted.sends,[]);

  const sendError=Object.assign(new Error('The requested account has not been authorized.'),{code:4100});
  const unauthorized=await mockPayment({sendError});
  const {walletErrorCode,walletErrorMessage}=await adapter();
  await assert.rejects(unauthorized.execute(),error=>walletErrorCode(error)===4100&&/重新授權綁定錢包/.test(walletErrorMessage(error)));
  assert.deepEqual(unauthorized.sends,['approve']);
  assert.deepEqual(unauthorized.submitted,[]);
});

test('fresh wallet sessions validate project bytecode and the browser transport blocks non-Sepolia sends',async t=>{
  const {createWalletSession,switchPaymentNetwork,ensurePaymentNetwork,walletErrorMessage}=await adapter();
  const {payment}=await mockPayment();
  let network='0x1';
  const sends=[];
  const previous=globalThis.window;
  globalThis.window={ethereum:{async request({method,params}){
    if(method==='eth_chainId')return network;
    if(method==='eth_accounts')return [payment.quote.student];
    if(method==='wallet_switchEthereumChain'){network=params[0].chainId;return null;}
    if(method==='eth_getCode')return [payment.tokenAddress,payment.escrowAddress].some(address=>address.toLowerCase()===params[0])?'0x6000':'0x';
    if(method==='eth_sendTransaction'){sends.push(params[0]);return '0x'+'a'.repeat(64);}
    assert.fail('Unexpected wallet request '+method);
  }}};
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  const config={...payment,enabled:true};
  const old=await createWalletSession();t.after(()=>old.provider.destroy());
  assert.equal((await old.provider.getNetwork()).chainId,1n);
  await switchPaymentNetwork(config);
  const fresh=await createWalletSession();t.after(()=>fresh.provider.destroy());
  await ensurePaymentNetwork(fresh.signer,config);
  await assert.rejects(ensurePaymentNetwork(fresh.signer,{...config,escrowAddress:payment.quote.teacher}),/找不到本專案合約/);
  await assert.rejects(fresh.provider.send('eth_sendTransaction',[{chainId:'0x1'}]),error=>/切換至 Sepolia/.test(walletErrorMessage(error)));
  network='0x539';
  await assert.rejects(fresh.provider.send('eth_sendTransaction',[{chainId:'0xaa36a7'}]),error=>/切換至 Sepolia/.test(walletErrorMessage(error)));
  assert.deepEqual(sends,[]);
  network='0xaa36a7';
  assert.equal(await fresh.provider.send('eth_sendTransaction',[{chainId:'0xaa36a7'}]),'0x'+'a'.repeat(64));
  assert.deepEqual(sends,[{chainId:'0xaa36a7'}]);
});
