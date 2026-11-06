import { useState, useEffect, useCallback } from 'react';
import { WalletContext } from './walletState';
import { formatAddress } from '../utils/formatAddress';
import { syncWalletAddress } from '../services/api';
import {
  isWalletAvailable,
  requestWalletConnection,
  getAuthorizedWalletAccounts,
  createWalletSession,
  subscribeWalletEvents,
  readSkillBalance,
} from '../services/blockchain';

const STORAGE_KEY = 'yunbarter_wallet_address';

/**
 * 全域錢包狀態管理
 * - MetaMask 連線 / 斷線
 * - 地址持久化至 localStorage
 * - 監聽帳戶切換與鏈變更
 */
export function WalletProvider({ children }) {
  const [address, setAddress] = useState(() => localStorage.getItem(STORAGE_KEY) || null);
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
      setChainBalance(formatted);
      return formatted;
    } catch (err) {
      console.error('讀取鏈上餘額失敗:', err);
      return null;
    }
  }, []);

  /** 將區塊鏈連線結果寫入 React 狀態，並同步錢包地址至後端。 */
  const setupProvider = useCallback(async (userAddress) => {
    if (!isWalletAvailable()) return;
    const { provider: browserProvider, signer: walletSigner } = await createWalletSession();
    setProvider(browserProvider);
    setSigner(walletSigner);
    setAddress(userAddress);
    localStorage.setItem(STORAGE_KEY, userAddress);

    const balance = await refreshChainBalance(walletSigner, userAddress);
    // 只同步地址；後端維護的平台點數不採用鏈上餘額顯示值。
    try {
      await syncWalletAddress(userAddress, balance ?? 0);
    } catch (err) {
      console.warn('同步錢包至後端失敗（後端可能未啟動）:', err.message);
    }
  }, [refreshChainBalance]);

  /** 連線 MetaMask */
  const connectWallet = useCallback(async () => {
    setError(null);

    setIsConnecting(true);
    try {
      const userAddress = await requestWalletConnection();
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

  // 頁面載入時嘗試恢復連線
  useEffect(() => {
    if (!isWalletAvailable() || !address) return;

    getAuthorizedWalletAccounts()
      .then((accounts) => {
        if (accounts.length > 0 && accounts[0].toLowerCase() === address.toLowerCase()) {
          setupProvider(accounts[0]);
        } else if (accounts.length === 0) {
          disconnectWallet();
        }
      })
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 監聽帳戶與鏈變更
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
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
