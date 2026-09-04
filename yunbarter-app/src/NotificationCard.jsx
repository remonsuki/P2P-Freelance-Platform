import { X, ShieldCheck, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

export default function NotificationCard({ 
  isVisible, 
  type = 'success', // 'success', 'confirm', 'error', 'warning'
  title, 
  message, 
  onClose, 
  onConfirm 
}) {
  if (!isVisible) return null;

  // 根據不同類型，決定圖示與顏色
  const getIcon = () => {
    switch (type) {
      case 'confirm': return <HelpCircle size={36} color="#3b82f6" />; // 藍色問號
      case 'warning': return <AlertTriangle size={36} color="#f59e0b" />; // 黃色警告
      case 'error': return <AlertTriangle size={36} color="#ef4444" />; // 紅色警告
      case 'success':
      default: return <CheckCircle size={36} color="#10b981" />; // 綠色打勾
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'confirm': return '#eff6ff';
      case 'warning': return '#fffbeb';
      case 'error': return '#fef2f2';
      case 'success':
      default: return '#ecfdf5';
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '20px', boxSizing: 'border-box' }}>
      
      {/* 🌟 參考你圖片設計的質感卡片 */}
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        
        {/* 右上角關閉按鈕 (適用於 success 類型) */}
        {type === 'success' && (
          <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={20} color="#94a3b8" /></button>
        )}

        {/* 🌟 圖示區 */}
        <div style={{ width: '64px', height: '64px', backgroundColor: getIconBgColor(), borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px' }}>
          {getIcon()}
        </div>

        {/* 🌟 標題與內文 */}
        <h2 style={{ margin: '0 0 10px 0', fontSize: '22px', color: '#0f172a', fontWeight: 'bold' }}>{title}</h2>
        <p style={{ margin: '0 0 32px 0', color: '#64748b', fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{message}</p>

        {/* 🌟 按鈕區 */}
        <div style={{ width: '100%', display: 'flex', gap: '12px' }}>
          {type === 'confirm' ? (
            // 確認型：取消 + 確認
            <>
              <button onClick={onClose} style={{ flex: 1, padding: '14px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}>取消</button>
              <button onClick={onConfirm} style={{ flex: 1, padding: '14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#2563eb'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#3b82f6'}>確認</button>
            </>
          ) : (
            // 提示型：單一 OK 按鈕
            <button onClick={onClose} style={{ width: '100%', padding: '14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}>我知道了</button>
          )}
        </div>

      </div>
    </div>
  );
}