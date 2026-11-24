const { SEPOLIA_CHAIN_ID, sepoliaRpcUrl } = require('../blockchain/sepolia');

function walletNetwork(env) {
  const publicRpc = env.CHAIN_WALLET_RPC_URL && sepoliaRpcUrl(env.CHAIN_WALLET_RPC_URL, 'CHAIN_WALLET_RPC_URL');
  if (publicRpc && (publicRpc.username || publicRpc.password)) throw new Error('CHAIN_WALLET_RPC_URL 必須是無帳密、可公開的 Sepolia RPC 網址');
  return {
    chainId: '0x' + SEPOLIA_CHAIN_ID.toString(16), chainName: 'Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: publicRpc ? [publicRpc.href] : [],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  };
}
module.exports={walletNetwork};
