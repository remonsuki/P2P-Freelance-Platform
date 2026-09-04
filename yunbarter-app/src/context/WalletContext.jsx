import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { formatAddress } from '../utils/formatAddress';
import { syncWalletAddress } from '../services/api';
import {
  SKILL_TOKEN_ADDRESS,
  SKILL_TOKEN_ABI,
} from '../config/contracts';

const STORAGE_KEY = 'yunbarter_wallet_address';

const WalletContext = createContext(null);

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
      const token = new Contract(SKILL_TOKEN_ADDRESS, SKILL_TOKEN_ABI, signerOrProvider);
      const raw = await token.balanceOf(userAddress);
      const decimals = await token.decimals();
      const formatted = parseFloat(formatUnits(raw, decimals));
      setChainBalance(formatted);
      return formatted;
    } catch (err) {
      console.error('讀取鏈上餘額失敗:', err);
      return null;
    }
  }, []);

  /** 建立 ethers Provider 與 Signer */
  const setupProvider = useCallback(async (userAddress) => {
    if (!window.ethereum) return;
    const browserProvider = new BrowserProvider(window.ethereum);
    const walletSigner = await browserProvider.getSigner();
    setProvider(browserProvider);
    setSigner(walletSigner);
    setAddress(userAddress);
    localStorage.setItem(STORAGE_KEY, userAddress);

    const balance = await refreshChainBalance(walletSigner, userAddress);
    // 同步至後端快取
    try {
      await syncWalletAddress(userAddress, balance ?? 0);
    } catch (err) {
      console.warn('同步錢包至後端失敗（後端可能未啟動）:', err.message);
    }
  }, [refreshChainBalance]);

  /** 連線 MetaMask */
  const connectWallet = useCallback(async () => {
    setError(null);

    if (!window.ethereum) {
      const msg = '未偵測到 MetaMask，請先安裝瀏覽器擴充套件。';
      setError(msg);
      throw new Error(msg);
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      await setupProvider(userAddress);
      return userAddress;
    } catch (err) {
      // 使用者拒絕簽章（錯誤碼 4001）
      if (err.code === 4001) {
        const msg = '您已拒絕連線錢包，請重新點擊「連線錢包」並授權。';
        setError(msg);
        throw new Error(msg);
      }
      const msg = err.message || '連線錢包時發生未知錯誤';
      setError(msg);
      throw new Error(msg);
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
    if (!window.ethereum || !address) return;

    window.ethereum
      .request({ method: 'eth_accounts' })
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
    if (!window.ethereum) return;

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

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
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

/** 取得錢包 Context，必須在 WalletProvider 內使用 */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet 必須在 WalletProvider 內使用');
  }
  return ctx;
}
