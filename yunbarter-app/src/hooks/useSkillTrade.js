import { useState, useCallback } from 'react';
import { Contract, parseUnits } from 'ethers';
import { useWallet } from '../context/WalletContext';
import {
  SKILL_TOKEN_ADDRESS,
  SKILL_TOKEN_ABI,
  SKILL_EXCHANGE_ADDRESS,
  SKILL_EXCHANGE_ABI,
} from '../config/contracts';

/**
 * P2P 技能交易 Hook
 * 依序執行：Approve（授權代幣）→ buySkill（鏈上交易）
 */
export function useSkillTrade() {
  const { signer, isConnected } = useWallet();
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isTrading, setIsTrading] = useState(false);

  /**
   * 發起技能交易
   * @param {number} jobId - 平台合約的 jobId（通常對應 class_id）
   * @param {number} tokenAmount - 代幣數量（人類可讀，例如 2.5 SKILL）
   * @returns {{ approveTxHash: string, tradeTxHash: string }}
   */
  const executeSkillTrade = useCallback(
    async (jobId, tokenAmount) => {
      if (!isConnected || !signer) {
        throw new Error('請先連線 MetaMask 錢包');
      }

      if (SKILL_EXCHANGE_ADDRESS === '0x0000000000000000000000000000000000000000') {
        throw new Error('平台合約地址尚未設定，請在 config/contracts.js 填入部署地址');
      }

      setIsTrading(true);

      try {
        const tokenContract = new Contract(SKILL_TOKEN_ADDRESS, SKILL_TOKEN_ABI, signer);
        const exchangeContract = new Contract(SKILL_EXCHANGE_ADDRESS, SKILL_EXCHANGE_ABI, signer);

        const decimals = await tokenContract.decimals();
        const amountWei = parseUnits(tokenAmount.toString(), decimals);

        // ── 步驟 A：授權平台合約動用代幣 ──
        setLoadingMessage('正在授權代幣...');
        const approveTx = await tokenContract.approve(SKILL_EXCHANGE_ADDRESS, amountWei);
        setLoadingMessage('等待授權區塊確認...');
        const approveReceipt = await approveTx.wait();
        if (approveReceipt.status !== 1) {
          throw new Error('代幣授權交易失敗');
        }

        // ── 步驟 B：呼叫平台合約 buySkill ──
        setLoadingMessage('正在發起交易...');
        const tradeTx = await exchangeContract.buySkill(jobId);
        setLoadingMessage('等待交易區塊確認...');
        const tradeReceipt = await tradeTx.wait();
        if (tradeReceipt.status !== 1) {
          throw new Error('技能交易失敗');
        }

        return {
          approveTxHash: approveTx.hash,
          tradeTxHash: tradeTx.hash,
        };
      } catch (err) {
        // 使用者取消 MetaMask 簽章
        if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
          throw new Error('您已取消簽章，交易未送出');
        }
        throw new Error(err.reason || err.message || '鏈上交易失敗');
      } finally {
        setLoadingMessage('');
        setIsTrading(false);
      }
    },
    [signer, isConnected]
  );

  return { executeSkillTrade, loadingMessage, isTrading };
}
