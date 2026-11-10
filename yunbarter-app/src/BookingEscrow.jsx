import ChainPayments from './components/ChainPayments';
import {fetchBookings} from './services/api';
import {useLiveData} from './hooks/useLiveData';

export default function BookingEscrow({showNotification}) {
  const {data,error}=useLiveData(fetchBookings);
  const archived=(data||[]).filter(b=>b.archived);
  return <main style={{minHeight:'calc(100vh - 70px)',background:'#f8fafc',padding:'36px 20px'}}>
    <div style={{maxWidth:'1020px',margin:'auto',display:'grid',gap:'24px'}}>
      <section><h1>預約與智能合約託管</h1><p>課程使用 SKILL 付款，由合約保管並處理完課撥款或退款。操作時請使用帳號綁定的 MetaMask 錢包。</p></section>
      <ChainPayments showNotification={showNotification}/>
      {error&&<p role="alert">歷史預約載入失敗：{error}</p>}
      {!!archived.length&&<section><h2>舊點數交易封存紀錄</h2><p>以下為過去的 YTC 記錄，保留供查閱，金額不代表鏈上 SKILL。</p>
        {archived.map(b=><article key={b.id} style={{background:'white',padding:'20px',margin:'12px 0',borderRadius:'12px'}}><strong>{b.courseTitle}</strong><p>{b.scheduledTime} · {b.amount} YTC · 已封存</p></article>)}
      </section>}
    </div>
  </main>;
}
