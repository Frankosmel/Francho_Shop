const tg = window.Telegram?.WebApp
const _isCapacitor = !!(window.Capacitor?.isNativePlatform?.())
const API_BASE = _isCapacitor ? 'https://franchoshop.com/api' : '/api'

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
  let res = null
  let lastErr = null
  const maxRetries = (options.method && options.method !== 'GET') ? 1 : 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      res = await fetch(API_BASE + path, { ...options, headers })
      break
    } catch (e) {
      lastErr = e
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    }
  }

  if (!res) {
    throw new Error(networkErrorMessage(lastErr))
  }

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
    throw new Error(body?.error?.message || body?.detail || body?.message || fallback || `Error HTTP ${res.status}`)
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
  if (!res.ok) throw new Error(body?.error?.message || body?.detail || body?.message || `Error HTTP ${res.status}`)
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
  if (!res.ok) throw new Error(body?.error?.message || body?.detail || body?.message || `Error HTTP ${res.status}`)
  return body
}

// In-memory catalog cache with sessionStorage persistence for instant (0ms) catalog navigation
const catalogCache = new Map()
const pendingRequests = new Map()

function readStorageCache(key) {
  try {
    const raw = sessionStorage.getItem('fs_cc_' + key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (entry && entry.expiresAt > Date.now()) {
      return entry
    }
    sessionStorage.removeItem('fs_cc_' + key)
  } catch {}
  return null
}

function writeStorageCache(key, entry) {
  try {
    sessionStorage.setItem('fs_cc_' + key, JSON.stringify(entry))
  } catch {}
}

function clearCatalogCache() {
  catalogCache.clear()
  pendingRequests.clear()
  try {
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith('fs_cc_')) keysToRemove.push(k)
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k))
  } catch {}
}

function getCachedData(path) {
  const token = getToken() || ''
  const tgInit = tg?.initData || ''
  const cacheKey = `${path}__${token.slice(-8)}__${tgInit ? 'tg' : 'web'}`
  let entry = catalogCache.get(cacheKey)
  if (!entry) {
    entry = readStorageCache(cacheKey)
    if (entry) catalogCache.set(cacheKey, entry)
  }
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data
  }
  return null
}

function prefetchCatalog(fetcher) {
  try {
    const res = fetcher()
    if (res && typeof res.catch === 'function') res.catch(() => {})
  } catch {}
}

function cachedRequest(path, ttlMs = 120000, options = {}) {
  if (options.method && options.method !== 'GET') {
    return request(path, options)
  }
  const token = getToken() || ''
  const tgInit = tg?.initData || ''
  const cacheKey = `${path}__${token.slice(-8)}__${tgInit ? 'tg' : 'web'}`
  const now = Date.now()

  let entry = catalogCache.get(cacheKey)
  if (!entry) {
    entry = readStorageCache(cacheKey)
    if (entry) catalogCache.set(cacheKey, entry)
  }
  if (entry && entry.expiresAt > now) {
    return Promise.resolve(entry.data)
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)
  }

  const reqPromise = request(path, options)
    .then((data) => {
      const newEntry = { data, expiresAt: Date.now() + ttlMs }
      catalogCache.set(cacheKey, newEntry)
      writeStorageCache(cacheKey, newEntry)
      pendingRequests.delete(cacheKey)
      return data
    })
    .catch((err) => {
      pendingRequests.delete(cacheKey)
      if (entry && entry.data) {
        return entry.data
      }
      throw err
    })

  pendingRequests.set(cacheKey, reqPromise)
  return reqPromise
}

