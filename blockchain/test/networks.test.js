const {test}=require('node:test');
const assert=require('node:assert/strict');
const sepolia='0xaa36a7';
const config={enabled:true,chainId:11155111,walletNetwork:{chainId:sepolia,chainName:'Sepolia',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['https://ethereum-sepolia-rpc.publicnode.com/']}};
const adapter=()=>import('../../yunbarter-app/src/services/blockchain.js');

test('matching chain does not ask MetaMask for another permission',async()=>{
  const calls=[];
  const ethereum={async request(req){calls.push(req);assert.equal(req.method,'eth_chainId');return sepolia;}};
  assert.equal(await (await adapter()).switchPaymentNetwork(config,ethereum),false);
  assert.equal(calls.length,1);
});

test('Sepolia is added with the configured public HTTPS RPC and explicitly switched when necessary',async()=>{
  let current='0x1',added=false;
  const calls=[];
  const ethereum={async request(req){
    calls.push(req);
    if(req.method==='eth_chainId')return current;
    if(req.method==='wallet_switchEthereumChain') {
      assert.deepEqual(req.params,[{chainId:sepolia}]);
      if(!added)throw Object.assign(new Error('Unknown chain'),{code:4902});
      current=sepolia;return null;
    }
    if(req.method==='wallet_addEthereumChain'){assert.deepEqual(req.params,[config.walletNetwork]);added=true;return null;}
    assert.fail('No transaction or signature is requested while setting up a network');
  }};
  assert.equal(await (await adapter()).switchPaymentNetwork(config,ethereum),true);
  assert.equal(current,sepolia);
  assert.equal(calls.filter(c=>c.method==='wallet_addEthereumChain').length,1);
  assert.equal(calls.filter(c=>c.method==='wallet_switchEthereumChain').length,2);
});

test('known chains switch without an add request',async()=>{
  let current='0x1';
  const ethereum={async request(req){if(req.method==='eth_chainId')return current;assert.equal(req.method,'wallet_switchEthereumChain');current=sepolia;}};
  assert.equal(await (await adapter()).switchPaymentNetwork(config,ethereum),true);
});

test('rejecting a switch stops the flow and does not try to add a chain',async()=>{
  const ethereum={async request(req){if(req.method==='eth_chainId')return '0x1';assert.equal(req.method,'wallet_switchEthereumChain');throw Object.assign(new Error('Rejected'),{code:4001});}};
  await assert.rejects((await adapter()).switchPaymentNetwork(config,ethereum),/取消新增或切換網路/);
});

test('wallet pending requests and unconfigured RPCs show actionable errors',async()=>{
  const pending={async request(req){if(req.method==='eth_chainId')return '0x1';throw Object.assign(new Error('Pending'),{code:-32002});}};
  await assert.rejects((await adapter()).switchPaymentNetwork(config,pending),/待處理的要求/);
  const unknown={async request(req){if(req.method==='eth_chainId')return '0x1';throw Object.assign(new Error('Unknown'),{code:4902});}};
  await assert.rejects((await adapter()).switchPaymentNetwork({...config,walletNetwork:undefined},unknown),/手動新增/);
});

test('a wallet that reports a successful request but stays on the wrong chain cannot proceed',async()=>{
  const ethereum={async request(req){return req.method==='eth_chainId'?'0x1':null;}};
  await assert.rejects((await adapter()).switchPaymentNetwork(config,ethereum),/尚未切換成功/);
});

test('unsupported chains are rejected before asking for wallet access',async()=>{
  const ethereum={async request(){assert.fail('No wallet RPC should be called');}};
  for(const chainId of [1,1337,31337,undefined]) {
    await assert.rejects((await adapter()).switchPaymentNetwork({...config,chainId},ethereum),/交易網路尚未就緒/);
  }
});

test('wallet add rejects nonpublic Sepolia metadata and configurations that name another chain',async()=>{
  const calls=[];
  const ethereum={async request(req){
    calls.push(req.method);
    if(req.method==='eth_chainId')return '0x1';
    assert.equal(req.method,'wallet_switchEthereumChain');
    throw Object.assign(new Error('Unknown'),{code:4902});
  }};
  const invalidNetworks=[
    ...['http://ethereum-sepolia-rpc.publicnode.com/','https://localhost/','https://127.0.0.1/','https://rpc.internal/',
      'https://user:secret@ethereum-sepolia-rpc.publicnode.com/'].map(url=>({...config.walletNetwork,rpcUrls:[url]})),
    {...config.walletNetwork,chainId:'0x539'},
  ];
  for(const walletNetwork of invalidNetworks) {
    await assert.rejects((await adapter()).switchPaymentNetwork({...config,walletNetwork},ethereum),/手動新增 Sepolia/);
  }
  assert.ok(!calls.includes('wallet_addEthereumChain'));
});

test('concurrent network requests cannot open duplicate wallet prompts',async()=>{
  let release;
  const ethereum={request(){return new Promise(resolve=>{release=resolve;});}};
  const {switchPaymentNetwork}=await adapter();
  const first=switchPaymentNetwork(config,ethereum);
  try {await assert.rejects(switchPaymentNetwork(config,ethereum),/網路切換正在處理/);}
  finally {release(sepolia);await first;}
});
