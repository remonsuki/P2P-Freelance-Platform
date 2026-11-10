const fs=require('node:fs');
const path=require('node:path');
const {JsonRpcProvider,Wallet,Contract,ContractFactory,getAddress,formatEther}=require('ethers');
const {compile}=require('./compile');

async function main() {
  const env=process.env;
  const chainId=Number(env.CHAIN_ID||11155111);
  if(![11155111,1337,31337].includes(chainId)) throw new Error('This deployment tool permits only Sepolia and local test chains.');
  if(!env.CHAIN_RPC_URL) throw new Error('Set CHAIN_RPC_URL in blockchain/.env first.');
  const provider=new JsonRpcProvider(env.CHAIN_RPC_URL,undefined,{cacheTimeout:-1});
  try {
    if((await provider.getNetwork()).chainId!==BigInt(chainId)) throw new Error('RPC chain ID does not match CHAIN_ID.');
    const tokenAddress=getAddress(env.SKILL_TOKEN_ADDRESS);
    const quoteSigner=getAddress(env.QUOTE_SIGNER_ADDRESS);
    if(await provider.getCode(tokenAddress)==='0x') throw new Error('No token contract exists at SKILL_TOKEN_ADDRESS on this chain.');
    const token=new Contract(tokenAddress,['function decimals() view returns(uint8)','function symbol() view returns(string)'],provider);
    if(await token.decimals()!==18n || await token.symbol()!=='SKILL') throw new Error('Expected an 18-decimal SKILL token.');
    const artifact=compile().SkillEscrow;
    console.log(JSON.stringify({chainId,tokenAddress,quoteSigner,contract:'SkillEscrow',mode:process.argv.includes('--send')?'send':'preview'},null,2));
    if(!process.argv.includes('--send')) {console.log('Preview only. Review settings, then use npm run deploy -- --send to deploy on the testnet.');return;}
    if(!env.DEPLOYER_PRIVATE_KEY) throw new Error('Set a testnet DEPLOYER_PRIVATE_KEY locally before sending.');
    const wallet=new Wallet(env.DEPLOYER_PRIVATE_KEY,provider);
    console.log(`Deployment wallet: ${wallet.address}; gas balance: ${formatEther(await provider.getBalance(wallet.address))} ETH`);
    const contract=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,wallet).deploy(tokenAddress,quoteSigner);
    const tx=contract.deploymentTransaction();console.log(`Deployment transaction: ${tx.hash}`);
    await tx.wait(2);
    const deployment={chainId,tokenAddress,quoteSigner,escrowAddress:await contract.getAddress(),transactionHash:tx.hash};
    const directory=path.join(__dirname,'../artifacts');fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,`deployment-${chainId}.json`),JSON.stringify(deployment,null,2));
    console.log(JSON.stringify(deployment,null,2));
  }finally{provider.destroy();}
}
if(require.main===module) main().catch(error=>{console.error(`Deployment not completed: ${error.shortMessage||error.message}`);process.exitCode=1;});
module.exports={main};
