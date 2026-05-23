import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      
      {/* 英雄區塊 (Hero Section) */}
      <div style={{ marginBottom: '50px' }}>
        <h1 style={{ fontSize: '48px', color: '#2c3e50', marginBottom: '10px' }}>
          YunBarter <span style={{ color: '#f39c12' }}>時間銀行</span>
        </h1>
        <p style={{ fontSize: '20px', color: '#7f8c8d', marginBottom: '40px' }}>
          打破金錢限制，用你的專業交換全世界的技能。
        </p>

        {/* 核心導航按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <Link to="/search" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '15px 30px', fontSize: '18px', fontWeight: 'bold', 
              backgroundColor: '#3498db', color: 'white', border: 'none', 
              borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              尋找教師 (我想學)
            </button>
          </Link>

          <Link to="/publish" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '15px 30px', fontSize: '18px', fontWeight: 'bold', 
              backgroundColor: '#9b59b6', color: 'white', border: 'none', 
              borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              發佈技能 (我想教)
            </button>
          </Link>
        </div>
      </div>

      {/* 平台特色介紹 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', marginTop: '60px' }}>
        
        {/* 特色一 */}
        <div style={{ width: '250px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* 照片佔位符 */}
          <div style={{
            width: '60px', height: '60px', backgroundColor: '#f0f0f0', border: '1px dashed #ccc',
            display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px',
            color: '#999', fontSize: '14px', marginBottom: '15px'
          }}>
            照片
          </div>
          <h3 style={{ color: '#2c3e50', margin: '0 0 10px 0' }}>Web3 時間幣</h3>
          <p style={{ color: '#7f8c8d', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            導入 YTC 時間幣與智能合約，確保交易安全，讓知識的價值透明化。
          </p>
        </div>

        {/* 特色二 */}
        <div style={{ width: '250px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* 照片佔位符 */}
          <div style={{
            width: '60px', height: '60px', backgroundColor: '#f0f0f0', border: '1px dashed #ccc',
            display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px',
            color: '#999', fontSize: '14px', marginBottom: '15px'
          }}>
            照片
          </div>
          <h3 style={{ color: '#2c3e50', margin: '0 0 10px 0' }}>AI 魔法助理</h3>
          <p style={{ color: '#7f8c8d', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            不知道怎麼推銷自己？AI 幫你自動生成專業文案與建議定價。
          </p>
        </div>

        {/* 特色三 */}
        <div style={{ width: '250px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* 照片佔位符 */}
          <div style={{
            width: '60px', height: '60px', backgroundColor: '#f0f0f0', border: '1px dashed #ccc',
            display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px',
            color: '#999', fontSize: '14px', marginBottom: '15px'
          }}>
            照片
          </div>
          <h3 style={{ color: '#2c3e50', margin: '0 0 10px 0' }}>校園互助圈</h3>
          <p style={{ color: '#7f8c8d', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            從課業輔導到生活技能，建立屬於大學生的專屬知識交換生態。
          </p>
        </div>

      </div>
    </div>
  );
}