import { useContext } from 'react';
import { WalletContext } from '../context/walletState';

/** 取得錢包狀態，必須在 WalletProvider 內使用。 */
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet 必須在 WalletProvider 內使用');
  return context;
}
