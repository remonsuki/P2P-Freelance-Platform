import { Loader2, Wallet } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

/**
 * 連線錢包按鈕
 * 未連線時顯示「連線錢包」，連線後顯示縮短地址
 */
export default function ConnectWalletButton({ onError, style = {} }) {
  const {
    isConnected,
    shortAddress,
    isConnecting,
    connectWallet,
    disconnectWallet,
  } = useWallet();

  const handleClick = async () => {
    if (isConnected) {
      disconnectWallet();
      return;
    }
    try {
      await connectWallet();
    } catch (err) {
      onError?.(err.message);
    }
  };

  const baseStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: isConnected ? '1px solid #86efac' : '1px solid #e2e8f0',
    backgroundColor: isConnected ? '#ecfdf5' : '#f8fafc',
    color: isConnected ? '#059669' : '#334155',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: isConnecting ? 'not-allowed' : 'pointer',
    opacity: isConnecting ? 0.7 : 1,
    transition: 'all 0.2s',
    ...style,
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isConnecting}
      style={baseStyle}
      title={isConnected ? '點擊斷開錢包' : '連線 MetaMask'}
    >
      {isConnecting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Wallet size={16} />
      )}
      {isConnecting
        ? '連線中...'
        : isConnected
          ? shortAddress
          : '連線錢包'}
    </button>
  );
}
