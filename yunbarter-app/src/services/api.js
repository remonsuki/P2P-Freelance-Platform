/**
 * 與團隊 PostgreSQL + HttpOnly Cookie Session 後端相容的 API helper。
 * 本檔不儲存認證 cookie，所有請求交由瀏覽器自動附帶。
 */
const API_ENV=import.meta.env||{};
const API_BASE = (
  API_ENV.VITE_API_BASE_URL ||
  (API_ENV.DEV ? `${window.location.protocol}//${window.location.hostname}:5000` : '')
).replace(/\/$/, '');

export function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

async function request(path, options = {}) {
  const response = await apiFetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('yunbarter:unauthorized'));
    const error = new Error(data.error || `請求失敗 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (options.method && options.method !== 'GET') window.dispatchEvent(new Event('yunbarter:data-changed'));
  return data;
}

export const fetchWallet = () => request('/api/user/wallet');

/** 確認目前錢包地址與帳號綁定相符 */
export const syncWalletAddress = (walletAddress) =>
  request('/api/user/wallet/sync', {
    method: 'POST',
    body: JSON.stringify({ walletAddress }),
  });

/** 取得教師／課程列表 */
export const fetchTeachers = () => request('/api/teachers');

/** 登入 */
export const login = (email, password) =>
  request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

/** Revoke this browser's session without affecting other users. */
export const logout = () => request('/api/auth/logout', { method: 'POST' });
export const register = (payload) => request('/api/auth/register', {
  method: 'POST', body: JSON.stringify(payload),
});
export const requestRegistrationWalletChallenge = (payload) => request('/api/auth/register/wallet-challenge', {method:'POST',body:JSON.stringify(payload)});
export const fetchProfile = () => request('/api/user/profile');

/** 更新個人檔案 */
export const updateProfile = (payload) =>
  request('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

/** 新增教師課程 */
export const addTeacher = (payload) =>
  request('/api/teachers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** 刪除教師課程 */
export const deleteTeacher = (id) =>
  request(`/api/teachers/${id}`, { method: 'DELETE' });

/** 更新教師課程 */
export const updateTeacher = (id, payload) =>
  request(`/api/teachers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const fetchBookings = () => request('/api/bookings');

export const fetchChainConfig = () => request('/api/chain/config');
export const fetchChainPayments = () => request('/api/chain/payments');
export const createChainQuote = (payload) => request('/api/chain/quotes', {method:'POST',body:JSON.stringify(payload)});
export const syncChainPayment = (id) => request(`/api/chain/payments/${id}/sync`, {method:'POST'});
export const reviewChainPayment = (id,payload) => request(`/api/chain/payments/${id}/review`, {method:'POST',body:JSON.stringify(payload)});
export const saveChainDisputeReason = (id,reason) => request(`/api/chain/payments/${id}/reason`, {method:'POST',body:JSON.stringify({reason})});
export async function verifyTransactionWallet(signer) {
  const walletAddress = await signer.getAddress();
  const current = await fetchWallet();
  if (current.verifiedWalletAddress?.toLowerCase() === walletAddress.toLowerCase()) return walletAddress;
  if (current.verifiedWalletAddress) throw new Error('此帳號已綁定其他錢包，請連接原本綁定的錢包');
  const {message} = await request('/api/chain/wallet/challenge', {method:'POST',body:JSON.stringify({walletAddress})});
  const signature = await signer.signMessage(message);
  await request('/api/chain/wallet/verify', {method:'POST',body:JSON.stringify({signature})});
  return walletAddress;
}

export const fetchChainTransactions = () => request('/api/chain/transactions');
export const backupChainTransaction = (txHash) => request('/api/chain/transactions/sync',{method:'POST',body:JSON.stringify({txHash})});
