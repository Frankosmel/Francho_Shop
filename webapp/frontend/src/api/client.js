const tg = window.Telegram?.WebApp
const API_BASE = '/api'
const TOKEN_KEY = 'fs_token'
const SELLER_KEY = 'fs_seller_id'
function getToken() { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t) } catch {} }
function clearToken() { try { localStorage.removeItem(TOKEN_KEY) } catch {} }
function getSellerId() { try { const v = localStorage.getItem(SELLER_KEY); return v && Number(v) ? Number(v) : null } catch { return null } }
function setSellerId(id) { try { if (id && Number(id)) localStorage.setItem(SELLER_KEY, String(Number(id))) } catch {} }

function networkErrorMessage(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sin conexión a Internet. Revisa tus datos móviles o Wi-Fi e inténtalo de nuevo.'
  }
  const message = String(error?.message || '').trim()
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(message)) {
    return 'No se pudo conectar con Francho Shop. Revisa tu conexión e inténtalo de nuevo.'
  }
  return message ? 'Error de conexión: ' + message : 'Ocurrió un error de conexión. Inténtalo de nuevo.'
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' }
  const init = tg?.initData
  const token = getToken()
  if (init) h['X-Telegram-Init-Data'] = init
  else if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function request(path, options = {}) {
  const headers = { ...authHeaders(), ...options.headers }
  let res
  try { res = await fetch(API_BASE + path, { ...options, headers }) }
  catch (e) { throw new Error(networkErrorMessage(e)) }
  let body = null
  let text = ""
  try { text = await res.text() } catch {}
  try { body = text ? JSON.parse(text) : null } catch {}
  const fallback = text && !text.trim().startsWith("<") ? text.trim() : ""
  if (!res.ok) {
    if (res.status === 401) {
      const hadToken = !!getToken()
      clearToken()
      if (hadToken && typeof window !== 'undefined' && !window.Telegram?.WebApp?.initData) {
        window.location.reload()
      }
    }
    throw new Error(body?.detail || body?.message || fallback || `Error HTTP ${res.status}`)
  }
  return body
}


async function upload(path, file) {
  const form = new FormData()
  form.append('file', file)
  const headers = authHeaders()
  delete headers['Content-Type']
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  let res
  try { res = await fetch(API_BASE + path, { method: 'POST', headers, body: form, signal: controller.signal }) }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'La subida tardó demasiado. Intenta con menos imágenes o una conexión más estable.' : networkErrorMessage(e)) }
  finally { clearTimeout(timer) }
  let body = null
  try { body = await res.json() } catch {}
  if (!res.ok) throw new Error(body?.detail || body?.message || `Error HTTP ${res.status}`)
  return body
}

async function multipart(path, fields = {}, file = null) {
  const form = new FormData()
  Object.entries(fields).forEach(([key, value]) => form.append(key, value ?? ''))
  if (file) form.append('file', file)
  const headers = authHeaders()
  delete headers['Content-Type']
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  let res
  try { res = await fetch(API_BASE + path, { method: 'POST', headers, body: form, signal: controller.signal }) }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'El envío tardó demasiado. Revisa el pedido en unos segundos antes de reenviar.' : networkErrorMessage(e)) }
  finally { clearTimeout(timer) }
  let body = null
  try { body = await res.json() } catch {}
  if (!res.ok) throw new Error(body?.detail || body?.message || `Error HTTP ${res.status}`)
  return body
}