export const api = {
  request,
  getNotifications: (limit = 50) => request(`/notifications?limit=${limit}`),
  getUnreadNotificationsCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
  publicConfig: () => request('/public-config'),
  appUpdate: () => request('/app-update'),
  submitResellerApplication: (data) => request('/public/reseller-applications', { method: 'POST', body: JSON.stringify(data) }),
  adminResellerApplications: (status = 'pending') => request('/admin/reseller-applications?status=' + encodeURIComponent(status)),
  reviewResellerApplication: (id, status, note = '') => request('/admin/reseller-applications/' + encodeURIComponent(id) + '/review', { method: 'POST', body: JSON.stringify({ status, note }) }),
  publicReviews: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/reviews/public${qs.toString() ? `?${qs}` : ''}`)
  },
  uploadIcon: (file) => upload('/admin/upload-icon', file),
  uploadProfilePhoto: (file) => upload('/profile/photo', file),
  uploadDeliveryFile: (file) => upload('/admin/upload-delivery-file', file),
  me: () => request('/me'),
  publicGames: () => cachedRequest('/public/games', 180000),
  publicRegions: (game) => cachedRequest('/public/games/' + encodeURIComponent(game) + '/regions', 180000),
  publicProducts: (game, region) => cachedRequest('/public/games/' + encodeURIComponent(game) + '/regions/' + encodeURIComponent(region) + '/products', 120000),
  publicProductDetail: (id, region) => {
    const q = region ? '?region=' + encodeURIComponent(region) : ''
    return cachedRequest('/public/products/' + id + q, 120000)
  },
  publicManualProducts: () => cachedRequest('/public/manual-products', 180000),
  publicAccountSellers: () => request('/public/account-sellers'),
  publicAccountSellerStore: (slug) => request('/public/account-sellers/' + encodeURIComponent(slug)),
  communityRanking: (period) => request('/community/ranking' + (period ? `?period=${encodeURIComponent(period)}` : '')),
  sellerScoreBreakdown: (sellerId, period) => {
    const q = new URLSearchParams()
    if (sellerId) q.set('seller_id', sellerId)
    if (period) q.set('period', period)
    return request('/seller/score-breakdown' + (q.toString() ? `?${q.toString()}` : ''))
  },
  games: () => cachedRequest('/games', 180000),
  regions: (game) => cachedRequest(`/games/${encodeURIComponent(game)}/regions`, 180000),
  products: (game, region) =>
    cachedRequest(`/games/${encodeURIComponent(game)}/regions/${encodeURIComponent(region)}/products`, 120000),
  productDetail: (id, region) => {
    const q = region ? `?region=${encodeURIComponent(region)}` : ''
    return cachedRequest(`/products/${id}${q}`, 120000)
  },
  verifyBuffpinAccount: (product_id, fields) => request(`/products/${encodeURIComponent(product_id)}/verify-account`, { method: "POST", body: JSON.stringify({ fields }) }),
  createOrder: (data) => {
    const seller_id = data?.seller_id || getSellerId()
    return request('/order', { method: 'POST', body: JSON.stringify(seller_id ? { ...data, seller_id } : data) })
  },
  cupPaymentSettings: () => request('/cup-payment/settings'),
  createCupOrder: (data) => request('/cup-orders', { method: 'POST', body: JSON.stringify(data) }),
  createManualCupOrder: (data) => request('/manual-cup-orders', { method: 'POST', body: JSON.stringify(data) }),
  cupOrderPaymentDetails: (orderId) => request(`/cup-orders/${encodeURIComponent(orderId)}`),
  uploadCupPaymentProof: (orderId, reference, file) => multipart(`/cup-orders/${encodeURIComponent(orderId)}/proof`, { reference }, file),
  adminCupPaymentSettingsGet: () => request('/admin/cup-payment/settings'),
  adminCupPaymentSettingsSet: (data) => request('/admin/cup-payment/settings', { method: 'POST', body: JSON.stringify(data) }),
  adminCupOrders: (payment_status = '', limit = 100) => request(`/admin/cup-orders?limit=${limit}${payment_status ? `&payment_status=${encodeURIComponent(payment_status)}` : ''}`),
  adminAutoOrders: (params = {}) => {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) qs.set(key, value) });
    return request(`/admin/automatic-orders${qs.toString() ? `?${qs}` : ''}`)
  },
  adminVerifyCupOrder: (orderId) => request(`/admin/cup-orders/${encodeURIComponent(orderId)}/verify`, { method: 'POST', body: JSON.stringify({}) }),
  adminRejectCupOrder: (orderId, reason = '') => request(`/admin/cup-orders/${encodeURIComponent(orderId)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  openCupPaymentProof: async (orderId) => {
    const res = await fetch(API_BASE + `/cup-orders/${encodeURIComponent(orderId)}/proof`, { headers: authHeaders() })
    if (!res.ok) { let body = null; try { body = await res.json() } catch {}; throw new Error(body?.detail || `Error HTTP ${res.status}`) }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
  applyReferral: (codeOrId) => request('/referrals/apply', { method: 'POST', body: JSON.stringify({ referrer_id: codeOrId, code: String(codeOrId || '') }) }),
  referralProductLink: (product_id) => request('/referral/product-link', { method: 'POST', body: JSON.stringify({ product_id }) }),
  referralTrack: (ref, product_id = null) => request('/referral/track', { method: 'POST', body: JSON.stringify({ ref, product_id }) }),
  referralMyEarnings: () => request('/referral/my-earnings'),
  adminReferralCampaigns: () => request('/admin/referral-campaigns'),
  saveReferralCampaign: (data) => request('/admin/referral-campaigns', { method: 'POST', body: JSON.stringify(data) }),
  adminReferralCommissions: (status = '', limit = 100) => request(`/admin/referral-commissions?limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`),
  cancelReferralCommission: (id, reason = '') => request(`/admin/referral-commissions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reverseReferralCommission: (id, reason = '') => request(`/admin/referral-commissions/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reviewOrder: (order_id, rating, comment = '') => request(`/orders/${encodeURIComponent(order_id)}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  reviewManualOrder: (order_id, rating, comment = '') => request(`/manual-orders/${encodeURIComponent(order_id)}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  legacyReview: (data) => request('/reviews/legacy', { method: 'POST', body: JSON.stringify(data) }),
  myOrders: () => request('/orders'),
  profile: () => request('/profile'),
  updateProfile: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  b2bLaunch: async () => ({ ok: true, csrf_token: '' }),
  createDeposit: (amount, is_checkout = false) => request('/deposits', { method: 'POST', body: JSON.stringify({ amount, is_checkout }) }),
  depositPaymentOptions: () => request('/deposits/payment-options'),
  createWhiteLabelDeposit: (amount, pay_currency, network, is_checkout = false) => request('/deposits/white-label', { method: 'POST', body: JSON.stringify({ amount, pay_currency, network, is_checkout }) }),
  createCardDeposit: (amount) => request('/deposits/card-changenow', { method: 'POST', body: JSON.stringify({ amount }) }),
  checkDeposit: (trackId) => request(`/deposits/${encodeURIComponent(trackId)}`),
  // SMS / números virtuales
  smsHealth: () => request('/sms/health'),
  smsCountries: () => request('/sms/countries'),
  smsServices: (country) => request(`/sms/services?country=${encodeURIComponent(country)}`),
  smsOperators: (country, service) => request(`/sms/operators?country=${encodeURIComponent(country)}&service=${encodeURIComponent(service)}`),
  smsOrderCreate: (data) => request('/sms/order/create', { method: 'POST', body: JSON.stringify(data) }),
  smsOrderStatus: (id) => request(`/sms/order/status?id=${encodeURIComponent(id)}`),
  smsOrderCancel: (id) => request('/sms/order/cancel', { method: 'POST', body: JSON.stringify({ id }) }),
  smsMyOrders: (limit = 50) => request(`/sms/my-orders?limit=${limit}`),
  smsAdminProfile: () => request('/admin/sms/profile'),
  smsAdminOverridesGet: () => request('/admin/sms/overrides'),
  smsAdminOverridesSet: (data) => request('/admin/sms/overrides', { method: 'POST', body: JSON.stringify(data) }),
  smsAdminOrders: (limit = 100) => request(`/admin/sms/orders?limit=${limit}`),
  smsAdminOrderSync: (id) => request(`/admin/sms/orders/${id}/sync`, { method: 'POST' }),
  smsAdminOrderCancel: (id) => request(`/admin/sms/orders/${id}/cancel`, { method: 'POST' }),
  smsSettingsGet: () => request('/sms/settings'),
  smsAdminSettingsGet: () => request('/admin/sms/settings'),
  smsAdminSettingsSet: (data) => request('/admin/sms/settings', { method: 'POST', body: JSON.stringify(data) }),
  // Streaming / StreamZone B2B
  streamingCatalog: () => request('/streaming/catalog'),
  streamingPurchase: (data) => request('/streaming/purchase', { method: 'POST', body: JSON.stringify(data) }),
  streamingMyOrders: (limit = 50) => request(`/streaming/my-orders?limit=${limit}`),
  streamingAdminProfile: () => request('/admin/streaming/profile'),
  streamingAdminCatalog: () => request('/admin/streaming/catalog'),
  streamingAdminOverride: (data) => request('/admin/streaming/override', { method: 'POST', body: JSON.stringify(data) }),
  streamingAdminSync: () => request('/admin/streaming/sync', { method: 'POST' }),
  streamingAdminOrders: (limit = 100) => request(`/admin/streaming/orders?limit=${limit}`),
  streamingB2bCatalog: () => request('/b2b/streaming/catalog'),
  streamingB2bOrder: (data) => request('/b2b/streaming/orders', { method: 'POST', body: JSON.stringify(data) }),
  // SMM / seguidores y likes
  smmSettingsGet: () => request('/smm/settings'),
  smmServices: () => request('/smm/services'),
  smmOrderCreate: (data) => request('/smm/order/create', { method: 'POST', body: JSON.stringify(data) }),
  smmMyOrders: (limit = 50) => request(`/smm/my-orders?limit=${limit}`),
  smmAdminSettingsGet: () => request('/admin/smm/settings'),
  smmAdminSettingsSet: (data) => request('/admin/smm/settings', { method: 'POST', body: JSON.stringify(data) }),
  smmAdminSync: () => request('/admin/smm/sync', { method: 'POST' }),
  smmAdminServices: () => request('/admin/smm/services'),
  smmAdminServiceUpdate: (id, data) => request(`/admin/smm/services/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(data) }),
  smmAdminOrders: (limit = 100) => request(`/admin/smm/orders?limit=${limit}`),
  smmAdminOrderSync: (id) => request(`/admin/smm/orders/${id}/sync`, { method: 'POST' }),
  // FZR / Telegram y CapCut
  fzrTelegramCatalog: () => cachedRequest('/fzr/telegram/catalog', 180000),
  fzrTelegramOrder: (data) => request('/fzr/telegram/order', { method: 'POST', body: JSON.stringify(data) }),
  fzrCapcutCatalog: () => cachedRequest('/fzr/capcut/catalog', 180000),
  fzrCapcutOrder: (data) => request('/fzr/capcut/order', { method: 'POST', body: JSON.stringify(data) }),
  fzrCatalogCategories: (providerType = '') => cachedRequest(`/fzr/catalog/categories${providerType ? `?provider_type=${encodeURIComponent(providerType)}` : ''}`, 180000),
  fzrCatalogOffers: (providerType, categoryId) => {
    if (!providerType || providerType === 'auto') {
      return cachedRequest(`/catalog/lookup/${encodeURIComponent(categoryId)}/offers`, 120000)
    }
    return cachedRequest(`/fzr/catalog/${encodeURIComponent(providerType)}/${encodeURIComponent(categoryId)}/offers`, 120000)
  },
  fzrCatalogOrder: (data) => request('/fzr/catalog/order', { method: 'POST', body: JSON.stringify(data) }),
  fzrCatalogCupOptions: (data) => request('/fzr/catalog/cup-options', { method: 'POST', body: JSON.stringify(data) }),
  fzrCatalogCupOrder: (data) => request('/fzr/catalog/cup-order', { method: 'POST', body: JSON.stringify(data) }),
  fzrMyOrders: (limit = 50) => request(`/fzr/my-orders?limit=${limit}`),
  fzrAdminSettingsGet: () => request('/admin/fzr/settings'),
  fzrAdminSettingsSet: (data) => request('/admin/fzr/settings', { method: 'POST', body: JSON.stringify(data) }),
  fzrAdminOrders: (limit = 100) => request(`/admin/fzr/orders?limit=${limit}`),
  fzrAdminCatalog: (providerType = '') => request(`/admin/fzr/catalog${providerType ? `?provider_type=${encodeURIComponent(providerType)}` : ''}`),
  fzrAdminCatalogSync: (providerTypes = ['topup', 'giftcard', 'gamekey', 'manual']) => { clearCatalogCache(); return request('/admin/fzr/catalog/sync', { method: 'POST', body: JSON.stringify({ provider_types: providerTypes }) }) },
  fzrAdminCatalogOffers: (providerType, categoryId) => request(`/admin/fzr/catalog/${encodeURIComponent(providerType)}/${encodeURIComponent(categoryId)}/offers`),
  fzrAdminCatalogOffersSync: (providerType, categoryId) => { clearCatalogCache(); return request(`/admin/fzr/catalog/${encodeURIComponent(providerType)}/${encodeURIComponent(categoryId)}/offers/sync`, { method: 'POST' }) },
  fzrAdminCatalogMappingSet: (providerType, categoryId, data) => { clearCatalogCache(); return request(`/admin/fzr/catalog/${encodeURIComponent(providerType)}/${encodeURIComponent(categoryId)}/mapping`, { method: 'PUT', body: JSON.stringify(data) }) },
  // Auth
  register: (email, password, name, referral_code = null) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, referral_code }) }),
  login: async (email, password) => {
    const d = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (d.token) {
      setToken(d.token)
      clearCatalogCache()
    }
    return d
  },
  loginWithGoogle: async (credential) => {
    const d = await request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) })
    if (d.token) {
      setToken(d.token)
      clearCatalogCache()
    }
    return d
  },
  loginWithTelegram: async (authData) => {
    const d = await request('/auth/telegram', { method: 'POST', body: JSON.stringify(authData) })
    if (d.token) {
      setToken(d.token)
      clearCatalogCache()
    }
    return d
  },
  requestTelegramToken: async () => {
    return await request('/auth/telegram/request-token', { method: 'POST' })
  },
  checkTelegramToken: async (token) => {
    const d = await request(`/auth/telegram/check-token?token=${encodeURIComponent(token)}`)
    if (d.token) {
      setToken(d.token)
      clearCatalogCache()
    }
    return d
  },
  logout: async () => {
    await request('/auth/logout', { method: 'POST' }).catch(() => {})
    clearToken()
    clearCatalogCache()
  },
  verifyEmail: (email, code) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
  resendEmailVerification: (email) =>
    request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email, code, new_password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, new_password }) }),
  linkTelegram: () => request('/auth/link-telegram', { method: 'POST' }),
  changePassword: (current_password, new_password) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  // Manual products
  manualProducts: () => request('/manual-products'),
  manualProduct: (id) => request(`/manual-products/${id}`),
  buyManualProduct: (product_id, option_id = null, customer_data = {}, referral_code = null) =>
    request('/manual-orders', { method: 'POST', body: JSON.stringify({ product_id, option_id, customer_data, referral_code }) }),
  myManualOrders: () => request('/my-manual-orders'),
  manualOrderCase: (order_id) => request(`/manual-orders/${encodeURIComponent(order_id)}/case`),
  escalateManualCase: (order_id, reason = '') => request(`/manual-orders/${encodeURIComponent(order_id)}/case/escalate`, { method: 'POST', body: JSON.stringify({ reason }) }),
  markCaseRead: (order_id) => request(`/manual-orders/${encodeURIComponent(order_id)}/case/read`, { method: 'POST', body: '{}' }),
  markAdminCaseRead: (order_id) => request(`/admin/manual-orders/${encodeURIComponent(order_id)}/case/read`, { method: 'POST', body: '{}' }),
  sendManualCaseMessage: (order_id, message) => request(`/manual-orders/${encodeURIComponent(order_id)}/case/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  uploadCaseFile: (order_id, file) => upload(`/manual-orders/${encodeURIComponent(order_id)}/case/upload`, file),
  // Admin
  sellerDashboard: () => request('/admin/seller-dashboard'),
  sellerRechargeDashboard: () => request('/seller/recharge-dashboard'),
  resellerPricingPreview: () => request('/reseller/pricing-preview'),
  resellerApiKeys: () => request('/reseller/api-keys'),
  createResellerApiKey: (data) => request('/reseller/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  rotateResellerApiKey: (id) => request('/reseller/api-keys/' + encodeURIComponent(id) + '/rotate', { method: 'POST', body: '{}' }),
  revokeResellerApiKey: (id) => request('/reseller/api-keys/' + encodeURIComponent(id), { method: 'DELETE' }),
  resellerWebhooks: () => request('/reseller/webhooks'),
  createResellerWebhook: (data) => request('/reseller/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  rotateResellerWebhook: (id) => request('/reseller/webhooks/' + encodeURIComponent(id) + '/rotate', { method: 'POST', body: '{}' }),
  disableResellerWebhook: (id) => request('/reseller/webhooks/' + encodeURIComponent(id), { method: 'DELETE' }),
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
  masterCatalogTree: () => request('/catalog/master-tree'),
  catalogOffers: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/catalog/offers${qs.toString() ? `?${qs}` : ''}`)
  },
  adminMasterCatalogAll: () => request('/admin/catalog/master-all'),
  adminCreateMasterCategory: (data) => request('/admin/catalog/master-categories', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateMasterCategory: (id, data) => request(`/admin/catalog/master-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeleteMasterCategory: (id) => request(`/admin/catalog/master-categories/${id}`, { method: 'DELETE' }),
  adminCreateMasterSubcategory: (data) => request('/admin/catalog/master-subcategories', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateMasterSubcategory: (id, data) => request(`/admin/catalog/master-subcategories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeleteMasterSubcategory: (id) => request(`/admin/catalog/master-subcategories/${id}`, { method: 'DELETE' }),
  adminCreateMasterPackage: (data) => request('/admin/catalog/master-packages', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateMasterPackage: (id, data) => request(`/admin/catalog/master-packages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeleteMasterPackage: (id) => request(`/admin/catalog/master-packages/${id}`, { method: 'DELETE' }),
  adminManualOrderDetail: (order_id) => request(`/admin/manual-orders/${order_id}`),
  adminManualOrderCase: (order_id) => request(`/admin/manual-orders/${order_id}/case`),
  adminManualCases: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/admin/manual-order-cases${qs.toString() ? `?${qs}` : ''}`)
  },
  sendAdminManualCaseMessage: (order_id, message, is_internal_note = false) => request(`/admin/manual-orders/${order_id}/case/messages`, { method: 'POST', body: JSON.stringify({ message, is_internal_note }) }),
  requestAdminManualCaseReview: (order_id) => request(`/admin/manual-orders/${order_id}/case/request-review`, { method: 'POST', body: '{}' }),
  uploadAdminCaseFile: (order_id, file) => upload(`/admin/manual-orders/${encodeURIComponent(order_id)}/case/upload`, file),
  updateAdminManualCaseStatus: (order_id, status, message = '') => request(`/admin/manual-orders/${order_id}/case/status`, { method: 'POST', body: JSON.stringify({ status, message }) }),
  adminReplaceCaseStock: (order_id) => request(`/admin/manual-orders/${order_id}/case/replace-stock`, { method: 'POST' }),
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
  adminProviderPrices: (gameName = '', region = '') => {
    const qs = new URLSearchParams()
    if (gameName) qs.set('game_name', gameName)
    if (region) qs.set('region', region)
    return request(`/admin/provider-prices${qs.toString() ? `?${qs}` : ''}`)
  },
  adminGameIcons: () => request('/admin/game-icons'),
  updateGameIcon: (data) => request('/admin/game-icons', { method: 'POST', body: JSON.stringify(data) }),
  refreshBuffpinProducts: () => request('/admin/buffpin-refresh', { method: 'POST', body: JSON.stringify({}) }),
  restoreProductOverride: (product_id) => request('/admin/product-overrides/' + encodeURIComponent(product_id) + '/restore', { method: 'POST', body: JSON.stringify({}) }),
  resellerSettings: () => request('/admin/reseller-settings'),
  updateResellerSettings: (reseller_min_deposit) => request('/admin/reseller-settings', { method: 'POST', body: JSON.stringify({ reseller_min_deposit }) }),
  resellerCatalogPermissions: (user_id) => request(`/admin/reseller-catalog-permissions/${encodeURIComponent(user_id)}`),
  updateResellerCatalogPermissions: (data) => request('/admin/reseller-catalog-permissions', { method: 'POST', body: JSON.stringify(data) }),
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
  adminUsers: (params = {}) => {
    const normalized = typeof params === 'string' ? { q: params } : params
    const qs = new URLSearchParams()
    Object.entries(normalized || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') qs.set(key, value)
    })
    return request(`/admin/users${qs.toString() ? `?${qs}` : ''}`)
  },
  adminUserDetail: (user_id) => request(`/admin/users/${user_id}`),
  adminEmailCampaigns: () => request('/admin/email-campaigns'),
  adminEmailRecipientCount: (audience = 'all') => request(`/admin/email-campaigns/recipient-count?audience=${encodeURIComponent(audience)}`),
  createAdminEmailCampaign: (data) => request('/admin/email-campaigns', { method: 'POST', body: JSON.stringify(data) }),
  testAdminEmailCampaign: (data) => request('/admin/email-campaigns/test', { method: 'POST', body: JSON.stringify(data) }),
  sendAdminEmailCampaign: (id) => request(`/admin/email-campaigns/${id}/send`, { method: 'POST', body: JSON.stringify({}) }),
  adminEmailCampaignAction: (id, action) => request(`/admin/email-campaigns/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
  adjustUserBalance: (user_id, amount, note) => request('/admin/users/balance', { method: 'POST', body: JSON.stringify({ user_id, amount, note }) }),
  updateUserRole: (user_id, role, extra = {}) => request('/admin/users/role', { method: 'POST', body: JSON.stringify({ user_id, role, ...extra }) }),
  updateUserBan: (user_id, is_banned, reason = '') => request('/admin/users/ban', { method: 'POST', body: JSON.stringify({ user_id, is_banned, reason }) }),
  updateUserNote: (user_id, internal_note, risk_tag = '') => request('/admin/users/note', { method: 'POST', body: JSON.stringify({ user_id, internal_note, risk_tag }) }),
  mergeUsers: (data) => request('/admin/users/merge', { method: 'POST', body: JSON.stringify(data) }),
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
  sellerCategoryPermissions: () => request('/seller/category-permissions'),
  sellerManagerMessages: () => request('/seller/manager/messages'),
  sendSellerManagerMessage: (data) => request('/seller/manager/messages', { method: 'POST', body: JSON.stringify(data) }),
  requestSellerCategoryPermission: (data) => request('/seller/category-requests', { method: 'POST', body: JSON.stringify(data) }),
  adminSellerPermissions: () => request('/admin/seller-permissions'),
  adminToggleSellerPermission: (data) => request('/admin/seller-permissions/toggle', { method: 'POST', body: JSON.stringify(data) }),
  adminSellerDetail: (user_id) => request(`/admin/sellers/${user_id}`),
  addSeller: (user_id, max_products, commission_pct = 0, notes = '', can_sell_recharges = false, recharge_commission_pct = 50, store_name = '') => request('/admin/sellers', { method: 'POST', body: JSON.stringify({ user_id, max_products, commission_pct, notes, can_sell_recharges, recharge_commission_pct, store_name }) }),
  updateSeller: (user_id, data) => request(`/admin/sellers/${user_id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeSeller: (user_id) => request(`/admin/sellers/${user_id}`, { method: 'DELETE' }),
  adminReviews: (limit = 100) => request(`/admin/reviews?limit=${limit}`),
  adminAudit: (limit = 50) => request(`/admin/audit?limit=${limit}`),
  adminAuditSearch: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') qs.set(key, value) })
    return request(`/admin/audit/search${qs.toString() ? `?${qs}` : ''}`)
  },
  // Promociones / Banners de Home
  promotions: () => request('/promotions'),
  adminPromotions: () => request('/admin/promotions'),
  adminCreatePromotion: (data) => request('/admin/promotions', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdatePromotion: (id, data) => request(`/admin/promotions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeletePromotion: (id) => request(`/admin/promotions/${id}`, { method: 'DELETE' }),
  adminTogglePromotion: (id) => request(`/admin/promotions/${id}/toggle`, { method: 'POST' }),
  uploadPromotionImage: (file) => upload('/admin/promotions/upload-image', file),
  // Asistente IA / soporte híbrido
  aiChatSession: () => request('/ai-chat/session'),
  aiChatMessage: (message) => request('/ai-chat/message', { method: 'POST', body: JSON.stringify({ message }) }),
  aiChatHandoff: (message = '') => request('/ai-chat/handoff', { method: 'POST', body: JSON.stringify({ message }) }),
  aiChatReset: () => request('/ai-chat/reset', { method: 'POST' }),
  aiAdminSettingsGet: () => request('/admin/ai/settings'),
  aiAdminSettingsSet: (data) => request('/admin/ai/settings', { method: 'POST', body: JSON.stringify(data) }),
  aiAdminTest: (data) => request('/admin/ai/test', { method: 'POST', body: JSON.stringify(data) }),
  // Configuración SMTP Gmail & Notificaciones
  getAdminSmtpSettings: () => request('/admin/smtp/settings'),
  saveAdminSmtpSettings: (data) => request('/admin/smtp/settings', { method: 'POST', body: JSON.stringify(data) }),
  testAdminSmtpSettings: (data) => request('/admin/smtp/test', { method: 'POST', body: JSON.stringify(data) }),
  // Soporte y Chats Unificados
  getInbox: () => request('/inbox'),
  createSupportTicket: (data) => request('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
  getChatMessages: (room_id) => request(`/chats/rooms/${room_id}/messages`),
  sendChatMessage: (room_id, message_text, attachment_url = null, attachment_type = null) => request(`/chats/rooms/${room_id}/messages`, { method: 'POST', body: JSON.stringify({ message_text, attachment_url, attachment_type }) }),
  markChatRoomRead: (room_id) => request(`/chats/rooms/${room_id}/read`, { method: 'POST', body: '{}' }),
  createDirectChat: (seller_id) => request('/chats/rooms/direct', { method: 'POST', body: JSON.stringify({ seller_id }) }),
  uploadChatFile: (room_id, file) => upload(`/chats/rooms/${room_id}/upload`, file),
  getAdminChatContacts: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    return request(`/admin/chat/contacts${qs.toString() ? '?' + qs.toString() : ''}`)
  },
  adminListTickets: (status = '') => request(`/admin/support/tickets${status ? '?status=' + encodeURIComponent(status) : ''}`),
  adminGetTicket: (ticket_id) => request(`/admin/support/tickets/${ticket_id}`),
  adminUpdateTicketStatus: (ticket_id, status) => request(`/admin/support/tickets/${ticket_id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  // B2B Auto-Redeem / GamsGo
  b2bValidateCode: (code) => request('/b2b/validate-code', { method: 'POST', body: JSON.stringify({ code }) }),
  b2bRedeem: (code, target) => request('/b2b/redeem', { method: 'POST', body: JSON.stringify({ code, target }) }),
  b2bSupportRequest: (data) => request('/b2b/support-request', { method: 'POST', body: JSON.stringify(data) }),
  b2bAdminGetCodes: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') qs.set(key, value) })
    return request(`/b2b/admin/codes${qs.toString() ? `?${qs}` : ''}`)
  },
  b2bAdminGenerate: (data) => request('/b2b/admin/generate', { method: 'POST', body: JSON.stringify(data) }),
  b2bAdminCancelCode: (id) => request(`/b2b/admin/codes/${id}/cancel`, { method: 'POST' }),
  b2bAdminDeleteCode: (id) => request(`/b2b/admin/codes/${id}`, { method: 'DELETE' }),
  // Tiendas Web para Revendedores (Multi-Tenant)
  getPublicWebStore: (identifier) => request(`/public/web-store/${encodeURIComponent(identifier)}`),
  getWebStoreCatalog: (slug) => request(`/public/web-store/${encodeURIComponent(slug)}/catalog`),
  getWebStoreGameProducts: (slug, game, region, category) => {
    const params = new URLSearchParams()
    if (region) params.set('region', region)
    if (category) params.set('category', category)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request(`/public/web-store/${encodeURIComponent(slug)}/games/${encodeURIComponent(game)}/products${qs}`)
  },
  getWebStoreSmsCountries: (slug) => request(`/public/web-store/${encodeURIComponent(slug)}/sms/countries`),
  getWebStoreSmsServices: (slug, country) => request(`/public/web-store/${encodeURIComponent(slug)}/sms/services?country=${encodeURIComponent(country)}`),
  getWebStoreSmsOperators: (slug, country, service) => request(`/public/web-store/${encodeURIComponent(slug)}/sms/operators?country=${encodeURIComponent(country)}&service=${encodeURIComponent(service)}`),
  getWebStoreSmsOrderStatus: (slug, id) => request(`/public/web-store/${encodeURIComponent(slug)}/sms/order/status?id=${encodeURIComponent(id)}`),
  cancelWebStoreSmsOrder: (slug, id) => request(`/public/web-store/${encodeURIComponent(slug)}/sms/order/cancel`, { method: 'POST', body: JSON.stringify({ id }) }),
  createWebStoreSmsOrder: (slug, data) => request(`/public/web-store/${encodeURIComponent(slug)}/sms/order/create`, { method: 'POST', body: JSON.stringify(data) }),
  getWebStoreManualProducts: (slug, all = false) => request(`/public/web-store/${encodeURIComponent(slug)}/manual-products${all ? '?all=true' : ''}`),
  getWebStoreOrders: (slug, query = '') => request(`/public/web-store/${encodeURIComponent(slug)}/orders${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getWebStoreCustomers: (slug) => request(`/public/web-store/${encodeURIComponent(slug)}/customers`),
  createWebStoreOrder: (slug, data) => request(`/public/web-store/${encodeURIComponent(slug)}/create-order`, { method: 'POST', body: JSON.stringify(data) }),
  createWebStoreDeposit: (slug, data) => request(`/public/web-store/${encodeURIComponent(slug)}/deposit`, { method: 'POST', body: JSON.stringify(data) }),
  getMyWebStore: () => request('/reseller/my-web-store'),
  saveMyWebStore: (data) => request('/reseller/my-web-store/save', { method: 'POST', body: JSON.stringify(data) }),
  testWebStoreSmtp: (data) => request('/reseller/my-web-store/test-smtp', { method: 'POST', body: JSON.stringify(data) }),
  setupWebStoreTelegramBot: (data) => request('/reseller/my-web-store/setup-telegram-bot', { method: 'POST', body: JSON.stringify(data) }),
  disconnectWebStoreTelegramBot: () => request('/reseller/my-web-store/disconnect-telegram-bot', { method: 'POST' }),
  uploadWebStoreImage: (file) => upload('/reseller/my-web-store/upload-image', file),
  getResellerCatalogGames: () => request('/reseller/my-web-store/catalog-games'),
  subscribeMyWebStore: (plan, billing_cycle = 'monthly', extra = {}) => request('/reseller/my-web-store/subscribe', { method: 'POST', body: JSON.stringify({ plan, billing_cycle, ...(extra || {}) }) }),
  getMyWebStoreCustomers: () => request('/reseller/my-web-store/customers'),
  getMyWebStoreManualProducts: (storeSlug = null) => request(`/reseller/my-web-store/manual-products${storeSlug ? `?store_slug=${encodeURIComponent(storeSlug)}` : ''}`),
  createWebStoreManualProduct: (data) => request('/reseller/my-web-store/manual-products', { method: 'POST', body: JSON.stringify(data) }),
  updateWebStoreManualProduct: (id, data) => request(`/reseller/my-web-store/manual-products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWebStoreManualProduct: (id) => request(`/reseller/my-web-store/manual-products/${id}`, { method: 'DELETE' }),
  adminListWebStores: () => request('/admin/web-stores'),
  adminExtendWebStore: (storeId, days = 30) => request(`/admin/web-stores/${storeId}/extend?days=${days}`, { method: 'POST' }),
  // Billetera FranchoCoin & Ecosistema
  getWalletMovements: (limit = 30) => request(`/wallet/movements?limit=${limit}`),
  resolveWalletRecipient: (query) => request(`/wallet/recipient?query=${encodeURIComponent(query)}`),
  transferWalletBalance: (data) => request('/wallet/transfer', { method: 'POST', body: JSON.stringify(data) }),
  getWalletWithdrawals: (limit = 50) => request(`/wallet/withdrawals?limit=${limit}`),
  requestWalletWithdrawal: (data) => request('/wallet/withdraw', { method: 'POST', body: JSON.stringify(data) }),
  adminListWalletWithdrawals: (status = '') => request(`/admin/wallet-withdrawals${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  adminDecideWalletWithdrawal: (wid, decision, txid = '', note = '') => request(`/admin/wallet-withdrawals/${wid}/decide`, { method: 'POST', body: JSON.stringify({ decision, txid, note }) }),
  // VIP Subscriptions
  getVipPlans: () => request('/vip/plans'),
  getVipStatus: () => request('/vip/status'),
  subscribeVip: (plan_id) => request('/vip/subscribe', { method: 'POST', body: JSON.stringify({ plan_id }) }),
  // KYC Verification
  getKycStatus: () => request('/kyc/status'),
  uploadKycImage: (file, docType = 'document') => upload(`/kyc/upload?doc_type=${encodeURIComponent(docType)}`, file),
  submitKyc: (data) => request('/kyc/submit', { method: 'POST', body: JSON.stringify(data) }),
  adminListKyc: (status = '') => request(`/admin/kyc/requests${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  adminReviewKyc: (kycId, decision, reason = '') => request(`/admin/kyc/${kycId}/review`, { method: 'POST', body: JSON.stringify({ decision, reason }) }),
  // Cripto Swap Multi-Cadena & Bridge (ChangeNOW / Uniswap)
  getSwapAssets: () => request('/swap/assets'),
  getSwapEstimate: (params) => request(`/swap/estimate?fromNetwork=${encodeURIComponent(params.fromNetwork)}&fromToken=${encodeURIComponent(params.fromToken)}&toNetwork=${encodeURIComponent(params.toNetwork)}&toToken=${encodeURIComponent(params.toToken)}&amountIn=${encodeURIComponent(params.amountIn)}`),
  createSwapOrder: (data) => request('/swap/order', { method: 'POST', body: JSON.stringify(data) }),
  getSwapOrder: (orderId) => request(`/swap/order/${encodeURIComponent(orderId)}`),
  getSwapHistory: (limit = 20) => request(`/swap/history?limit=${limit}`),
  // VPN & WireGuard QR
  getVpnQr: (conf) => request('/vpn/qr', { method: 'POST', body: JSON.stringify({ conf }) }),
  // Cache sync getters
  getCachedData: (path) => getCachedData(path),
  getCachedCatalogOffers: (providerType, categoryId) => getCachedData(`/fzr/catalog/${encodeURIComponent(providerType)}/${encodeURIComponent(categoryId)}/offers`),
  getCachedCatalogCategories: () => getCachedData('/fzr/catalog/categories'),
  getCachedProducts: (game, region) => (
    getCachedData(`/games/${encodeURIComponent(game)}/regions/${encodeURIComponent(region || '')}/products`) ||
    getCachedData(`/public/games/${encodeURIComponent(game)}/regions/${encodeURIComponent(region || '')}/products`) ||
    getCachedData(`/products?game=${encodeURIComponent(game)}&region=${encodeURIComponent(region || '')}`) ||
    getCachedData(`/public/products?game=${encodeURIComponent(game)}&region=${encodeURIComponent(region || '')}`)
  ),
  getCachedManualProducts: () => getCachedData('/manual-products') || getCachedData('/public/manual-products'),
  // Helpers
  isLoggedIn: () => !!(tg?.initData || getToken()),
  isTelegram: () => !!(tg && tg.platform && tg.platform !== 'unknown'),
  clearSession: () => { clearToken(); clearCatalogCache(); },
}
export { request, tg, setSellerId, getSellerId, clearCatalogCache, prefetchCatalog, getCachedData }
export default api
