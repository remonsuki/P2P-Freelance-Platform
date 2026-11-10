const {Wallet}=require('ethers');

async function registerAccount(request,payload,wallet=Wallet.createRandom(),cookie) {
  const challenge=await request('POST','/api/auth/register/wallet-challenge',{email:payload.email,walletAddress:wallet.address},cookie);
  if(challenge.status!==200) return challenge;
  const combinedCookie=[cookie,challenge.cookie].filter(Boolean).join('; ');
  return request('POST','/api/auth/register',{...payload,walletProof:{challengeId:challenge.body.challengeId,signature:await wallet.signMessage(challenge.body.message)}},combinedCookie);
}
module.exports={registerAccount};
