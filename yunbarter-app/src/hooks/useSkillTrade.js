import { useState, useCallback } from 'react';
import { useWallet } from './useWallet';
import { executeSkillPurchase, isSkillExchangeConfigured } from '../services/blockchain';

/**
 * P2P 技能交易 Hook
 * 僅管理 React 交易狀態；鏈上操作集中在 services/blockchain.js。
 */
export function useSkillTrade() {
  const { signer, isConnected } = useWallet();
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isTrading, setIsTrading] = useState(false);

  /**
   * 發起技能交易
   * @param {number|string} jobId - 平台合約的 jobId，需符合交易合約定義
   * @param {number} tokenAmount - 代幣數量（人類可讀，例如 2.5 SKILL）
   * @returns {{ approveTxHash: string, tradeTxHash: string }}
   */
  const executeSkillTrade = useCallback(
    async (jobId, tokenAmount) => {
      if (!isConnected || !signer) {
        throw new Error('請先連線 MetaMask 錢包');
      }

      if (!isSkillExchangeConfigured()) {
        throw new Error('平台合約地址尚未設定，請在 config/contracts.js 填入部署地址');
      }

      setIsTrading(true);

      try {
        return await executeSkillPurchase({ signer, jobId, tokenAmount, onProgress: setLoadingMessage });
      } finally {
        setLoadingMessage('');
        setIsTrading(false);
      }
    },
    [signer, isConnected]
  );

  return { executeSkillTrade, loadingMessage, isTrading };
}
