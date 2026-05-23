import { useState } from 'react';

// 直接從參數 (Props) 接收總部傳來的 transactions 與 setTransactions
export default function Wallet({ balance, setBalance, transactions, setTransactions }) {
  
  const handleDeposit = () => {
    const amount = prompt("請輸入欲儲值的 TWD 金額 (模擬 1:1 兌換 YTC):");
    if (amount && !isNaN(amount)) {
      const num = parseFloat(amount);
      setBalance(prev => prev + num);
      // 這裡呼叫的 setTransactions，現在會直接去改動 App.jsx 裡面的總帳本
      setTransactions([{
        id: Date.now(),
        type: '儲值',
        amount: num,
        date: new Date().toISOString().split('T')[0],
        note: '信用卡支付成功'
      }, ...transactions]);
      alert(`✅ 模擬儲值成功！已存入 ${num} YTC`);
    }
  };

  const handleWithdraw = () => {
    const amount = prompt("請輸入欲提領的 YTC 金額 (將換匯匯入您的實體銀行帳戶):");
    if (amount && !isNaN(amount)) {
      const num = parseFloat(amount);
      if (num > balance) {
        alert("❌ 餘額不足以提領！");
        return;
      }
      setBalance(prev => prev - num);
      setTransactions([{
        id: Date.now(),
        type: '提領',
        amount: -num,
        date: new Date().toISOString().split('T')[0],
        note: '提領至 台灣銀行 (帳號 ****123)'
      }, ...transactions]);
      alert(`✅ 提領申請已提交！模擬款項將在 24 小時內匯入您的銀行帳戶。`);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#2c3e50' }}>我的錢包</h2>

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

      <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
        <button onClick={handleDeposit} style={{ flex: 1, padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#2ecc71', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
          儲值入金 (信用卡)
        </button>
        <button onClick={handleWithdraw} style={{ flex: 1, padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#e67e22', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
          提領出金 (銀行轉帳)
        </button>
      </div>

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
            {/* 這裡渲染的 transactions 現在是來自 App.jsx 的資料 */}
            {transactions.map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{t.type}</td>
                <td style={{ padding: '15px', color: '#34495e' }}>{t.note}</td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: t.amount > 0 ? '#2ecc71' : '#e74c3c' }}>
                  {t.amount > 0 ? '+' : ''}{t.amount.toFixed(1)}
                </td>
                <td style={{ padding: '15px', textAlign: 'right', color: '#bdc3c7', fontSize: '14px' }}>{t.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}