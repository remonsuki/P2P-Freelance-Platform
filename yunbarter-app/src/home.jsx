import Landing from './Landing';
import Dashboard from './Dashboard';

// 🌟 Home 元件現在是一個「分流器」
// 它根據 isLoggedIn 的狀態，決定要渲染 Landing 還是 Dashboard
export default function Home({ isLoggedIn, userName, teachers }) {
  
  if (isLoggedIn) {
    // 傳送必要的 props 給 Dashboard
    return <Dashboard userName={userName} teachers={teachers} />;
  } else {
    // 沒登入就顯示 Landing 宣傳頁
    return <Landing />;
  }
}