/**
 * 後端 API 集中管理
 * 所有前端與 yunbarter-backend 的 HTTP 請求由此發出
 */

const API_BASE = 'http://localhost:5000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `請求失敗 (${response.status})`);
  }
  return data;
}

/** 取得錢包與交易紀錄 */
export const fetchWallet = () => request('/api/user/wallet');

/** 同步鏈上錢包地址與餘額快取 */
export const syncWalletAddress = (walletAddress, cachedPoints) =>
  request('/api/user/wallet/sync', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, cachedPoints }),
  });

/** 取得教師／課程列表 */
export const fetchTeachers = () => request('/api/teachers');

/** 建立預約（鏈上交易成功後呼叫） */
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
