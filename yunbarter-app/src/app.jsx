import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import SearchTeacher from './SearchTeacher';
import PublishSkill from './PublishSkill';
import Home from './Home';
import Login from './Login';
import Wallet from './Wallet';
import Profile from './Profile';

function ProtectedRoute({ isLoggedIn, children }) {
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('Yun');
  const [balance, setBalance] = useState(0); // 初始改由後端取得
  const [transactions, setTransactions] = useState([]); // 初始改由後端取得
  const [teachers, setTeachers] = useState([]); // 初始改由後端取得

  // 🔄 頁面初次載入：從後端 API 撈取所有初始化資料
  useEffect(() => {
    // 1. 獲取錢包與使用者狀態
    fetch('http://localhost:5000/api/user/wallet')
      .then(res => res.json())
      .then(data => {
        setUserName(data.userName);
        setBalance(data.balance);
        setTransactions(data.transactions);
      })
      .catch(err => console.error("無法獲取錢包資料:", err));

    // 2. 獲取教師列表
    fetch('http://localhost:5000/api/teachers')
      .then(res => res.json())
      .then(data => setTeachers(data))
      .catch(err => console.error("無法獲取老師列表:", err));
  }, []);

  // 💸 處理上課扣款
  const handleDeduct = async (amount, teacherName, skillName) => {
    try {
      const response = await fetch('http://localhost:5000/api/wallet/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, teacherName, skillName })
      });
      const data = await response.json();

      if (response.ok) {
        // 同步更新前端 State
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

  // ➕ 發佈新技能
  const handleAddTeacher = async (newSkill, newPrice) => {
    try {
      const response = await fetch('http://localhost:5000/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, skill: newSkill, price: newPrice, category: '綜合' })
      });
      const data = await response.json();

      if (response.ok) {
        // 將後端回傳含新 ID 的老師物件塞回前端列表
        setTeachers(prev => [data, ...prev]);
      } else {
        alert("發佈失敗：" + (data.error || "未知錯誤"));
      }
    } catch (error) {
      console.error("發佈技能時發生錯誤:", error);
    }
  };

  // ❌ 刪除教師課程
  const handleDeleteTeacher = async (deleteId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/teachers/${deleteId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // 後端刪除成功後，過濾掉該筆資料更新 UI
        setTeachers(prev => prev.filter(teacher => teacher.id !== deleteId));
      } else {
        const data = await response.json();
        alert("刪除失敗：" + (data.error || "未知錯誤"));
      }
    } catch (error) {
      console.error("刪除課程時發生錯誤:", error);
    }
  };

  // 📝 更新教師課程資料
  const handleUpdateTeacher = async (updateId, newSkill, newPrice) => {
    try {
      const response = await fetch(`http://localhost:5000/api/teachers/${updateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: newSkill, price: newPrice })
      });
      const data = await response.json();

      if (response.ok) {
        // 後端修改成功後，更新前端對應的老師物件資料
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
      <nav style={{ padding: '15px 20px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link to="/" style={{ fontWeight: 'bold', fontSize: '20px', color: '#2c3e50', textDecoration: 'none', marginRight: '20px' }}>YunBarter</Link>
        <Link to="/search" style={{ textDecoration: 'none', color: '#7f8c8d', fontWeight: 'bold' }}>搜尋教師</Link>
        <Link to="/publish" style={{ textDecoration: 'none', color: '#9b59b6', fontWeight: 'bold' }}>發佈技能</Link>
        <Link to="/profile" style={{ textDecoration: 'none', color: '#7f8c8d', fontWeight: 'bold', marginLeft: 'auto' }}>個人主頁</Link>
        <Link to="/wallet" style={{ textDecoration: 'none', color: '#f39c12', fontWeight: 'bold' }}>錢包</Link>
        {isLoggedIn ? (
          <button onClick={() => { setIsLoggedIn(false); alert("已成功登出。"); }} style={{ background: 'none', border: 'none', color: '#e74c3c', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>登出</button>
        ) : (
          <Link to="/login" style={{ textDecoration: 'none', color: '#7f8c8d', fontWeight: 'bold' }}>登入</Link>
        )}
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
        
        <Route path="/login" element={
          <Login setIsLoggedIn={setIsLoggedIn} setUserName={setUserName} />
        } />
        
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
            {/* 注意：這裡為了讓前端錢包儲值功能也能正常作用，實務上後續也可以將 Wallet 內部的儲值/扣款改寫成 API 呼叫 */}
            <Wallet balance={balance} setBalance={setBalance} transactions={transactions} setTransactions={setTransactions} />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;