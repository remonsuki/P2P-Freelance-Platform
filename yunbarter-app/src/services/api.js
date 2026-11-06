/**
 * 與團隊 PostgreSQL + HttpOnly Cookie Session 後端相容的 API helper。
 * 本檔不儲存認證 cookie，所有請求交由瀏覽器自動附帶。
 */
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:5000` : '')
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
    const err = new Error(data.error || `請求失敗 (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export const fetchWallet = () => request('/api/user/wallet');
// 錢包地址綁定不應覆蓋 PostgreSQL 內的平台餘額。
export const syncWalletAddress = (walletAddress) => request('/api/user/wallet/sync', {
  method: 'POST', body: JSON.stringify({ walletAddress }),
});
export const fetchTeachers = () => request('/api/teachers');
export const createBooking = (payload) => request('/api/bookings', {
  method: 'POST', body: JSON.stringify(payload),
});
export const depositWallet = (amount, txHash = null) => request('/api/wallet/deposit', {
  method: 'POST', body: JSON.stringify({ amount, txHash }),
});
export const withdrawWallet = (amount) => request('/api/wallet/withdraw', {
  method: 'POST', body: JSON.stringify({ amount }),
});
export const login = (email, password) => request('/api/auth/login', {
  method: 'POST', body: JSON.stringify({ email, password }),
});
export const logout = () => request('/api/auth/logout', { method: 'POST' });
export const register = (payload) => request('/api/auth/register', {
  method: 'POST', body: JSON.stringify(payload),
});
export const fetchProfile = () => request('/api/user/profile');
export const updateProfile = (payload) => request('/api/user/profile', {
  method: 'PUT', body: JSON.stringify(payload),
});
export const addTeacher = (payload) => request('/api/teachers', {
  method: 'POST', body: JSON.stringify(payload),
});
export const deleteTeacher = (id) => request(`/api/teachers/${id}`, { method: 'DELETE' });
export const updateTeacher = (id, payload) => request(`/api/teachers/${id}`, {
  method: 'PUT', body: JSON.stringify(payload),
});
