/**
 * 後端 API 集中管理
 * 所有前端與 yunbarter-backend 的 HTTP 請求由此發出
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:5000` : '')).replace(/\/$/, '');

/** Include the HttpOnly login cookie for every backend request. */
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

/** 取得錢包與交易紀錄 */
export const fetchWallet = () => request('/api/user/wallet');

/** 同步錢包地址；點數帳務餘額由後端維護 */
export const syncWalletAddress = (walletAddress, cachedPoints) =>
  request('/api/user/wallet/sync', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, cachedPoints }),
  });

/** 取得教師／課程列表 */
export const fetchTeachers = () => request('/api/teachers');

/** 建立預約與平台點數託管 */
export const createBooking = (payload) =>
  request('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** 儲值 */
export const depositWallet = (amount, txHash = null) =>
  request('/api/wallet/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount, txHash }),
  });

/** 提領 */
export const withdrawWallet = (amount) =>
  request('/api/wallet/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

/** 登入 */
export const login = (email, password) =>
  request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

/** Revoke this browser's session without affecting other users. */
export const logout = () => request('/api/auth/logout', { method: 'POST' });

/** 註冊 */
export const register = (payload) =>
  request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** 取得個人檔案 */
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
export const cancelBooking = (id) => request(`/api/bookings/${id}/cancel`, { method: 'POST' });
export const completeBooking = (id, payload) => request(`/api/bookings/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) });
export const disputeBooking = (id, reason) => request(`/api/bookings/${id}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
export const refundBooking = (id) => request(`/api/bookings/${id}/refund`, { method: 'POST' });
