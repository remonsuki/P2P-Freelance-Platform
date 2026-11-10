import {requestWalletConnection,createWalletSession,getAuthorizedWalletAccounts} from './blockchain.js';
import {requestRegistrationWalletChallenge,register} from './api.js';

export async function registerWithWallet(payload,onProgress=()=>{}) {
  onProgress('請在 MetaMask 連接要綁定的錢包');
  const walletAddress=await requestWalletConnection();
  const session=await createWalletSession(walletAddress);
  if((await session.signer.getAddress()).toLowerCase()!==walletAddress.toLowerCase()) throw new Error('錢包帳戶已切換，請重新註冊');
  const challenge=await requestRegistrationWalletChallenge({email:payload.email,walletAddress});
  onProgress('請簽章確認綁定錢包（不會轉出代幣）');
  const signature=await session.signer.signMessage(challenge.message);
  onProgress('正在建立帳號並綁定錢包');
  const data=await register({...payload,walletProof:{challengeId:challenge.challengeId,signature}});
  const accounts=await getAuthorizedWalletAccounts().catch(()=>[]);
  return {data,session:accounts[0]?.toLowerCase()===walletAddress.toLowerCase()?session:null};
}
