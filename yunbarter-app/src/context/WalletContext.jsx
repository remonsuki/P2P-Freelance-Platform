import { useState, useEffect, useCallback, useRef } from 'react';
import { formatEther } from 'ethers';
import { WalletContext } from './walletState';
import { formatAddress } from '../utils/formatAddress';
import { syncWalletAddress, fetchChainConfig, fetchWallet } from '../services/api';
import {
  isWalletAvailable,
  connectAuthorizedWallet,
  getAuthorizedWalletAccounts,
  createWalletSession,
  ensurePaymentNetwork,
  walletErrorMessage,
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
  const connectingRef = useRef(false);
  const sessionRequest = useRef(0);

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
  const [nativeBalance, setNativeBalance] = useState(null);
  const [balanceError, setBalanceError] = useState('');
  const balanceRequest = useRef(0);

  const isConnected = Boolean(address);

  /** 讀取鏈上 SKILL 代幣餘額 */
  const refreshChainBalance = useCallback(async (signerOrProvider, userAddress) => {
    if (!signerOrProvider || !userAddress) return null;
    const request=++balanceRequest.current;
    try {
      const config = await fetchChainConfig();
      if(!config.enabled) throw new Error(config.message||'鏈上交易尚未就緒');
      const rpc=signerOrProvider.provider || signerOrProvider;
      const network = await rpc.getNetwork();
      if (network.chainId !== BigInt(config.chainId)) throw new Error('請切換至交易使用的測試網路');
      const block=await rpc.getBlockNumber();
      const [formatted,native]=await Promise.all([
        readSkillBalance(signerOrProvider,userAddress,config.tokenAddress,block),rpc.getBalance(userAddress,block),
      ]);
      if (canConnectRef.current && request===balanceRequest.current) {
        setChainBalance(formatted);setNativeBalance(formatEther(native));setBalanceError('');
      }
      return formatted;
    } catch (err) {
      if (canConnectRef.current && request===balanceRequest.current) {
        setChainBalance(null);setNativeBalance(null);setBalanceError(walletErrorMessage(err));
      }
      return null;
    }
  }, []);

  /** 將區塊鏈連線結果寫入 React 狀態，並同步錢包地址至後端。 */
  const setupProvider = useCallback(async (userAddress,paymentNetwork,authorizedSession) => {
    if (!isWalletAvailable() || !canConnectRef.current) return;
    const request=++sessionRequest.current;
    const account=await fetchWallet();
    const bound=account.verifiedWalletAddress;
    if(bound&&bound.toLowerCase()!==userAddress.toLowerCase()) throw new Error('錢包與帳號綁定不符，請切回原本綁定的錢包');
    const { provider: browserProvider, signer: walletSigner } = authorizedSession||await createWalletSession(userAddress);
    if(paymentNetwork) await ensurePaymentNetwork(walletSigner,paymentNetwork);

    // 等待 MetaMask 回應期間若會員登出，就停止連線。
    if (!canConnectRef.current||request!==sessionRequest.current) return;
    if((await walletSigner.getAddress()).toLowerCase()!==userAddress.toLowerCase()) throw new Error('錢包帳戶已切換，請重新連線');
    setProvider(browserProvider);
    setSigner(walletSigner);
    setAddress(userAddress);
    // 僅當前頁面連線；登出後不保存舊地址。

    await refreshChainBalance(walletSigner, userAddress);
    // 後端只確認綁定地址，不接收或儲存餘額。
    try {
      if (canConnectRef.current&&bound) await syncWalletAddress(userAddress);
    } catch (err) {
      console.warn('同步錢包至後端失敗（後端可能未啟動）:', err.message);
    }
    return canConnectRef.current&&request===sessionRequest.current?{address:userAddress,provider:browserProvider,signer:walletSigner}:null;
  }, [refreshChainBalance]);

  // Registration has already obtained wallet permission, a signature and a server session.
  const attachRegisteredWallet=useCallback((session,walletAddress)=>{
    sessionRequest.current+=1;
    canConnectRef.current=true;
    setProvider(session.provider);
    setSigner(session.signer);
    setAddress(walletAddress);
    setError(null);
    void refreshChainBalance(session.signer,walletAddress);
  },[refreshChainBalance]);

  /** 連線 MetaMask */
  const connectWallet = useCallback(async (options={}) => {
    if(connectingRef.current) throw new Error('錢包連線正在處理，請先回覆 MetaMask 的視窗');
    setError(null);

    if (!canConnectRef.current) {
      const msg = '請先登入平台會員，再連接 MetaMask 錢包。';
      setError(msg);
      throw new Error(msg);
    }

    connectingRef.current=true;setIsConnecting(true);
    let session;
    try {
      const account=await fetchWallet();
      if(!canConnectRef.current) throw new Error('會員已登出，已取消錢包連線。');
      session=await connectAuthorizedWallet({expectedAddress:account.verifiedWalletAddress,paymentNetwork:options.paymentNetwork,reauthorize:options.reauthorize});
      if (!canConnectRef.current) {
        throw new Error('會員已登出，已取消錢包連線。');
      }
      const connected=await setupProvider(session.address,undefined,session);
      if(!connected) throw new Error('錢包狀態已變更，請重新連線');
      return connected;
    } catch (err) {
      session?.provider.destroy();
      const msg = walletErrorMessage(err);
      setAddress(null);
      setProvider(null);
      setSigner(null);
      balanceRequest.current+=1;
      setChainBalance(null);
      setNativeBalance(null);
      setError(msg);
      throw new Error(msg, { cause: err });
    } finally {
      connectingRef.current=false;
      setIsConnecting(false);
    }
  }, [setupProvider]);

  /** 斷開連線（僅清除前端狀態） */
  const disconnectWallet = useCallback(() => {
    sessionRequest.current+=1;
    balanceRequest.current+=1;
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainBalance(null);
    setNativeBalance(null);
    setBalanceError('');
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 不自動恢復錢包：需先確認會員 Session，再由使用者主動連線。

  // 監聽帳戶與鏈變更
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      // The active connect flow validates the completed permission response itself.
      if(connectingRef.current) return;
      if (!canConnectRef.current) {
        disconnectWallet();
        return;
      }
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        void setupProvider(accounts[0]).catch(err=>{disconnectWallet();setError(walletErrorMessage(err));});
      }
    };

    const handleChainChanged = () => {
      // Replace providers instead of reloading and losing the in-flight booking.
      disconnectWallet();
      if(!canConnectRef.current||connectingRef.current) return;
      void getAuthorizedWalletAccounts().then(accounts=>{
        if(accounts[0]&&canConnectRef.current) return setupProvider(accounts[0]);
      }).catch(err=>{disconnectWallet();setError(walletErrorMessage(err));});
    };

    return subscribeWalletEvents({
      onAccountsChanged: handleAccountsChanged,
      onChainChanged: handleChainChanged,
    });
  }, [setupProvider, disconnectWallet]);

  useEffect(()=>{
    const refresh=()=>{if(signer&&address&&!document.hidden) void refreshChainBalance(signer,address);};
    window.addEventListener('focus',refresh);
    window.addEventListener('yunbarter:data-changed',refresh);
    const timer=setInterval(refresh,10000);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('yunbarter:data-changed',refresh);};
  },[signer,address,refreshChainBalance]);

  const shortAddress = address ? formatAddress(address) : '';

  return (
    <WalletContext.Provider
      value={{
        setCanConnect,
        attachRegisteredWallet,
        address,
        shortAddress,
        provider,
        signer,
        isConnected,
        isConnecting,
        error,
        chainBalance,
        nativeBalance,
        balanceError,
        connectWallet,
        disconnectWallet,
        refreshChainBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
