import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { CircleDollarSign, CircleUser, LogOut, Sparkles, GraduationCap } from 'lucide-react';

import SearchTeacher from './SearchTeacher';
import PublishSkill from './PublishSkill';
import Home from './Home';
import Login from './Login';
import Wallet from './Wallet';
import Profile from './Profile';
import NotificationCard from './NotificationCard';
import ConnectWalletButton from './components/ConnectWalletButton';
import { fetchWallet, fetchTeachers, createBooking } from './services/api';
import { useWallet } from './context/WalletContext';

function ProtectedRoute({ isLoggedIn, children }) {
  const location = useLocation();
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

function AppContent() {
  const { chainBalance, refreshChainBalance, signer, address } = useWallet();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('Yun');
  const [balance, setBalance] = useState(0); 
  const [transactions, setTransactions] = useState([]); 
  const [teachers, setTeachers] = useState([]); 

  // ==========================================
  // 🌟 全局通知系統的狀態管理
  // ==========================================
  const [notification, setNotification] = useState({
    isVisible: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null
  });

  const showNotification = (type, title, message) => {
    setNotification({
      isVisible: true,
      type,
      title,
      message,
      onConfirm: null
    });
  };

  const showConfirmation = (title, message, onConfirmAction) => {
    setNotification({
      isVisible: true,
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        onConfirmAction(); 
        closeNotification(); 
      }
    });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  // ==========================================
  // 資料與 API 處理邏輯
  // ==========================================
  const loadTeachers = () => {
    fetchTeachers()
      .then(data => setTeachers(data))
      .catch(err => console.error("無法獲取老師列表:", err));
  };

  const loadWallet = () => {
    fetchWallet()
      .then(data => {
        setUserName(data.userName);
        setBalance(data.balance);
        setTransactions(data.transactions);
      })
      .catch(err => console.error("無法獲取錢包資料:", err));
  };

  useEffect(() => {
    loadWallet();
    loadTeachers();
  }, []);

  // 鏈上餘額更新時同步顯示（優先顯示鏈上餘額）
  useEffect(() => {
    if (chainBalance !== null) {
      setBalance(chainBalance);
    }
  }, [chainBalance]);

  useEffect(() => {
    if (signer && address) {
      refreshChainBalance(signer, address);
    }
  }, [signer, address, refreshChainBalance]);

  /** 預約扣款：支援純後端或鏈上交易後同步 */
  const handleBookingComplete = async (bookingPayload) => {
    try {
      const data = await createBooking(bookingPayload);
      setBalance(data.balance);
      setTransactions(prev => [data.newTransaction, ...prev]);
      loadTeachers();
      return data;
    } catch (error) {
      console.error("預約同步後端失敗:", error);
      throw error;
    }
  };

  const handleAddTeacher = async (newSkill, newPrice, newCategory) => {
    try {
      const response = await fetch('http://localhost:5000/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, skill: newSkill, price: newPrice, category: newCategory })
      });
      const data = await response.json();

      if (response.ok) {
        setTeachers(prev => [data, ...prev]);
        showNotification('success', '上架成功', `已成功上架「${newSkill}」課程，開始賺取 YTC 吧！`);
      } else {
        showNotification('error', '上架失敗', data.error || "未知錯誤");
      }
    } catch (error) {
      console.error("發佈技能時發生錯誤:", error);
      showNotification('error', '連線錯誤', "無法連線至伺服器。");
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
    <>
      {/* ==========================================
          導覽列 (一字不漏完整版)
          ========================================== */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#0f172a', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>YunBarter</Link>
          <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
            <Link to="/search" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#0f172a'} onMouseOut={e => e.target.style.color = '#64748b'}>
              尋找課程
            </Link>
            <Link to="/publish" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#3b82f6', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = '#e0e7ff'; e.currentTarget.style.color = '#2563eb'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#3b82f6'; }}>
                {isLoggedIn ? <><Sparkles size={16} /> 發佈技能</> : <><GraduationCap size={16} /> 成為老師</>}
              </button>
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <ConnectWalletButton onError={(msg) => showNotification('error', '錢包連線', msg)} />
          {!isLoggedIn ? (
            <>
              <Link to="/login" style={{ textDecoration: 'none' }}><button style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>登入</button></Link>
              <Link to="/register" state={{ isRegister: true }} style={{ textDecoration: 'none' }}><button style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>註冊</button></Link>
            </>
          ) : (
            <>
              <Link to="/wallet" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '6px 14px', borderRadius: '20px', color: '#d97706', fontWeight: 'bold', fontSize: '14px' }}>
                <CircleDollarSign size={16} color="#d97706" strokeWidth={2} />
                <span>{balance.toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>YTC</span></span>
              </Link>
              <Link to="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ width: '28px', height: '28px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircleUser size={18} color="#475569" strokeWidth={2} /></div>
                <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '14px' }}>{userName}</span>
              </Link>
              <button 
                onClick={() => showConfirmation('確定登出', '您確定要登出系統嗎？', () => setIsLoggedIn(false))} 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', padding: '6px' }}
              >
                <LogOut size={14} strokeWidth={2.2} /><span>登出</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ==========================================
          路由設定 (所有路由全數回歸)
          ========================================== */}
        <Routes>
          <Route path="/" element={<Home isLoggedIn={isLoggedIn} userName={userName} teachers={teachers} />} />
          
          <Route path="/search" element={
            <SearchTeacher 
              isLoggedIn={isLoggedIn} balance={balance}
              onBookingComplete={handleBookingComplete}
              teachers={teachers} userName={userName} 
              showNotification={showNotification} showConfirmation={showConfirmation}
            />
          } />
          
          {/* 🌟 把通知功能傳給發佈技能 */}
          <Route path="/publish" element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <PublishSkill onAddTeacher={handleAddTeacher} showNotification={showNotification} />
            </ProtectedRoute>
          } />
          
          {/* 🌟 把通知功能傳給登入與註冊 */}
          <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} setUserName={setUserName} showNotification={showNotification} />} />
          <Route path="/register" element={<Login setIsLoggedIn={setIsLoggedIn} setUserName={setUserName} showNotification={showNotification} />} />
          
          {/* 🌟 把通知與確認功能傳給個人主頁 */}
          <Route path="/profile" element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <Profile 
                userName={userName} setUserName={setUserName} teachers={teachers} 
                onDeleteTeacher={handleDeleteTeacher} onUpdateTeacher={handleUpdateTeacher} refreshTeachers={loadTeachers}
                showNotification={showNotification} showConfirmation={showConfirmation}
              />
            </ProtectedRoute>
          } />
          
          {/* 🌟 把通知功能傳給錢包 */}
          <Route path="/wallet" element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <Wallet balance={balance} setBalance={setBalance} transactions={transactions} setTransactions={setTransactions} showNotification={showNotification} />
            </ProtectedRoute>
          } />
        </Routes>

      {/* ==========================================
          渲染全局通知元件
          ========================================== */}
      <NotificationCard 
        {...notification} 
        onClose={closeNotification} 
      />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;