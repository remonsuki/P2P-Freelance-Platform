import { useState } from 'react';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, History, CreditCard, Landmark, ArrowRightLeft, ShieldCheck, Loader2, CircleDollarSign } from 'lucide-react';
import { useWallet } from './context/WalletContext';
import ConnectWalletButton from './components/ConnectWalletButton';
import { depositWallet, withdrawWallet } from './services/api';
import { SKILL_TOKEN_ADDRESS } from './config/contracts';

// 🌟 接收 showNotification
export default function Wallet({ balance, setBalance, transactions, setTransactions, showNotification }) {
  const { isConnected, address, chainBalance, refreshChainBalance, signer } = useWallet();
  const [activeTab, setActiveTab] = useState('deposit'); 
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTransaction = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    
    if (!parsedAmount || parsedAmount <= 0) {
      showNotification('warning', '操作提示', '請輸入有效的儲值或提領金額！');
      return;
    }
    if (activeTab === 'withdraw' && parsedAmount > balance) {
      showNotification('error', '提領失敗', '目前餘額不足，無法提領喔！');
      return;
    }

    setIsProcessing(true);

    try {
      const data = activeTab === 'deposit'
        ? await depositWallet(parsedAmount)
        : await withdrawWallet(parsedAmount);

      setTimeout(async () => {
        setBalance(data.balance);
        setTransactions(prev => [data.newTransaction, ...prev]);
        setAmount('');
        setIsProcessing(false);
        if (signer && address) await refreshChainBalance(signer, address);
        showNotification('success', '交易完成', `已成功${activeTab === 'deposit' ? '儲值' : '提領'} ${parsedAmount} SKILL！`);
      }, 800);
    } catch (error) {
      console.error("交易錯誤:", error);
      setIsProcessing(false);
      showNotification('error', '連線異常', error.message || '無法連線至後端伺服器，請檢查網路狀態。');
    }
  };

  const getTransactionStyle = (type, amount) => {
    const isIncome = amount > 0;
    return {
      color: isIncome ? '#10b981' : '#ef4444', 
      bgColor: isIncome ? '#ecfdf5' : '#fef2f2',
      icon: isIncome ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />,
      prefix: isIncome ? '+' : '' 
    };
  };

  const addAmount = (val) => {
    setAmount(prev => {
      const current = parseFloat(prev) || 0;
      return (current + val).toString();
    });
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 70px)', padding: '50px 20px', fontFamily: 'sans-serif' }}>
      <style>
        {`input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; }`}
      </style>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        <div style={{ flex: '1', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '24px', padding: '30px', color: 'white', boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.4)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(217, 119, 6, 0.2) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', position: 'relative', zIndex: 1 }}>
              <span style={{ fontSize: '15px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '1px' }}>
                <WalletIcon size={18} /> YUNBARTER WALLET
              </span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', color: '#fcd34d' }}>Web3 安全認證</span>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '5px' }}>目前總資產 (SKILL)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '48px', fontWeight: '900', letterSpacing: '-1px' }}>{balance.toFixed(1)}</span>
                <span style={{ fontSize: '18px', color: '#d97706', fontWeight: 'bold' }}>SKILL</span>
              </div>
              {isConnected && chainBalance !== null && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#94a3b8' }}>
                  鏈上餘額：{chainBalance.toFixed(2)} SKILL
                </div>
              )}
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <ConnectWalletButton onError={(msg) => showNotification('error', '錢包連線', msg)} />
                {isConnected && (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    合約：{SKILL_TOKEN_ADDRESS.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '12px', padding: '6px', marginBottom: '25px' }}>
              <button onClick={() => { setActiveTab('deposit'); setAmount(''); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'deposit' ? 'white' : 'transparent', color: activeTab === 'deposit' ? '#0f172a' : '#64748b', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'deposit' ? '0 2px 10px rgba(0,0,0,0.05)' : 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}><ArrowDownRight size={16} /> 儲值代幣</button>
              <button onClick={() => { setActiveTab('withdraw'); setAmount(''); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'withdraw' ? 'white' : 'transparent', color: activeTab === 'withdraw' ? '#0f172a' : '#64748b', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'withdraw' ? '0 2px 10px rgba(0,0,0,0.05)' : 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}><ArrowUpRight size={16} /> 提領收益</button>
            </div>

            <form onSubmit={handleTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '10px' }}>
                  {activeTab === 'deposit' ? '請輸入儲值數量' : '請輸入提領數量'}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#d97706' }}>
                    <CircleDollarSign size={20} strokeWidth={2} />
                  </span>
                  <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '16px 50px 16px 48px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '20px', fontWeight: 'bold', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3b82f6', transition: 'all 0.2s' }} required />
                  <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 'bold' }}>YTC</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {[10, 50, 100, 500].map(val => (
                    <button key={val} type="button" onClick={() => addAmount(val)} style={{ flex: 1, padding: '8px 0', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = '#e0e7ff'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#bfdbfe'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>+{val}</button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', backgroundColor: 'white', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                    {activeTab === 'deposit' ? <CreditCard size={18} color="#3b82f6" /> : <Landmark size={18} color="#10b981" />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{activeTab === 'deposit' ? '信用卡支付 (預設)' : '轉入銀行帳戶 (綁定)'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{activeTab === 'deposit' ? '免手續費，即時入帳' : '台灣銀行 **** 1234'}</div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isProcessing} style={{ width: '100%', padding: '16px', backgroundColor: activeTab === 'deposit' ? '#0f172a' : '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: isProcessing ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.3)', transition: 'all 0.2s', marginTop: '10px', opacity: isProcessing ? 0.8 : 1 }}>
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                {isProcessing ? '安全處理中...' : (activeTab === 'deposit' ? '確認儲值' : '確認提領')}
              </button>
            </form>
          </div>
        </div>

        <div style={{ flex: '1.5', minWidth: '400px', backgroundColor: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}><History size={20} color="#475569" /> 交易明細</h3>
            <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowRightLeft size={14} /> 最近 30 天</span>
          </div>

          {transactions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {transactions.map(tx => {
                const style = getTransactionStyle(tx.type, tx.amount);
                return (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '16px', backgroundColor: '#f8fafc', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#f8fafc'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '40px', height: '40px', backgroundColor: style.bgColor, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: style.color }}>{style.icon}</div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>{tx.type}</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                          {tx.date} • {tx.note}
                          {tx.txHash && <span> • 鏈上 {tx.txHash.slice(0, 8)}...</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: style.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {style.prefix}{Math.abs(tx.amount).toFixed(1)} <span style={{ fontSize: '12px' }}>YTC</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center' }}><History size={48} strokeWidth={1} color="#cbd5e1" /></div>
              <p style={{ margin: 0, fontSize: '15px' }}>目前還沒有任何交易紀錄。<br/>去大廳逛逛，或者發佈你的第一堂課吧！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}