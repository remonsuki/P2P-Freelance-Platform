import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import SearchTeacher from './SearchTeacher';
import PublishSkill from './PublishSkill';
import Home from './Home';
import Login from './Login';
import Wallet from './Wallet';
import Profile from './Profile';

// 🛡️ 路由守衛：記住使用者本來想去哪裡 (from)，登入後直接送他過去
function ProtectedRoute({ isLoggedIn, children }) {
  const location = useLocation();
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('Yun');
  const [balance, setBalance] = useState(0); 
  const [transactions, setTransactions] = useState([]); 
  const [teachers, setTeachers] = useState([]); 

  useEffect(() => {
    fetch('http://localhost:5000/api/user/wallet')
      .then(res => res.json())
      .then(data => {
        setUserName(data.userName);
        setBalance(data.balance);
        setTransactions(data.transactions);
      })
      .catch(err => console.error("無法獲取錢包資料:", err));

    fetch('http://localhost:5000/api/teachers')
      .then(res => res.json())
      .then(data => setTeachers(data))
      .catch(err => console.error("無法獲取老師列表:", err));
  }, []);

  const handleDeduct = async (amount, teacherName, skillName) => {
    try {
      const response = await fetch('http://localhost:5000/api/wallet/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, teacherName, skillName })
      });
      const data = await response.json();

      if (response.ok) {
        setBalance(data.balance);
        setTransactions(prev => [data.newTransaction, ...prev]);
      } else {
        alert("交易失敗：" + (data.error || "未知錯誤"));
      }
    } catch (error) {
      console.error("發送交易請求時發生錯誤:", error);
      alert("無法連線至後端伺服器");
    }
  };

  const handleAddTeacher = async (newSkill, newPrice) => {
    try {
      const response = await fetch('http://localhost:5000/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, skill: newSkill, price: newPrice, category: '綜合' })
      });
      const data = await response.json();

      if (response.ok) {
        setTeachers(prev => [data, ...prev]);
      } else {
        alert("發佈失敗：" + (data.error || "未知錯誤"));
      }
    } catch (error) {
      console.error("發佈技能時發生錯誤:", error);
    }
  };

  const handleDeleteTeacher = async (deleteId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/teachers/${deleteId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTeachers(prev => prev.filter(teacher => teacher.id !== deleteId));
      } else {
        const data = await response.json();
        alert("刪除失敗：" + (data.error || "未知錯誤"));
      }
    } catch (error) {
      console.error("刪除課程時發生錯誤:", error);
    }
  };

  const handleUpdateTeacher = async (updateId, newSkill, newPrice) => {
    try {
      const response = await fetch(`http://localhost:5000/api/teachers/${updateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: newSkill, price: newPrice })
      });
      const data = await response.json();

      if (response.ok) {
        setTeachers(prev => prev.map(teacher => 
          teacher.id === updateId ? data : teacher
        ));
      } else {
        alert("更新失敗：" + (data.error || "未知錯誤"));
      }
    } catch (error) {
      console.error("更新課程時發生錯誤:", error);
    }
  };

  return (
    <BrowserRouter>
      <nav style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0',
        position: 'sticky', top: 0, zIndex: 1000 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#0f172a', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>
            YunBarter
          </Link>

          <div style={{ display: 'flex', gap: '25px' }}>
            <Link to="/search" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = '#0f172a'} onMouseOut={(e) => e.target.style.color = '#64748b'}>
              尋找課程
            </Link>
            
            <Link to="/publish" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = '#0f172a'} onMouseOut={(e) => e.target.style.color = '#64748b'}>
              {isLoggedIn ? '發佈技能' : '成為老師'}
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {!isLoggedIn ? (
            <>
              {/* 🌟 點擊登入：直接導向獨立的 /login 路由 */}
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}>
                  登入
                </button>
              </Link>
              {/* 🌟 點擊註冊：直接導向獨立的 /register 路由 */}
              <Link to="/register" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'all 0.2s' }}>
                  註冊
                </button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/wallet" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: '20px', color: '#d97706', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fffbeb'}>
                🪙 {balance.toFixed(1)} <span style={{ fontSize: '12px' }}>YTC</span>
              </Link>
              
              <Link to="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <div style={{ width: '28px', height: '28px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px' }}>🧑‍💻</div>
                <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '14px' }}>{userName}</span>
              </Link>

              <button 
                onClick={() => {
                  if(window.confirm('確定要登出系統嗎？')) {
                    setIsLoggedIn(false);
                  }
                }} 
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', padding: '6px', transition: 'color 0.2s' }}
                onMouseOver={(e) => e.target.style.color = '#ef4444'} 
                onMouseOut={(e) => e.target.style.color = '#94a3b8'}
              >
                登出
              </button>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={
          <SearchTeacher isLoggedIn={isLoggedIn} balance={balance} onDeduct={handleDeduct} teachers={teachers} />
        } />
        <Route path="/publish" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <PublishSkill onAddTeacher={handleAddTeacher} />
          </ProtectedRoute>
        } />
        
        {/* 🌟 兩個路由共用同一個 Login 元件，由內部判斷網址來決定顯示哪一個介面 */}
        <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} setUserName={setUserName} />} />
        <Route path="/register" element={<Login setIsLoggedIn={setIsLoggedIn} setUserName={setUserName} />} />
        
        <Route path="/profile" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Profile 
              userName={userName} 
              setUserName={setUserName}
              teachers={teachers} 
              onDeleteTeacher={handleDeleteTeacher}
              onUpdateTeacher={handleUpdateTeacher}
            />
          </ProtectedRoute>
        } />
        <Route path="/wallet" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Wallet balance={balance} setBalance={setBalance} transactions={transactions} setTransactions={setTransactions} />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;