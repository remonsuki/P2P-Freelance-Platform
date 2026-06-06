import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Coins, CircleUser, LogOut } from 'lucide-react';
import SearchTeacher from './SearchTeacher';
import PublishSkill from './PublishSkill';
import Home from './Home';
import Login from './Login';
import Wallet from './Wallet';
import Profile from './Profile';

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

  const fetchTeachers = () => {
    fetch('http://localhost:5000/api/teachers')
      .then(res => res.json())
      .then(data => setTeachers(data))
      .catch(err => console.error("無法獲取老師列表:", err));
  };

  useEffect(() => {
    fetch('http://localhost:5000/api/user/wallet')
      .then(res => res.json())
      .then(data => {
        setUserName(data.userName);
        setBalance(data.balance);
        setTransactions(data.transactions);
      })
      .catch(err => console.error("無法獲取錢包資料:", err));

    fetchTeachers(); 
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

  // 🌟 修復 Bug：讓這個郵差函式接收第三個參數「newCategory」，並傳給後端
  const handleAddTeacher = async (newSkill, newPrice, newCategory) => {
    try {
      const response = await fetch('http://localhost:5000/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 🌟 把寫死的 '綜合' 替換為傳進來的 newCategory
        body: JSON.stringify({ name: userName, skill: newSkill, price: newPrice, category: newCategory })
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
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#0f172a', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>YunBarter</Link>
          <div style={{ display: 'flex', gap: '25px' }}>
            <Link to="/search" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px' }}>尋找課程</Link>
            <Link to="/publish" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px' }}>{isLoggedIn ? '發佈技能' : '成為老師'}</Link>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {!isLoggedIn ? (
            <>
              <Link to="/login" style={{ textDecoration: 'none' }}><button style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>登入</button></Link>
              <Link to="/register" style={{ textDecoration: 'none' }}><button style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>註冊</button></Link>
            </>
          ) : (
            <>
              <Link to="/wallet" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '6px 14px', borderRadius: '20px', color: '#d97706', fontWeight: 'bold', fontSize: '14px' }}>
                <Coins size={16} color="#d97706" strokeWidth={2} />
                <span>{balance.toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>YTC</span></span>
              </Link>
              <Link to="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ width: '28px', height: '28px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircleUser size={18} color="#475569" strokeWidth={2} /></div>
                <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '14px' }}>{userName}</span>
              </Link>
              <button 
                onClick={() => { if(window.confirm('確定要登出系統嗎？')) setIsLoggedIn(false); }} 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', padding: '6px' }}
              >
                <LogOut size={14} strokeWidth={2.2} /><span>登出</span>
              </button>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchTeacher isLoggedIn={isLoggedIn} balance={balance} onDeduct={handleDeduct} teachers={teachers} />} />
        <Route path="/publish" element={<ProtectedRoute isLoggedIn={isLoggedIn}><PublishSkill onAddTeacher={handleAddTeacher} /></ProtectedRoute>} />
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
              refreshTeachers={fetchTeachers}
            />
          </ProtectedRoute>
        } />
        
        <Route path="/wallet" element={<ProtectedRoute isLoggedIn={isLoggedIn}><Wallet balance={balance} setBalance={setBalance} transactions={transactions} setTransactions={setTransactions} /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;