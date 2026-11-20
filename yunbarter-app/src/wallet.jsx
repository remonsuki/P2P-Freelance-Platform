import { useId, useState } from 'react';
import { formatUnits } from 'ethers';
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Eye, EyeOff, History, Minus } from 'lucide-react';
import ConnectWalletButton from './components/ConnectWalletButton';
import { useLiveData } from './hooks/useLiveData';
import { useWallet } from './hooks/useWallet';
import { fetchChainConfig, fetchChainTransactions, fetchWallet, verifyTransactionWallet } from './services/api';
import { walletErrorMessage } from './services/blockchain';
import './wallet.css';

const actions = {
  approve: '代幣授權',
  fund: '課程付款',
  cancel: '取消預約退款',
  complete: '完課撥款',
  dispute: '提出爭議',
  refund: '爭議退款',
  claim: '老師領款',
  deploy: '合約部署',
};
const dateFormat = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

async function fetchRecentTransactions() {
  const result = await fetchChainTransactions();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    ...result,
    transactions: result.transactions.filter(tx => Date.parse(tx.block_time) >= cutoff),
  };
}

function WalletTransaction({ transaction, wallet }) {
  const amount = transaction.token_transfers.reduce((net, transfer) => {
    const value = BigInt(transfer.amountRaw);
    if (transfer.from.toLowerCase() === wallet) net -= value;
    if (transfer.to.toLowerCase() === wallet) net += value;
    return net;
  }, 0n);
  const direction = amount > 0n ? 'incoming' : amount < 0n ? 'outgoing' : 'neutral';
  const Icon = direction === 'incoming' ? ArrowDownRight : direction === 'outgoing' ? ArrowUpRight : Minus;
  const transferLabel = direction === 'incoming' ? 'SKILL 轉入' : direction === 'outgoing' ? 'SKILL 轉出' : 'SKILL 轉帳';
  const title = transaction.action === 'transfer' ? transferLabel : actions[transaction.action] || '合約交易';
  const [whole, fraction] = formatUnits(amount < 0n ? -amount : amount, 18).split('.');
  const displayAmount = amount === 0n ? '—' : `${amount > 0n ? '+' : '−'}${whole}.${fraction.padEnd(2, '0')} SKILL`;
  const status = transaction.status === 1 ? '已確認' : '交易失敗';

  return <li className="wallet-transaction" data-direction={direction}>
    <span className="wallet-transaction-icon"><Icon size={19} aria-hidden="true" /></span>
    <div className="wallet-transaction-summary">
      <strong>{title}</strong>
      <span><time dateTime={transaction.block_time}>{dateFormat.format(new Date(transaction.block_time))}</time> · {status}</span>
    </div>
    <strong className="wallet-transaction-amount">{displayAmount}</strong>
  </li>;
}

