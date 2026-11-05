import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { CircleDollarSign, CircleUser, LogOut, Sparkles, GraduationCap, ShieldCheck } from 'lucide-react';

import SearchTeacher from './SearchTeacher';
import PublishSkill from './PublishSkill';
import Home from './Home';
import Login from './Login';
import Wallet from './Wallet';
import Profile from './Profile';
import NotificationCard from './NotificationCard';
import ConnectWalletButton from './components/ConnectWalletButton';
import BookingEscrow from './BookingEscrow';
import { fetchWallet, fetchTeachers, createBooking, logout, addTeacher, deleteTeacher, updateTeacher } from './services/api';
import { useWallet } from './context/WalletContext';

function ProtectedRoute({ isLoggedIn, isAuthLoading, children }) {
  const location = useLocation();
  if (isAuthLoading) return <div style={{ padding: '40px' }}>正在確認登入狀態...</div>;
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

function AppContent() {
  const { refreshChainBalance, signer, address } = useWallet();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('Yun');
  const [balance, setBalance] = useState(0); 
  const [transactions, setTransactions] = useState([]); 
  const [teachers, setTeachers] = useState([]); 
  const teachersRequest = useRef(0);
  const walletRequest = useRef(0);

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
  const loadTeachers = useCallback(async () => {
    const request = ++teachersRequest.current;
    const data = await fetchTeachers();
    if (request === teachersRequest.current) setTeachers(data);
    return data;
  }, []);

  const refreshWallet = useCallback(async () => {
    const request = ++walletRequest.current;
    const data = await fetchWallet();
    if (request === walletRequest.current) {
      setIsLoggedIn(true);
      setUserId(data.userId);
      setUserName(data.userName);
      setBalance(data.balance);
      setTransactions(data.transactions);
    }
    return data;
  }, []);

  useEffect(() => { walletRequest.current += 1; }, [userId]);

  useEffect(() => {
    const clearSession = () => {
      walletRequest.current += 1;
      setIsLoggedIn(false);
      setUserId(null);
      setUserName('Yun');
      setBalance(0);
      setTransactions([]);
    };
    window.addEventListener('yunbarter:unauthorized', clearSession);
    return () => window.removeEventListener('yunbarter:unauthorized', clearSession);
  }, []);

  useEffect(() => {
    let active = true;
    fetchWallet()
      .then(data => {
        if (!active) return;
        setIsLoggedIn(true);
        setUserId(data.userId);
        setUserName(data.userName);
        setBalance(data.balance);
        setTransactions(data.transactions);
      })
      .catch(err => {
        if (!active) return;
        if (err.status === 401) {
          setIsLoggedIn(false);
          setUserId(null);
          setUserName('Yun');
          setBalance(0);
          setTransactions([]);
        } else {
          console.error('無法獲取錢包資料:', err);
        }
      })
      .finally(() => { if (active) setIsAuthLoading(false); });
    return () => { active = false; };
  }, [isLoggedIn, userId]);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      const jobs = [loadTeachers()];
      if (isLoggedIn) jobs.push(refreshWallet());
      void Promise.all(jobs).catch(error => console.error('同步資料失敗:', error));
    };
    refresh();
    window.addEventListener('yunbarter:data-changed', refresh);
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('yunbarter:data-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isLoggedIn, loadTeachers, refreshWallet]);

  useEffect(() => {
    if (signer && address) {
      refreshChainBalance(signer, address);
    }
  }, [signer, address, refreshChainBalance]);

  const handleBookingComplete = async (payload) => {
    const data = await createBooking({ ...payload, expectedUserId: userId });
    await Promise.allSettled([refreshWallet(), loadTeachers()]);
    return data;
  };

  const handleAddTeacher = async (skill, price, category, description) => {
    const data = await addTeacher({ skill, price, category, description, expectedUserId: userId });
    teachersRequest.current += 1;
    setTeachers(prev => [data, ...prev.filter(course => course.id !== data.id)]);
    return data;
  };

  const handleDeleteTeacher = async (courseId) => {
    try {
      await deleteTeacher(courseId);
      await loadTeachers();
      showNotification('success', '已下架', '課程已下架，歷史預約仍會保留。');
    } catch (error) {
      showNotification('error', '下架失敗', error.message);
    }
  };

  const handleUpdateTeacher = async (courseId, skill, price, description) => {
    const data = await updateTeacher(courseId, { skill, price, description });
    teachersRequest.current += 1;
    setTeachers(prev => prev.map(course => course.id === data.id ? data : course));
    return data;
  };

  return (
    <>
      {/* ==========================================
          導覽列 (新增「合約託管」入口)
          ========================================== */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#0f172a', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>YunBarter</Link>
          <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
            <Link to="/search" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#0f172a'} onMouseOut={e => e.target.style.color = '#64748b'}>
              尋找課程
            </Link>
            <Link to="/bookings" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '5px' }} onMouseOver={e => e.currentTarget.style.color = '#0f172a'} onMouseOut={e => e.currentTarget.style.color = '#64748b'}>
              <ShieldCheck size={16} color="#4f46e5" />
              合約託管
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
                onClick={() => showConfirmation('確定登出', '您確定要登出系統嗎？', async () => {
                  try {
                    await logout();
                    setIsLoggedIn(false);
                    setUserId(null);
                    setUserName('Yun');
                    setBalance(0);
                    setTransactions([]);
                  } catch (error) {
                    showNotification('error', '登出失敗', error.message);
                  }
                })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', padding: '6px' }}
              >
                <LogOut size={14} strokeWidth={2.2} /><span>登出</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ==========================================
          路由設定
          ========================================== */}
        <Routes>
          <Route path="/" element={<Home isLoggedIn={isLoggedIn} userName={userName} teachers={teachers} />} />
          
          <Route path="/search" element={
            <SearchTeacher 
              isLoggedIn={isLoggedIn} balance={balance}
              onBookingComplete={handleBookingComplete}
              teachers={teachers} userId={userId}
              showNotification={showNotification} showConfirmation={showConfirmation}
            />
          } />
          
          {/* 🌟 把通知功能傳給發佈技能 */}
          <Route path="/publish" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading}>
              <PublishSkill onAddTeacher={handleAddTeacher} showNotification={showNotification} />
            </ProtectedRoute>
          } />
          
          {/* 🌟 把通知功能傳給登入與註冊 */}
          <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} setUserId={setUserId} setUserName={setUserName} showNotification={showNotification} showConfirmation={showConfirmation} />} />
          <Route path="/register" element={<Login setIsLoggedIn={setIsLoggedIn} setUserId={setUserId} setUserName={setUserName} showNotification={showNotification} showConfirmation={showConfirmation} />} />
          
          {/* 🌟 把通知與確認功能傳給個人主頁 */}
          <Route path="/profile" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading}>
              <Profile 
                key={userId} userName={userName} userId={userId} setUserName={setUserName} teachers={teachers}
                onDeleteTeacher={handleDeleteTeacher} onUpdateTeacher={handleUpdateTeacher} refreshTeachers={loadTeachers}
                showNotification={showNotification} showConfirmation={showConfirmation}
              />
            </ProtectedRoute>
          } />
          
          {/* 🌟 把通知功能傳給錢包 */}
          <Route path="/wallet" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading}>
              <Wallet balance={balance} setBalance={setBalance} transactions={transactions} setTransactions={setTransactions} showNotification={showNotification} />
            </ProtectedRoute>
          } />

          {/* 🌟 合約爭議託管 (串接全局通知、錢包餘額與交易紀錄) */}
          <Route path="/bookings" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading}>
              <BookingEscrow key={userId} showNotification={showNotification} />
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
