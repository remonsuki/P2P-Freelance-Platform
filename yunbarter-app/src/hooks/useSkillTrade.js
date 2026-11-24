import { useEffect, useRef, useState } from 'react';
import { useWallet } from './useWallet';
import { checkSepoliaGasBalance, ensurePaymentNetwork, fundSkillPayment, isSepoliaPaymentConfig, walletErrorMessage } from '../services/blockchain';
import { backupChainTransaction, fetchChainConfig, verifyTransactionWallet, createChainQuote, syncChainPayment } from '../services/api';

/**
 * P2P 技能交易 Hook
 * 僅管理 React 交易狀態；鏈上操作集中在 services/blockchain.js。
 */
export function useSkillTrade() {
  const { connectWallet } = useWallet();
  const activeTrade=useRef(null);
  const mounted=useRef(false);
  const [loadingMessage,setLoadingMessage]=useState('');
  const [isTrading,setIsTrading]=useState(false);
  const [walletOperationStarted,setWalletOperationStarted]=useState(false);

  useEffect(()=>{
    mounted.current=true;
    return ()=>{
      mounted.current=false;
      activeTrade.current?.controller.abort();
    };
  },[]);

  function cancelSkillTrade() {
    const trade=activeTrade.current;
    if(trade?.walletOperationStarted) return false;
    trade?.controller.abort();
    return true;
  }

  async function executeSkillTrade(courseId,timeSlot,expectedUserId) {
    if(activeTrade.current) throw new Error('上一筆交易仍在處理');
    const trade={controller:new AbortController(),walletOperationStarted:false};
    activeTrade.current=trade;
    const {signal}=trade.controller;
    const updateProgress=message=>{if(!signal.aborted) setLoadingMessage(message);};
    setIsTrading(true);
    let payment;
    let sent=false;
    let foundOnChain=false;
    try {
      const config=await fetchChainConfig();
      signal.throwIfAborted();
      if(!isSepoliaPaymentConfig(config)) throw new Error(config?.message || 'Sepolia SKILL 交易尚未啟用');
      updateProgress('請在 MetaMask 確認連線與交易網路');
      const {signer}=await connectWallet({paymentNetwork:config});
      signal.throwIfAborted();
      await ensurePaymentNetwork(signer,config.chainId);
      updateProgress('正在確認測試網 ETH 餘額與錢包綁定');
      await checkSepoliaGasBalance(signer);
      signal.throwIfAborted();
      await verifyTransactionWallet(signer);
      signal.throwIfAborted();
      updateProgress('正在確認時段並建立付款報價');
      payment=await createChainQuote({courseId,timeSlot,expectedUserId},signal);
      await fundSkillPayment({
        signer,payment,signal,onProgress:updateProgress,
        onWalletRequest:()=>{trade.walletOperationStarted=true;setWalletOperationStarted(true);},
        onSubmitted:()=>{sent=true;},
        onReceipt:({hash})=>{void backupChainTransaction(hash).catch(()=>null);},
      });
      foundOnChain=true;
      updateProgress('正在由後端驗證付款');
      const result=await syncChainPayment(payment.paymentId);
      signal.throwIfAborted();
      return result;
    } catch(error) {
      signal.throwIfAborted();
      const message=walletErrorMessage(error);
      let detail='';
      if (foundOnChain) detail='已在鏈上找到這筆付款，平台同步尚未完成。請到預約管理同步，避免重複付款。';
      else if (sent&&!(error?.code==='TRANSACTION_REPLACED'&&error.cancelled)) detail='付款已送出，請到預約管理同步確認，避免重複付款。';
      else if (payment) detail='付款報價已保留。請到預約管理同步，再查看是否可以繼續付款。';
      throw new Error([message,detail].filter(Boolean).join(' '),{cause:error});
    } finally {
      window.dispatchEvent(new Event('yunbarter:data-changed'));
      activeTrade.current=null;
      if(mounted.current) {
        setIsTrading(false);
        setLoadingMessage('');
        setWalletOperationStarted(false);
      }
    }
  }
  return {executeSkillTrade,cancelSkillTrade,loadingMessage,isTrading,walletOperationStarted};
}