export default function Wallet({ showNotification }) {
  const { address, signer, isConnected, isConnecting, chainBalance, balanceError, refreshChainBalance, connectWallet } = useWallet();
  const { data: config } = useLiveData(fetchChainConfig);
  const { data: account, error: accountError, refresh: refreshAccount } = useLiveData(fetchWallet);
  const { data, loading, error, refresh } = useLiveData(fetchRecentTransactions);
  const [refreshing, setRefreshing] = useState(false);
  const [binding, setBinding] = useState(false);
  const [revealedWallet, setRevealedWallet] = useState(null);
  const addressId = useId();
  const wallet = account?.verifiedWalletAddress;
  const paymentNetwork = config?.enabled ? config : undefined;
  const showAddress = Boolean(wallet && revealedWallet === wallet);
  const addressAction = showAddress ? '隱藏綁定地址' : '顯示綁定地址';
  const transactions = data?.transactions ?? [];
  const historyLoading = loading || (!account && !accountError);
  const historyError = error || data?.syncError || (!account && accountError);
  const syncPending = data?.syncState?.complete === false;

  async function authorizeWallet() {
    if (binding || isConnecting) return;
    setBinding(true);
    try {
      const { signer: walletSigner } = await connectWallet({ reauthorize: Boolean(wallet), paymentNetwork });
      if (wallet) {
        showNotification('success', '錢包授權已更新', '已確認原本綁定錢包的網站授權，現在可以重新操作預約。');
      } else {
        await verifyTransactionWallet(walletSigner);
        await refreshAccount();
        showNotification('success', '已綁定錢包', '此地址將用於付款與收款。');
      }
    } catch (err) {
      showNotification('error', wallet ? '錢包授權尚未完成' : '錢包綁定未完成', walletErrorMessage(err));
    } finally {
      setBinding(false);
    }
  }

  async function reload() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([refresh(), refreshChainBalance(signer, address)]);
    } finally {
      setRefreshing(false);
    }
  }

  return <main className="wallet-page">
    <div className="wallet-content">
      <section className="wallet-card" aria-labelledby="wallet-title">
        <h1 id="wallet-title">我的鏈上錢包</h1>
        <div className="wallet-actions">
          <ConnectWalletButton
            showAddress={false}
            paymentNetwork={paymentNetwork}
            onError={message => showNotification('error', '錢包連線', message)}
          />
          {account && <button type="button" className="wallet-button" disabled={binding || isConnecting} onClick={authorizeWallet}>
            {binding ? '請回覆 MetaMask…' : wallet ? '重新授權綁定錢包' : '綁定錢包（限一次）'}
          </button>}
        </div>
        <div className="wallet-address">
          <div className="wallet-address-label">
            <span>綁定地址</span>
            {wallet && <button
              type="button"
              className="wallet-eye-button"
              aria-label={addressAction}
              title={addressAction}
              aria-expanded={showAddress}
              aria-controls={addressId}
              onClick={() => setRevealedWallet(showAddress ? null : wallet)}
            >
              {showAddress ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>}
            {account && !wallet && <span className="wallet-muted">尚未綁定</span>}
          </div>
          {wallet && <div className="wallet-address-value" id={addressId} hidden={!showAddress}>{showAddress && wallet}</div>}
          {accountError && <p role="alert" className="wallet-message">暫時無法讀取綁定地址。</p>}
        </div>
        <div className="wallet-balance">
          <div className="wallet-muted">可用 SKILL</div>
          <strong>{isConnected ? chainBalance ?? '—' : '請連接錢包'}</strong>
        </div>
        {balanceError && <p role="alert" className="wallet-message">{balanceError}</p>}
        <button type="button" className="wallet-button" disabled={refreshing} onClick={() => void reload()}>
          {refreshing ? '同步中…' : '更新餘額與交易'}
        </button>
      </section>
      <section className="wallet-card" aria-labelledby="wallet-history-title">
        <div className="wallet-history-heading">
          <h2 id="wallet-history-title"><History size={22} aria-hidden="true" />交易明細</h2>
          <span><ArrowRightLeft size={16} aria-hidden="true" />最近 30 天</span>
        </div>
        {historyError && <p role="alert" className="wallet-message">暫時無法更新交易明細，請稍後再試。</p>}
        {historyLoading && <p role="status" className="wallet-message">正在讀取交易明細…</p>}
        {syncPending && !historyLoading && !historyError && <p role="status" className="wallet-message">交易明細同步中…</p>}
        {!historyLoading && account && !historyError && !syncPending && !transactions.length &&
          <p className="wallet-message">最近 30 天沒有交易紀錄。</p>}
        {account && transactions.length > 0 && <ul className="wallet-history-list">
          {transactions.map(transaction => <WalletTransaction
            key={`${transaction.chain_id}:${transaction.tx_hash}`}
            transaction={transaction}
            wallet={wallet?.toLowerCase()}
          />)}
        </ul>}
      </section>
    </div>
  </main>;
}
