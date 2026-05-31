import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login({ setIsLoggedIn, setUserName }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inputName, setInputName] = useState(''); 

  const handleAuth = async () => {
    if (!email || !password || (!isLoginView && !inputName)) {
      alert("❌ 請填寫所有必填欄位");
      return;
    }

    const apiUrl = isLoginView 
      ? 'http://localhost:5000/api/auth/login' 
      : 'http://localhost:5000/api/auth/register';

    const payload = isLoginView 
      ? { email, password } 
      : { email, password, userName: inputName }; 

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setIsLoggedIn(true);
        setUserName(data.userName); 
        alert(`✅ ${isLoginView ? '登入' : '註冊'}成功！歡迎，${data.userName}。`);
        navigate('/search');
      } else {
        if (isLoginView) {
          const wantToRegister = window.confirm(`❌ 登入失敗：${data.error}\n\n您是不是還沒建立過帳號？需要為您切換到「註冊」畫面嗎？`);
          if (wantToRegister) {
            setIsLoginView(false); 
          }
        } else {
          const wantToLogin = window.confirm(`❌ 註冊失敗：${data.error}\n\n該信箱可能已經註冊過了，要切換到「登入」畫面試試看嗎？`);
          if (wantToLogin) {
            setIsLoginView(true); 
          }
        }
      }
    } catch (error) {
      console.error("驗證時發生錯誤:", error);
      alert("無法連線至後端伺服器");
    }
  };

  const handleWeb3Auth = () => {
    setIsLoggedIn(true);
    setUserName('Web3 訪客');
    alert("✅ Web3 錢包連接成功！為您導向搜尋頁面...");
    navigate('/search');
  };

  // 乾淨的 Spotify 風格打勾 SVG 元件
  const CheckIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill="white"/>
      <path d="M7 12L10.5 15.5L17 8" stroke="#9b59b6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)', backgroundColor: '#f4f7f6', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', width: '100%', maxWidth: '900px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 15px 35px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        
        {/* ================= 左側：表單區塊 ================= */}
        <div style={{ flex: '1', padding: '50px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ color: '#2c3e50', fontSize: '28px', margin: '0 0 10px 0' }}>YunBarter 技能交換</h2>
            <p style={{ color: '#7f8c8d', margin: 0 }}>登入或註冊，開啟你的學習旅程</p>
          </div>

          <div style={{ display: 'flex', marginBottom: '30px', borderBottom: '2px solid #ecf0f1' }}>
            <button 
              onClick={() => setIsLoginView(true)}
              style={{ flex: 1, padding: '15px 0', border: 'none', background: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', color: isLoginView ? '#3498db' : '#95a5a6', borderBottom: isLoginView ? '3px solid #3498db' : '3px solid transparent', transition: 'all 0.3s' }}
            >
              登入
            </button>
            <button 
              onClick={() => setIsLoginView(false)}
              style={{ flex: 1, padding: '15px 0', border: 'none', background: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', color: !isLoginView ? '#3498db' : '#95a5a6', borderBottom: !isLoginView ? '3px solid #3498db' : '3px solid transparent', transition: 'all 0.3s' }}
            >
              註冊
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {!isLoginView && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#34495e', fontWeight: 'bold', fontSize: '14px' }}>使用者名稱 (暱稱)</label>
                <input 
                  type="text" 
                  placeholder="例如：吉他小天才、Yun" 
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #dfe6e9', boxSizing: 'border-box', fontSize: '15px', backgroundColor: '#f9fbfd' }} 
                />
              </div>
            )}
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#34495e', fontWeight: 'bold', fontSize: '14px' }}>電子郵件</label>
              <input 
                type="email" 
                placeholder="example@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #dfe6e9', boxSizing: 'border-box', fontSize: '15px', backgroundColor: '#f9fbfd' }} 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#34495e', fontWeight: 'bold', fontSize: '14px' }}>密碼</label>
              <input 
                type="password" 
                placeholder="輸入密碼" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #dfe6e9', boxSizing: 'border-box', fontSize: '15px', backgroundColor: '#f9fbfd' }} 
              />
            </div>

            <button 
              onClick={handleAuth} 
              style={{ width: '100%', padding: '15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 10px rgba(52, 152, 219, 0.3)', transition: 'background-color 0.3s' }}
            >
              {isLoginView ? '登入帳號' : '建立新帳號'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <span style={{ color: '#7f8c8d', fontSize: '14px' }}>
              {isLoginView ? '還沒有帳號嗎？' : '已經有帳號了？'}
            </span>
            <button 
              onClick={() => setIsLoginView(!isLoginView)} 
              style={{ background: 'none', border: 'none', color: '#9b59b6', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', paddingLeft: '5px' }}
            >
              {isLoginView ? '點此註冊' : '點此登入'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', margin: '25px 0' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#ecf0f1' }}></div>
            <span style={{ padding: '0 15px', color: '#bdc3c7', fontSize: '13px', fontWeight: 'bold' }}>或使用 Web3 登入</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#ecf0f1' }}></div>
          </div>

          <button 
            onClick={handleWeb3Auth} 
            style={{ width: '100%', padding: '14px', backgroundColor: 'transparent', color: '#f39c12', border: '2px solid #f39c12', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
          >
          連接 MetaMask 錢包
          </button>
        </div>

        {/* ================= 右側：視覺品牌區塊 (Spotify 極簡風格) ================= */}
        <div style={{ flex: '1', background: 'linear-gradient(135deg, #3498db 0%, #9b59b6 100%)', padding: '50px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', color: 'white' }}>
          
          {/* 大標題改為靠左對齊，字體加粗加大 */}
          <h2 style={{ fontSize: '38px', margin: '0 0 15px 0', lineHeight: '1.2', fontWeight: '900' }}>
            知識不應該<br/>被金錢限制
          </h2>
          <p style={{ fontSize: '17px', margin: '0 0 40px 0', opacity: 0.9, lineHeight: '1.6' }}>
            在這裡，你可以用自己擅長的技能，換取你想學習的新知識。<br/>加入我們，成為最大的技能交換社群！
          </p>

          {/* Spotify 風格的條列式清單 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <CheckIcon />
              <span style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>零手續費交易，把價值還給學習者</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <CheckIcon />
              <span style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>AI 智能文案輔助，輕鬆上架課程</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <CheckIcon />
              <span style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>Web3 安全整合，保障資產安全</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}