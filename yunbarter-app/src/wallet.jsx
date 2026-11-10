import { useState } from 'react';
import { formatUnits } from 'ethers';
import { useWallet } from './hooks/useWallet';
import { useLiveData } from './hooks/useLiveData';
import { fetchChainConfig, fetchChainTransactions, fetchWallet } from './services/api';
import ConnectWalletButton from './components/ConnectWalletButton';
import TransactionWallet from './components/TransactionWallet';

const actions={approve:'代幣授權',fund:'課程付款',cancel:'課前取消退款',complete:'完課撥款',dispute:'提出爭議',refund:'爭議退款',claim:'老師領款',transfer:'SKILL 轉帳',deploy:'合約部署'};
const card={background:'white',padding:'26px',border:'1px solid #e2e8f0',borderRadius:'18px'};

export default function Wallet({showNotification}) {
  const {address,signer,isConnected,isConnecting,chainBalance,nativeBalance,balanceError,refreshChainBalance,connectWallet}=useWallet();
  const {data:config}=useLiveData(fetchChainConfig);
  const {data:account}=useLiveData(fetchWallet);
  const {data,loading,error,refresh}=useLiveData(fetchChainTransactions);
  const [refreshing,setRefreshing]=useState(false);
  async function reauthorize() {
    try {
      await connectWallet({reauthorize:true,paymentNetwork:config?.enabled?config:undefined});
      showNotification('success','錢包授權已更新','已確認原本綁定錢包的網站授權，現在可以重新操作預約。');
    } catch(error) {showNotification('error','錢包授權尚未完成',error.message);}
  }
  async function switchNetwork() {
    try {await connectWallet({paymentNetwork:config});showNotification('success','交易網路已就緒','已連接本專案的交易網路與綁定錢包，可以開始預約。');}
    catch(error) {showNotification('error','網路設定尚未完成',error.message);}
  }
  async function reload() {
    if(refreshing)return;
    setRefreshing(true);
    try {await Promise.all([refresh(),refreshChainBalance(signer,address)]);}
    finally {setRefreshing(false);}
  }
  const wallet=account?.verifiedWalletAddress;
  return <main style={{background:'#f8fafc',minHeight:'calc(100vh - 70px)',padding:'36px 20px'}}>
    <div style={{maxWidth:'1020px',margin:'auto',display:'grid',gap:'24px'}}>
      <section style={card}>
        <h1>我的鏈上錢包</h1>
        <p>使用 SKILL 支付課程費用，ETH 支付網路費。餘額即時從區塊鏈讀取。</p>
        <ConnectWalletButton onError={message=>showNotification('error','錢包連線',message)}/>
        <button disabled={isConnecting} onClick={()=>void reauthorize()} style={{marginTop:'12px'}}>{isConnecting?'請回覆 MetaMask…':'重新授權綁定錢包'}</button>
        <p style={{overflowWrap:'anywhere'}}>綁定地址：{wallet||'尚未綁定'}</p>
        <p>交易網路：{config?.enabled?(config.chainId===11155111?'Sepolia':`本機測試鏈 ${config.chainId}`):'尚未就緒'}</p>
        {config?.enabled&&<div style={{padding:'16px',background:'#f1f5f9',borderRadius:'10px'}}>
          <p style={{marginTop:0}}>Chain ID：{config.chainId} · 網路貨幣：ETH</p>
          {config.walletNetwork?.rpcUrls?.[0]&&<p style={{overflowWrap:'anywhere'}}>RPC：{config.walletNetwork.rpcUrls[0]}</p>}
          <button disabled={isConnecting} onClick={()=>void switchNetwork()}>{isConnecting?'請回覆 MetaMask…':'新增／切換至交易網路'}</button>
        </div>}
        <div style={{display:'flex',gap:'36px',flexWrap:'wrap',margin:'24px 0'}}>
          <div><div>可用 SKILL</div><strong style={{fontSize:'30px'}}>{isConnected?chainBalance??'—':'請連接錢包'}</strong></div>
          <div><div>網路費用 ETH</div><strong style={{fontSize:'24px'}}>{isConnected?nativeBalance??'—':'—'}</strong></div>
        </div>
        {balanceError&&<p role="alert">{balanceError}</p>}
        <button disabled={refreshing} onClick={()=>void reload()}>{refreshing?'同步中…':'更新鏈上餘額與交易紀錄'}</button>
      </section>
      <TransactionWallet showNotification={showNotification}/>
      <section style={card}>
        <h2>鏈上交易備份</h2>
        <p>付款、授權、撥款與退款各有獨立紀錄。達到確認數並通過鏈上收據核對後才會顯示。</p>
        {loading&&<p>正在讀取交易紀錄…</p>}
        {error&&<p role="alert">{error}</p>}
        {data?.syncError&&<p role="alert">同步暫停：{data.syncError}。下方仍可查看已備份紀錄。</p>}
        {data?.syncState?.complete===false&&<p>歷史交易同步中，請繼續更新以讀取較新的區塊。</p>}
        {!loading&&!error&&!data?.transactions?.length&&<p>目前沒有已確認的交易備份。</p>}
        {data?.transactions?.map(tx=><article key={`${tx.chain_id}:${tx.tx_hash}`} style={{borderTop:'1px solid #e2e8f0',padding:'18px 0',overflowWrap:'anywhere'}}>
          <strong>{actions[tx.action]||'合約交易'} · {tx.status===1?'成功':'失敗'}</strong>
          <p>{new Date(tx.block_time).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})} · 鏈 {tx.chain_id} · 區塊 {tx.block_number}</p>
          {tx.token_transfers.filter(t=>t.from===wallet||t.to===wallet).map(t=><p key={t.logIndex}>{t.from===wallet?'轉出':'轉入'} {formatUnits(t.amountRaw,18)} SKILL</p>)}
          {tx.approvals.filter(a=>a.owner===wallet).map(a=><p key={a.logIndex}>授權金額 {formatUnits(a.amountRaw,18)} SKILL</p>)}
          <p>網路費：{formatUnits(tx.fee_wei,18)} ETH（由交易發送者支付）</p>
          <small>{Number(tx.chain_id)===11155111?<a href={`https://sepolia.etherscan.io/tx/${tx.tx_hash}`} target="_blank" rel="noreferrer">{tx.tx_hash}</a>:tx.tx_hash}</small>
        </article>)}
      </section>
    </div>
  </main>;
}
