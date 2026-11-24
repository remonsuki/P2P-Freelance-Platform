import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useLiveData } from '../hooks/useLiveData';
import { backupChainTransaction, fetchChainConfig, fetchChainPayments, syncChainPayment, reviewChainPayment, saveChainDisputeReason } from '../services/api';
import { fundSkillPayment, changeSkillPayment, fundingStatusNotification, isSepoliaChain, isSepoliaPaymentConfig, walletErrorMessage } from '../services/blockchain';

const labels={quoted:'待付款／等待確認',funded:'預約中',disputed:'爭議處理中',released:'已撥款給老師',refunded:'已退款給學生',expired:'未付款，時段已釋放'};
const button={padding:'9px 13px',border:'1px solid #cbd5e1',borderRadius:'9px',background:'white',cursor:'pointer'};
const bookingAction={...button,display:'inline-flex',alignItems:'center',boxSizing:'border-box',color:'#0f172a',fontFamily:'inherit',fontSize:'14px',fontWeight:400,lineHeight:1.4,textDecoration:'none'};
const iconButton={...button,display:'inline-grid',placeItems:'center',padding:0,flexShrink:0,color:'#334155'};
const field={padding:'10px',border:'1px solid #cbd5e1',borderRadius:'8px',width:'100%',boxSizing:'border-box'};
const statusBadge={display:'inline-block',padding:'3px 8px',borderWidth:'1px',borderStyle:'solid',borderColor:'#cbd5e1',borderRadius:'6px',backgroundColor:'#f1f5f9',color:'#334155',fontSize:'13px',fontWeight:600};
const redStatus={backgroundColor:'#fee2e2',color:'#991b1b',borderColor:'#fca5a5'};
const statusColors={
  funded:{backgroundColor:'#ffedd5',color:'#9a3412',borderColor:'#fdba74'},
  disputed:redStatus,
  refunded:redStatus,
  released:{backgroundColor:'#dcfce7',color:'#166534',borderColor:'#86efac'},
};

