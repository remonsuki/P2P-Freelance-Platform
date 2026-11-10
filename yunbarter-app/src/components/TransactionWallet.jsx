import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useLiveData } from '../hooks/useLiveData';
import { fetchWallet, verifyTransactionWallet } from '../services/api';
import { walletErrorMessage } from '../services/blockchain';

export default function TransactionWallet({showNotification}) {
  const {connectWallet}=useWallet();
  const {data:wallet,refresh}=useLiveData(fetchWallet);
  const [busy,setBusy]=useState(false);
  async function verify() {
    if(busy) return;
    setBusy(true);
    try {
      const {signer}=await connectWallet();
      await verifyTransactionWallet(signer);
      await refresh();
      showNotification('success','交易錢包已綁定','此帳號已綁定這個錢包，之後付款與收款都使用同一個地址。');
    } catch(error) {showNotification('error','錢包驗證未完成',walletErrorMessage(error));}
    finally {setBusy(false);}
  }
  return <section style={{padding:'22px',background:'white',border:'1px solid #cbd5e1',borderRadius:'18px'}}>
    <h3 style={{marginTop:0}}>SKILL 交易錢包</h3>
    <p style={{color:'#475569',fontSize:'14px',lineHeight:1.7}}>一個帳號只能綁定一個錢包，綁定後不能更換或解除；同一錢包只能綁定一個帳號。</p>
    {wallet?.verifiedWalletAddress?<p style={{overflowWrap:'anywhere',fontSize:'13px'}}>已綁定：{wallet.verifiedWalletAddress}</p>:
      <button type="button" disabled={busy||!wallet} onClick={verify} style={{padding:'10px 16px',borderRadius:'8px',border:'none',background:'#4f46e5',color:'white',cursor:'pointer'}}>{busy?'正在驗證…':'連接並綁定錢包（限一次）'}</button>}
  </section>;
}
