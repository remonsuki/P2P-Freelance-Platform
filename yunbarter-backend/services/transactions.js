const pool = require('../db');

const typeMap = {
  charge: '儲值',
  consume: '上課支出',
  refund: '退款',
  withdraw: '提領',
};

/** 將 point_transactions 轉為前端交易明細格式 */
async function formatTransactionsForFrontend(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT * FROM point_transactions WHERE user_id = $1
     ORDER BY created_at DESC, transaction_id DESC`,
    [userId]
  );

  return rows.map((tx) => ({
    id: tx.transaction_id,
    type: typeMap[tx.transaction_type] || tx.transaction_type,
    amount: tx.amount,
    date: tx.created_at.toISOString().split('T')[0],
    note: tx.description,
    txHash: tx.tx_hash,
    txStatus: tx.tx_status,
  }));
}

/** 寫入一筆點數流水帳，回傳前端格式 */
async function insertTransaction(db, { userId, amount, type, description, txHash = null, txStatus = 'success' }) {
  await db.query(
    `INSERT INTO point_transactions (user_id, amount, transaction_type, description, tx_hash, tx_status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, amount, type, description, txHash, txStatus]
  );
  return (await formatTransactionsForFrontend(userId, db))[0];
}

module.exports = { formatTransactionsForFrontend, insertTransaction };