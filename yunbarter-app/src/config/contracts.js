/**
 * 區塊鏈合約設定
 * - SkillToken：已部署的 ERC-20 測試代幣
 * - SkillExchange：技能交換平台合約（部署後請更新地址）
 */

// 測試幣 SkillToken 合約地址（Sepolia / 本地測試網）
export const SKILL_TOKEN_ADDRESS = '0xF3A9Ad79A8bCDF5F58C4d79BADebB3F47715B009';

// 技能交換平台合約地址（部署後替換此佔位符）
export const SKILL_EXCHANGE_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * SkillToken ERC-20 ABI（來自 file/constants.js）
 * 至少包含 approve、balanceOf、allowance 等互動所需函式
 */
export const SKILL_TOKEN_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

/**
 * 技能交換平台合約 ABI（虛擬介面，部署真實合約後替換）
 */
export const SKILL_EXCHANGE_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'jobId', type: 'uint256' }],
    name: 'buySkill',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];
