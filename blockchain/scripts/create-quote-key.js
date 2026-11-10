const fs=require('node:fs');
const path=require('node:path');
const {Wallet}=require('ethers');
const target=path.join(__dirname,'../../yunbarter-backend/.env.chain.local');
try {
  const wallet=Wallet.createRandom();
  fs.writeFileSync(target,`# Backend quote signing only. Keep private and back up before deploying.\nCHAIN_QUOTE_PRIVATE_KEY=${wallet.privateKey}\n`,{flag:'wx',mode:0o600});
  console.log(`Created a dedicated quote-signing key in ${target}`);
  console.log(`QUOTE_SIGNER_ADDRESS=${wallet.address}`);
  console.log('The private key was not printed. Keep the same key for all outstanding quotes.');
}catch(error){
  console.error(error.code==='EEXIST'?'Quote key file already exists; it was preserved. Use the existing public address.':`Could not create quote key: ${error.code||error.name}`);
  process.exitCode=1;
}
