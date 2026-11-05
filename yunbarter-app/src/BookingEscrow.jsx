import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, RefreshCw, Clock, X } from 'lucide-react';
import { fetchBookings, completeBooking, disputeBooking, cancelBooking, refundBooking } from './services/api';
import { useLiveData } from './hooks/useLiveData';

const buttonStyle = { padding:'10px 16px',borderRadius:'10px',border:'1px solid #cbd5e1',background:'white',cursor:'pointer',fontWeight:'bold' };
const fieldStyle = { width:'100%',padding:'12px',border:'1px solid #cbd5e1',borderRadius:'10px',boxSizing:'border-box' };
const STATUS = {IN_ESCROW:'點數託管中',COMPLETED:'已完課並撥款',DISPUTED:'爭議處理中',REFUNDED:'已取消並退款'};

export default function BookingEscrow({ showNotification }) {
  const {data,loading,error,refresh}=useLiveData(fetchBookings);
  const [activeTab,setActiveTab]=useState('all');
  const [processingId,setProcessingId]=useState(null);
  const [modal,setModal]=useState(null);
  const [rating,setRating]=useState(5);
  const [review,setReview]=useState('');
  const [reason,setReason]=useState('');
  const bookings=data||[];
  const visible=bookings.filter(b=>activeTab==='all'||b.role===activeTab);
  const locked=bookings.filter(b=>b.status==='IN_ESCROW'||b.status==='DISPUTED').reduce((sum,b)=>sum+b.amount,0);

  async function perform(order,action,payload) {
    if(processingId!==null) return;
    setProcessingId(order.id);
    try {
      if(action==='complete') await completeBooking(order.id,payload);
      if(action==='dispute') await disputeBooking(order.id,payload);
      if(action==='cancel') await cancelBooking(order.id);
      if(action==='refund') await refundBooking(order.id);
      setModal(null);
      await refresh();
      const messages={complete:'已確認完課，點數已撥入老師帳戶，評價已儲存。',dispute:'爭議已送出，託管點數暫停撥款，等待老師回覆。',cancel:'預約已取消，點數已退回你的帳戶。',refund:'已同意退款，託管點數已退回學生帳戶。'};
      showNotification('success','操作完成',messages[action]);
    } catch(err) {
      showNotification('error','操作失敗',err.message);
      await refresh();
    } finally {setProcessingId(null);}
  }

  const openModal=(order,action)=>{setModal({order,action});setRating(5);setReview('');setReason('');};
  const submitModal=e=>{
    e.preventDefault();
    void perform(modal.order,modal.action,modal.action==='complete'?{rating,review}:reason);
  };

  return <div style={{minHeight:'calc(100vh - 70px)',background:'#f8fafc',padding:'36px 20px'}}>
    <div style={{maxWidth:'1020px',margin:'auto',display:'flex',flexDirection:'column',gap:'24px'}}>
      <div style={{background:'#0f172a',color:'white',borderRadius:'24px',padding:'32px',display:'flex',justifyContent:'space-between',gap:'24px',flexWrap:'wrap'}}>
        <div><div style={{display:'flex',alignItems:'center',gap:'8px',color:'#a5b4fc'}}><ShieldCheck size={18}/> 課程預約與點數託管</div>
          <h1 style={{fontSize:'28px'}}>預約管理中心</h1>
          <p style={{color:'#cbd5e1',maxWidth:'650px',lineHeight:1.7}}>課前可取消並退回點數；課程結束後由學生確認完課與評價，點數才會撥給老師。課後有問題可提出爭議，待老師同意後退款。</p></div>
        <div style={{padding:'20px',background:'#1e293b',borderRadius:'16px',alignSelf:'center'}}><div style={{color:'#94a3b8'}}><Lock size={14}/> 目前託管點數</div><strong style={{fontSize:'32px',color:'#fbbf24'}}>{locked.toFixed(1)} YTC</strong></div>
      </div>
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
        {[['all','全部紀錄'],['student','我是學生'],['teacher','我是老師']].map(([key,label])=><button key={key} onClick={()=>setActiveTab(key)} style={{...buttonStyle,background:activeTab===key?'#0f172a':'white',color:activeTab===key?'white':'#334155'}}>{label}</button>)}
        <button onClick={()=>void refresh()} style={{...buttonStyle,marginLeft:'auto'}}><RefreshCw size={14}/> 重新整理</button>
      </div>
      {loading&&<p>正在載入預約...</p>}
      {error&&<p role="alert" style={{color:'#b91c1c'}}>無法載入預約：{error}</p>}
      {!loading&&!error&&!visible.length&&<div style={{padding:'40px',textAlign:'center',background:'white',borderRadius:'16px'}}>目前沒有預約紀錄。<Link to="/search">前往尋找課程</Link></div>}
      {visible.map(order=><article key={order.id} style={{padding:'24px',background:'white',border:'1px solid #e2e8f0',borderRadius:'20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:'15px',flexWrap:'wrap'}}><div><small style={{color:'#64748b'}}>預約 #{order.id} · {order.category}</small><h2 style={{fontSize:'20px'}}>{order.courseTitle}</h2><p>{order.role==='student'?'授課老師：'+order.teacherName:'預約學生：'+order.studentName}</p></div>
          <div style={{textAlign:'right'}}><strong style={{color:'#b45309'}}>{order.amount.toFixed(1)} YTC</strong><p>{STATUS[order.status]}</p></div></div>
        <p style={{color:'#64748b'}}><Clock size={14}/> {order.scheduledTime}（台北時間）</p>
        {order.disputeReason&&<p style={{padding:'12px',background:'#fff1f2',borderRadius:'10px'}}>爭議原因：{order.disputeReason}</p>}
        {order.rating&&<p style={{color:'#b45309'}}>你的評價：{order.rating} / 5 {order.review}</p>}
        <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
          {order.role==='student'&&order.status==='IN_ESCROW'&&order.canCancel&&<button disabled={processingId!==null} onClick={()=>openModal(order,'cancel')} style={buttonStyle}>取消預約並退款</button>}
          {order.role==='student'&&order.status==='IN_ESCROW'&&order.canComplete&&<button disabled={processingId!==null} onClick={()=>openModal(order,'complete')} style={buttonStyle}>確認完課與評價</button>}
          {order.role==='student'&&order.status==='IN_ESCROW'&&!order.canCancel&&<button disabled={processingId!==null} onClick={()=>openModal(order,'dispute')} style={buttonStyle}>提出爭議</button>}
          {order.role==='teacher'&&order.status==='DISPUTED'&&<button disabled={processingId!==null} onClick={()=>openModal(order,'refund')} style={buttonStyle}>同意退款給學生</button>}
          {order.status==='DISPUTED'&&order.role==='student'&&<p>已暫停撥款，等待授課老師回覆。</p>}
          {processingId===order.id&&<span>正在儲存...</span>}
        </div>
      </article>)}
      {modal&&<div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.65)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',zIndex:2000}}>
        <form onSubmit={submitModal} style={{background:'white',padding:'28px',borderRadius:'20px',width:'100%',maxWidth:'480px',display:'flex',flexDirection:'column',gap:'18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:'20px',margin:0}}>{{complete:'確認完課',dispute:'提出課程爭議',cancel:'取消預約',refund:'同意爭議退款'}[modal.action]}</h2><button type="button" aria-label="關閉" disabled={processingId!==null} onClick={()=>setModal(null)} style={buttonStyle}><X size={16}/></button></div>
          <p>{modal.order.courseTitle} · {modal.order.amount.toFixed(1)} YTC</p>
          {modal.action==='complete'&&<><label>課程評分<select aria-label="課程評分" value={rating} onChange={e=>setRating(Number(e.target.value))} style={fieldStyle}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} 分</option>)}</select></label><label>評語<textarea value={review} onChange={e=>setReview(e.target.value)} maxLength={3000} rows={4} style={fieldStyle}/></label></>}
          {modal.action==='dispute'&&<label>請說明問題<textarea required value={reason} onChange={e=>setReason(e.target.value)} maxLength={3000} rows={4} style={fieldStyle}/></label>}
          {['cancel','refund'].includes(modal.action)&&<p>確認後將退回全部點數，預約紀錄會保留。</p>}
          <button type="submit" disabled={processingId!==null} style={{...buttonStyle,background:'#0f172a',color:'white'}}>{processingId!==null?'正在儲存...':'確認'}</button>
        </form>
      </div>}
    </div>
  </div>;
}
