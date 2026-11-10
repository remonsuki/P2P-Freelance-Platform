import { useRef, useState } from 'react';
import { useWallet } from './useWallet';
import { ensurePaymentNetwork, fundSkillPayment, walletErrorMessage } from '../services/blockchain';
import { backupChainTransaction, fetchChainConfig, verifyTransactionWallet, createChainQuote, syncChainPayment } from '../services/api';

/**
 * P2P 技能交易 Hook
 * 僅管理 React 交易狀態；鏈上操作集中在 services/blockchain.js。
 */
export function useSkillTrade() {
  const { connectWallet } = useWallet();
  const busy=useRef(false);
  const [loadingMessage,setLoadingMessage]=useState('');
  const [isTrading,setIsTrading]=useState(false);
  async function executeSkillTrade(courseId,timeSlot,expectedUserId) {
    if(busy.current) throw new Error('上一筆交易仍在處理');
    busy.current=true;setIsTrading(true);
    let payment;
    let sent=false;
    try {
      const config=await fetchChainConfig();
      if(!config.enabled) throw new Error(config.message || 'SKILL 交易尚未啟用');
      setLoadingMessage('請在 MetaMask 確認連線與交易網路');
      const {signer}=await connectWallet({paymentNetwork:config});
      await ensurePaymentNetwork(signer,config.chainId);
      await verifyTransactionWallet(signer);
      payment=await createChainQuote({courseId,timeSlot,expectedUserId});
      await fundSkillPayment({signer,payment,onProgress:setLoadingMessage,onSubmitted:()=>{sent=true;},onReceipt:r=>backupChainTransaction(r.hash).catch(()=>null)});
      setLoadingMessage('正在由後端驗證付款');
      return await syncChainPayment(payment.paymentId);
    } catch(error) {
      const message=walletErrorMessage(error);
      throw new Error(`${message}${payment ? sent ? '。付款可能已送出，請到預約管理同步，請勿另外付款。' : '。待付款紀錄已保留，可至預約管理繼續付款；報價到期確認後會釋放時段。' : ''}`,{cause:error});
    } finally {window.dispatchEvent(new Event('yunbarter:data-changed'));busy.current=false;setIsTrading(false);setLoadingMessage('');}
  }
  return {executeSkillTrade,loadingMessage,isTrading};
}
