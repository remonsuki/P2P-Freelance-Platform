import { useState } from 'react';
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
  const [balance, setBalance] = useState(100.5);

  const [transactions, setTransactions] = useState([
    { id: 1, type: '上課支出', amount: -2.0, date: '2024-05-20', note: '阿弦老師 - 吉他指彈教學' },
    { id: 2, type: '教學收入', amount: 3.0, date: '2024-05-18', note: '教小明 - 網頁開發' },
    { id: 3, type: '儲值', amount: 50.0, date: '2024-05-15', note: '模擬綠界科技 - 信用卡入金' },
  ]);

  const [teachers, setTeachers] = useState([
    { id: 1, name: '阿弦', skill: '吉他指彈教學', price: 2.0, category: '音樂' },
    { id: 2, name: '林克', skill: '網頁開發', price: 3.5, category: '程式' },
    { id: 3, name: '田中櫻', skill: '日文 N3 考前衝刺', price: 1.5, category: '語言' },
  ]);

  const handleDeduct = (amount, teacherName, skillName) => {
    setBalance(prev => prev - amount);
    setTransactions(prev => [
      {
        id: Date.now(),
        type: '上課支出',
        amount: -amount,
        date: new Date().toISOString().split('T')[0],
        note: `${teacherName}老師 - ${skillName}`
      },
      ...prev
    ]);
  };

  const handleAddTeacher = (newSkill, newPrice) => {
    const newTeacher = {
      id: Date.now(),
      name: userName, 
      skill: newSkill,
      price: parseFloat(newPrice),
      category: '綜合' 
    };
    setTeachers(prev => [newTeacher, ...prev]);
  };

  // 這裡就是剛剛系統找不到的刪除功能，我們確實把它放在 function App() 的肚子裡了
  const handleDeleteTeacher = (deleteId) => {
    setTeachers(prev => prev.filter(teacher => teacher.id !== deleteId));
  };
  // 更新課程資料的功能
  const handleUpdateTeacher = (updateId, newSkill, newPrice) => {
    setTeachers(prev => prev.map(teacher => 
      teacher.id === updateId 
        ? { ...teacher, skill: newSkill, price: parseFloat(newPrice) } 
        : teacher
    ));
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
        
        <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} />} />
        
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