function formatSkillAmount(amount) {
  const [whole, fraction='']=String(amount).split('.');
  const decimals=fraction.replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${decimals} SKILL 🪙`;
}

export default function ChainPayments({showNotification,readOnly=false}) {
  const {data,error,loading,refresh}=useLiveData(fetchChainPayments);
  const {connectWallet}=useWallet();
  const activeOperation=useRef(null);
  const [busy,setBusy]=useState(false);
  const [operationMessage,setOperationMessage]=useState('');
  const [modal,setModal]=useState(null);
  const [reason,setReason]=useState('');
  const [rating,setRating]=useState(5);
  const [review,setReview]=useState('');
  const [visiblePaymentIds,setVisiblePaymentIds]=useState(()=>new Set());
  const [now,setNow]=useState(()=>Math.floor(Date.now()/1000));
  useEffect(()=>{const timer=setInterval(()=>setNow(Math.floor(Date.now()/1000)),10000);return()=>clearInterval(timer);},[]);
  useEffect(()=>()=>activeOperation.current?.abort(),[]);
  async function perform(payment,action) {
    if(activeOperation.current) return;
    const controller=new AbortController();
    activeOperation.current=controller;
    const {signal}=controller;
    const updateProgress=message=>{if(!signal.aborted) setOperationMessage(message);};
    setBusy(true);
    let submitted=false;
    let foundOnChain=false;
    try {
      if(!isSepoliaChain(payment.chainId)) throw new Error('此筆紀錄目前僅供查閱');
      let result;
      if(action==='review') await reviewChainPayment(payment.paymentId,{rating,review});
      else if(action==='reason') await saveChainDisputeReason(payment.paymentId,reason);
      else {
        if(action!=='sync') {
          updateProgress('正在確認錢包與交易網路');
          const config=await fetchChainConfig();
          signal.throwIfAborted();
          if(!isSepoliaPaymentConfig(config)) throw new Error(config?.message||'Sepolia 交易尚未就緒');
          const {signer}=await connectWallet({paymentNetwork:config});
          signal.throwIfAborted();
          const options={signer,payment,signal,onProgress:updateProgress,onSubmitted:()=>{
            submitted=true;
            updateProgress('交易已送出，等待區塊確認');
          },onReceipt:({hash})=>{void backupChainTransaction(hash).catch(()=>null);}};
          if(action!=='fund') updateProgress('請在 MetaMask 確認這筆操作');
          if(action==='fund') await fundSkillPayment(options);
          else await changeSkillPayment({...options,action});
          foundOnChain=true;
        }
        updateProgress('正在同步鏈上狀態');
        result=await syncChainPayment(payment.paymentId);
        if(action==='dispute'&&result.status==='disputed') await saveChainDisputeReason(payment.paymentId,reason);
      }
      if(signal.aborted) return;
      setModal(null);
      await refresh();
      if(signal.aborted) return;
      if(action==='fund') showNotification(...fundingStatusNotification(result.status));
      else if(action==='review') showNotification('success','評價已儲存','已更新這堂課程的評價。');
      else if(action==='reason') showNotification('success','爭議說明已儲存','已更新這筆交易的爭議說明。');
      else showNotification('success','已查驗鏈上狀態','若狀態尚未更新，請等待區塊確認後按卡片右上角的重新整理圖示。');
    } catch(err) {
      if(signal.aborted) return;
      let detail='';
      if(foundOnChain) detail='鏈上已找到這筆交易，請同步確認平台狀態，避免重複操作。';
      else if(submitted&&!(err?.code==='TRANSACTION_REPLACED'&&err.cancelled)) detail='交易已送出，請同步確認結果，避免重複操作。';
      showNotification('error','操作尚未完成',[walletErrorMessage(err),detail].filter(Boolean).join(' '));
      await refresh();
    } finally {
      window.dispatchEvent(new Event('yunbarter:data-changed'));
      activeOperation.current=null;
      if(!signal.aborted) {
        setBusy(false);
        setOperationMessage('');
      }
    }
  }
  function open(payment,action) {setModal({payment,action});setReason('');setReview('');setRating(5);}
  function togglePaymentId(paymentId) {
    setVisiblePaymentIds(current=>{
      const next=new Set(current);
      if(next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  }
  if(loading) return <p>正在載入 SKILL 交易…</p>;
  if(error) return <p role="alert">SKILL 交易載入失敗：{error}</p>;
  if(!data?.payments?.length) return null;
  return <section style={{display:'flex',flexDirection:'column',gap:'16px'}}>
    <h2 style={{marginBottom:0}}>{readOnly?'SKILL 交易紀錄':'SKILL 鏈上交易'}</h2>
    <p style={{margin:0,color:'#64748b',lineHeight:1.7}}>{readOnly?'每筆紀錄代表一堂課程的付款與結算結果；授權、付款與退款會有各自的鏈上交易。需要操作時請前往預約管理。':'款項由合約託管。學生可在課前取消、完課後撥款，或在完課後 7 天內提出爭議；沒有爭議且超過 7 天時，老師可以領取款項。爭議退款須由老師同意。'}</p>
    {data.syncErrors?.length>0&&<p role="alert" style={{color:'#b91c1c'}}>部分交易暫時無法確認。請稍後同步，勿重複付款。</p>}
    {data.payments.map(p=>{
      const student=p.role==='student';
      const start=Number(p.quote.startsAt),end=Number(p.quote.endsAt),deadline=Number(p.quote.deadline);
      const canOperate=!readOnly&&p.canOperate&&isSepoliaChain(p.chainId);
      const contractUrl=p.txHash&&p.explorer?`${p.explorer}/tx/${p.txHash}`:null;
      const showPaymentId=visiblePaymentIds.has(p.paymentId);
      const paymentIdElement='payment-id-'+p.paymentId;
      const paymentIdAction=showPaymentId?'隱藏付款編號':'顯示付款編號';
      return <article key={p.paymentId} style={{padding:'24px',background:'white',border:'1px solid #c7d2fe',borderRadius:'18px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px'}}>
          <strong style={{minWidth:0,overflowWrap:'anywhere'}}>{p.courseTitle}</strong>
          {canOperate&&<button type="button" style={{...iconButton,width:36,height:36}} aria-label="同步鏈上狀態" title="同步鏈上狀態" disabled={busy} onClick={()=>void perform(p,'sync')}>
            <RefreshCw size={18} aria-hidden="true"/>
          </button>}
        </div>
        <p style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
          <span>{student?'老師：'+p.teacherName:'學生：'+p.studentName} · {formatSkillAmount(p.amount)}</span>
          <span style={{...statusBadge,...statusColors[p.status]}}>{labels[p.status]}</span>
        </p>
        <div style={{fontSize:'13px',color:'#475569'}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <span>付款編號：</span>
            <button type="button" style={{...iconButton,width:30,height:28}} aria-label={paymentIdAction} title={paymentIdAction} aria-expanded={showPaymentId} aria-controls={paymentIdElement} onClick={()=>togglePaymentId(p.paymentId)}>
              {showPaymentId?<EyeOff size={16} aria-hidden="true"/>:<Eye size={16} aria-hidden="true"/>}
            </button>
          </div>
          <div id={paymentIdElement} hidden={!showPaymentId} style={{marginTop:'6px',overflowWrap:'anywhere'}}>{showPaymentId&&p.paymentId}</div>
        </div>
        <p style={{fontSize:'13px'}}>課程時間：{new Date(start*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台北時間）</p>
        {p.txHash&&!p.explorer&&<p style={{fontSize:'12px',overflowWrap:'anywhere'}}>結算交易雜湊：{p.txHash}</p>}
        {p.disputeReason&&<p>爭議原因：{p.disputeReason}</p>}
        {!readOnly&&!canOperate&&<p style={{fontSize:'13px',color:'#64748b'}}>此筆紀錄目前僅供查閱。</p>}
        {(contractUrl||canOperate)&&<div style={{display:'flex',flexWrap:'wrap',gap:'9px'}}>
          {contractUrl&&<a href={contractUrl} target="_blank" rel="noreferrer" style={bookingAction}>查看合約</a>}
          {canOperate&&<>
            {student&&p.status==='quoted'&&now<deadline&&<button style={button} disabled={busy} onClick={()=>open(p,'fund')}>繼續付款</button>}
            {student&&p.status==='funded'&&now<start&&<button style={bookingAction} disabled={busy} onClick={()=>open(p,'cancel')}>取消預約</button>}
            {student&&p.status==='funded'&&now>=end&&<button style={button} disabled={busy} onClick={()=>open(p,'complete')}>確認完課並撥款</button>}
            {student&&p.status==='funded'&&now>=start&&now<end+604800&&<button style={button} disabled={busy} onClick={()=>open(p,'dispute')}>提出爭議</button>}
            {!student&&p.status==='disputed'&&<button style={button} disabled={busy} onClick={()=>open(p,'refund')}>同意學生退款</button>}
            {!student&&p.status==='funded'&&now>=end+604800&&<button style={button} disabled={busy} onClick={()=>open(p,'claim')}>領取逾期未確認款項</button>}
            {student&&p.status==='released'&&<button style={button} disabled={busy} onClick={()=>open(p,'review')}>留下／更新評價</button>}
            {student&&p.status==='disputed'&&<button style={button} disabled={busy} onClick={()=>open(p,'reason')}>補充爭議原因</button>}
          </>}
        </div>}
      </article>;
    })}
    {modal&&<div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.65)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',zIndex:2100}}>
      <form onSubmit={e=>{e.preventDefault();void perform(modal.payment,modal.action);}} style={{background:'white',padding:'28px',borderRadius:'20px',width:'100%',maxWidth:'480px',display:'flex',flexDirection:'column',gap:'16px'}}>
        <h3>{modal.payment.courseTitle}</h3><p>{formatSkillAmount(modal.payment.amount)}</p>
        <p>{({fund:'付款至託管合約。MetaMask 可能依序要求代幣授權與付款確認，另需測試網 ETH 支付網路費。',cancel:'取消課前預約，合約將全部 SKILL 退回原付款錢包。',complete:'確認課程已完成，合約將全部 SKILL 撥入老師的原收款錢包。',refund:'同意此筆爭議退款，合約將全部 SKILL 退回學生。',claim:'超過完課後 7 天且沒有爭議，將由合約撥款給老師。',dispute:'提出爭議後停止自動撥款，須由老師同意退款。',reason:'補充這筆鏈上爭議的說明。',review:'評分與評語會儲存在平台，不需要支付網路費。'})[modal.action]}</p>
        {['dispute','reason'].includes(modal.action)&&<textarea aria-label="爭議原因" style={field} required maxLength={3000} value={reason} onChange={e=>setReason(e.target.value)}/>}
        {modal.action==='review'&&<><select aria-label="課程評分" style={field} value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} 分</option>)}</select><textarea aria-label="評語" style={field} maxLength={3000} value={review} onChange={e=>setReview(e.target.value)}/></>}
        {operationMessage&&<p role="status" style={{margin:0,color:'#1d4ed8'}}>{operationMessage}</p>}
        <button style={button} disabled={busy} type="submit">{busy?'處理中…':'確認操作'}</button>
        <button style={button} disabled={busy} type="button" onClick={()=>setModal(null)}>返回</button>
      </form>
    </div>}
  </section>;
}
