const fs = require('node:fs');
const path = require('node:path');
const { Contract, ContractFactory, FetchRequest, JsonRpcProvider, Wallet, ZeroAddress, formatEther, getAddress } = require('ethers');
const { sepoliaChainId, sepoliaRpcUrl } = require('../sepolia');
const { compile } = require('./compile');

function requiredAddress(value, name) {
  let address;
  try {
    address = getAddress(value);
  } catch {
    throw new Error(`${name} must be a valid Ethereum address.`);
  }
  if (address === ZeroAddress) throw new Error(`${name} must be a nonzero Ethereum address.`);
  return address;
}

async function main({ env = process.env, args = process.argv.slice(2) } = {}) {
  const send = args.length === 1 && args[0] === '--send';
  if (args.length && !send) throw new Error('Usage: npm run deploy [-- --send]');
  const chainId = sepoliaChainId(env.CHAIN_ID);
  const rpcUrl = sepoliaRpcUrl(env.CHAIN_RPC_URL);
  const tokenAddress = requiredAddress(env.SKILL_TOKEN_ADDRESS, 'SKILL_TOKEN_ADDRESS');
  const quoteSigner = requiredAddress(env.QUOTE_SIGNER_ADDRESS, 'QUOTE_SIGNER_ADDRESS');
  const request = new FetchRequest(rpcUrl.href);
  request.timeout = 15000;
  const provider = new JsonRpcProvider(request, chainId, { cacheTimeout: -1 });
  try {
    if ((await provider.getNetwork()).chainId !== BigInt(chainId)) throw new Error('RPC must report the Sepolia chain ID.');
    if (await provider.getCode(tokenAddress) === '0x') throw new Error('No Sepolia token contract exists at SKILL_TOKEN_ADDRESS.');
    const token = new Contract(tokenAddress, ['function decimals() view returns(uint8)', 'function symbol() view returns(string)'], provider);
    if (await token.decimals() !== 18n || await token.symbol() !== 'SKILL') throw new Error('Expected an 18-decimal SKILL token.');
    const artifact = compile().SkillEscrow;
    console.log(JSON.stringify({ chainId, tokenAddress, quoteSigner, contract: 'SkillEscrow', mode: send ? 'send' : 'preview' }, null, 2));
    if (!send) {
      console.log('Preview only. Review settings, then use npm run deploy -- --send to deploy to Sepolia.');
      return;
    }
    let wallet;
    try {
      wallet = new Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
    } catch {
      throw new Error('Set a valid Sepolia DEPLOYER_PRIVATE_KEY locally before sending.');
    }
    console.log(`Deployment wallet: ${wallet.address}; gas balance: ${formatEther(await provider.getBalance(wallet.address))} ETH`);
    const factory = new ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet);
    const contract = await factory.deploy(tokenAddress, quoteSigner);
    const tx = contract.deploymentTransaction();
    console.log(`Deployment transaction: ${tx.hash}`);
    const receipt = await tx.wait(2);
    if (receipt?.status !== 1) throw new Error('Sepolia deployment did not succeed.');
    const deployment = { chainId, tokenAddress, quoteSigner, escrowAddress: await contract.getAddress(), transactionHash: tx.hash };
    const directory = path.join(__dirname, '../artifacts');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `deployment-${chainId}.json`), JSON.stringify(deployment, null, 2));
    console.log(JSON.stringify(deployment, null, 2));
  } finally {
    provider.destroy();
  }
}
if (require.main === module) {
  main().catch(error => {
    console.error(`Deployment not completed: ${error.shortMessage || error.message}`);
    process.exitCode = 1;
  });
}
module.exports = { main };
