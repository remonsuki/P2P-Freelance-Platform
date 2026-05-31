import { useState } from 'react';

export default function Wallet({ balance, setBalance, transactions, setTransactions }) {
  // 🌟 新增：用來控制彈出視窗 (Modal) 的狀態
  const [activeModal, setActiveModal] = useState(null); // 'deposit' (儲值) | 'withdraw' (提領) | null (關閉)
  const [inputAmount, setInputAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 統一處理「儲值」與「提領」打 API 的邏輯
  const submitTransaction = async () => {
    const num = parseFloat(inputAmount);

    if (!inputAmount || isNaN(num) || num <= 0) {
      alert("❌ 請輸入大於 0 的正確金額！");
      return;
    }

    if (activeModal === 'withdraw' && num > balance) {
      alert("❌ 餘額不足以提領！您的餘額只有 " + balance.toFixed(1) + " YTC。");
      return;
    }

    setIsProcessing(true);
    const endpoint = activeModal === 'deposit' ? '/api/wallet/deposit' : '/api/wallet/withdraw';

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num })
      });

      const data = await response.json();

      if (response.ok) {
        setBalance(data.balance);
        // 使用 prev 確保抓到最新的陣列狀態
        setTransactions(prev => [data.newTransaction, ...prev]);
        
        alert(activeModal === 'deposit' ? `✅ 儲值成功！已存入 ${num} YTC` : `✅ 提領申請已提交！款項將匯入您的銀行帳戶。`);
        
        // 成功後關閉視窗並清空輸入框
        setActiveModal(null);
        setInputAmount('');
      } else {
        alert(`❌ 交易失敗：${data.error}`);
      }
    } catch (error) {
      console.error("交易連線時發生錯誤:", error);
      alert("無法連線至伺服器，請稍後再試。");
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setInputAmount('');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#2c3e50', marginBottom: '25px' }}>我的錢包</h2>

      {/* 餘額卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #3498db 0%, #8e44ad 100%)',
        color: 'white', padding: '35px', borderRadius: '20px', marginBottom: '25px',
        boxShadow: '0 10px 20px rgba(52, 152, 219, 0.2)', position: 'relative'
      }}>
        <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>YunBarter 帳戶餘額</p>
        <div style={{ fontSize: '56px', fontWeight: 'bold', margin: '15px 0' }}>
          🪙 {balance.toFixed(1)} <span style={{ fontSize: '24px' }}>YTC</span>
        </div>
        <div style={{ fontSize: '16px', opacity: 0.8 }}>
          約等值 NT$ {(balance * 100).toLocaleString()} ( 匯率 1:100 )
        </div>
      </div>

      {/* 兩顆大按鈕：點擊後不再跳 prompt，而是打開自訂 Modal */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
        <button 
          onClick={() => setActiveModal('deposit')} 
          style={{ flex: 1, padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#2ecc71', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(46, 204, 113, 0.3)', transition: 'transform 0.2s' }}
        >
        儲值入金 (信用卡)
        </button>
        <button 
          onClick={() => setActiveModal('withdraw')} 
          style={{ flex: 1, padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#e67e22', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(230, 126, 34, 0.3)', transition: 'transform 0.2s' }}
        >
        提領出金 (銀行轉帳)
        </button>
      </div>

      {/* 交易紀錄表格 */}
      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>近期交易紀錄</h3>
      <div style={{ backgroundColor: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f8f9fa' }}>
            <tr>
              <th style={{ padding: '15px', textAlign: 'left', color: '#7f8c8d' }}>類型</th>
              <th style={{ padding: '15px', textAlign: 'left', color: '#7f8c8d' }}>詳細內容</th>
              <th style={{ padding: '15px', textAlign: 'right', color: '#7f8c8d' }}>金額 (YTC)</th>
              <th style={{ padding: '15px', textAlign: 'right', color: '#7f8c8d' }}>交易日期</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>
                  <span style={{ backgroundColor: t.amount > 0 ? '#eafaf1' : '#fdedec', color: t.amount > 0 ? '#2ecc71' : '#e74c3c', padding: '5px 10px', borderRadius: '8px', fontSize: '12px' }}>
                    {t.type}
                  </span>
                </td>
                <td style={{ padding: '15px', color: '#34495e' }}>{t.note}</td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: t.amount > 0 ? '#2ecc71' : '#e74c3c' }}>
                  {t.amount > 0 ? '+' : ''}{t.amount.toFixed(1)}
                </td>
                <td style={{ padding: '15px', textAlign: 'right', color: '#bdc3c7', fontSize: '14px' }}>{t.date}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#bdc3c7' }}>目前還沒有任何交易紀錄喔！</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🌟 彈出式視窗 (Modal) */}
      {activeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '22px', textAlign: 'center' }}>
              {activeModal === 'deposit' ? '儲值 YTC 代幣' : '提領 YTC 餘額'}
            </h3>
            <p style={{ color: '#7f8c8d', marginBottom: '25px', textAlign: 'center', fontSize: '14px' }}>
              {activeModal === 'deposit' ? '輸入欲儲值的 TWD 金額 (兌換比例 1:1)' : '輸入欲提領的 YTC 金額 (將匯入您的實體帳戶)'}
            </p>
            
            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '2px solid #3498db', borderRadius: '12px', padding: '5px 15px', backgroundColor: '#f9fbfd' }}>
                <span style={{ fontSize: '24px', marginRight: '10px' }}>🪙</span>
                <input 
                  type="number" 
                  autoFocus
                  placeholder="0.0" 
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  style={{ width: '100%', padding: '15px 0', border: 'none', background: 'transparent', fontSize: '24px', fontWeight: 'bold', outline: 'none', color: '#2c3e50' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={closeModal} 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #bdc3c7', backgroundColor: 'transparent', color: '#7f8c8d', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
              >
                取消
              </button>
              <button 
                onClick={submitTransaction} 
                disabled={isProcessing}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: activeModal === 'deposit' ? '#2ecc71' : '#e67e22', color: 'white', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', fontSize: '16px', opacity: isProcessing ? 0.7 : 1 }}
              >
                {isProcessing ? '處理中...' : '確認執行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}