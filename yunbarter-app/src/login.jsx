import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 接收從 App.jsx 傳來的 setIsLoggedIn 鑰匙
export default function Login({ setIsLoggedIn }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const navigate = useNavigate(); // 用來切換網址的導航員

  // 模擬登入成功的動作
  const handleAuth = () => {
    // 1. 把系統狀態改成「已登入」
    setIsLoggedIn(true);
    // 2. 彈出成功提示
    alert(`✅ ${isLoginView ? '登入' : '註冊'}成功！為您導向個人主頁...`);
    // 3. 自動跳轉到個人主頁
    navigate('/profile');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
        
        <div style={{ width: '80px', height: '80px', backgroundColor: '#f0f0f0', border: '1px dashed #ccc', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', color: '#999', fontSize: '14px', margin: '0 auto 20px auto' }}>
          照片 (Logo)
        </div>

        <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '20px' }}>
          {isLoginView ? '登入 YunBarter' : '註冊新帳號'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {!isLoginView && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#34495e', fontWeight: 'bold' }}>學校信箱或學號</label>
              <input type="text" placeholder="輸入您的學號或信箱" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#34495e', fontWeight: 'bold' }}>電子郵件</label>
            <input type="email" placeholder="example@email.com" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#34495e', fontWeight: 'bold' }}>密碼</label>
            <input type="password" placeholder="輸入密碼" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
          </div>

          {/* 🌟 綁定剛剛寫好的 handleAuth 函數 */}
          <button onClick={handleAuth} style={{ width: '100%', padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px' }}>
            {isLoginView ? '登入' : '註冊帳號'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <span style={{ color: '#7f8c8d', fontSize: '14px' }}>
            {isLoginView ? '還沒有帳號嗎？' : '已經有帳號了？'}
          </span>
          <button onClick={() => setIsLoginView(!isLoginView)} style={{ background: 'none', border: 'none', color: '#9b59b6', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', paddingLeft: '5px' }}>
            {isLoginView ? '點此註冊' : '點此登入'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#eee' }}></div>
          <span style={{ padding: '0 10px', color: '#999', fontSize: '12px' }}>或是使用 Web3 登入</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#eee' }}></div>
        </div>

        <button onClick={handleAuth} style={{ width: '100%', padding: '12px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
          連接 Web3 錢包 (MetaMask)
        </button>

      </div>
    </div>
  );
}