const {test}=require('node:test');
const assert=require('node:assert/strict');
const {walletNetwork}=require('../walletNetwork');

test('local wallet metadata uses the configured port and native ETH, not the SKILL token',()=>{
  const network=walletNetwork({CHAIN_RPC_URL:'http://127.0.0.1:18545'},1337);
  assert.equal(network.chainId,'0x539');assert.deepEqual(network.rpcUrls,['http://127.0.0.1:18545/']);
  assert.deepEqual(network.nativeCurrency,{name:'Ether',symbol:'ETH',decimals:18});
});

test('backend RPC credentials are never reused as public wallet settings',()=>{
  for(const url of ['https://rpc.example/private-api-key','http://name:secret@127.0.0.1:18545','http://127.0.0.1:18545/?key=secret']) {
    const network=walletNetwork({CHAIN_RPC_URL:url},1337);assert.deepEqual(network.rpcUrls,[]);assert.equal(JSON.stringify(network).includes('secret'),false);
  }
  assert.deepEqual(walletNetwork({CHAIN_RPC_URL:'https://rpc.example/private-api-key'},11155111).rpcUrls,[]);
});

test('explicit public wallet RPC is supported without exposing the backend URL',()=>{
  const network=walletNetwork({CHAIN_RPC_URL:'https://rpc.example/private-api-key',CHAIN_WALLET_RPC_URL:'https://public.example/rpc'},11155111);
  assert.deepEqual(network.rpcUrls,['https://public.example/rpc']);assert.equal(JSON.stringify(network).includes('private-api-key'),false);
  assert.throws(()=>walletNetwork({CHAIN_WALLET_RPC_URL:'https://user:secret@rpc.example'},11155111),/無帳密/);
});