export const api = {
  getNotifications: (limit = 50) => request(`/notifications?limit=${limit}`),
  getUnreadNotificationsCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
  publicConfig: () => request('/public-config'),
  publicReviews: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/reviews/public${qs.toString() ? `?${qs}` : ''}`)
  },
  uploadIcon: (file) => upload('/admin/upload-icon', file),
  uploadDeliveryFile: (file) => upload('/admin/upload-delivery-file', file),
  me: () => request('/me'),
  publicGames: () => request('/public/games'),
  publicRegions: (game) => request('/public/games/' + encodeURIComponent(game) + '/regions'),
  publicProducts: (game, region) => request('/public/games/' + encodeURIComponent(game) + '/regions/' + encodeURIComponent(region) + '/products'),
  publicProductDetail: (id, region) => {
    const q = region ? '?region=' + encodeURIComponent(region) : ''
    return request('/public/products/' + id + q)
  },
  publicManualProducts: () => request('/public/manual-products'),
  publicAccountSellerStore: (slug) => request('/public/account-sellers/' + encodeURIComponent(slug)),
  games: () => request('/games'),
  regions: (game) => request(`/games/${encodeURIComponent(game)}/regions`),
  products: (game, region) =>
    request(`/games/${encodeURIComponent(game)}/regions/${encodeURIComponent(region)}/products`),
  productDetail: (id, region) => {
    const q = region ? `?region=${encodeURIComponent(region)}` : ''
    return request(`/products/${id}${q}`)
  },
  createOrder: (data) => {
    const seller_id = data?.seller_id || getSellerId()
    return request('/order', { method: 'POST', body: JSON.stringify(seller_id ? { ...data, seller_id } : data) })
  },
  applyReferral: (referrer_id) => request('/referrals/apply', { method: 'POST', body: JSON.stringify({ referrer_id }) }),
  reviewOrder: (order_id, rating, comment = '') => request(`/orders/${encodeURIComponent(order_id)}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  reviewManualOrder: (order_id, rating, comment = '') => request(`/manual-orders/${encodeURIComponent(order_id)}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  myOrders: () => request('/orders'),
  profile: () => request('/profile'),
  createDeposit: (amount) => request('/deposits', { method: 'POST', body: JSON.stringify({ amount }) }),
  checkDeposit: (trackId) => request(`/deposits/${encodeURIComponent(trackId)}`),
  // SMS / números virtuales
  smsHealth: () => request('/sms/health'),
  smsCountries: () => request('/sms/countries'),
  smsServices: (country) => request(`/sms/services?country=${encodeURIComponent(country)}`),
  smsOperators: (country, service) => request(`/sms/operators?country=${encodeURIComponent(country)}&service=${encodeURIComponent(service)}`),
  smsOrderCreate: (data) => request('/sms/order/create', { method: 'POST', body: JSON.stringify(data) }),
  smsOrderStatus: (id) => request(`/sms/order/status?id=${encodeURIComponent(id)}`),
  smsOrderCancel: (id) => request('/sms/order/cancel', { method: 'POST', body: JSON.stringify({ id }) }),
  // Auth
  register: (email, password, name) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: async (email, password) => {
    const d = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (d.token) setToken(d.token)
    return d
  },
  logout: async () => { await request('/auth/logout', { method: 'POST' }).catch(() => {}); clearToken() },
  verifyEmail: (email, code) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email, code, new_password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, new_password }) }),
  linkTelegram: () => request('/auth/link-telegram', { method: 'POST' }),
  changePassword: (current_password, new_password) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  // Manual products
  manualProducts: () => request('/manual-products'),
  buyManualProduct: (product_id, option_id = null, customer_data = {}) =>
    request('/manual-orders', { method: 'POST', body: JSON.stringify({ product_id, option_id, customer_data }) }),
  myManualOrders: () => request('/my-manual-orders'),
  manualOrderCase: (order_id) => request(`/manual-orders/${encodeURIComponent(order_id)}/case`),
  markCaseRead: (order_id) => request(`/manual-orders/${encodeURIComponent(order_id)}/case/read`, { method: 'POST', body: '{}' }),
  markAdminCaseRead: (order_id) => request(`/admin/manual-orders/${encodeURIComponent(order_id)}/case/read`, { method: 'POST', body: '{}' }),
  sendManualCaseMessage: (order_id, message) => request(`/manual-orders/${encodeURIComponent(order_id)}/case/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  uploadCaseFile: (order_id, file) => upload(`/manual-orders/${encodeURIComponent(order_id)}/case/upload`, file),
  // Admin
  sellerDashboard: () => request('/admin/seller-dashboard'),
  sellerRechargeDashboard: () => request('/seller/recharge-dashboard'),
  adminManualOrders: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/admin/manual-orders${qs.toString() ? `?${qs}` : ''}`)
  },
  exportManualOrdersCsv: async (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    qs.set('export', 'csv')
    const res = await fetch(API_BASE + `/admin/manual-orders?${qs}`, { headers: authHeaders() })
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
    return res.blob()
  },
  adminManualOrderDetail: (order_id) => request(`/admin/manual-orders/${order_id}`),
  adminManualOrderCase: (order_id) => request(`/admin/manual-orders/${order_id}/case`),
  adminManualCases: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/admin/manual-order-cases${qs.toString() ? `?${qs}` : ''}`)
  },
  sendAdminManualCaseMessage: (order_id, message, is_internal_note = false) => request(`/admin/manual-orders/${order_id}/case/messages`, { method: 'POST', body: JSON.stringify({ message, is_internal_note }) }),
  uploadAdminCaseFile: (order_id, file) => upload(`/admin/manual-orders/${encodeURIComponent(order_id)}/case/upload`, file),
  updateAdminManualCaseStatus: (order_id, status, message = '') => request(`/admin/manual-orders/${order_id}/case/status`, { method: 'POST', body: JSON.stringify({ status, message }) }),
  refundManualOrder: (order_id, reason = '') => request(`/admin/manual-orders/${order_id}/refund`, { method: 'POST', body: JSON.stringify({ reason }) }),
  cancelManualOrder: (order_id, reason = '') => request(`/admin/manual-orders/${order_id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminCompleteOrder: (order_id, delivery_data, admin_note) =>
    request(`/admin/manual-orders/${order_id}/complete`, {
      method: 'POST', body: JSON.stringify({ delivery_data, admin_note }),
    }),
  adminCompleteOrderWithFile: (order_id, delivery_data, admin_note, file) =>
    multipart(`/admin/manual-orders/${order_id}/complete-with-file`, { delivery_data, admin_note }, file),
  adminDeliveryEvents: (order_id) => request(`/admin/manual-orders/${order_id}/delivery-events`),
  resendDelivery: (order_id) => request(`/admin/manual-orders/${order_id}/resend-delivery`, { method: 'POST' }),
  sendEmailNotification: (order_id) => request(`/admin/manual-orders/${order_id}/email-notify`, { method: 'POST' }),
  changeDelivery: (order_id, delivery_data, admin_note = '') => request(`/admin/manual-orders/${order_id}/change-delivery`, { method: 'POST', body: JSON.stringify({ delivery_data, admin_note }) }),
  revokeDelivery: (order_id, reason = '') => request(`/admin/manual-orders/${order_id}/revoke-delivery`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminDigitalStock: (product_id, status = '') => request(`/admin/manual-products/${product_id}/digital-stock${status ? `?status=${status}` : ''}`),
  importDigitalStock: (product_id, stock_type, items_text, option_id = null) => request(`/admin/manual-products/${product_id}/digital-stock`, { method: 'POST', body: JSON.stringify({ stock_type, items_text, option_id }) }),
  adminGamePricing: () => request('/admin/game-pricing'),
  adminGameIcons: () => request('/admin/game-icons'),
  updateGameIcon: (data) => request('/admin/game-icons', { method: 'POST', body: JSON.stringify(data) }),
  refreshBuffpinProducts: () => request('/admin/buffpin-refresh', { method: 'POST', body: JSON.stringify({}) }),
  restoreProductOverride: (product_id) => request('/admin/product-overrides/' + encodeURIComponent(product_id) + '/restore', { method: 'POST', body: JSON.stringify({}) }),
  resellerSettings: () => request('/admin/reseller-settings'),
  updateResellerSettings: (reseller_min_deposit) => request('/admin/reseller-settings', { method: 'POST', body: JSON.stringify({ reseller_min_deposit }) }),
  sellerPayoutSettings: () => request('/admin/seller-payout-settings'),
  updateSellerPayoutSettings: (data) => request('/admin/seller-payout-settings', { method: 'POST', body: JSON.stringify(data) }),
  sellerWithdrawals: () => request('/seller/withdrawals'),
  accountSellerFinance: () => request('/seller/account-finance'),
  requestSellerWithdrawal: (amount, wallet_address, note = '') => request('/seller/withdrawals', { method: 'POST', body: JSON.stringify({ amount, wallet_address, note }) }),
  adminOxaPayBalance: (currency = 'USDT') => request(`/admin/oxapay-balance?currency=${encodeURIComponent(currency)}`),
  adminSellerWithdrawals: (status = '') => request(`/admin/seller-withdrawals${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  approveSellerWithdrawal: (id, txid, note = '') => request(`/admin/seller-withdrawals/${id}/approve`, { method: 'POST', body: JSON.stringify({ txid, note }) }),
  paySellerWithdrawalOxaPay: (id, note = '') => request(`/admin/seller-withdrawals/${id}/pay-oxapay`, { method: 'POST', body: JSON.stringify({ note }) }),
  syncSellerWithdrawalOxaPay: (id) => request(`/admin/seller-withdrawals/${id}/sync-oxapay`, { method: 'POST', body: JSON.stringify({}) }),
  rejectSellerWithdrawal: (id, note = '') => request(`/admin/seller-withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  updateGamePricing: (data) => request('/admin/game-pricing', { method: 'POST', body: JSON.stringify(data) }),
  adminUsers: (q) => request(`/admin/users?q=${encodeURIComponent(q)}`),
  adminUserDetail: (user_id) => request(`/admin/users/${user_id}`),
  adjustUserBalance: (user_id, amount, note) => request('/admin/users/balance', { method: 'POST', body: JSON.stringify({ user_id, amount, note }) }),
  updateUserRole: (user_id, role, extra = {}) => request('/admin/users/role', { method: 'POST', body: JSON.stringify({ user_id, role, ...extra }) }),
  updateUserBan: (user_id, is_banned, reason = '') => request('/admin/users/ban', { method: 'POST', body: JSON.stringify({ user_id, is_banned, reason }) }),
  updateUserNote: (user_id, internal_note, risk_tag = '') => request('/admin/users/note', { method: 'POST', body: JSON.stringify({ user_id, internal_note, risk_tag }) }),
  adminSellers: () => request('/admin/sellers'),
  adminAccountSellers: (status = '') => request(`/admin/account-sellers${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  accountSellerSales: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/admin/account-seller-sales${qs.toString() ? `?${qs}` : ''}`)
  },
  accountSellerSaleDetail: (order_id) => request(`/admin/account-seller-sales/${order_id}`),
  createAccountSeller: (data) => request('/admin/account-sellers', { method: 'POST', body: JSON.stringify(data) }),
  updateAccountSeller: (user_id, data) => request(`/admin/account-sellers/${user_id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sellerAccountStore: () => request('/seller/account-store'),
  updateSellerAccountStore: (data) => request('/seller/account-store', { method: 'PUT', body: JSON.stringify(data) }),
  adminSellerDetail: (user_id) => request(`/admin/sellers/${user_id}`),
  addSeller: (user_id, max_products, commission_pct = 0, notes = '', can_sell_recharges = false, recharge_commission_pct = 50, store_name = '') => request('/admin/sellers', { method: 'POST', body: JSON.stringify({ user_id, max_products, commission_pct, notes, can_sell_recharges, recharge_commission_pct, store_name }) }),
  updateSeller: (user_id, data) => request(`/admin/sellers/${user_id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeSeller: (user_id) => request(`/admin/sellers/${user_id}`, { method: 'DELETE' }),
  adminReviews: (limit = 100) => request(`/admin/reviews?limit=${limit}`),
  adminAudit: (limit = 50) => request(`/admin/audit?limit=${limit}`),
  // Helpers
  isLoggedIn: () => !!(tg?.initData || getToken()),
  isTelegram: () => !!(tg && tg.platform && tg.platform !== 'unknown'),
  clearSession: () => clearToken(),
}
export { tg, setSellerId, getSellerId }
