
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation
} from 'react-router-dom';
import {
  CircleDollarSign,
  CircleUser,
  LogOut,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

import SearchTeacher from './SearchTeacher';
import PublishSkill from './PublishSkill';
import Home from './home';
import Login from './login';
import Wallet from './wallet';
import Profile from './profile';
import NotificationCard from './NotificationCard';
import ConnectWalletButton from './components/ConnectWalletButton';
import BookingEscrow from './BookingEscrow';
import {
  fetchWallet,
  fetchTeachers,
  logout,
  addTeacher,
  deleteTeacher,
  updateTeacher
} from './services/api';
import { useWallet } from './hooks/useWallet';

// 需要登入才能進入的頁面
function ProtectedRoute({
  isLoggedIn,
  isAuthLoading,
  children
}) {
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div style={{ padding: '40px' }}>
        正在確認登入狀態...
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return children;
}

function AppContent() {
  const {
    chainBalance,
    refreshChainBalance,
    signer,
    address,
    setCanConnect,
    disconnectWallet
  } = useWallet();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('Yun');
  const [teachers, setTeachers] = useState([]);

  const teachersRequest = useRef(0);
  const walletRequest = useRef(0);

  // ===== Step 5.1：手機版導覽選單 =====
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [menuPath, setMenuPath] = useState(location.pathname);

  // 切換頁面時關閉手機選單
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMobileMenuOpen(false);
  }

  // Session 尚未確認前，不允許連線錢包
  useEffect(() => {
    setCanConnect(isLoggedIn && !isAuthLoading);
  }, [isLoggedIn, isAuthLoading, setCanConnect]);

  // ===== 全局通知系統 =====
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

  const showConfirmation = (
    title,
    message,
    onConfirmAction
  ) => {
    setNotification({
      isVisible: true,
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        closeNotification();
        onConfirmAction();
      }
    });
  };

  const closeNotification = () => {
    setNotification(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  // ===== 資料與 API 處理邏輯 =====
  const loadTeachers = useCallback(async () => {
    const request = ++teachersRequest.current;
    const data = await fetchTeachers();

    if (request === teachersRequest.current) {
      setTeachers(data);
    }

    return data;
  }, []);

  const refreshWallet = useCallback(async () => {
    const request = ++walletRequest.current;
    const data = await fetchWallet();

    if (request === walletRequest.current) {
      setIsLoggedIn(true);
      setUserId(data.userId);
      setUserName(data.userName);
    }

    return data;
  }, []);

  useEffect(() => {
    walletRequest.current += 1;
  }, [userId]);

  useEffect(() => {
    const clearSession = () => {
      walletRequest.current += 1;
      setCanConnect(false);
      disconnectWallet();
      setIsLoggedIn(false);
      setUserId(null);
      setUserName('Yun');
      setMobileMenuOpen(false);
    };

    window.addEventListener(
      'yunbarter:unauthorized',
      clearSession
    );

    return () => {
      window.removeEventListener(
        'yunbarter:unauthorized',
        clearSession
      );
    };
  }, [setCanConnect, disconnectWallet]);

  // ===== 確認登入狀態 =====
  useEffect(() => {
    let active = true;

    fetchWallet()
      .then(data => {
        if (!active) return;

        setIsLoggedIn(true);
        setUserId(data.userId);
        setUserName(data.userName);
      })
      .catch(err => {
        if (!active) return;

        if (err.status === 401) {
          setCanConnect(false);
          disconnectWallet();
          setIsLoggedIn(false);
          setUserId(null);
          setUserName('Yun');
        } else {
          console.error('無法獲取錢包資料:', err);
        }
      })
      .finally(() => {
        if (active) {
          setIsAuthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    isLoggedIn,
    userId,
    setCanConnect,
    disconnectWallet
  ]);

  // ===== 自動同步資料 =====
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;

      const jobs = [loadTeachers()];

      if (isLoggedIn) {
        jobs.push(refreshWallet());
      }

      void Promise.all(jobs).catch(error =>
        console.error('同步資料失敗:', error)
      );
    };

    refresh();

    window.addEventListener(
      'yunbarter:data-changed',
      refresh
    );

    window.addEventListener('focus', refresh);

    const timer = setInterval(refresh, 15000);

    return () => {
      clearInterval(timer);

      window.removeEventListener(
        'yunbarter:data-changed',
        refresh
      );

      window.removeEventListener('focus', refresh);
    };
  }, [isLoggedIn, loadTeachers, refreshWallet]);

  useEffect(() => {
    if (signer && address) {
      refreshChainBalance(signer, address);
    }
  }, [signer, address, refreshChainBalance]);

  // ===== 新增課程 =====
  const handleAddTeacher = async (
    skill,
    price,
    category,
    description
  ) => {
    const data = await addTeacher({
      skill,
      price,
      category,
      description,
      expectedUserId: userId
    });

    teachersRequest.current += 1;

    setTeachers(prev => [
      data,
      ...prev.filter(course => course.id !== data.id)
    ]);

    return data;
  };

  // ===== 下架課程 =====
  const handleDeleteTeacher = async (courseId) => {
    try {
      await deleteTeacher(courseId);
      await loadTeachers();

      showNotification(
        'success',
        '已下架',
        '課程已下架，歷史預約仍會保留。'
      );
    } catch (error) {
      showNotification(
        'error',
        '下架失敗',
        error.message
      );
    }
  };

  // ===== 更新課程 =====
  const handleUpdateTeacher = async (
    courseId,
    skill,
    price,
    description
  ) => {
    const data = await updateTeacher(courseId, {
      skill,
      price,
      description
    });

    teachersRequest.current += 1;

    setTeachers(prev =>
      prev.map(course =>
        course.id === data.id ? data : course
      )
    );

    return data;
  };

  // ===== 共用登出處理 =====
  const handleLogout = () => {
    showConfirmation(
      '確定登出',
      '您確定要登出系統嗎？',
      async () => {
        try {
          await logout();

          setCanConnect(false);
          disconnectWallet();

          setIsLoggedIn(false);
          setUserId(null);
          setUserName('Yun');
          setMobileMenuOpen(false);
        } catch (error) {
          showNotification(
            'error',
            '登出失敗',
            error.message
          );
        }
      }
    );
  };

  return (
    <>
      {/* ===== Step 5.1：手機版導覽列樣式 ===== */}
      <style>{`
        .yb-mobile-toggle,
        .yb-mobile-panel {
          display: none;
        }

        @media (max-width: 960px) {
          .yb-navbar {
            padding: 12px 18px !important;
          }

          .yb-navbar-links,
          .yb-navbar-account {
            display: none !important;
          }

          .yb-mobile-toggle {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            width: 42px;
            height: 42px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #f8fafc;
            color: #0f172a;
            cursor: pointer;
            flex-shrink: 0;
          }

          .yb-mobile-panel {
            display: flex;
            flex-direction: column;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            padding: 12px 18px 20px;
            background: white;
            border-bottom: 1px solid #e2e8f0;
            box-shadow: 0 16px 28px rgba(15,23,42,0.1);
            max-height: calc(100dvh - 70px);
            overflow-y: auto;
            z-index: 1001;
          }

          .yb-mobile-link {
            display: flex;
            align-items: center;
            gap: 9px;
            width: 100%;
            padding: 14px 12px;
            color: #334155;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            text-align: left;
            background: transparent;
            border: 0;
            border-bottom: 1px solid #f1f5f9;
            box-sizing: border-box;
            cursor: pointer;
          }

          .yb-mobile-link:hover {
            background: #eff6ff;
            color: #2563eb;
            border-radius: 8px;
          }
        }
      `}</style>

      {/* ===== 導覽列 ===== */}
      <nav
        className="yb-navbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 40px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}
      >
        {/* ===== Logo 與桌面版導覽 ===== */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '40px',
          minWidth: 0
        }}>
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              color: '#0f172a',
              fontSize: '22px',
              fontWeight: '900',
              letterSpacing: '-0.5px'
            }}
          >
            YunBarter
          </Link>

          <div
            className="yb-navbar-links"
            style={{
              display: 'flex',
              gap: '25px',
              alignItems: 'center'
            }}
          >
            <Link
              to="/search"
              style={{
                textDecoration: 'none',
                color: '#64748b',
                fontWeight: 'bold',
                fontSize: '15px',
                whiteSpace: 'nowrap'
              }}
            >
              尋找課程
            </Link>

            <Link
              to="/bookings"
              style={{
                textDecoration: 'none',
                color: '#64748b',
                fontWeight: 'bold',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
            >
              <ShieldCheck
                size={16}
                color="#4f46e5"
              />
              合約託管
            </Link>

            <Link
              to="/publish"
              style={{ textDecoration: 'none' }}
            >
              <button
                type="button"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#3b82f6',
                  border: 'none',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isLoggedIn ? (
                  <>
                    <Sparkles size={16} />
                    發佈技能
                  </>
                ) : (
                  <>
                    <GraduationCap size={16} />
                    成為老師
                  </>
                )}
              </button>
            </Link>
          </div>
        </div>

        {/* ===== 桌面版會員操作 ===== */}
        <div
          className="yb-navbar-account"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}
        >
          {isLoggedIn && !isAuthLoading && (
            <ConnectWalletButton
              onError={msg =>
                showNotification(
                  'error',
                  '錢包連線',
                  msg
                )
              }
            />
          )}

          {!isLoggedIn ? (
            <>
              <Link
                to="/login"
                style={{ textDecoration: 'none' }}
              >
                <button
                  type="button"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  登入
                </button>
              </Link>

              <Link
                to="/register"
                style={{ textDecoration: 'none' }}
              >
                <button
                  type="button"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0f172a',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  註冊
                </button>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/wallet"
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  color: '#d97706',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                <CircleDollarSign
                  size={16}
                  color="#d97706"
                  strokeWidth={2}
                />

                <span>
                  {chainBalance ?? '—'}
                  {' '}
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 'normal'
                  }}>
                    SKILL
                  </span>
                </span>
              </Link>

              <Link
                to="/profile"
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '50%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <CircleUser
                    size={18}
                    color="#475569"
                    strokeWidth={2}
                  />
                </div>

                <span style={{
                  color: '#334155',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  {userName}
                </span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  padding: '6px'
                }}
              >
                <LogOut size={14} />
                <span>登出</span>
              </button>
            </>
          )}
        </div>

        {/* ===== 手機版漢堡選單按鈕 ===== */}
        <button
          type="button"
          className="yb-mobile-toggle"
          aria-label={
            mobileMenuOpen ? '關閉選單' : '開啟選單'
          }
          aria-expanded={mobileMenuOpen}
          aria-controls="yb-mobile-panel"
          onClick={() =>
            setMobileMenuOpen(prev => !prev)
          }
        >
          {mobileMenuOpen ? (
            <X size={23} />
          ) : (
            <Menu size={23} />
          )}
        </button>

        {/* ===== 手機版展開選單 ===== */}
        {mobileMenuOpen && (
          <div
            id="yb-mobile-panel"
            className="yb-mobile-panel"
          >
            <Link
              to="/search"
              className="yb-mobile-link"
            >
              尋找課程
            </Link>

            {isAuthLoading ? (
              <span className="yb-mobile-link">
                正在確認登入狀態...
              </span>
            ) : isLoggedIn ? (
              <>
                <Link
                  to="/bookings"
                  className="yb-mobile-link"
                >
                  合約託管
                </Link>

                <Link
                  to="/publish"
                  className="yb-mobile-link"
                >
                  發佈技能
                </Link>

                <Link
                  to="/wallet"
                  className="yb-mobile-link"
                >
                  我的錢包
                </Link>

                <Link
                  to="/profile"
                  className="yb-mobile-link"
                >
                  個人資料
                </Link>

                {/* 手機版錢包連線 */}
                <div style={{
                  padding: '12px',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <ConnectWalletButton
                    onError={msg =>
                      showNotification(
                        'error',
                        '錢包連線',
                        msg
                      )
                    }
                  />
                </div>

                {/* 手機版登出 */}
                <button
                  type="button"
                  className="yb-mobile-link"
                  style={{ color: '#dc2626' }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  登出
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/publish"
                  className="yb-mobile-link"
                >
                  成為老師
                </Link>

                <Link
                  to="/login"
                  className="yb-mobile-link"
                >
                  會員登入
                </Link>

                <Link
                  to="/register"
                  className="yb-mobile-link"
                >
                  免費註冊
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ===== 路由設定 ===== */}
      <Routes>
        <Route
          path="/"
          element={
            <Home
              isLoggedIn={isLoggedIn}
              userName={userName}
              teachers={teachers}
            />
          }
        />

        <Route
          path="/search"
          element={
            <SearchTeacher
              isLoggedIn={isLoggedIn}
              teachers={teachers}
              userId={userId}
              userName={userName}
              showNotification={showNotification}
              showConfirmation={showConfirmation}
            />
          }
        />

        <Route
          path="/publish"
          element={
            <ProtectedRoute
              isLoggedIn={isLoggedIn}
              isAuthLoading={isAuthLoading}
            >
              <PublishSkill
                onAddTeacher={handleAddTeacher}
                showNotification={showNotification}
              />
            </ProtectedRoute>
          }
        />

        {/* 登入 */}
        <Route
          path="/login"
          element={
            <Login
              setIsLoggedIn={setIsLoggedIn}
              setUserId={setUserId}
              setUserName={setUserName}
              showNotification={showNotification}
              showConfirmation={showConfirmation}
            />
          }
        />

        {/* 註冊 */}
        <Route
          path="/register"
          element={
            <Login
              setIsLoggedIn={setIsLoggedIn}
              setUserId={setUserId}
              setUserName={setUserName}
              showNotification={showNotification}
              showConfirmation={showConfirmation}
            />
          }
        />

        {/* 個人資料 */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute
              isLoggedIn={isLoggedIn}
              isAuthLoading={isAuthLoading}
            >
              <Profile
                key={userId}
                userName={userName}
                userId={userId}
                setUserName={setUserName}
                teachers={teachers}
                onDeleteTeacher={handleDeleteTeacher}
                onUpdateTeacher={handleUpdateTeacher}
                refreshTeachers={loadTeachers}
                showNotification={showNotification}
                showConfirmation={showConfirmation}
              />
            </ProtectedRoute>
          }
        />

        {/* 錢包 */}
        <Route
          path="/wallet"
          element={
            <ProtectedRoute
              isLoggedIn={isLoggedIn}
              isAuthLoading={isAuthLoading}
            >
              <Wallet
                key={userId}
                showNotification={showNotification}
              />
            </ProtectedRoute>
          }
        />

        {/* 合約託管 */}
        <Route
          path="/bookings"
          element={
            <ProtectedRoute
              isLoggedIn={isLoggedIn}
              isAuthLoading={isAuthLoading}
            >
              <BookingEscrow
                key={userId}
                showNotification={showNotification}
              />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* ===== 全局通知 ===== */}
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
