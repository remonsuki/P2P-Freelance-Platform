const ganache = require('ganache');
const {BrowserProvider,ContractFactory,Wallet,parseUnits,randomBytes,hexlify,solidityPackedKeccak256}=require('ethers');
const {compile}=require('../scripts/compile');
const protocol=require('../protocol.json');
let compiled;
async function fixture(t) {
  const rpc=ganache.provider({logging:{quiet:true},chain:{chainId:1337,hardfork:'shanghai'},wallet:{totalAccounts:6}});
  const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=20;
  t.after(async()=>{provider.destroy();await rpc.disconnect();});
  const actors=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
  const wallets=Object.values(rpc.getInitialAccounts()).map(a=>new Wallet(a.secretKey));
  const signer=Wallet.createRandom();
  compiled ||= compile();
  const token=await new ContractFactory(compiled.SkillToken.abi,compiled.SkillToken.evm.bytecode.object,actors[0]).deploy(await actors[0].getAddress());await token.waitForDeployment();
  const escrow=await new ContractFactory(compiled.SkillEscrow.abi,compiled.SkillEscrow.evm.bytecode.object,actors[0]).deploy(await token.getAddress(),signer.address);await escrow.waitForDeployment();
  const domain={name:protocol.name,version:protocol.version,chainId:1337,verifyingContract:await escrow.getAddress()};
  async function quote(options={}) {
    const head=await provider.getBlock('latest');
    const q={paymentId:hexlify(randomBytes(32)),slotKey:hexlify(randomBytes(32)),student:await actors[1].getAddress(),teacher:await actors[2].getAddress(),amount:parseUnits('2.123456',18).toString(),startsAt:String(head.timestamp+3600),endsAt:String(head.timestamp+7200),deadline:String(head.timestamp+600),...options};
    return {q,signature:await signer.signTypedData(domain,protocol.types,q)};
  }
  async function fund(q,signature,actor=actors[1]) {return (await escrow.connect(actor).fund(q,signature)).wait();}
  async function advance(seconds) {await rpc.request({method:'evm_increaseTime',params:[seconds]});await rpc.request({method:'evm_mine',params:[]});}
  await (await token.transfer(await actors[1].getAddress(),parseUnits('1000',18))).wait();
  await (await token.connect(actors[1]).approve(await escrow.getAddress(),parseUnits('1000',18))).wait();
  return {rpc,provider,actors,wallets,signer,token,escrow,domain,quote,fund,advance,compiled,solidityPackedKeccak256};
}
module.exports={fixture};
