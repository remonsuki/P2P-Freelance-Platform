/**
 * 區塊鏈操作入口。
 * 集中處理 MetaMask、ethers、代幣餘額與 approve → buySkill；
 * 不依賴 React，也不呼叫後端或修改平台點數帳務。
 */
import { BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';
import {
  SKILL_TOKEN_ADDRESS,
  SKILL_TOKEN_ABI,
  SKILL_EXCHANGE_ADDRESS,
  SKILL_EXCHANGE_ABI,
} from '../config/contracts.js';

function getEthereum() {
  return globalThis.window?.ethereum;
}

export function isWalletAvailable() {
  return Boolean(getEthereum());
}

/** 要求使用者授權錢包；此操作不會建立平台會員登入狀態。 */
export async function requestWalletConnection() {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('未偵測到 MetaMask，請先安裝瀏覽器擴充套件。');
  }

  try {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) throw new Error('錢包未提供可連線的帳戶');
    return accounts[0];
  } catch (err) {
    const message = err.code === 4001
      ? '您已拒絕連線錢包，請重新點擊「連線錢包」並授權。'
      : err.message || '連線錢包時發生未知錯誤';
    throw new Error(message, { cause: err });
  }
}

/** 讀取已授權帳戶，不跳出授權視窗。 */
export async function getAuthorizedWalletAccounts() {
  const ethereum = getEthereum();
  return ethereum ? ethereum.request({ method: 'eth_accounts' }) : [];
}

export async function createWalletSession() {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('未偵測到 MetaMask，請先安裝瀏覽器擴充套件。');
  }
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  return { provider, signer };
}

/** 回傳清理函式，讓呼叫端在卸載時移除相同的監聽器。 */
export function subscribeWalletEvents({ onAccountsChanged, onChainChanged }) {
  const ethereum = getEthereum();
  if (!ethereum) return () => {};

  ethereum.on('accountsChanged', onAccountsChanged);
  ethereum.on('chainChanged', onChainChanged);
  return () => {
    ethereum.removeListener('accountsChanged', onAccountsChanged);
    ethereum.removeListener('chainChanged', onChainChanged);
  };
}

/** 保留現有畫面使用的 Number 格式；不可將此顯示值當成帳務依據。 */
export async function readSkillBalance(signerOrProvider, userAddress) {
  if (!signerOrProvider || !userAddress) return null;
  const token = new Contract(SKILL_TOKEN_ADDRESS, SKILL_TOKEN_ABI, signerOrProvider);
  const raw = await token.balanceOf(userAddress);
  const decimals = await token.decimals();
  return parseFloat(formatUnits(raw, decimals));
}

/** 僅檢查是否填入地址，不代表已驗證合約部署或後端鏈上同步。 */
export function isSkillExchangeConfigured() {
  return SKILL_EXCHANGE_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

/** 鏈上交易雛形；jobId 必須符合未來部署的交易合約定義。 */
export async function executeSkillPurchase({ signer, jobId, tokenAmount, onProgress = () => {} }) {
  if (!signer) throw new Error('請先連線 MetaMask 錢包');
  if (!isSkillExchangeConfigured()) {
    throw new Error('平台合約地址尚未設定，請在 config/contracts.js 填入部署地址');
  }

  try {
    const token = new Contract(SKILL_TOKEN_ADDRESS, SKILL_TOKEN_ABI, signer);
    const exchange = new Contract(SKILL_EXCHANGE_ADDRESS, SKILL_EXCHANGE_ABI, signer);
    const decimals = await token.decimals();
    const amountWei = parseUnits(tokenAmount.toString(), decimals);

    onProgress('正在授權代幣...');
    const approveTx = await token.approve(SKILL_EXCHANGE_ADDRESS, amountWei);
    onProgress('等待授權區塊確認...');
    const approveReceipt = await approveTx.wait();
    if (approveReceipt.status !== 1) throw new Error('代幣授權交易失敗');

    onProgress('正在發起交易...');
    const tradeTx = await exchange.buySkill(jobId);
    onProgress('等待交易區塊確認...');
    const tradeReceipt = await tradeTx.wait();
    if (tradeReceipt.status !== 1) throw new Error('技能交易失敗');

    return { approveTxHash: approveTx.hash, tradeTxHash: tradeTx.hash };
  } catch (err) {
    const message = err.code === 'ACTION_REJECTED' || err.code === 4001
      ? '您已取消簽章，交易未送出'
      : err.reason || err.message || '鏈上交易失敗';
    throw new Error(message, { cause: err });
  }
}
