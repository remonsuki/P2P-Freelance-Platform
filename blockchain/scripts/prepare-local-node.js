const fs=require('node:fs');
const path=require('node:path');
const {Wallet,parseEther}=require('ethers');
const directory=path.join(__dirname,'../../.local-backups/chain-test');
const target=path.join(directory,'node-private.json');
fs.mkdirSync(directory,{recursive:true});
if(!fs.existsSync(target)) {
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'../test-accounts/accounts.json'),'utf8'));
  const deployer=Wallet.createRandom();
  const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
  const accounts=[{secretKey:deployer.privateKey,balance:'0x'+parseEther('1000').toString(16)},
    ...manifest.accounts.map(a=>({secretKey:a.privateKey,balance:'0x'+parseEther('10').toString(16)}))];
  fs.writeFileSync(target,JSON.stringify({version:1,chainId:1337,port:18545,genesisTime:new Date(day+'T08:00:00+08:00').toISOString(),accounts},null,2),{flag:'wx',mode:0o600});
}
const keyFile=path.join(__dirname,'../../yunbarter-backend/.env.chain.local');
if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,`# Dedicated quote signer for the local test deployment.\nCHAIN_QUOTE_PRIVATE_KEY=${Wallet.createRandom().privateKey}\n`,{flag:'wx',mode:0o600});
const config=JSON.parse(fs.readFileSync(target,'utf8'));
console.log(JSON.stringify({prepared:true,chainId:config.chainId,rpcUrl:`http://127.0.0.1:${config.port}`,walletCount:config.accounts.length,privateKeysPrinted:false}));
