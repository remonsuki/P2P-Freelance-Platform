// Only publish a deliberately public RPC, or an unauthenticated loopback endpoint.
// Hosted backend RPC URLs may contain credentials and must not be sent to browsers.
function walletNetwork(env,chainId) {
  let rpcUrl=env.CHAIN_WALLET_RPC_URL||'';
  if(!rpcUrl && [1337,31337].includes(chainId)) {
    const candidate=new URL(env.CHAIN_RPC_URL);
    if(['localhost','127.0.0.1','[::1]'].includes(candidate.hostname)
        && !candidate.username && !candidate.password && !candidate.search && candidate.pathname==='/') rpcUrl=candidate.href;
  }
  if(rpcUrl) {
    const parsed=new URL(rpcUrl);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password) throw new Error('CHAIN_WALLET_RPC_URL 必須是無帳密、可公開的 HTTP(S) RPC 網址');
    rpcUrl=parsed.href;
  }
  return {chainId:'0x'+chainId.toString(16),chainName:chainId===11155111?'Sepolia':`YunBarter 本機測試鏈 ${chainId}`,
    nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:rpcUrl?[rpcUrl]:[],
    ...(chainId===11155111?{blockExplorerUrls:['https://sepolia.etherscan.io']}:{} )};
}
module.exports={walletNetwork};
