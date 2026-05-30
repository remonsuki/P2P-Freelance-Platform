import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'sans-serif', backgroundColor: '#fdfefe', minHeight: '80vh' }}>
      
      {/* 英雄區塊 (Hero Section) */}
      <div style={{ marginBottom: '60px', padding: '0 10px' }}>
        <h1 style={{ fontSize: '52px', color: '#2c3e50', marginBottom: '15px', fontWeight: '800', letterSpacing: '1px' }}>
          YunBarter <span style={{ color: '#f39c12' }}>時間銀行</span>
        </h1>
        <p style={{ fontSize: '22px', color: '#7f8c8d', marginBottom: '45px', maxWidth: '600px', margin: '0 auto 45px auto', lineHeight: '1.5' }}>
          打破金錢限制，用你的專業交換全世界的技能。
        </p>

        {/* 核心導航按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '25px', flexWrap: 'wrap' }}>
          <Link to="/search" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '16px 35px', fontSize: '18px', fontWeight: 'bold', 
              backgroundColor: '#3498db', color: 'white', border: 'none', 
              borderRadius: '30px', cursor: 'pointer', boxShadow: '0 6px 15px rgba(52, 152, 219, 0.3)',
              transition: 'transform 0.2s, cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
            >
              🔍 尋找教師 (我想學)
            </button>
          </Link>

          <Link to="/publish" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '16px 35px', fontSize: '18px', fontWeight: 'bold', 
              backgroundColor: '#9b59b6', color: 'white', border: 'none', 
              borderRadius: '30px', cursor: 'pointer', boxShadow: '0 6px 15px rgba(155, 89, 182, 0.3)',
              transition: 'transform 0.2s, cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
            >
              ✨ 發佈技能 (我想教)
            </button>
          </Link>
        </div>
      </div>

      {/* 平台特色介紹 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', marginTop: '80px' }}>
        
        {/* 特色一 */}
        <div style={{ 
          width: '260px', padding: '30px 20px', backgroundColor: 'white', borderRadius: '20px', 
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f3f5'
        }}>
          {/* 圖示化佔位符 */}
          <div style={{
            width: '65px', height: '65px', backgroundColor: '#eaf2f8',
            display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%',
            fontSize: '30px', marginBottom: '20px'
          }}>
            🪙
          </div>
          <h3 style={{ color: '#2c3e50', margin: '0 0 12px 0', fontSize: '18px' }}>Web3 時間幣</h3>
          <p style={{ color: '#7f8c8d', fontSize: '14px', lineHeight: '1.6', margin: 0, textAlign: 'justify' }}>
            導入 YTC 時間幣與智能合約概念，確保交易安全，讓校園內知識產出的價值完全透明化。
          </p>
        </div>

        {/* 特色二 */}
        <div style={{ 
          width: '260px', padding: '30px 20px', backgroundColor: 'white', borderRadius: '20px', 
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f3f5'
        }}>
          {/* 圖示化佔位符 */}
          <div style={{
            width: '65px', height: '65px', backgroundColor: '#f5eef8',
            display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%',
            fontSize: '30px', marginBottom: '20px'
          }}>
            🤖
          </div>
          <h3 style={{ color: '#2c3e50', margin: '0 0 12px 0', fontSize: '18px' }}>AI 魔法助理</h3>
          <p style={{ color: '#7f8c8d', fontSize: '14px', lineHeight: '1.6', margin: 0, textAlign: 'justify' }}>
            不知道怎麼包裝行銷自己？AI 助理幫你一鍵自動生成吸睛的專業文案與最合適的階梯定價。
          </p>
        </div>

        {/* 特色三 */}
        <div style={{ 
          width: '260px', padding: '30px 20px', backgroundColor: 'white', borderRadius: '20px', 
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f3f5'
        }}>
          {/* 圖示化佔位符 */}
          <div style={{
            width: '65px', height: '65px', backgroundColor: '#eafaf1',
            display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%',
            fontSize: '30px', marginBottom: '20px'
          }}>
            🎓
          </div>
          <h3 style={{ color: '#2c3e50', margin: '0 0 12px 0', fontSize: '18px' }}>校園互助圈</h3>
          <p style={{ color: '#7f8c8d', fontSize: '14px', lineHeight: '1.6', margin: 0, textAlign: 'justify' }}>
            從專業期中課業輔導到生活興趣技能，輕鬆建立屬於大學生跨科系的專屬技能交換生態圈。
          </p>
        </div>

      </div>
    </div>
  );
}