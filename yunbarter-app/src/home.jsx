import { Link } from 'react-router-dom';
// 🌟 引入頂級線條圖示
import { ArrowRight, Search, Sparkles, ShieldCheck, Repeat, BookOpen, Coins, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div style={{ fontFamily: 'sans-serif', color: '#0f172a', backgroundColor: '#f8fafc' }}>
      
      {/* ================= 🌟 第一區：主視覺 (Hero Section) ================= */}
      <div style={{ padding: '100px 20px', textAlign: 'center', background: 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)', position: 'relative', overflow: 'hidden' }}>
        
        {/* 背景裝飾光暈 */}
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: 'radial-gradient(circle, rgba(52, 152, 219, 0.1) 0%, rgba(255,255,255,0) 70%)', zIndex: 0 }}></div>

        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', backgroundColor: '#e0e7ff', color: '#3b82f6', borderRadius: '30px', fontSize: '14px', fontWeight: 'bold', marginBottom: '25px' }}>
            <Sparkles size={16} /> 全新校園 P2P 技能交換平台上線
          </div>
          
          <h1 style={{ fontSize: '54px', fontWeight: '900', margin: '0 0 24px 0', lineHeight: '1.2', letterSpacing: '-1px' }}>
            校園裡的隱藏天賦<br />
            <span style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              等你來發掘與變現
            </span>
          </h1>
          
          <p style={{ fontSize: '18px', color: '#475569', lineHeight: '1.7', margin: '0 auto 40px auto', maxWidth: '600px' }}>
            YunBarter 是一個基於 P2P (點對點) 架構的校園時間銀行。我們不聘請師資，而是透過 Web3 虛擬代幣 (YTC)，讓大學生能安全、流暢地互相交易彼此的閒置時間與專長。
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <Link to="/search" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '16px 32px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <Search size={18} /> 探索課程
              </button>
            </Link>
            <Link to="/login" state={{ isRegister: true }} style={{ textDecoration: 'none' }}>
              <button style={{ padding: '16px 32px', backgroundColor: 'white', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}>
                立即註冊 <ArrowRight size={18} />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ================= 🌟 第二區：核心價值 (Features) ================= */}
      <div style={{ padding: '80px 20px', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 15px 0' }}>為什麼選擇 YunBarter？</h2>
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>打破傳統金錢限制，重塑知識的流通方式</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            
            {/* 特色 1 */}
            <div style={{ padding: '40px 30px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #f1f5f9', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.05)'} onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ width: '56px', height: '56px', backgroundColor: '#e0e7ff', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
                <Repeat size={28} color="#3b82f6" strokeWidth={2} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 10px 0' }}>P2P 點對點直接交易</h3>
              <p style={{ color: '#64748b', lineHeight: '1.6', margin: 0 }}>沒有補習班抽成，沒有中間商賺差價。你的技能創造多少價值，你就獲得多少 YTC 代幣，100% 價值回歸學生。</p>
            </div>

            {/* 特色 2 */}
            <div style={{ padding: '40px 30px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #f1f5f9', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.05)'} onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ width: '56px', height: '56px', backgroundColor: '#fce7f3', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
                <Zap size={28} color="#ec4899" strokeWidth={2} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 10px 0' }}>AI 智能文案生成</h3>
              <p style={{ color: '#64748b', lineHeight: '1.6', margin: 0 }}>很會彈吉他卻不知道怎麼寫推銷文案？內建 AI 助手一鍵生成專業、幽默的高轉換率課程說明，輕鬆上架你的天賦。</p>
            </div>

            {/* 特色 3 */}
            <div style={{ padding: '40px 30px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #f1f5f9', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.05)'} onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ width: '56px', height: '56px', backgroundColor: '#fef3c7', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
                <ShieldCheck size={28} color="#d97706" strokeWidth={2} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Web3 資產安全防護</h3>
              <p style={{ color: '#64748b', lineHeight: '1.6', margin: 0 }}>串接 MetaMask 錢包與智慧合約邏輯。預約課程即鎖定代幣，完善的防呆退款機制，徹底消滅網路詐騙與放鳥行為。</p>
            </div>

          </div>
        </div>
      </div>

      {/* ================= 🌟 第三區：運作流程 (How it Works) ================= */}
      <div style={{ padding: '80px 20px', backgroundColor: '#f8fafc' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 15px 0' }}>簡單三步，開啟技能交換</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 步驟 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px', backgroundColor: 'white', padding: '30px 40px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '48px', fontWeight: '900', color: '#e2e8f0' }}>01</div>
              <div style={{ width: '50px', height: '50px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <BookOpen size={24} color="#475569" />
              </div>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>發佈專長 或 尋找課程</h4>
                <p style={{ color: '#64748b', margin: 0, lineHeight: '1.6', fontSize: '15px' }}>設定你的有空時間並上架技能，或是到大廳搜尋你想學習的新知識。</p>
              </div>
            </div>

            {/* 步驟 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px', backgroundColor: 'white', padding: '30px 40px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '48px', fontWeight: '900', color: '#e2e8f0' }}>02</div>
              <div style={{ width: '50px', height: '50px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Coins size={24} color="#475569" />
              </div>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>使用 YTC 代幣預約</h4>
                <p style={{ color: '#64748b', margin: 0, lineHeight: '1.6', fontSize: '15px' }}>選擇適合的時段，使用平台專屬代幣 (YTC) 進行沉浸式安全結帳，預約零風險。</p>
              </div>
            </div>

            {/* 步驟 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px', backgroundColor: 'white', padding: '30px 40px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '48px', fontWeight: '900', color: '#e2e8f0' }}>03</div>
              <div style={{ width: '50px', height: '50px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Sparkles size={24} color="#475569" />
              </div>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>線下學習，累積資產</h4>
                <p style={{ color: '#64748b', margin: 0, lineHeight: '1.6', fontSize: '15px' }}>與同學見面交換技能！完成教學後賺取 YTC 代幣，再去兌換其他你想學的課程。</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ================= 🌟 第四區：行動呼籲 (Bottom CTA) ================= */}
      <div style={{ padding: '80px 20px', backgroundColor: '#0f172a', color: 'white', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 20px 0' }}>準備好加入我們了嗎？</h2>
          <p style={{ fontSize: '18px', color: '#94a3b8', margin: '0 0 40px 0', lineHeight: '1.6' }}>
            現在註冊，立即獲得初始 YTC 獎勵。<br />
            開啟你在 YunBarter 的知識交換旅程。
          </p>
          <Link to="/login" state={{ isRegister: true }} style={{ textDecoration: 'none' }}>
            <button style={{ padding: '16px 40px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#2563eb'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#3b82f6'}>
              免費註冊帳號
            </button>
          </Link>
        </div>
      </div>

      {/* 簡單的 Footer */}
      <footer style={{ backgroundColor: '#020617', padding: '30px 20px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
        <p style={{ margin: 0 }}>© 2026 YunBarter. P2P Freelance Platform Project. All rights reserved.</p>
      </footer>

    </div>
  );
}