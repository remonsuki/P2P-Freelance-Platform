import { Link } from 'react-router-dom';

export default function Home() {
  return (
    // 最外層：改為非常柔和的淡灰藍漸層背景，與白色 Navbar 無縫接軌
    <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #f1f5f9 100%)', minHeight: 'calc(100vh - 70px)', overflow: 'hidden', fontFamily: 'sans-serif', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* 背景裝飾網格 (改成極淡的灰藍色，營造輕盈的工程感) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6, pointerEvents: 'none' }}></div>

      {/* Hero 文字區塊：深色文字配上極致留白 */}
      <div style={{ textAlign: 'center', marginTop: '100px', zIndex: 10, padding: '0 20px', position: 'relative' }}>
        <h1 style={{ fontSize: '56px', color: '#0f172a', fontWeight: '900', margin: '0 0 20px 0', letterSpacing: '1px', lineHeight: '1.3' }}>
          知識不該被定價，<br/>一起交流才是成長。
        </h1>
        <p style={{ fontSize: '18px', color: '#64748b', margin: '0 0 40px 0', maxWidth: '600px', lineHeight: '1.7' }}>
          把你的專長變成連結他人的橋樑。<br/>
          在 YunBarter，你可以是學生，也是老師。<br/>在這裡，每一次交流都是成長的開始。
        </p>

        {/* 單一明確的號召按鈕 (CTA) - 改為亮眼的科技藍 */}
        <Link to="/search" style={{ textDecoration: 'none' }}>
          <button style={{
            backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '16px 45px',
            borderRadius: '30px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)', transition: 'transform 0.2s'
          }}>
            尋找學習夥伴
          </button>
        </Link>
      </div>

      {/* 底部漂浮卡片區塊：亮色系毛玻璃質感 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '25px', marginTop: '90px', width: '100%', maxWidth: '1100px', position: 'relative' }}>
        
        {/* 左邊卡片 - 微傾斜、半透明毛玻璃 */}
        <div style={{ 
          transform: 'rotate(-6deg) translateY(30px)', zIndex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.8)', borderRadius: '20px', padding: '25px', width: '300px', boxShadow: '0 15px 35px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{ width: '45px', height: '45px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}></div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e293b' }}>排球扣球與防守特訓</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>指導者：阿翔</div>
            </div>
          </div>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
            針對校隊與系隊強度的訓練，調整起跳姿勢與防守預判，室外場地實戰演練。
          </div>
        </div>

        {/* 中間卡片 - 正向、純白實體、視覺焦點 */}
        <div style={{ 
          transform: 'translateY(0px)', zIndex: 5,
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '30px', width: '340px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{ width: '55px', height: '55px', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}></div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#0f172a' }}>Python 基礎與爬蟲</div>
              <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>雲科大圖書館 / 線上</div>
            </div>
          </div>
          <div style={{ fontSize: '15px', color: '#475569', lineHeight: '1.6' }}>
            資料收集不求人，從邏輯撰寫到帶你寫出第一隻爬蟲程式，適合零基礎新手！
          </div>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
            <span style={{ color: '#2563eb', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '6px 10px', borderRadius: '6px' }}>程式開發</span>
            <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '16px' }}>技能交換</span>
          </div>
        </div>

        {/* 右邊卡片 - 微傾斜、半透明毛玻璃 */}
        <div style={{ 
          transform: 'rotate(6deg) translateY(30px)', zIndex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.8)', borderRadius: '20px', padding: '25px', width: '300px', boxShadow: '0 15px 35px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{ width: '45px', height: '45px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}></div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e293b' }}>檔車入門與保養</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>指導者：車神小豪</div>
            </div>
          </div>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
            考照指導、安全駕駛觀念建立，以及洗車保養與日常鏈條清潔教學。
          </div>
        </div>

      </div>

      {/* 漸層遮罩，讓卡片下方完美融入背景，避免被切斷 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '150px', background: 'linear-gradient(to bottom, rgba(241,245,249,0) 0%, rgba(241,245,249,1) 100%)', zIndex: 10, pointerEvents: 'none' }}></div>

    </div>
  );
}