const { isIP } = require('node:net');

const SEPOLIA_CHAIN_ID = 11155111;
const LOCAL_DOMAIN = /\.(?:localhost|local|test|invalid|example|internal)$/;

function sepoliaChainId(value) {
  if (Number(value ?? SEPOLIA_CHAIN_ID) !== SEPOLIA_CHAIN_ID) {
    throw new Error(`CHAIN_ID must be Ethereum Sepolia (${SEPOLIA_CHAIN_ID}).`);
  }
  return SEPOLIA_CHAIN_ID;
}

function sepoliaRpcUrl(value, setting = 'CHAIN_RPC_URL') {
  const message = `${setting} must be a remote HTTPS Sepolia RPC URL.`;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(message);
  }
  const host = url.hostname.replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || !host.includes('.') || isIP(host) || LOCAL_DOMAIN.test(host)) {
    throw new Error(message);
  }
  return url;
}

module.exports = { SEPOLIA_CHAIN_ID, sepoliaChainId, sepoliaRpcUrl };
