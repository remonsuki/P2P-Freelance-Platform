import { useState, useEffect, useCallback, useRef } from 'react';
import { WalletContext } from './walletState';
import { formatAddress } from '../utils/formatAddress';
import { syncWalletAddress } from '../services/api';
import {
  isWalletAvailable,
  requestWalletConnection,
  createWalletSession,
  subscribeWalletEvents,
  readSkillBalance,
} from '../services/blockchain';

const STORAGE_KEY = 'yunbarter_wallet_address';

/**
 * 全域錢包狀態管理
 * - MetaMask 連線 / 斷線
 * - 需會員登入後手動授權；登出時清除網站錢包狀態
 * - 監聽帳戶切換與鏈變更
 */
export function WalletProvider({ children }) {
  // 記錄會員是否已登入，預設禁止連接錢包
  const canConnectRef = useRef(false);

  // 提供給 App 更新會員登入狀態
  const setCanConnect = useCallback((loggedIn) => {
    canConnectRef.current = Boolean(loggedIn);
  }, []);
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [chainBalance, setChainBalance] = useState(null);

  const isConnected = Boolean(address);

  /** 讀取鏈上 SKILL 代幣餘額 */
  const refreshChainBalance = useCallback(async (signerOrProvider, userAddress) => {
    if (!signerOrProvider || !userAddress) return null;
    try {
      const formatted = await readSkillBalance(signerOrProvider, userAddress);
      if (canConnectRef.current) setChainBalance(formatted);
      return formatted;
    } catch (err) {
      console.error('讀取鏈上餘額失敗:', err);
      return null;
    }
  }, []);

  /** 將區塊鏈連線結果寫入 React 狀態，並同步錢包地址至後端。 */
  const setupProvider = useCallback(async (userAddress) => {
    if (!isWalletAvailable() || !canConnectRef.current) return;
    const { provider: browserProvider, signer: walletSigner } = await createWalletSession();

    // 等待 MetaMask 回應期間若會員登出，就停止連線。
    if (!canConnectRef.current) return;
    setProvider(browserProvider);
    setSigner(walletSigner);
    setAddress(userAddress);
    // 僅當前頁面連線；登出後不保存舊地址。

    await refreshChainBalance(walletSigner, userAddress);
    // 只同步錢包地址，不以鏈上餘額覆寫平台點數。
    try {
      if (canConnectRef.current) await syncWalletAddress(userAddress);
    } catch (err) {
      console.warn('同步錢包至後端失敗（後端可能未啟動）:', err.message);
    }
  }, [refreshChainBalance]);

  /** 連線 MetaMask */
  const connectWallet = useCallback(async () => {
    setError(null);

    if (!canConnectRef.current) {
      const msg = '請先登入平台會員，再連接 MetaMask 錢包。';
      setError(msg);
      throw new Error(msg);
    }

    setIsConnecting(true);
    try {
      const userAddress = await requestWalletConnection();
      if (!canConnectRef.current) {
        throw new Error('會員已登出，已取消錢包連線。');
      }
      await setupProvider(userAddress);
      return userAddress;
    } catch (err) {
      const msg = err.message || '連線錢包時發生未知錯誤';
      setError(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setIsConnecting(false);
    }
  }, [setupProvider]);

  /** 斷開連線（僅清除前端狀態） */
  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainBalance(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 不自動恢復錢包：需先確認會員 Session，再由使用者主動連線。

  // 監聽帳戶與鏈變更
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      if (!canConnectRef.current) {
        disconnectWallet();
        return;
      }
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setupProvider(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    return subscribeWalletEvents({
      onAccountsChanged: handleAccountsChanged,
      onChainChanged: handleChainChanged,
    });
  }, [setupProvider, disconnectWallet]);

  const shortAddress = address ? formatAddress(address) : '';

  return (
    <WalletContext.Provider
      value={{
        setCanConnect,
        address,
        shortAddress,
        provider,
        signer,
        isConnected,
        isConnecting,
        error,
        chainBalance,
        connectWallet,
        disconnectWallet,
        refreshChainBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
