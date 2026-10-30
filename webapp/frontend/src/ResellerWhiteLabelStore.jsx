import React, { useState, useEffect, useRef } from 'react'
import {
  Gamepad2, Search, Zap, ShieldCheck, MessageCircle, Send,
  CreditCard, Check, Copy, ExternalLink, ChevronRight, X, Bot,
  ShoppingBag, Sparkles, AlertCircle, CheckCircle2, Phone, Mail,
  ArrowRight, Flame, Globe2, ShieldAlert, Palette, Plus, Trash2,
  Edit3, Sliders, User, LogIn, LogOut, Settings, Package, Tag,
  Clock, RefreshCw, ChevronDown, CheckCheck, Eye, EyeOff, Save,
  Layers, Lock, Image as ImageIcon, Key, Crown, HelpCircle, Gift,
  Smartphone, ArrowLeft, ChevronLeft, Store, KeyRound, PackageOpen,
  Star, Minus, Boxes, Loader2, Share2, Wallet, CircleCheck, CircleX, Upload,
  ClipboardList, Headphones, LockKeyhole, Filter, CheckCircle, Tv,
  Percent, RotateCcw, QrCode, Bell, FileText, Globe, Info, Users
} from 'lucide-react'
import api from './api/client'
import ColorBarPicker from './ColorBarPicker'

const smsCountryIconUrl = (country = {}) => {
  if (country.icon_url) return toFastImageUrl(country.icon_url)
  const iso = String(country.iso || '').toLowerCase()
  return iso ? toFastImageUrl(`https://flagcdn.com/w80/${iso}.png`) : ''
}

const smsServiceIconSlug = (name = '') => {
  const raw = String(name || '').toLowerCase()
  const aliases = [
    ['whatsapp', 'whatsapp'], ['telegram', 'telegram'], ['google', 'google'], ['gmail', 'google'],
    ['facebook', 'facebook'], ['instagram', 'instagram'], ['tiktok', 'tiktok'], ['twitter', 'x'],
    ['x', 'x'], ['discord', 'discord'], ['paypal', 'paypal'], ['amazon', 'amazon'],
    ['microsoft', 'microsoft'], ['apple', 'apple'], ['uber', 'uber'], ['netflix', 'netflix'],
    ['spotify', 'spotify'], ['steam', 'steam'], ['openai', 'openai'], ['chatgpt', 'openai'],
    ['snapchat', 'snapchat'], ['linkedin', 'linkedin'], ['tinder', 'tinder'], ['line', 'line'],
    ['viber', 'viber'], ['vk', 'vk'], ['wechat', 'wechat'], ['airbnb', 'airbnb'],
    ['aliexpress', 'aliexpress'], ['alibaba', 'alibaba'], ['ebay', 'ebay'], ['yahoo', 'yahoo'],
    ['reddit', 'reddit'], ['twitch', 'twitch'], ['roblox', 'roblox'], ['binance', 'binance'],
    ['coinbase', 'coinbase'], ['bybit', 'bybit'], ['youtube', 'youtube']
  ]
  const found = aliases.find(([needle]) => raw.includes(needle))
  if (found) return found[1]
  return raw.replace(/[^a-z0-9]+/g, '')
}

const smsServiceIconUrl = (service = {}) => {
  if (service.icon_url && typeof service.icon_url === 'string') {
    return toFastImageUrl(service.icon_url)
  }
  const slug = smsServiceIconSlug(service.slug || service.name || service.key)
  if (!slug) return ''
  if (slug === 'openai' || slug === 'amazon') {
    return toFastImageUrl(`https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/${slug}.svg`)
  }
  return toFastImageUrl(`https://cdn.simpleicons.org/${slug}`)
}

const B2B_STORE_ORIGIN = 'https://franchoshop.com'
const isNativeB2BApp = () => {
  try { return Boolean(window.Capacitor?.isNativePlatform?.()) } catch { return false }
}

export function toFastImageUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  const normalized = trimmed.replace(/^https?:\/{3,}/, '/')
  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) return normalized
  if (normalized.startsWith('/')) return isNativeB2BApp() ? `${B2B_STORE_ORIGIN}${normalized}` : normalized
  if (normalized.includes('/api/image-cache') || normalized.includes('/api/image-proxy')) return normalized
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return isNativeB2BApp() ? normalized : `/api/image-cache?url=${encodeURIComponent(normalized)}`
  }
  return isNativeB2BApp() ? `${B2B_STORE_ORIGIN}/${normalized}` : normalized
}

export function OptimizedImage({
  src,
  alt = '',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
  fallbackEmoji = null,
  fallbackSrc = null,
  style = {},
  onError = null,
  onLoad = null
}) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (!src || error) {
    if (fallbackSrc && !error) {
      return (
        <img
          src={toFastImageUrl(fallbackSrc)}
          alt={alt}
          className={className}
          loading={loading}
          decoding={decoding}
          style={style}
          onError={(e) => {
            setError(true)
            if (onError) onError(e)
          }}
          onLoad={(e) => {
            setLoaded(true)
            if (onLoad) onLoad(e)
          }}
        />
      )
    }
    if (fallbackEmoji) {
      return (
        <span className={`flex h-full w-full items-center justify-center select-none ${className}`}>
          {fallbackEmoji}
        </span>
      )
    }
    return null
  }

  const fastSrc = toFastImageUrl(src)

  return (
    <img
      src={fastSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onLoad={(e) => {
        setLoaded(true)
        if (onLoad) onLoad(e)
      }}
      onError={(e) => {
        setError(true)
        if (onError) onError(e)
      }}
      className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-90'}`}
      style={style}
    />
  )
}

function SmsIcon({ src, fallback, className = '', fit = 'cover' }) {
  const [bad, setBad] = useState(false)
  if (src && !bad) {
    return (
      <img
        src={toFastImageUrl(src)}
        alt=""
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${fit === 'contain' ? 'object-contain p-1.5' : 'object-cover'} ${className}`}
        onError={() => setBad(true)}
      />
    )
  }
  return <span className={`flex h-full w-full items-center justify-center ${className}`}>{fallback || <Smartphone className="h-4 w-4 text-emerald-500" />}</span>
}

function cleanFzrPackageName(name) {
  if (!name) return ''
  let s = name.replace(/^(?:[\p{Extended_Pictographic}\u2600-\u27BF\uFE0F\u200D\s·–—\-]|[\uD83C-\uDBFF\uDC00-\uDFFF])+/u, '').trim() || name
  if (s.includes('_') && !s.includes(' ')) {
    const specialMap = {
      'free_fire_diamond_pins_eu_tr': 'Free Fire Diamond Pins (EU + TR)',
      'free_fire_diamond_pins': 'Free Fire Diamond Pins',
      'free_fire_diamonds': 'Free Fire Diamantes',
      'mobile_legends': 'Mobile Legends',
      'blood_strike': 'Blood Strike',
      'pubg_mobile': 'PUBG Mobile',
      'call_of_duty_mobile': 'Call of Duty: Mobile'
    }
    if (specialMap[s.toLowerCase()]) return specialMap[s.toLowerCase()]
    return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  return s
}

export default function ResellerWhiteLabelStore({
  activeWebStore,
  me,
  onUpdateMe,
  onUpdateStore,
  onGoToPanel
}) {
  const store = activeWebStore || {}

  // Caché en memoria de alto rendimiento para juegos y SMS (0ms latencia)
  const gameProductsCache = useRef(new Map())
  const smsServicesCache = useRef(new Map())

  // ─── ESTADOS DE AUTENTICACIÓN Y NAVEGACIÓN ─────────────────────
  const [activeView, setActiveView] = useState('store') // 'store' | 'orders' | 'profile' | 'sms'
  const [currentUser, setCurrentUser] = useState(me || null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('10')
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositError, setDepositError] = useState('')
  const [depositResult, setDepositResult] = useState(null)
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false)
  const [profileEditName, setProfileEditName] = useState('')
  const [profileEditEmail, setProfileEditEmail] = useState('')
  const [profileEditSaving, setProfileEditSaving] = useState(false)
  const [profileEditMsg, setProfileEditMsg] = useState(null)

  // Estados de cambio de contraseña en Perfil
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdMsg, setPwdMsg] = useState(null)
  const [pwdLoading, setPwdLoading] = useState(false)

  // Sincronizar con prop `me`
  useEffect(() => {
    if (me) setCurrentUser(me)
  }, [me])

  // ─── INICIALIZACIÓN DE TELEGRAM MINI APP SDK ─────────────────
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        const tg = window.Telegram.WebApp
        setIsTelegramMiniApp(Boolean(tg.initData))
        tg.ready()
        tg.expand()
        if (tg.setHeaderColor) tg.setHeaderColor('#0b0f19')
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0b0f19')
      } catch (err) {
        console.warn('Error inicializando Telegram WebApp:', err)
      }
    }
  }, [])

  // Comprobar si el usuario conectado es el dueño o admin
  const isOwner = Boolean(
    currentUser &&
    (
      Number(currentUser.user_id) === Number(store.user_id) ||
      Number(currentUser.id) === Number(store.user_id) ||
      currentUser.role === 'admin'
    )
  )

  const [clientPreviewMode, setClientPreviewMode] = useState(false)
  const showOwnerTools = isOwner && !clientPreviewMode

  // ─── ESTADOS DE PERSONALIZACIÓN VISUAL (EN TIEMPO REAL) ──────
  const [primaryColor, setPrimaryColor] = useState(store.primary_color || '#ffff00')
  const [secondaryColor, setSecondaryColor] = useState(store.secondary_color || '#3B82F6')
  const [bgStyle, setBgStyle] = useState(store.bg_style || 'midnight')
  const [storeName, setStoreName] = useState(store.store_name || 'Mi Tienda')
  const [tagline, setTagline] = useState(store.tagline || 'Recargas automáticas 24/7')
  const [logoUrl, setLogoUrl] = useState(store.logo_url || '')
  const [whatsappNumber, setWhatsappNumber] = useState(store.whatsapp_number || '')
  const [telegramUsername, setTelegramUsername] = useState(store.telegram_username || '')
  const [contactEmail, setContactEmail] = useState(store.contact_email || '')
  const [instagramUrl, setInstagramUrl] = useState(store.instagram_url || '')

  // ─── ESTADOS DE GANANCIAS (MÁRGENES %) ─────────────────────────
  const [markupPercent, setMarkupPercent] = useState(Number(store.markup_percent || 10.0))
  const [gameMarkups, setGameMarkups] = useState(store.game_markups || {})
  const [markupGameSearch, setMarkupGameSearch] = useState('')
  const [markupCategoryFilter, setMarkupCategoryFilter] = useState('all') // 'all' | 'topup' | 'giftcard' | 'streaming' | 'custom'
  const [markupPage, setMarkupPage] = useState(1)
  const MARKUP_ITEMS_PER_PAGE = 15
  const [allCatalogGames, setAllCatalogGames] = useState([])
  const [loadingAllCatalogGames, setLoadingAllCatalogGames] = useState(false)
  const [simGameName, setSimGameName] = useState('Free Fire')
  const [simCost, setSimCost] = useState(1.0)

  // ─── ESTADOS DE NÚMEROS VIRTUALES SMS (CONFIG) ──────────────────
  const [smsConfig, setSmsConfig] = useState(store.sms_config || store.theme_config?.sms_config || {
    enabled: true,
    markup_percent: 15.0,
    display_name: '📱 Números Virtuales (SMS)',
    category_logo_url: ''
  })
  const [uploadingSmsLogo, setUploadingSmsLogo] = useState(false)

  // ─── ESTADOS DE BOT DE TELEGRAM & NOTIFICACIONES ───────────────
  const [botToken, setBotToken] = useState(store.telegram_bot_token || '')
  const [botUsername, setBotUsername] = useState(store.telegram_bot_username || '')
  const [botActive, setBotActive] = useState(Boolean(store.telegram_bot_active))
  const [storeMode, setStoreMode] = useState(store.store_mode || 'both')
  const [notificationPrefs, setNotificationPrefs] = useState(store.notification_prefs || {
    notify_telegram: true,
    notify_email: true
  })
  const [connectingBot, setConnectingBot] = useState(false)
  const [disconnectingBot, setDisconnectingBot] = useState(false)

  // Configuración de Correo / Gmail SMTP del Revendedor
  const initialEmailConfig = store.email_config || {}
  const [emailConfig, setEmailConfig] = useState({
    enabled: Boolean(initialEmailConfig.enabled ?? true),
    smtp_user: initialEmailConfig.smtp_user || store.contact_email || '',
    smtp_app_password: initialEmailConfig.smtp_app_password || '',
    sender_name: initialEmailConfig.sender_name || store.store_name || '',
    notify_on_order: Boolean(initialEmailConfig.notify_on_order ?? true),
    notify_client_receipt: Boolean(initialEmailConfig.notify_client_receipt ?? true),
    notify_client_delivery: Boolean(initialEmailConfig.notify_client_delivery ?? true),
  })
  const [showAppPassword, setShowAppPassword] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [showSmtpGuide, setShowSmtpGuide] = useState(false)

  const handleTestSmtp = async () => {
    const userEmail = (emailConfig.smtp_user || contactEmail || '').trim()
    const pass = (emailConfig.smtp_app_password || '').trim()
    if (!userEmail || !userEmail.includes('@')) {
      return showToast('error', 'Por favor ingresa tu correo Gmail antes de probar.')
    }
    if (!pass || pass.replace(/\s+/g, '').length < 14) {
      return showToast('error', 'Por favor ingresa tu contraseña de aplicación de 16 caracteres de Google.')
    }
    setTestingSmtp(true)
    try {
      const res = await api.testWebStoreSmtp({
        smtp_user: userEmail,
        smtp_app_password: pass,
        sender_name: (emailConfig.sender_name || storeName || store.store_name || 'Mi Tienda').trim(),
        test_recipient: userEmail
      })
      if (res && res.ok) {
        showToast('success', res.message || '¡Prueba exitosa! Revisa tu correo.')
      } else {
        showToast('error', res?.message || 'Fallo en la prueba de correo.')
      }
    } catch (err) {
      showToast('error', err?.message || 'Error al conectar con los servidores de Google.')
    } finally {
      setTestingSmtp(false)
    }
  }

  // Configuración extendida de theme
  const initialTheme = store.theme_config || {}
  const [themeConfig, setThemeConfig] = useState(initialTheme)
  const [customBgColor, setCustomBgColor] = useState(initialTheme.custom_bg_color || '')
  const [navbarBg, setNavbarBg] = useState(initialTheme.navbar_bg || '')
  const [cardBg, setCardBg] = useState(initialTheme.card_bg || '')
  const [cardBorder, setCardBorder] = useState(initialTheme.card_border || '')
  const [buttonBg, setButtonBg] = useState(initialTheme.button_bg || '')
  const [buttonText, setButtonText] = useState(initialTheme.button_text || '#000000')
  const [buttonRadius, setButtonRadius] = useState(initialTheme.button_radius || 'rounded-xl')
  const [announcementBar, setAnnouncementBar] = useState(initialTheme.announcement_bar || '')
  const [heroBadge, setHeroBadge] = useState(initialTheme.hero_badge || 'Recargas Instantáneas y Seguras')
  const [heroTitle, setHeroTitle] = useState(initialTheme.hero_title || `Bienvenido a ${store.store_name || 'Mi Tienda'}`)
  const [heroSubtitle, setHeroSubtitle] = useState(initialTheme.hero_subtitle || 'Selecciona tu juego favorito, ingresa tu ID y recibe tus diamantes o monedas al instante.')

  // Drawer de personalización
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [customizerTab, setCustomizerTab] = useState('branding') // 'branding' | 'colors' | 'markups' | 'sms' | 'payments' | 'bot' | 'contact' | 'manual'
  const [savingCustomizer, setSavingCustomizer] = useState(false)
  const [uploadingStoreLogo, setUploadingStoreLogo] = useState(false)
  const [uploadingManualImage, setUploadingManualImage] = useState(false)

  // ─── ESTADOS DE PRODUCTOS MANUALES ────────────────────────────
  const [manualProducts, setManualProducts] = useState([])
  const [loadingManual, setLoadingManual] = useState(false)
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [manualView, setManualView] = useState('list') // 'list' | 'form'
  const [editingManualProduct, setEditingManualProduct] = useState(null)
  const [manualForm, setManualForm] = useState({
    name: '',
    category: '🎮 Cuentas de Juegos',
    price: '',
    icon_url: '',
    delivery_type: 'manual',
    delivery_time: '15 - 30 min',
    stock: -1,
    instructions: '',
    description: '',
    is_active: true,
    options: []
  })
  const [savingManual, setSavingManual] = useState(false)

  // ─── ESTADOS DE CATÁLOGO GENERAL ──────────────────────────────
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [products, setProducts] = useState([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [availableRegions, setAvailableRegions] = useState([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCatalogTab, setActiveCatalogTab] = useState('all') // 'all' | 'manual' | game.name
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all') // 'all' | 'game' | 'giftcard' | 'manual'
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(36)
  const [activeSubcategory, setActiveSubcategory] = useState('all') // 'all' | 'diamonds' | 'passes' | 'specials'
  const [gameModalSearch, setGameModalSearch] = useState('')
  const [activeGameModal, setActiveGameModal] = useState(null)

  // ─── ESTADOS DE NÚMEROS VIRTUALES (SMS) ────────────────────────
  const [smsCountries, setSmsCountries] = useState([])
  const [smsSelectedCountry, setSmsSelectedCountry] = useState('usa')
  const [smsCountrySearch, setSmsCountrySearch] = useState('')
  const [smsServices, setSmsServices] = useState([])
  const [smsLoadingCountries, setSmsLoadingCountries] = useState(false)
  const [smsLoadingServices, setSmsLoadingServices] = useState(false)
  const [smsServiceSearch, setSmsServiceSearch] = useState('')
  const [smsFastFilter, setSmsFastFilter] = useState('all')
  const [smsActivePicker, setSmsActivePicker] = useState('country') // 'country' | 'service' | null
  const [smsOperators, setSmsOperators] = useState([])
  const [smsOperator, setSmsOperator] = useState('any')
  const [smsOperatorsOpen, setSmsOperatorsOpen] = useState(false)
  const [smsSelectedService, setSmsSelectedService] = useState('')
  const [smsBuying, setSmsBuying] = useState(false)
  const [smsCanceling, setSmsCanceling] = useState(false)
  const [smsError, setSmsError] = useState(null)
  const [smsActiveOrder, setSmsActiveOrder] = useState(null)
  const [smsNowSec, setSmsNowSec] = useState(() => Math.floor(Date.now() / 1000))

  // ─── ESTADOS DE CONSULTA DE PEDIDOS ─────────────────────────
  const [ordersModalOpen, setOrdersModalOpen] = useState(false)
  const [ordersList, setOrdersList] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersQuery, setOrdersQuery] = useState('')
  const [ordersSearched, setOrdersSearched] = useState(false)
  const [ordersIsOwnerView, setOrdersIsOwnerView] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState(() => new Set())
  const [ordersFilterStatus, setOrdersFilterStatus] = useState('all') // 'all' | 'completed' | 'processing' | 'pending' | 'cancelled'
  const [ordersFilterType, setOrdersFilterType] = useState('all') // 'all' | 'auto' | 'manual'

  // ─── ESTADOS DE CLIENTES DE LA TIENDA (MODO DUEÑO) ───────────
  const [customersList, setCustomersList] = useState([])
  const [customersStats, setCustomersStats] = useState({ total_customers: 0, total_revenue_usdt: 0, total_profit_usdt: 0, registered_count: 0 })
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customersSearch, setCustomersSearch] = useState('')

  const toggleExpandOrder = (orderKey) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderKey)) next.delete(orderKey)
      else next.add(orderKey)
      return next
    })
  }

  const openOrdersTab = (query = '') => {
    setActiveView('orders')
    setOrdersModalOpen(false)
    loadOrders(query)
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
  }

  const openProfileTab = () => {
    if (currentUser) {
      setActiveView('profile')
      setUserProfileModalOpen(false)
      try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
    } else {
      setAuthMode('login')
      setAuthError('')
      setAuthModalOpen(true)
    }
  }

  const openSmsTab = () => {
    setActiveView('sms')
    if (smsCountries.length === 0) {
      loadSmsCountries()
    }
    if (smsSelectedCountry) {
      loadSmsServices(smsSelectedCountry)
    }
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
  }

  // Métodos de pago y checkout
  const [paymentMethods, setPaymentMethods] = useState(store.payment_methods || {})
  const [showMerchantKey, setShowMerchantKey] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState(1)
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('oxapay')
  const [orderForm, setOrderForm] = useState({
    player_id: '',
    zone_id: '',
    client_name: '',
    client_contact: '',
    cup_reference: '',
    cup_phone: '',
  })
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderSuccessData, setOrderSuccessData] = useState(null)
  const [copiedCard, setCopiedCard] = useState('')
  const [regTermsAccepted, setRegTermsAccepted] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  // Cargar pedidos de la tienda
  const loadOrders = async (queryParam = '') => {
    if (!store.slug) return
    setOrdersLoading(true)
    setOrdersSearched(true)
    try {
      const res = await api.getWebStoreOrders(store.slug, queryParam)
      if (res && res.orders) {
        setOrdersList(res.orders)
        setOrdersIsOwnerView(Boolean(res.is_owner))
      } else {
        setOrdersList([])
      }
    } catch (err) {
      console.warn("Error cargando pedidos:", err)
      setOrdersList([])
    } finally {
      setOrdersLoading(false)
    }
  }

  // Cargar lista de clientes de la tienda (solo para el dueño)
  const loadCustomers = async () => {
    if (!store.slug) return
    setCustomersLoading(true)
    try {
      let res = await api.getWebStoreCustomers(store.slug).catch(() => null)
      if (!res || !res.ok) {
        res = await api.getMyWebStoreCustomers().catch(() => null)
      }
      if (res?.ok && res.customers) {
        setCustomersList(res.customers)
        if (res.stats) setCustomersStats(res.stats)
      } else {
        setCustomersList([])
      }
    } catch (e) {
      console.warn('Error loading store customers:', e)
      setCustomersList([])
    } finally {
      setCustomersLoading(false)
    }
  }

  // Sincronizar estado de orden SMS en vivo
  const syncWebStoreSmsOrder = async (order) => {
    const lookupId = order.fivesim_order_id || order.id
    if (!lookupId) return
    try {
      showToast('info', 'Consultando estado del SMS...')
      const res = await api.getWebStoreSmsOrderStatus(store.slug, lookupId)
      if (res && res.ok && res.order) {
        const updated = res.order
        setOrdersList(prev => prev.map(o => {
          if ((o.fivesim_order_id && o.fivesim_order_id === lookupId) || String(o.id) === String(lookupId)) {
            return {
              ...o,
              phone: updated.phone || o.phone,
              sms_code: updated.code || updated.sms_code || o.sms_code,
              code: updated.code || updated.sms_code || o.code,
              status_code: updated.status === 'completed' ? 'completed' : updated.status === 'canceled' ? 'cancelled' : o.status_code,
              status_label: updated.status === 'completed' ? 'Completado' : updated.status === 'canceled' ? 'Cancelado / Reembolsado' : o.status_label
            }
          }
          return o
        }))
        if (updated.code) {
          showToast('success', `¡Código recibido: ${updated.code}!`)
        } else if (updated.status === 'completed') {
          showToast('success', 'Pedido completado exitosamente')
        } else {
          showToast('info', 'Aún esperando código SMS...')
        }
      }
    } catch (e) {
      showToast('error', e.message || 'Error al consultar estado')
    }
  }

  // Cancelar orden SMS
  const cancelWebStoreSms = async (order) => {
    const lookupId = order.fivesim_order_id || order.id
    if (!lookupId) return
    if (!window.confirm('¿Deseas cancelar este número virtual y solicitar el reembolso?')) return
    try {
      showToast('info', 'Cancelando número...')
      const res = await api.cancelWebStoreSmsOrder(store.slug, lookupId)
      if (res && res.ok) {
        showToast('success', 'Número cancelado correctamente')
        setOrdersList(prev => prev.map(o => {
          if ((o.fivesim_order_id && o.fivesim_order_id === lookupId) || String(o.id) === String(lookupId)) {
            return {
              ...o,
              status_code: 'cancelled',
              status_label: 'Cancelado / Reembolsado'
            }
          }
          return o
        }))
        if (order.sell_price) {
          setCurrentUser(prev => prev ? ({ ...prev, balance: Number(prev.balance || 0) + Number(order.sell_price) }) : prev)
        }
      } else {
        showToast('error', res?.message || 'No se pudo cancelar el número')
      }
    } catch (e) {
      showToast('error', e.message || 'Error al cancelar número')
    }
  }
  const handleChangePwd = async () => {
    if (pwdNew.length < 6) {
      setPwdMsg({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' })
      return
    }
    setPwdLoading(true)
    setPwdMsg(null)
    try {
      await api.changePassword(pwdCurrent || null, pwdNew)
      setPwdMsg({ type: 'success', text: 'Contraseña actualizada con éxito' })
      setPwdCurrent('')
      setPwdNew('')
      setTimeout(() => {
        setShowPwdModal(false)
        setPwdMsg(null)
      }, 1500)
    } catch (e) {
      setPwdMsg({ type: 'error', text: e.message || 'Error al cambiar contraseña' })
    } finally {
      setPwdLoading(false)
    }
  }

  // Detección de pestaña por URL (ej. ?tab=orders o ?tab=profile o ?tab=sms)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab') || params.get('screen') || params.get('view')
      if (tab === 'orders' || tab === 'pedidos') {
        setActiveView('orders')
        loadOrders()
      } else if (tab === 'profile' || tab === 'perfil' || tab === 'ajustes') {
        setActiveView('profile')
      } else if (tab === 'sms' || tab === 'numeros' || tab === 'virtuales') {
        setActiveView('sms')
        if (smsCountries.length === 0) loadSmsCountries()
        if (smsSelectedCountry) loadSmsServices(smsSelectedCountry)
      }
    } catch {}
  }, [])

  // Cargar productos manuales de la tienda (estrictamente de esta tienda)
  const loadManualProducts = async () => {
    if (!store.slug) return
    setLoadingManual(true)
    try {
      const res = await api.getWebStoreManualProducts(store.slug, isOwner)
      if (res && res.products) {
        setManualProducts(res.products)
      }
    } catch (err) {
      console.warn("Error cargando productos manuales:", err)
    } finally {
      setLoadingManual(false)
    }
  }

  // Cargar catálogo de juegos
  const loadCatalog = async () => {
    if (!store.slug) return
    setLoadingGames(true)
    try {
      const res = await api.getWebStoreCatalog(store.slug)
      if (res && res.games) {
        setGames(res.games)
      }
    } catch (err) {
      console.error("Error al cargar juegos de la tienda:", err)
    } finally {
      setLoadingGames(false)
    }
  }

  const handleOpenGameModal = (game) => {
    if (game.category === 'sms' || game.is_sms) {
      openSmsTab()
      return
    }
    setActiveGameModal(game)
    setSelectedGame(game)
    setSelectedProduct(null)
    setCheckoutStep(1)
    setOrderSuccessData(null)
    setGameModalSearch('')
    setOrderForm({
      player_id: '',
      zone_id: '',
      client_name: currentUser?.first_name || '',
      client_contact: currentUser?.email || '',
      cup_reference: '',
      cup_phone: '',
    })
    setCheckoutPaymentMethod(
      paymentMethods.oxapay?.enabled ? 'oxapay' : (Number(currentUser?.balance || 0) > 0 ? 'balance' : 'whatsapp')
    )
    handleSelectGame(game)
  }

  const handleCloseGameModal = () => {
    setActiveGameModal(null)
    setSelectedGame(null)
    setSelectedProduct(null)
    setCheckoutStep(1)
    setOrderSuccessData(null)
    setGameModalSearch('')
  }

  // Cargar lista de países para números virtuales (5sim)
  const loadSmsCountries = async () => {
    if (!store.slug) return
    setSmsLoadingCountries(true)
    try {
      const res = await api.getWebStoreSmsCountries(store.slug)
      if (res && res.countries) {
        setSmsCountries(res.countries)
        if (res.countries.length > 0 && !smsSelectedCountry) {
          setSmsSelectedCountry(res.countries[0].key)
        }
      }
    } catch (err) {
      console.error("Error al cargar países SMS:", err)
    } finally {
      setSmsLoadingCountries(false)
    }
  }

  // Cargar servicios disponibles para un país de números virtuales
  const loadSmsServices = async (countryKey) => {
    if (!store.slug || !countryKey) return
    const cacheKey = `${store.slug}:${countryKey}`
    if (smsServicesCache.current.has(cacheKey)) {
      setSmsServices(smsServicesCache.current.get(cacheKey))
    } else {
      setSmsLoadingServices(true)
    }
    try {
      const res = await api.getWebStoreSmsServices(store.slug, countryKey)
      if (res && res.services) {
        setSmsServices(res.services)
        smsServicesCache.current.set(cacheKey, res.services)
      } else {
        if (!smsServicesCache.current.has(cacheKey)) {
          setSmsServices([])
        }
      }
    } catch (err) {
      console.error("Error al cargar servicios SMS:", err)
      if (!smsServicesCache.current.has(cacheKey)) {
        setSmsServices([])
      }
    } finally {
      setSmsLoadingServices(false)
    }
  }

  const handleSelectSmsCountry = (countryKey) => {
    setSmsSelectedCountry(countryKey)
    setSmsSelectedService('')
    setSmsActivePicker('service')
    loadSmsServices(countryKey)
  }

  const handleSelectSmsService = (serviceKey) => {
    setSmsSelectedService(serviceKey)
    setSmsActivePicker(null)
  }

  useEffect(() => {
    if (!smsActiveOrder || smsActiveOrder.code || smsActiveOrder.status === 'canceled' || smsActiveOrder.status === 'failed' || smsActiveOrder.status === 'refunded') return
    const timer = setInterval(() => {
      setSmsNowSec(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [smsActiveOrder?.id, smsActiveOrder?.code, smsActiveOrder?.status])

  useEffect(() => {
    if (!smsActiveOrder || smsActiveOrder.status === 'completed' || smsActiveOrder.status === 'canceled' || smsActiveOrder.status === 'refunded' || smsActiveOrder.code) return
    const idToPoll = smsActiveOrder.fivesim_order_id || smsActiveOrder.id
    if (!idToPoll || !store.slug) return
    const interval = setInterval(async () => {
      try {
        const res = await api.getWebStoreSmsOrderStatus(store.slug, idToPoll)
        if (res?.ok && res?.order) {
          const ord = res.order
          if (ord.code) {
            setSmsActiveOrder(prev => ({ ...prev, ...ord, code: ord.code }))
          } else if (ord.status === 'canceled' || ord.status === 'failed' || ord.status === 'refunded') {
            setSmsActiveOrder(prev => ({ ...prev, ...ord }))
          }
        }
      } catch {}
    }, 3500)
    return () => clearInterval(interval)
  }, [smsActiveOrder?.id, smsActiveOrder?.fivesim_order_id, smsActiveOrder?.status, smsActiveOrder?.code, store.slug])

  useEffect(() => {
    if (!smsSelectedCountry || !smsSelectedService || !store.slug) {
      setSmsOperators([])
      setSmsOperator('any')
      return
    }
    setSmsOperators([])
    setSmsOperator('any')
    api.getWebStoreSmsOperators(store.slug, smsSelectedCountry, smsSelectedService)
      .then(res => setSmsOperators(res?.items || []))
      .catch(() => setSmsOperators([]))
  }, [smsSelectedCountry, smsSelectedService, store.slug])

  const handleBuySmsNumber = async () => {
    if (!currentUser) {
      setAuthMode('login')
      setAuthModalOpen(true)
      return
    }
    const selectedServiceObj = smsServices.find(s => s.key === smsSelectedService)
    const selectedOpObj = smsOperator === 'any' ? null : smsOperators.find(o => o.name === smsOperator)
    const bestOpObj = smsOperators[0]
    const priceToPay = Number(selectedOpObj?.price || bestOpObj?.price || selectedServiceObj?.sell_price || 0)
    const currentBalance = Number(currentUser?.balance || 0)

    if (currentBalance < priceToPay) {
      setDepositModalOpen(true)
      return
    }

    setSmsBuying(true)
    setSmsError(null)
    try {
      const res = await api.createWebStoreSmsOrder(store.slug, {
        country: smsSelectedCountry,
        service: smsSelectedService,
        operator: smsOperator
      })
      if (res && res.ok) {
        setSmsActiveOrder(res)
        setCurrentUser(prev => ({ ...prev, balance: Math.max(0, currentBalance - priceToPay) }))
        setToast({ type: 'success', text: '¡Número virtual asignado exitosamente!' })
      } else {
        setSmsError(res?.message || 'Error al reservar número')
      }
    } catch (e) {
      setSmsError(e.message || 'Error al procesar reserva de número')
    } finally {
      setSmsBuying(false)
    }
  }

  const handleCancelSmsNumber = async () => {
    if (!smsActiveOrder) return
    const idToCancel = smsActiveOrder.fivesim_order_id || smsActiveOrder.id
    if (!window.confirm('¿Deseas cancelar este número virtual? Tu saldo se reembolsará de inmediato.')) return
    setSmsCanceling(true)
    setSmsError(null)
    try {
      const res = await api.cancelWebStoreSmsOrder(store.slug, idToCancel)
      if (res && res.ok) {
        setSmsActiveOrder(prev => ({ ...prev, status: 'canceled', ...(res.order || {}) }))
        const refundAmt = Number(smsActiveOrder.price || 0)
        setCurrentUser(prev => ({ ...prev, balance: Number(prev?.balance || 0) + refundAmt }))
        setToast({ type: 'success', text: `Número cancelado. Reembolsados $${refundAmt.toFixed(2)} USDT` })
      } else {
        setSmsError(res?.message || 'No se pudo cancelar el número')
      }
    } catch (e) {
      setSmsError(e.message || 'Error al cancelar')
    } finally {
      setSmsCanceling(false)
    }
  }

  const handleBuySmsService = (service) => {
    handleSelectSmsService(service.key)
  }

  useEffect(() => {
    if (activeView === 'sms' || catalogCategoryFilter === 'sms') {
      if (smsCountries.length === 0) {
        loadSmsCountries()
      }
      if (smsSelectedCountry) {
        loadSmsServices(smsSelectedCountry)
      }
    }
  }, [activeView, catalogCategoryFilter, smsSelectedCountry, store.slug])

  useEffect(() => {
    if (store.store_name) {
      document.title = `${store.store_name} | Recargas y Juegos 24/7`
    }
    loadCatalog()
    loadManualProducts()
    if (currentUser) {
      loadOrders()
    }
  }, [store.slug, isOwner, currentUser])

  // Sincronizar métodos de pago si se actualiza el prop store
  useEffect(() => {
    if (store.payment_methods) {
      setPaymentMethods(prev => ({
        ...store.payment_methods,
        ...prev
      }))
    }
  }, [store.payment_methods])

  // Cargar configuración privada (merchant_key de OxaPay, bot, markups, sms, etc.) si es el dueño
  useEffect(() => {
    if (isOwner) {
      api.getMyWebStore()
        .then(res => {
          if (res && res.store) {
            const s = res.store
            if (s.payment_methods) setPaymentMethods(s.payment_methods)
            if (s.game_markups) setGameMarkups(s.game_markups)
            if (s.markup_percent !== undefined) setMarkupPercent(Number(s.markup_percent))
            if (s.sms_config) setSmsConfig(s.sms_config)
            if (s.telegram_bot_token) setBotToken(s.telegram_bot_token)
            if (s.telegram_bot_username) setBotUsername(s.telegram_bot_username)
            if (s.telegram_bot_active !== undefined) setBotActive(Boolean(s.telegram_bot_active))
            if (s.store_mode) setStoreMode(s.store_mode)
            if (s.notification_prefs) setNotificationPrefs(s.notification_prefs)
            if (s.contact_email) setContactEmail(s.contact_email)
            if (s.instagram_url) setInstagramUrl(s.instagram_url)
            if (s.whatsapp_number) setWhatsappNumber(s.whatsapp_number)
            if (s.telegram_username) setTelegramUsername(s.telegram_username)
          }
        })
        .catch(() => {})
    }
  }, [isOwner])

  // Cargar lista completa de juegos, gift cards y apps desde la API para configuración de márgenes
  const loadAllCatalogGames = React.useCallback(async () => {
    setLoadingAllCatalogGames(true)
    try {
      const res = await api.getResellerCatalogGames()
      if (res?.ok && Array.isArray(res.games)) {
        setAllCatalogGames(res.games)
      }
    } catch (err) {
      console.error('Error cargando catálogo completo para márgenes:', err)
    } finally {
      setLoadingAllCatalogGames(false)
    }
  }, [])

  useEffect(() => {
    if (isOwner && (customizerOpen || customizerTab === 'markups')) {
      loadAllCatalogGames()
    }
  }, [isOwner, customizerOpen, customizerTab, loadAllCatalogGames])

  // Cargar clientes o pedidos cuando el dueño abre sus pestañas en el drawer
  useEffect(() => {
    if (isOwner && customizerOpen) {
      if (customizerTab === 'customers') {
        loadCustomers()
      } else if (customizerTab === 'orders') {
        loadOrders()
      }
    }
  }, [isOwner, customizerOpen, customizerTab])

  // Listener de autenticación Google por Popup Relay
  useEffect(() => {
    const handleGoogleMessage = async (event) => {
      if (event.data && event.data.type === 'FRANCHOSHOP_GOOGLE_AUTH_SUCCESS') {
        const { credential } = event.data
        if (!credential) return
        setGoogleAuthLoading(true)
        setAuthError('')
        try {
          const res = await api.loginWithGoogle(credential)
          if (res && res.token) {
            const userData = await api.me()
            setCurrentUser(userData)
            if (onUpdateMe) onUpdateMe(userData)
            setAuthModalOpen(false)
            showToast('success', `¡Bienvenido, ${userData.first_name || userData.username || 'Usuario'}!`)
            loadManualProducts()
            if (
              Number(userData.user_id || userData.id) === Number(store.user_id) ||
              userData.role === 'admin'
            ) {
              api.getMyWebStore().then(sRes => {
                if (sRes && sRes.store && sRes.store.payment_methods) {
                  setPaymentMethods(sRes.store.payment_methods)
                }
              }).catch(() => {})
            }
          } else {
            setAuthError(res?.message || 'Error al autenticar con Google')
          }
        } catch (err) {
          setAuthError(err.message || 'Error al conectar con Google')
        } finally {
          setGoogleAuthLoading(false)
        }
      }
    }

    window.addEventListener('message', handleGoogleMessage)
    return () => window.removeEventListener('message', handleGoogleMessage)
  }, [store.user_id, onUpdateMe])

  const handleGoogleAuthClick = () => {
    setGoogleAuthLoading(true)
    setAuthError('')
    const popupOrigin = window.location.origin
    const popupUrl = `https://franchoshop.com/auth-google-popup.html?origin=${encodeURIComponent(popupOrigin)}`
    const w = 450
    const h = 550
    const left = window.screen.width / 2 - w / 2
    const top = window.screen.height / 2 - h / 2
    const popup = window.open(
      popupUrl,
      'GoogleAuthPopup',
      `width=${w},height=${h},top=${top},left=${left},status=no,menubar=no,toolbar=no`
    )
    if (popup && popup.focus) {
      popup.focus()
    }
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      setGoogleAuthLoading(false)
      setAuthError('Tu navegador bloqueó la ventana emergente. Por favor permite popups para continuar.')
    }
  }

  // Clasificador de subcategorías para juegos como Free Fire
  const getProductSubcategory = (p) => {
    if (p.is_manual) return 'manual'
    const name = (p.name || '').toLowerCase()
    if (
      name.includes('weekly') || name.includes('monthly') ||
      name.includes('membership') || name.includes('membresia') ||
      name.includes('pase') || name.includes('pass') ||
      name.includes('tarjeta') || name.includes('lite') ||
      name.includes('level') || name.includes('nivel')
    ) {
      return 'passes'
    }
    if (
      name.includes('diamond') || name.includes('diamante') ||
      /\d+\s*\+\s*\d+/.test(name)
    ) {
      return 'diamonds'
    }
    if (
      name.includes('grenade') || name.includes('loot') ||
      name.includes('backpack') || name.includes('gloo') ||
      name.includes('skin') || name.includes('box') ||
      name.includes('burger') || name.includes('bundle')
    ) {
      return 'specials'
    }
    return 'diamonds'
  }

  // Cargar productos de un juego
  const handleSelectGame = (game, region = null) => {
    setSelectedGame(game)
    setActiveSubcategory('all')
    if (game.is_manual || game.category === 'manual') {
      const prodId = game.manual_product_id || (game.id && String(game.id).startsWith('manual_') ? parseInt(String(game.id).replace('manual_', ''), 10) : game.id)
      const matched = manualProducts.find(p => p.id === prodId || p.name === game.name)
      const rawOpts = (matched?.options || game.options || []).filter(o => o.is_active !== false && o.is_active !== 0)
      if (rawOpts.length > 0) {
        const optionProducts = rawOpts.map(o => ({
          id: `${prodId}_opt_${o.id}`,
          manual_product_id: prodId,
          manual_option_id: o.id,
          name: o.name,
          variant_name: o.name,
          sell_price: Number(o.price || o.sell_price || 0),
          price: Number(o.price || o.sell_price || 0),
          cup_price: o.cup_price,
          description: matched?.description || game.description || '',
          instructions: matched?.instructions || game.instructions || '',
          delivery_time: o.delivery_time || matched?.delivery_time || game.delivery_time || 'Inmediato',
          delivery_type: matched?.delivery_type || game.delivery_type || 'manual',
          stock: o.stock ?? -1,
          fields: matched?.fields || game.fields || [],
          options: rawOpts,
          is_manual: true
        }))
        setProducts(optionProducts)
        setSelectedProduct(optionProducts[0])
        setAvailableRegions([])
        setSelectedRegion('')
        return
      }
      const singleProduct = matched ? { ...matched, is_manual: true } : {
        id: prodId || game.id,
        manual_product_id: prodId,
        name: game.title || game.name,
        sell_price: Number(game.price || game.price_usd || 0),
        price: Number(game.price || game.price_usd || 0),
        cup_price: game.cup_price,
        description: game.description || '',
        instructions: game.instructions || '',
        delivery_time: game.delivery_time || 'Inmediato',
        delivery_type: game.delivery_type || 'manual',
        stock: game.stock ?? -1,
        fields: game.fields || [],
        options: [],
        is_manual: true
      }
      setProducts([singleProduct])
      setSelectedProduct(singleProduct)
      setAvailableRegions([])
      setSelectedRegion('')

      // Si no tiene opciones en memoria, verificar en segundo plano
      if (store.slug && prodId) {
        api.getWebStoreProducts(store.slug, `manual_${prodId}`).then(res => {
          if (res && res.products && res.products.length > 0) {
            const apiProds = res.products.map(p => ({
              ...p,
              is_manual: true,
              sell_price: Number(p.sell_price || p.price || 0),
              price: Number(p.sell_price || p.price || 0),
              description: p.description || singleProduct.description,
              instructions: p.instructions || singleProduct.instructions,
              delivery_time: p.delivery_time || singleProduct.delivery_time
            }))
            if (apiProds.length > 1 || (apiProds[0].options && apiProds[0].options.length > 0)) {
              setProducts(apiProds)
              setSelectedProduct(apiProds[0])
            }
          }
        }).catch(() => {})
      }
      return
    }
    const gName = game.name || game.title
    const cacheKey = `${store.slug}:${gName}:${region || ''}:${game.category || ''}`
    if (gameProductsCache.current.has(cacheKey)) {
      const cached = gameProductsCache.current.get(cacheKey)
      if (cached && cached.products) {
        setProducts(cached.products)
        if (cached.products.length > 0) {
          setSelectedProduct(cached.products[0])
        }
        setAvailableRegions(cached.regions || [])
        setSelectedRegion(cached.region || '')
      }
    } else {
      setLoadingProducts(true)
    }

    api.getWebStoreGameProducts(store.slug, gName, region, game.category)
      .then(res => {
        if (res && res.products) {
          gameProductsCache.current.set(cacheKey, res)
          setProducts(res.products)
          if (res.products.length > 0) {
            setSelectedProduct(res.products[0])
          }
          setAvailableRegions(res.regions || [])
          setSelectedRegion(res.region || '')
        }
      })
      .catch(err => {
        console.error("Error cargando productos:", err)
        if (!gameProductsCache.current.has(cacheKey)) {
          setProducts([])
        }
      })
      .finally(() => setLoadingProducts(false))
  }

  // ─── LOGIN / AUTH MODAL ───────────────────────────────────────
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthSubmitting(true)
    try {
      if (authMode === 'login') {
        const res = await api.login(authEmail.trim(), authPassword)
        if (res.token) {
          const userData = await api.me()
          setCurrentUser(userData)
          if (onUpdateMe) onUpdateMe(userData)
          setAuthModalOpen(false)
          showToast('success', `¡Bienvenido, ${userData.first_name || userData.username || 'Usuario'}!`)
          loadManualProducts()
        } else {
          setAuthError(res.message || 'Credenciales inválidas')
        }
      } else {
        if (!regTermsAccepted) {
          setAuthError('Debes aceptar los Términos y Condiciones para registrarte.')
          setAuthSubmitting(false)
          return
        }
        const res = await api.register(authEmail.trim(), authPassword, authName.trim())
        if (res.ok || res.token) {
          const loginRes = await api.login(authEmail.trim(), authPassword)
          if (loginRes.token) {
            const userData = await api.me()
            setCurrentUser(userData)
            if (onUpdateMe) onUpdateMe(userData)
            setAuthModalOpen(false)
            showToast('success', '¡Cuenta creada e iniciada con éxito!')
          }
        } else {
          setAuthError(res.message || 'Error al crear la cuenta')
        }
      }
    } catch (err) {
      setAuthError(err.message || 'Error de conexión')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {}
    setCurrentUser(null)
    if (onUpdateMe) onUpdateMe(null)
    setUserDropdownOpen(false)
    setUserProfileModalOpen(false)
    setActiveView('store')
    showToast('success', 'Sesión cerrada exitosamente.')
  }

  // Actualizar datos de usuario (saldo, perfil)
  const refreshUserData = async () => {
    try {
      const userData = await api.me()
      if (userData && (userData.id || userData.user_id)) {
        setCurrentUser(userData)
        if (onUpdateMe) onUpdateMe(userData)
      }
    } catch (err) {
      console.warn("Error actualizando usuario:", err)
    }
  }

  // Guardar cambios en el perfil del usuario de la tienda
  const handleSaveStoreProfile = async (e) => {
    if (e) e.preventDefault()
    setProfileEditSaving(true)
    setProfileEditMsg(null)
    try {
      const name = (profileEditName || '').trim()
      const email = (profileEditEmail || '').trim()
      if (!name || name.length < 2) {
        setProfileEditMsg("El nombre debe tener al menos 2 caracteres.")
        setProfileEditSaving(false)
        return
      }
      await api.updateProfile({ display_name: name, email: email || null })
      await refreshUserData()
      showToast('success', 'Perfil actualizado correctamente.')
      setUserProfileModalOpen(false)
    } catch (err) {
      setProfileEditMsg(err?.message || 'No se pudo guardar el perfil.')
    } finally {
      setProfileEditSaving(false)
    }
  }

  // Generar depósito USDT con la pasarela oficial OxaPay
  const handleCreateDeposit = async () => {
    if (!currentUser) {
      setDepositModalOpen(false)
      setAuthMode('login')
      setAuthModalOpen(true)
      return
    }
    const amt = parseFloat(depositAmount)
    if (isNaN(amt) || amt < 1.0) {
      setDepositError("El monto mínimo de recarga es $1.00 USDT.")
      return
    }
    setDepositError('')
    setDepositLoading(true)
    try {
      const res = await api.createWebStoreDeposit(store.slug, { amount_usd: amt })
      if (res && res.pay_url) {
        setDepositResult(res)
        window.open(res.pay_url, '_blank', 'noopener,noreferrer')
      } else {
        setDepositError(res?.message || "No se pudo generar la orden de pago OxaPay.")
      }
    } catch (err) {
      setDepositError(err?.message || "Error al conectar con la pasarela OxaPay.")
    } finally {
      setDepositLoading(false)
    }
  }

  // ─── GUARDAR PERSONALIZACIÓN (EN VIVO) ────────────────────────
  const handleSaveCustomization = async () => {
    setSavingCustomizer(true)
    try {
      const payload = {
        slug: store.slug,
        store_name: storeName.trim() || store.store_name,
        tagline: tagline.trim(),
        logo_url: logoUrl.trim(),
        banner_url: store.banner_url || '',
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        bg_style: bgStyle,
        theme_config: {
          ...themeConfig,
          custom_bg_color: customBgColor.trim(),
          navbar_bg: navbarBg.trim(),
          card_bg: cardBg.trim(),
          card_border: cardBorder.trim(),
          button_bg: buttonBg.trim(),
          button_text: buttonText.trim(),
          button_radius: buttonRadius,
          announcement_bar: announcementBar.trim(),
          hero_badge: heroBadge.trim(),
          hero_title: heroTitle.trim(),
          hero_subtitle: heroSubtitle.trim(),
          sms_config: smsConfig
        },
        game_markups: gameMarkups,
        payment_methods: paymentMethods,
        contact_email: (emailConfig.smtp_user || contactEmail).trim(),
        email_config: emailConfig,
        whatsapp_number: whatsappNumber.trim(),
        telegram_username: telegramUsername.trim().replace('@', ''),
        instagram_url: instagramUrl.trim(),
        custom_domain: store.custom_domain || '',
        markup_percent: Number(markupPercent || 10.0),
        sms_config: smsConfig,
        store_mode: storeMode,
        notification_prefs: notificationPrefs
      }

      const res = await api.saveMyWebStore(payload)
      if (res && res.ok) {
        showToast('success', '¡Ajustes de tu tienda guardados con éxito!')
        if (onUpdateStore) onUpdateStore({ ...store, ...payload })
        if (res.store && res.store.payment_methods) {
          setPaymentMethods(res.store.payment_methods)
        }
        setCustomizerOpen(false)
      } else {
        showToast('error', res?.message || 'Error al guardar la tienda')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al guardar cambios')
    } finally {
      setSavingCustomizer(false)
    }
  }

  // ─── CONEXIÓN / DESCONEXIÓN BOT TELEGRAM (EN VIVO) ────────────
  const handleConnectBot = async () => {
    const token = botToken.trim()
    if (!token) {
      showToast('error', 'Por favor ingresa el token de tu bot de @BotFather')
      return
    }
    setConnectingBot(true)
    try {
      const res = await api.setupWebStoreTelegramBot({
        bot_token: token,
        store_mode: storeMode,
        notification_prefs: notificationPrefs
      })
      if (res?.ok) {
        showToast('success', res.message || '¡Bot de Telegram vinculado y configurado con éxito!')
        setBotActive(true)
        if (res.bot_username) setBotUsername(res.bot_username)
        if (onUpdateStore) {
          onUpdateStore({
            ...store,
            telegram_bot_token: token,
            telegram_bot_username: res.bot_username || botUsername,
            telegram_bot_active: true,
            store_mode: storeMode,
            notification_prefs: notificationPrefs
          })
        }
      } else {
        showToast('error', res?.detail || res?.message || 'Error al vincular el bot con Telegram')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al conectar con Telegram')
    } finally {
      setConnectingBot(false)
    }
  }

  const handleDisconnectBot = async () => {
    if (!window.confirm('¿Seguro que deseas desconectar tu Bot de Telegram de tu tienda?')) return
    setDisconnectingBot(true)
    try {
      const res = await api.disconnectWebStoreTelegramBot()
      if (res?.ok) {
        showToast('info', 'Bot de Telegram desconectado correctamente')
        setBotActive(false)
        setBotToken('')
        setBotUsername('')
        if (onUpdateStore) {
          onUpdateStore({
            ...store,
            telegram_bot_token: '',
            telegram_bot_username: '',
            telegram_bot_active: false
          })
        }
      } else {
        showToast('error', res?.detail || res?.message || 'Error al desconectar el bot')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al desconectar el bot')
    } finally {
      setDisconnectingBot(false)
    }
  }

  // ─── GESTIÓN DE PRODUCTOS MANUALES ────────────────────────────
  const handleOpenCreateManual = () => {
    setEditingManualProduct(null)
    setManualForm({
      name: '',
      category: '🎮 Cuentas de Juegos',
      price: '',
      icon_url: '',
      delivery_type: 'manual',
      delivery_time: '15 - 30 min',
      stock: -1,
      instructions: '',
      description: '',
      is_active: true,
      options: []
    })
    setManualView('form')
    setManualModalOpen(true)
  }

  const handleOpenEditManual = (p) => {
    setEditingManualProduct(p)
    setManualForm({
      name: p.name || '',
      category: p.category || '🎮 Cuentas de Juegos',
      price: p.price || p.sell_price || '',
      icon_url: p.icon_url || '',
      delivery_type: p.delivery_type || 'manual',
      delivery_time: p.delivery_time || '15 - 30 min',
      stock: p.stock !== undefined ? p.stock : -1,
      instructions: p.instructions || '',
      description: p.description || '',
      is_active: p.is_active !== undefined ? p.is_active : true,
      options: (p.options || []).map(o => ({
        id: o.id,
        name: o.name || '',
        price: o.price !== undefined ? o.price : '',
        stock: o.stock !== undefined ? o.stock : -1
      }))
    })
    setManualView('form')
  }

  const handleSaveManualProduct = async (e) => {
    e.preventDefault()
    if (!manualForm.name.trim()) {
      return showToast('error', 'El nombre del producto es obligatorio.')
    }

    const validOptions = (manualForm.options || [])
      .map(o => ({
        id: o.id,
        name: String(o.name || '').trim(),
        price: parseFloat(o.price) || 0,
        stock: parseInt(o.stock) || -1
      }))
      .filter(o => o.name && o.price > 0)

    let numPrice = parseFloat(manualForm.price)
    if (validOptions.length > 0) {
      if (isNaN(numPrice) || numPrice <= 0) {
        numPrice = Math.min(...validOptions.map(o => o.price))
      }
    } else {
      if (isNaN(numPrice) || numPrice <= 0) {
        return showToast('error', 'El precio en USD debe ser mayor que 0.')
      }
    }

    setSavingManual(true)
    try {
      const data = {
        name: manualForm.name.trim(),
        category: manualForm.category.trim() || 'Servicios',
        price: numPrice,
        icon_url: manualForm.icon_url.trim(),
        delivery_type: manualForm.delivery_type,
        delivery_time: manualForm.delivery_time.trim() || 'Inmediato',
        stock: parseInt(manualForm.stock) || -1,
        instructions: manualForm.instructions.trim(),
        description: manualForm.description.trim(),
        is_active: Boolean(manualForm.is_active),
        options: validOptions,
        store_slug: store.slug
      }

      if (editingManualProduct) {
        await api.updateWebStoreManualProduct(editingManualProduct.id, data)
        showToast('success', '¡Producto actualizado con éxito!')
      } else {
        await api.createWebStoreManualProduct(data)
        showToast('success', '¡Producto creado y publicado en tu tienda!')
      }

      await loadManualProducts()
      await loadCatalog()
      setManualView('list')
    } catch (err) {
      showToast('error', err.message || 'Error al guardar producto')
    } finally {
      setSavingManual(false)
    }
  }

  const handleDeleteManualProduct = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este producto de tu tienda?')) return
    try {
      await api.deleteWebStoreManualProduct(id)
      showToast('success', 'Producto eliminado de tu tienda.')
      await loadManualProducts()
      await loadCatalog()
    } catch (err) {
      showToast('error', err.message || 'Error al eliminar')
    }
  }

  const handleToggleManualActive = async (p) => {
    try {
      await api.updateWebStoreManualProduct(p.id, { is_active: !p.is_active })
      await loadManualProducts()
      await loadCatalog()
      showToast('success', p.is_active ? 'Producto pausado.' : 'Producto activado.')
    } catch (err) {
      showToast('error', err.message || 'Error al cambiar estado')
    }
  }

  // ─── CHECKOUT / COMPRA ────────────────────────────────────────
  const handleOpenCheckout = (product) => {
    setSelectedProduct(product)
    setCheckoutStep(2)
  }

  const handleConfirmOrder = async () => {
    if (!selectedProduct) {
      return showToast('error', 'Por favor selecciona un paquete primero.')
    }
    const isStr = Boolean(selectedProduct?.provider_type === 'streaming' || selectedGame?.is_streaming || selectedGame?.category === 'streaming' || (selectedGame?.id && String(selectedGame.id).startsWith('streaming_')))
    if (!orderForm.player_id.trim()) {
      if (isStr) {
        orderForm.player_id = currentUser?.email || orderForm.client_contact || 'Detalles del Pedido, Telegram y Gmail'
      } else {
        const isGc = Boolean(selectedGame?.category === 'giftcard' || selectedProduct?.provider_type === 'giftcard')
        return showToast(
          'error',
          isGc
            ? 'Por favor introduce tu correo o contacto para recibir el PIN.'
            : selectedProduct?.is_manual
            ? 'Por favor introduce el dato de entrega o identificador.'
            : selectedProduct?.is_sms
            ? 'Por favor introduce tu número o contacto para la entrega del código.'
            : 'Por favor introduce tu Player ID / ID de jugador.'
        )
      }
    }

    const priceUsdt = Number(selectedProduct.sell_price || selectedProduct.price || 0)

    if (checkoutPaymentMethod === 'balance') {
      if (!currentUser) {
        setAuthMode('login')
        setAuthModalOpen(true)
        return showToast('error', 'Debes iniciar sesión para pagar con tu saldo USDT.')
      }
      const userBal = Number(currentUser.balance || 0)
      if (userBal < priceUsdt) {
        return showToast('error', `Saldo USDT insuficiente ($${userBal.toFixed(2)} / $${priceUsdt.toFixed(2)} USDT).`)
      }
    }

    try {
      setSubmittingOrder(true)
      const res = await api.createWebStoreOrder(store.slug, {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        game_name: selectedProduct.is_sms
          ? 'Números Virtuales (SMS)'
          : selectedProduct.is_manual
          ? 'Productos Exclusivos'
          : (selectedGame?.name || selectedGame?.title || 'Juego'),
        amount_usd: priceUsdt,
        amount_cup: 0,
        player_id: orderForm.player_id,
        zone_id: orderForm.zone_id || '',
        client_name: orderForm.client_name || '',
        client_contact: orderForm.client_contact || '',
        payment_method: checkoutPaymentMethod,
      })

      if (res && res.ok) {
        if (res.type === 'whatsapp' && res.whatsapp_url) {
          window.open(res.whatsapp_url, '_blank')
          setOrderSuccessData(res)
          setCheckoutStep(3)
          showToast('success', '¡Abriendo WhatsApp para completar tu pago en USDT!')
        } else if (res.type === 'oxapay' && res.pay_url) {
          window.open(res.pay_url, '_blank')
          setOrderSuccessData(res)
          setCheckoutStep(3)
        } else if (res.type === 'balance') {
          try {
            const meRes = await api.me()
            setCurrentUser(meRes)
            if (onUpdateMe) onUpdateMe(meRes)
          } catch {}
          setOrderSuccessData(res)
          setCheckoutStep(3)
          showToast('success', '¡Pago procesado con éxito usando tu saldo USDT!')
        } else {
          setOrderSuccessData(res)
          setCheckoutStep(3)
        }
      } else {
        showToast('error', res?.message || 'Error al procesar el pedido')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al procesar el pedido')
    } finally {
      setSubmittingOrder(false)
    }
  }

  const handleCopyText = (text, type) => {
    navigator.clipboard.writeText(text)
    if (type === 'card') {
      setCopiedCard(text)
      setTimeout(() => setCopiedCard(''), 2500)
    }
    showToast('success', '¡Copiado al portapapeles!')
  }

  // Temas de fondo predeterminados
  const bgStyles = {
    clean_white: 'bg-gradient-to-b from-[#F8FAFC] via-[#FFFFFF] to-[#F1F5F9] text-slate-800',
    white: 'bg-gradient-to-b from-[#F8FAFC] via-[#FFFFFF] to-[#F1F5F9] text-slate-800',
    light: 'bg-gradient-to-b from-[#F8FAFC] via-[#FFFFFF] to-[#F1F5F9] text-slate-800',
    midnight: 'bg-[#0a0f1d] text-slate-100',
    cyberpunk: 'bg-[#0d091a] text-slate-100',
    matrix: 'bg-[#06120d] text-slate-100',
    sunset: 'bg-[#140b08] text-slate-100',
    obsidian: 'bg-[#080808] text-slate-100'
  }

  const isGlobalLight = typeof document !== 'undefined' && (document.documentElement.classList.contains('light-theme') || (typeof localStorage !== 'undefined' && localStorage.getItem('francho_theme') === 'light'))
  const isWhiteTheme = isGlobalLight || bgStyle === 'clean_white' || bgStyle === 'white' || bgStyle === 'light'
  const activeBgClass = isWhiteTheme ? 'bg-[#FAF5FF] text-slate-900' : (bgStyles[bgStyle] || bgStyles.midnight)

  // Sincronizar fondo del viewport del navegador (html, body y theme-color) para evitar pantallazos negros al scrollear
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isWhiteTheme) {
      document.documentElement.classList.add('light-theme')
      document.documentElement.style.backgroundColor = '#FAF5FF'
      document.body.style.backgroundColor = '#FAF5FF'
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', '#FAF5FF')
    } else {
      const globalLight = typeof localStorage !== 'undefined' && localStorage.getItem('francho_theme') === 'light'
      if (!globalLight) {
        document.documentElement.classList.remove('light-theme')
        document.documentElement.style.backgroundColor = '#070a0f'
        document.body.style.backgroundColor = '#070a0f'
        const meta = document.querySelector('meta[name="theme-color"]')
        if (meta) meta.setAttribute('content', '#070a0f')
      }
    }
    return () => {
      const globalLight = typeof localStorage !== 'undefined' && localStorage.getItem('francho_theme') === 'light'
      if (!globalLight) {
        document.documentElement.classList.remove('light-theme')
        document.documentElement.style.backgroundColor = ''
        document.body.style.backgroundColor = ''
      }
    }
  }, [isWhiteTheme])

  // Clasificación de juegos y categorías
  const isTopupGame = (g) => !g.is_manual && g.category !== 'manual' && g.category !== 'giftcard' && g.category !== 'sms' && g.category !== 'streaming'
  const isGiftcardGame = (g) => g.category === 'giftcard'
  const isStreamingGame = (g) => g.category === 'streaming' || g.is_streaming
  const isSmsGame = (g) => g.category === 'sms' || g.is_sms
  const isManualGame = (g) => Boolean((g.is_manual || g.category === 'manual') && g.id !== 'manual_store_products')

  const qSearch = searchQuery.trim().toLowerCase()
  const matchGameSearch = (g) => !qSearch || (g.name || '').toLowerCase().includes(qSearch) || (g.title || '').toLowerCase().includes(qSearch)

  const topupGames = games.filter(isTopupGame)
  const giftcardGames = games.filter(isGiftcardGame)
  const streamingGames = games.filter(isStreamingGame)
  const manualGamesList = [
    ...games.filter(g => isManualGame(g) && g.id !== 'manual_store_products'),
    ...manualProducts.filter(p => !games.some(g => g.id === p.id || g.id === `manual_${p.id}` || g.manual_product_id === p.id)).map(p => ({
      ...p,
      id: `manual_${p.id}`,
      manual_product_id: p.id,
      is_manual: true,
      category: 'manual',
      title: p.name,
      count: p.delivery_time || 'Inmediato'
    }))
  ]

  const filteredTopupGames = topupGames.filter(matchGameSearch)
  const filteredGiftcardGames = giftcardGames.filter(matchGameSearch)
  const filteredStreamingGames = streamingGames.filter(matchGameSearch)
  const filteredManualGames = manualGamesList.filter(matchGameSearch)

  // Conteo por categoría para filtros rápidos estilo Francho Shop
  const categoryCounts = {
    all: topupGames.length + giftcardGames.length + streamingGames.length + (manualGamesList.length || 0),
    game: topupGames.length,
    giftcard: giftcardGames.length,
    streaming: streamingGames.length,
    sms: 1,
    manual: manualGamesList.length,
  }

  // Filtrado de juegos por búsqueda y categoría
  const filteredGames = games.filter(g => {
    const matchesSearch = matchGameSearch(g)
    const isManual = isManualGame(g)
    const isGiftcard = isGiftcardGame(g)
    const isStreaming = isStreamingGame(g)
    const isSms = isSmsGame(g)
    const isGame = isTopupGame(g)

    let matchesCategory = true
    if (catalogCategoryFilter === 'game') matchesCategory = isGame
    else if (catalogCategoryFilter === 'giftcard') matchesCategory = isGiftcard
    else if (catalogCategoryFilter === 'streaming') matchesCategory = isStreaming
    else if (catalogCategoryFilter === 'sms') matchesCategory = isSms
    else if (catalogCategoryFilter === 'manual') matchesCategory = isManual

    return matchesSearch && matchesCategory
  })

  // ─── FILTRADO & PAGINACIÓN PARA MODO DUEÑO (GANANCIAS: API COMPLETA 650+ ITEMS) ───
  const filteredCatalogForMarkups = React.useMemo(() => {
    let list = allCatalogGames
    if (!list || list.length === 0) return []
    if (markupGameSearch.trim()) {
      const q = markupGameSearch.toLowerCase().trim()
      list = list.filter(g => (g.name || '').toLowerCase().includes(q) || (g.category || '').toLowerCase().includes(q))
    }
    if (markupCategoryFilter === 'topup') {
      list = list.filter(g => g.kind === 'topup')
    } else if (markupCategoryFilter === 'giftcard') {
      list = list.filter(g => g.kind === 'giftcard')
    } else if (markupCategoryFilter === 'streaming') {
      list = list.filter(g => g.kind === 'streaming')
    } else if (markupCategoryFilter === 'apps') {
      list = list.filter(g => g.kind === 'apps' || g.kind === 'sms')
    } else if (markupCategoryFilter === 'custom') {
      list = list.filter(g => gameMarkups && (gameMarkups[g.name] !== undefined || (g.base_name && gameMarkups[g.base_name] !== undefined)))
    }
    return list
  }, [allCatalogGames, markupGameSearch, markupCategoryFilter, gameMarkups])

  const totalMarkupPages = Math.max(1, Math.ceil(filteredCatalogForMarkups.length / MARKUP_ITEMS_PER_PAGE))
  const paginatedMarkupGames = React.useMemo(() => {
    const start = (markupPage - 1) * MARKUP_ITEMS_PER_PAGE
    return filteredCatalogForMarkups.slice(start, start + MARKUP_ITEMS_PER_PAGE)
  }, [filteredCatalogForMarkups, markupPage])

  // Servicios SMS filtrados
  const filteredSmsServices = smsServices.filter(s => {
    const q = smsServiceSearch.trim().toLowerCase()
    if (!q) return true
    return (s.name || '').toLowerCase().includes(q) || (s.key || '').toLowerCase().includes(q)
  })

  // Ofertas filtradas para el modal del juego activo
  const filteredModalProducts = products.filter(p => {
    const matchesSubcat = activeSubcategory === 'all' || getProductSubcategory(p) === activeSubcategory
    const q = gameModalSearch.trim().toLowerCase()
    const matchesSearch = !q || (p.name || '').toLowerCase().includes(q)
    return matchesSubcat && matchesSearch
  })

  // Paleta de presets de colores primarios
  const COLOR_PRESETS = [
    { label: 'Esmeralda', hex: '#00C26F' },
    { label: 'Cian Neón', hex: '#00E5FF' },
    { label: 'Naranja Fuego', hex: '#FF7A00' },
    { label: 'Morado Cyber', hex: '#8B5CF6' },
    { label: 'Rojo Carmesí', hex: '#EF4444' },
    { label: 'Amarillo Oro', hex: '#EAB308' },
    { label: 'Azul Real', hex: '#3B82F6' },
    { label: 'Rosa Neón', hex: '#EC4899' }
  ]

  // Categorías sugeridas para productos manuales
  const MANUAL_CATEGORIES = [
    '🎮 Cuentas de Juegos',
    '📺 Streaming',
    '💎 Combos Especiales',
    '🎁 Gift Cards',
    '⚡ Servicios Digitales',
    '📲 Números Virtuales'
  ]

  // ─── TARJETA OFICIAL SMS VIRTUAL (IDÉNTICA A LA WEB PRINCIPAL) ───
  const renderSmsCard = () => {
    const smsCover = store.theme_config?.sms_config?.catalog_image_url ||
                     store.theme_config?.sms_config?.banner_url ||
                     store.theme_config?.sms_config?.category_logo_url ||
                     store.theme_config?.sms_config?.icon_url ||
                     '/api/icons/manual-1782655319-e35b38c8.png'
    const smsTitle = store.theme_config?.sms_config?.display_name || 'Números Virtuales'

    return (
      <button
        key="card_virtual_sms"
        type="button"
        onClick={() => openSmsTab()}
        className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#16181f]/90 text-left transition-all duration-300 active:scale-95 hover:-translate-y-0.5"
        style={(!isWhiteTheme && cardBg) ? { backgroundColor: cardBg } : {}}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${primaryColor}cc`
          e.currentTarget.style.boxShadow = `0 4px 20px ${primaryColor}25`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = ''
          e.currentTarget.style.boxShadow = 'none'
        }}
        aria-label="Abrir Números Virtuales"
      >
        <span className="block relative aspect-[1/1.1] w-full flex-shrink-0 overflow-hidden bg-[#101318]">
          <OptimizedImage
            src={smsCover}
            alt={smsTitle}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
            fallbackSrc="/api/icons/manual-1782655319-e35b38c8.png"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#16181f] to-transparent z-10" />
          <span
            className="block absolute left-1.5 top-1.5 z-20 max-w-[calc(100%-12px)] truncate rounded-full bg-black/80 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider backdrop-blur-md shadow-md border"
            style={{
              color: primaryColor,
              borderColor: `${primaryColor}60`
            }}
          >
            SMS OTP
          </span>
        </span>
        <span className="block flex-1 p-1.5">
          <span className="block line-clamp-2 text-[11px] font-bold leading-tight text-white group-hover:text-white transition-colors">
            {smsTitle}
          </span>
        </span>
      </button>
    )
  }

  // Tarjeta compacta estilo póster oficial de Francho Shop
  const renderGameCard = (game) => {
    if (game.category === 'sms' || game.is_sms) {
      return renderSmsCard()
    }
    const isManual = Boolean(game.is_manual || game.category === 'manual')
    const isGiftcard = game.category === 'giftcard'
    const isStreaming = game.category === 'streaming' || game.is_streaming
    const cardKey = `${game.category || 'cat'}_${game.id || game.name}`

    const badgeLabel = isManual
      ? 'Exclusivo'
      : isGiftcard
      ? 'Gift Card'
      : isStreaming
      ? 'Streaming'
      : 'Top-Up'

    return (
      <button
        key={cardKey}
        type="button"
        onClick={() => handleOpenGameModal(game)}
        className={`group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border text-left transition-all duration-300 active:scale-95 hover:-translate-y-0.5 ${
          isWhiteTheme
            ? 'border-slate-200 bg-white shadow-sm hover:shadow-md'
            : 'border-white/10 bg-[#16181f]/90'
        }`}
        style={(!isWhiteTheme && cardBg) ? { backgroundColor: cardBg } : {}}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${primaryColor}cc`
          e.currentTarget.style.boxShadow = `0 4px 20px ${primaryColor}25`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = ''
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <span className={`block relative aspect-[1/1.1] w-full flex-shrink-0 overflow-hidden ${isWhiteTheme ? 'bg-slate-100' : 'bg-[#101318]'}`}>
          {game.icon_url ? (
            <OptimizedImage
              src={game.icon_url}
              alt={game.title || game.name}
              className="relative z-10 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
              fallbackEmoji={isManual ? '🛍️' : isGiftcard ? '🎁' : isStreaming ? '📺' : (game.emoji || '🎮')}
            />
          ) : (
            <span className={`block absolute inset-0 flex items-center justify-center text-2xl ${isWhiteTheme ? 'bg-slate-100 text-slate-700' : 'bg-white/5'}`}>
              {isManual ? '🛍️' : isGiftcard ? '🎁' : isStreaming ? '📺' : (game.emoji || '🎮')}
            </span>
          )}
          <span className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t ${isWhiteTheme ? 'from-white' : 'from-[#16181f]'} to-transparent z-10`} />
          <span
            className={`block absolute left-1.5 top-1.5 z-20 max-w-[calc(100%-12px)] truncate rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-md border ${
              isWhiteTheme ? 'bg-white/95 text-slate-800' : 'bg-black/90'
            }`}
            style={{
              color: primaryColor,
              borderColor: `${primaryColor}60`
            }}
          >
            {badgeLabel}
          </span>
        </span>
        <span className="block flex-1 p-1.5">
          <span className={`block line-clamp-2 text-[11px] font-bold leading-tight transition-colors ${
            isWhiteTheme ? 'text-slate-800 group-hover:text-slate-950' : 'text-white group-hover:text-white'
          }`}>
            {cleanFzrPackageName(game.title || game.name)}
          </span>
          {isManual && game.price && (
            <span className="block mt-0.5 text-[10px] font-black" style={{ color: primaryColor }}>
              {game.options && game.options.length > 0 ? 'Desde ' : ''}${Number(game.price).toFixed(2)} USDT
            </span>
          )}
          {isStreaming && (game.price || game.price_usd) && (
            <span className="block mt-0.5 text-[10px] font-black" style={{ color: primaryColor }}>
              ${Number(game.price || game.price_usd).toFixed(2)} USDT
            </span>
          )}
        </span>
      </button>
    )
  }

  // Tarjeta de "Ver más" con círculo y flecha estilo Francho Shop
  const renderViewMoreCard = (title, onClick) => {
    return (
      <button
        key={`view_more_${title}`}
        type="button"
        onClick={onClick}
        className={`group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border text-left transition-all duration-300 active:scale-95 hover:-translate-y-0.5 ${
          isWhiteTheme ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-[#16181f]/90'
        }`}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${primaryColor}cc`
          e.currentTarget.style.boxShadow = `0 4px 20px ${primaryColor}25`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = ''
          e.currentTarget.style.boxShadow = 'none'
        }}
        aria-label={`Ver más ${title}`}
      >
        <span className={`block flex aspect-[1/1.1] w-full items-center justify-center transition group-hover:scale-105 ${
          isWhiteTheme ? 'bg-slate-50' : 'bg-white/5'
        }`}>
          <div className="flex flex-col items-center gap-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border shadow-sm"
              style={{
                backgroundColor: `${primaryColor}15`,
                borderColor: `${primaryColor}40`,
                color: primaryColor
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </span>
            <span className={`text-[9px] font-bold ${isWhiteTheme ? 'text-slate-500' : 'text-white/60'}`}>Ver todo</span>
          </div>
        </span>
        <span className="block flex-1 p-1.5">
          <span className={`block line-clamp-1 text-[10px] font-bold leading-tight transition-colors ${
            isWhiteTheme ? 'text-slate-700' : 'text-white/70'
          }`}>
            Ver más
          </span>
          <span className="block truncate text-[9px] font-black uppercase tracking-wider" style={{ color: primaryColor }}>
            {title} &gt;
          </span>
        </span>
      </button>
    )
  }

  const handleSelectCategory = (cat) => {
    if (cat === 'sms') {
      openSmsTab()
      return
    }
    setActiveView('store')
    setCatalogCategoryFilter(cat)
    setSearchQuery('')
    setVisibleCategoryCount(36)
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {}
  }

  return (
    <div
      className={`min-h-screen font-sans ${activeBgClass} relative selection:bg-orange-500/30 selection:text-white pb-24`}
      style={customBgColor ? { backgroundColor: customBgColor } : {}}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md border text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200"
          style={{
            backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            borderColor: toast.type === 'error' ? '#f87171' : '#34d399',
            color: '#fff'
          }}
        >
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Barra de Anuncio Superior */}
      {announcementBar && (
        <div
          className="py-1.5 px-4 text-xs font-black text-center tracking-wide overflow-hidden flex items-center justify-center gap-2 shadow-sm"
          style={{ backgroundColor: primaryColor, color: '#000' }}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{announcementBar}</span>
        </div>
      )}

      {/* ─── BARRA FLOTANTE DE ADMINISTRADOR (PROPIETARIO) ──────────── */}
      {showOwnerTools && (
        <div className="bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-emerald-500/20 border-b border-amber-500/30 backdrop-blur-md px-4 py-2 text-xs">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                👑 Modo Propietario
              </span>
              <span className="text-white/70 hidden sm:inline">
                Estás visualizando tu tienda web con herramientas de administración activas.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomizerOpen(true)}
                className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/15"
              >
                <Palette className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <span>Personalizar Diseño</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualView('list')
                  setManualModalOpen(true)
                }}
                className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/15"
              >
                <Package className="w-3.5 h-3.5 text-sky-400" />
                <span>Mis Productos ({manualProducts.length})</span>
              </button>

              {onGoToPanel && (
                <button
                  type="button"
                  onClick={onGoToPanel}
                  className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5 transition active:scale-95 border border-amber-500/30"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Panel Revendedor</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setClientPreviewMode(true)}
                title="Ver tienda como un cliente común"
                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante para restaurar modo dueño si se ocultó */}
      {isOwner && clientPreviewMode && (
        <div className="fixed bottom-3 right-3 z-50 animate-in fade-in">
          <button
            type="button"
            onClick={() => setClientPreviewMode(false)}
            className="px-2.5 py-1.5 rounded-full bg-amber-500/95 hover:bg-amber-400 text-black font-bold text-[11px] shadow-lg flex items-center gap-1.5 border border-amber-300/80 transition-all active:scale-95 backdrop-blur-sm cursor-pointer"
            title="Volver al Modo Dueño"
          >
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            <span>Restaurar Modo Dueño</span>
          </button>
        </div>
      )}

      {/* Botón flotante persistente de Modo Dueño (compacto, ideal para móvil / Mini App) */}
      {showOwnerTools && (
        <div className="fixed bottom-3.5 right-3.5 z-40 animate-in fade-in">
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="group px-2.5 py-1.5 rounded-full bg-amber-500/95 hover:bg-amber-400 text-black font-black text-[11px] shadow-lg flex items-center gap-1.5 border border-amber-300/80 transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
            title="Administración de la tienda"
          >
            <Crown className="w-3.5 h-3.5 text-black group-hover:rotate-12 transition-transform shrink-0" />
            <span>Modo Dueño</span>
            <span className="w-1.5 h-1.5 rounded-full bg-black/80 shrink-0" />
          </button>
        </div>
      )}

      {/* Banner si la tienda es 'miniapp_only' y se abre fuera de Telegram */}
      {store.store_mode === 'miniapp_only' && !isTelegramMiniApp && store.telegram_bot_username && (
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white px-4 py-2 text-xs flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 shrink-0" />
            <span>Esta tienda está optimizada para disfrutarse dentro de Telegram como Mini App.</span>
          </div>
          <a
            href={`https://t.me/${store.telegram_bot_username}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 rounded-xl bg-white text-black font-black text-[11px] hover:bg-white/90 shrink-0 flex items-center gap-1 shadow"
          >
            <span>Abrir en Telegram</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* ─── HEADER / NAVBAR ────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-xl border-b ${isWhiteTheme ? 'border-slate-200 shadow-sm' : 'border-white/10'}`}
        style={navbarBg ? { backgroundColor: navbarBg } : { backgroundColor: isWhiteTheme ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.5)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo y Nombre (Click para volver a la Tienda) */}
          <div
            onClick={() => setActiveView('store')}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 cursor-pointer select-none"
            title="Ir a la Tienda"
          >
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border flex items-center justify-center font-black text-sm sm:text-base shadow-lg shrink-0 ${
                isWhiteTheme ? 'bg-white border-slate-200 shadow-sm' : 'border-white/20 bg-black/60'
              }`}
              style={{ color: primaryColor }}
            >
              {logoUrl ? (
                <OptimizedImage src={logoUrl} alt={storeName} className="w-full h-full object-cover" fetchPriority="high" loading="eager" />
              ) : (
                (storeName || "TG").slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className={`text-sm sm:text-lg font-black tracking-tight truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                  {storeName}
                </h1>
                {store.is_verified && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                    ✓
                  </span>
                )}
              </div>
              <p className={`text-[10px] sm:text-[11px] truncate ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                {tagline}
              </p>
            </div>
          </div>

          {/* Acciones Derecha: Pedidos + Usuario / Cerrar Sesión */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Botón de Sección de Pedidos (en móvil ya está en la barra inferior) */}
            <button
              type="button"
              onClick={() => openOrdersTab()}
              className={`hidden sm:flex px-3 py-1.5 rounded-xl font-bold text-xs items-center gap-1.5 border transition active:scale-95 shadow-sm ${
                activeView === 'orders'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>Pedidos</span>
            </button>

            {/* Botón de Sección de Números Virtuales (SMS) en Desktop */}
            <button
              type="button"
              onClick={() => openSmsTab()}
              className={`hidden sm:flex px-3 py-1.5 rounded-xl font-bold text-xs items-center gap-1.5 border transition active:scale-95 shadow-sm ${
                activeView === 'sms'
                  ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
              }`}
              style={
                activeView === 'sms'
                  ? { borderColor: `${primaryColor}80`, backgroundColor: `${primaryColor}26`, color: primaryColor }
                  : {}
              }
            >
              <Smartphone className="w-3.5 h-3.5" style={{ color: activeView === 'sms' ? primaryColor : '#22d3ee' }} />
              <span>SMS</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Saldo USDT Pill con botón de recarga */}
                <div className="flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 sm:px-2.5 py-1 text-xs font-black shadow-sm">
                  <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-300">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>${Number(currentUser.balance || 0).toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400/80">USDT</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDepositAmount('10')
                      setDepositResult(null)
                      setDepositError('')
                      setDepositModalOpen(true)
                    }}
                    className="ml-1 sm:ml-2 inline-flex items-center gap-0.5 rounded-lg bg-emerald-500 text-black px-1.5 py-0.5 text-[10px] font-black hover:bg-emerald-400 active:scale-95 transition cursor-pointer"
                    title="Recargar Saldo USDT con OxaPay"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span className="hidden sm:inline">Recargar</span>
                  </button>
                </div>

                {/* Perfil del usuario */}
                <button
                  type="button"
                  onClick={() => openProfileTab()}
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${
                    activeView === 'profile'
                      ? 'border-white/30 bg-white/20 text-white shadow'
                      : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                  }`}
                  title="Ver perfil y monedero"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {(currentUser.first_name || currentUser.username || 'U')[0].toUpperCase()}
                  </div>
                  <span className="hidden md:inline max-w-[100px] truncate">
                    {currentUser.first_name || currentUser.username || 'Mi Cuenta'}
                  </span>
                  {isOwner && (
                    <span className="hidden md:inline text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Dueño
                    </span>
                  )}
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setCustomizerOpen(true)}
                    className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs items-center gap-1 border border-white/10 transition active:scale-95"
                    title="Personalizar Tienda"
                  >
                    <Palette className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden md:inline">Ajustes</span>
                  </button>
                )}

                {/* Botón dedicado de Cerrar Sesión (en desktop; en móvil está dentro del perfil) */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:flex px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/30 text-xs font-bold items-center gap-1 transition active:scale-95 shadow-sm cursor-pointer"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden lg:inline">Salir</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                  setAuthModalOpen(true)
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/10 transition active:scale-95 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Iniciar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── CONTENIDO PRINCIPAL: EXACTAMENTE COMO EN FRANCHO SHOP ──── */}
      <main className="max-w-lg md:max-w-4xl lg:max-w-5xl mx-auto px-4 py-4 md:p-6 pb-28 relative z-10">
        {/* ─── VISTA: CATÁLOGO DE TIENDA ───────────────────────────── */}
        {activeView === 'store' && (
          <>
            {/* Barra de Búsqueda Redonda Oficial de Francho Shop */}
            <div className="mb-4">
          <div className="relative flex items-center shadow-lg">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: primaryColor }} />
            <input
              type="text"
              placeholder="Buscar juego, tarjeta o servicio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-full border py-3 pl-11 pr-11 text-sm outline-none transition shadow-inner backdrop-blur ${
                isWhiteTheme
                  ? 'border-slate-200 bg-white text-slate-900 placeholder-slate-400 shadow-sm'
                  : 'border-white/15 bg-[#16181f]/90 text-white placeholder-white/40'
              }`}
              style={{
                borderColor: searchQuery ? primaryColor : (isWhiteTheme ? '#e2e8f0' : 'rgba(255, 255, 255, 0.15)')
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full transition active:scale-90 ${
                  isWhiteTheme ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-white/15 text-white/70 hover:bg-white/25 hover:text-white'
                }`}
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chips de Categorías Rápidas */}
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none [will-change:scroll-position]">
          <button
            type="button"
            onClick={() => handleSelectCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
              catalogCategoryFilter === 'all' && !searchQuery
                ? 'text-black shadow-md'
                : isWhiteTheme
                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
            }`}
            style={catalogCategoryFilter === 'all' && !searchQuery ? { backgroundColor: primaryColor, color: '#000' } : {}}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Todos</span>
            <span className="text-[10px] opacity-75">({categoryCounts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory('game')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
              catalogCategoryFilter === 'game'
                ? 'text-black shadow-md'
                : isWhiteTheme
                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
            }`}
            style={catalogCategoryFilter === 'game' ? { backgroundColor: primaryColor, color: '#000' } : {}}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Direct Top-Up</span>
            <span className="text-[10px] opacity-75">({categoryCounts.game})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory('giftcard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
              catalogCategoryFilter === 'giftcard'
                ? 'text-black shadow-md'
                : isWhiteTheme
                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
            }`}
            style={catalogCategoryFilter === 'giftcard' ? { backgroundColor: primaryColor, color: '#000' } : {}}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Gift Cards</span>
            <span className="text-[10px] opacity-75">({categoryCounts.giftcard})</span>
          </button>

          {categoryCounts.streaming > 0 && (
            <button
              type="button"
              onClick={() => handleSelectCategory('streaming')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
                catalogCategoryFilter === 'streaming'
                  ? 'text-black shadow-md'
                  : isWhiteTheme
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
              }`}
              style={catalogCategoryFilter === 'streaming' ? { backgroundColor: primaryColor, color: '#000' } : {}}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Streaming</span>
              <span className="text-[10px] opacity-75">({categoryCounts.streaming})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openSmsTab()}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
              isWhiteTheme ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>SMS Virtual</span>
          </button>

          {categoryCounts.manual > 0 && (
            <button
              type="button"
              onClick={() => handleSelectCategory('manual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
                catalogCategoryFilter === 'manual'
                  ? 'text-black shadow-md'
                  : isWhiteTheme
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
              }`}
              style={catalogCategoryFilter === 'manual' ? { backgroundColor: primaryColor, color: '#000' } : {}}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Exclusivos</span>
              <span className="text-[10px] opacity-75">({categoryCounts.manual})</span>
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={handleOpenCreateManual}
              className="ml-auto px-3 py-1.5 rounded-xl text-xs font-black text-black flex items-center gap-1 shrink-0 shadow-md active:scale-95 transition"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Crear Producto</span>
            </button>
          )}
        </div>

        {loadingGames ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
              <div key={i} className={`aspect-[1/1.1] rounded-xl animate-pulse border ${isWhiteTheme ? 'bg-slate-200/80 border-slate-300/50' : 'bg-[#16181f]/60 border-white/5'}`} />
            ))}
          </div>
        ) : searchQuery.trim() ? (
          /* VISTA CUANDO SE REALIZA UNA BÚSQUEDA */
          <section className="space-y-4">
            <div className={`flex items-center justify-between gap-2 border-b pb-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <h3 className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-black uppercase ${isWhiteTheme ? 'text-slate-800' : 'text-white/85'}`}>
                <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                <span>Resultados para "{searchQuery}"</span>
                <span
                  className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                  style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}35`, color: primaryColor }}
                >
                  {filteredGames.length}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold hover:underline"
                style={{ color: primaryColor }}
              >
                Limpiar búsqueda
              </button>
            </div>

            {filteredGames.length === 0 ? (
              <div className={`rounded-2xl border p-8 text-center space-y-2 ${isWhiteTheme ? 'border-slate-200 bg-white text-slate-700 shadow-sm' : 'border-white/10 bg-[#16181f]/60 text-white/80'}`}>
                <PackageOpen className={`mx-auto h-8 w-8 ${isWhiteTheme ? 'text-slate-400' : 'text-white/30'}`} />
                <p className={`text-sm font-bold ${isWhiteTheme ? 'text-slate-800' : 'text-white/80'}`}>No se encontraron resultados para "{searchQuery}"</p>
                <p className={`text-xs ${isWhiteTheme ? 'text-slate-500' : 'text-white/45'}`}>Prueba con otra palabra o revisa la ortografía</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-black text-black active:scale-95 shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  Ver todos los juegos
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {filteredGames.slice(0, visibleCategoryCount).map(renderGameCard)}
                </div>
                {filteredGames.length > visibleCategoryCount && (
                  <div className="flex justify-center pt-2 pb-4">
                    <button
                      type="button"
                      onClick={() => setVisibleCategoryCount(v => v + 36)}
                      className="px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
                      style={{ backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}40`, color: primaryColor, borderWidth: 1 }}
                    >
                      <ChevronDown className="h-4 w-4" />
                      <span>Cargar más ({visibleCategoryCount} de {filteredGames.length})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : catalogCategoryFilter === 'game' ? (
          /* VISTA DEDICADA DE RECARGAS DIRECTAS (TOP-UP) */
          <section className="space-y-4">
            <div className={`flex items-center justify-between gap-2 border-b pb-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectCategory('all')}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                    isWhiteTheme
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Categorías</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                  <h3 className={`text-xs sm:text-sm font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>DIRECT TOP-UP</h3>
                  <span
                    className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                    style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}35`, color: primaryColor }}
                  >
                    {filteredTopupGames.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {filteredTopupGames.slice(0, visibleCategoryCount).map(renderGameCard)}
              </div>
              {filteredTopupGames.length > visibleCategoryCount && (
                <div className="flex justify-center pt-2 pb-4">
                  <button
                    type="button"
                    onClick={() => setVisibleCategoryCount(v => v + 36)}
                    className="px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
                    style={{ backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}40`, color: primaryColor, borderWidth: 1 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>Cargar más recargas ({visibleCategoryCount} de {filteredTopupGames.length})</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : catalogCategoryFilter === 'giftcard' ? (
          /* VISTA DEDICADA DE GIFT CARDS */
          <section className="space-y-4">
            <div className={`flex items-center justify-between gap-2 border-b pb-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectCategory('all')}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                    isWhiteTheme
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Categorías</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                  <h3 className={`text-xs sm:text-sm font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>GIFT CARDS & PINES</h3>
                  <span
                    className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                    style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}35`, color: primaryColor }}
                  >
                    {filteredGiftcardGames.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {filteredGiftcardGames.slice(0, visibleCategoryCount).map(renderGameCard)}
              </div>
              {filteredGiftcardGames.length > visibleCategoryCount && (
                <div className="flex justify-center pt-2 pb-4">
                  <button
                    type="button"
                    onClick={() => setVisibleCategoryCount(v => v + 36)}
                    className="px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
                    style={{ backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}40`, color: primaryColor, borderWidth: 1 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>Cargar más gift cards ({visibleCategoryCount} de {filteredGiftcardGames.length})</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : catalogCategoryFilter === 'streaming' ? (
          /* VISTA DEDICADA DE STREAMING */
          <section className="space-y-4">
            <div className={`flex items-center justify-between gap-2 border-b pb-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectCategory('all')}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                    isWhiteTheme
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Categorías</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <Tv className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                  <h3 className={`text-xs sm:text-sm font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>STREAMING & APPS</h3>
                  <span
                    className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                    style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}35`, color: primaryColor }}
                  >
                    {filteredStreamingGames.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {filteredStreamingGames.slice(0, visibleCategoryCount).map(renderGameCard)}
              </div>
              {filteredStreamingGames.length > visibleCategoryCount && (
                <div className="flex justify-center pt-2 pb-4">
                  <button
                    type="button"
                    onClick={() => setVisibleCategoryCount(v => v + 36)}
                    className="px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
                    style={{ backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}40`, color: primaryColor, borderWidth: 1 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>Cargar más streaming ({visibleCategoryCount} de {filteredStreamingGames.length})</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : catalogCategoryFilter === 'manual' ? (
          /* VISTA DEDICADA DE PRODUCTOS EXCLUSIVOS */
          <section className="space-y-4">
            <div className={`flex items-center justify-between gap-2 border-b pb-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectCategory('all')}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                    isWhiteTheme
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Categorías</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                  <h3 className={`text-xs sm:text-sm font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>PRODUCTOS EXCLUSIVOS</h3>
                  <span
                    className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                    style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}35`, color: primaryColor }}
                  >
                    {filteredManualGames.length}
                  </span>
                </div>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleOpenCreateManual}
                  className="px-3 py-1 rounded-xl text-xs font-black text-black flex items-center gap-1 shadow-md active:scale-95 transition"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Producto</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {filteredManualGames.map(renderGameCard)}
            </div>
          </section>
        ) : (
          /* ─── VISTA PRINCIPAL: SECCIONES IDÉNTICAS A FRANCHO SHOP ─── */
          <div className="space-y-6">
            {/* 📱 SECCIÓN 1: DIRECT TOP-UP */}
            {topupGames.length > 0 && (
              <section className="mb-5 [content-visibility:auto]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <h3 className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white/85'}`}>
                    <Smartphone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                    <span className="truncate">DIRECT TOP-UP</span>
                    <span
                      className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderColor: `${primaryColor}35`,
                        color: primaryColor
                      }}
                    >
                      {topupGames.length}
                    </span>
                  </h3>
                  {topupGames.length > 5 && (
                    <button
                      onClick={() => handleSelectCategory('game')}
                      className="text-xs font-bold hover:underline flex items-center gap-0.5"
                      style={{ color: primaryColor }}
                    >
                      Ver más <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]">
                  {topupGames.slice(0, 5).map((g) => (
                    <div key={g.id || g.name} className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderGameCard(g)}
                    </div>
                  ))}
                  {topupGames.length > 5 && (
                    <div className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderViewMoreCard('Direct Top-Up', () => handleSelectCategory('game'))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 🔑 SECCIÓN 2: GIFT CARDS & PINES */}
            {giftcardGames.length > 0 && (
              <section className="mb-5 [content-visibility:auto]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <h3 className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white/85'}`}>
                    <Gift className="h-3.5 w-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                    <span className="truncate">GIFT CARDS & PINES</span>
                    <span
                      className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderColor: `${primaryColor}35`,
                        color: primaryColor
                      }}
                    >
                      {giftcardGames.length}
                    </span>
                  </h3>
                  {giftcardGames.length > 5 && (
                    <button
                      onClick={() => handleSelectCategory('giftcard')}
                      className="text-xs font-bold hover:underline flex items-center gap-0.5"
                      style={{ color: primaryColor }}
                    >
                      Ver más <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]">
                  {giftcardGames.slice(0, 5).map((g) => (
                    <div key={g.id || g.name} className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderGameCard(g)}
                    </div>
                  ))}
                  {giftcardGames.length > 5 && (
                    <div className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderViewMoreCard('Gift Cards', () => handleSelectCategory('giftcard'))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 📱 SECCIÓN 3: SERVICIOS DIGITALES & SMS */}
            <section className="mb-5 [content-visibility:auto]">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h3 className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white/85'}`}>
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                  <span className="truncate">SERVICIOS DIGITALES & SMS</span>
                  <span
                    className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                      borderColor: `${primaryColor}35`,
                      color: primaryColor
                    }}
                  >
                    OTP
                  </span>
                </h3>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]">
                <div className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                  {renderSmsCard()}
                </div>
              </div>
            </section>

            {/* 📺 SECCIÓN 4: STREAMING & ENTRETENIMIENTO */}
            {streamingGames.length > 0 && (
              <section className="mb-5 [content-visibility:auto]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <h3 className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white/85'}`}>
                    <Tv className="h-3.5 w-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                    <span className="truncate">STREAMING & ENTRETENIMIENTO</span>
                    <span
                      className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderColor: `${primaryColor}35`,
                        color: primaryColor
                      }}
                    >
                      {streamingGames.length}
                    </span>
                  </h3>
                  {streamingGames.length > 5 && (
                    <button
                      onClick={() => handleSelectCategory('streaming')}
                      className="text-xs font-bold hover:underline flex items-center gap-0.5"
                      style={{ color: primaryColor }}
                    >
                      Ver más <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]">
                  {streamingGames.slice(0, 5).map((g) => (
                    <div key={g.id || g.name} className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderGameCard(g)}
                    </div>
                  ))}
                  {streamingGames.length > 5 && (
                    <div className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderViewMoreCard('Streaming', () => handleSelectCategory('streaming'))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ✨ SECCIÓN 5: PRODUCTOS EXCLUSIVOS (Si existen) */}
            {manualGamesList.length > 0 && (
              <section className="mb-5 [content-visibility:auto]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <h3 className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-black uppercase ${isWhiteTheme ? 'text-slate-900' : 'text-white/85'}`}>
                    <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                    <span className="truncate">PRODUCTOS EXCLUSIVOS</span>
                    <span
                      className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderColor: `${primaryColor}35`,
                        color: primaryColor
                      }}
                    >
                      {manualGamesList.length}
                    </span>
                  </h3>
                  {manualGamesList.length > 5 && (
                    <button
                      onClick={() => handleSelectCategory('manual')}
                      className="text-xs font-bold hover:underline flex items-center gap-0.5"
                      style={{ color: primaryColor }}
                    >
                      Ver más <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]">
                  {manualGamesList.slice(0, 5).map((g) => (
                    <div key={g.id || g.name} className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderGameCard(g)}
                    </div>
                  ))}
                  {manualGamesList.length > 5 && (
                    <div className="w-[28%] min-w-[100px] max-w-[125px] flex-shrink-0 md:w-[15%] md:min-w-[120px] md:max-w-[140px]">
                      {renderViewMoreCard('Exclusivos', () => handleSelectCategory('manual'))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </>
    )}

    {/* ─── PESTAÑA: NÚMEROS VIRTUALES (SMS 5SIM) (ESTILO FRANCHO SHOP) ─── */}
    {activeView === 'sms' && (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Cabecera con flecha para volver */}
        <div className={`flex items-center justify-between gap-3 pb-3 border-b ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('store')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border active:scale-95 transition shadow-sm ${
                isWhiteTheme ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100' : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
              }`}
              aria-label="Volver a la tienda"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                <h1 className={`text-base sm:text-lg font-black leading-tight ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                  {store.theme_config?.sms_config?.display_name || 'Números Virtuales (SMS)'}
                </h1>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-black border flex items-center gap-1"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    borderColor: `${primaryColor}35`,
                    color: primaryColor
                  }}
                >
                  <Zap className="h-2.5 w-2.5" />
                  <span>Automático 24/7</span>
                </span>
              </div>
              <p className={`text-[11px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>Recibe códigos de verificación para WhatsApp, Telegram y más</p>
            </div>
          </div>
        </div>

        {/* Banner Informativo y Garantía estilo Francho Shop */}
        <section className={`overflow-hidden rounded-2xl border shadow-lg relative ${isWhiteTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-card'}`}>
          <div className={`relative min-h-[96px] p-4 flex items-center ${isWhiteTheme ? 'bg-gradient-to-r from-slate-100 to-slate-50' : 'bg-[#101820]'}`}>
            {store.theme_config?.sms_config?.banner_url ? (
              <img
                src={toFastImageUrl(store.theme_config.sms_config.banner_url)}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover ${isWhiteTheme ? 'opacity-20' : 'opacity-35'}`}
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-[#101820] to-emerald-500/10" />
            )}
            <div className={`absolute inset-0 ${isWhiteTheme ? 'bg-gradient-to-r from-white/95 via-white/80 to-white/60' : 'bg-gradient-to-r from-black/90 via-black/70 to-black/40'}`} />
            <div className="relative space-y-1.5 max-w-xl">
              <p className={`text-xs leading-relaxed ${isWhiteTheme ? 'text-slate-700' : 'text-white/85'}`}>
                {store.theme_config?.sms_config?.description ||
                  'Compra números virtuales de diferentes países para recibir códigos de verificación al instante (WhatsApp, Telegram, ChatGPT, Google y más). Reembolso 100% garantizado si el SMS no llega o si decides cancelar el pedido.'}
              </p>
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black ${isWhiteTheme ? 'bg-slate-200/80 text-slate-800' : 'bg-white/10 text-white/90'}`}>
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span>Activaciones oficiales con entrega inmediata</span>
              </div>
            </div>
          </div>
        </section>

        {/* Selector de Dos Píldoras: [País] y [App] */}
        <section className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSmsActivePicker('country')}
            className={`flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left active:scale-[0.99] transition ${
              smsActivePicker === 'country'
                ? 'shadow-md ring-1'
                : isWhiteTheme ? 'border-slate-200 bg-white hover:border-slate-300 shadow-sm' : 'border-white/10 bg-[#16181f]/80 hover:border-white/20'
            }`}
            style={
              smsActivePicker === 'country'
                ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15`, ringColor: primaryColor }
                : {}
            }
          >
            <span className={`flex h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl text-lg items-center justify-center border ${isWhiteTheme ? 'bg-slate-100 border-slate-200' : 'bg-black/30 border-white/10'}`}>
              <SmsIcon
                src={smsCountryIconUrl(smsCountries.find(x => x.key === smsSelectedCountry) || {})}
                fallback={<Globe className="h-4 w-4 text-slate-400" />}
              />
            </span>
            <span className="min-w-0">
              <span className={`block text-[10px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>País</span>
              <span className={`block truncate text-xs font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                {smsCountries.find(x => x.key === smsSelectedCountry)?.name || 'Escoger país'}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => smsSelectedCountry && setSmsActivePicker('service')}
            disabled={!smsSelectedCountry}
            className={`flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left active:scale-[0.99] transition disabled:opacity-50 ${
              smsActivePicker === 'service'
                ? 'shadow-md ring-1'
                : isWhiteTheme ? 'border-slate-200 bg-white hover:border-slate-300 shadow-sm' : 'border-white/10 bg-[#16181f]/80 hover:border-white/20'
            }`}
            style={
              smsActivePicker === 'service'
                ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15`, ringColor: primaryColor }
                : {}
            }
          >
            <span className={`flex h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl items-center justify-center border ${isWhiteTheme ? 'bg-slate-100 border-slate-200' : 'bg-black/30 border-white/10'}`}>
              <SmsIcon
                src={smsServiceIconUrl(smsServices.find(x => x.key === smsSelectedService) || {})}
                fallback={<Smartphone className="h-4 w-4 text-emerald-500" />}
                fit="contain"
              />
            </span>
            <span className="min-w-0">
              <span className={`block text-[10px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>App</span>
              <span className={`block truncate text-xs font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                {smsServices.find(x => x.key === smsSelectedService)?.name || 'Escoger app'}
              </span>
            </span>
          </button>
        </section>

        {/* Spinner si carga servicios */}
        {smsLoadingServices && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: primaryColor }} />
          </div>
        )}

        {/* Vista 1: Selector de Países */}
        {smsActivePicker === 'country' && (
          <section className={`flex flex-col rounded-2xl border overflow-hidden shadow-xl animate-in fade-in duration-200 ${
            isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#16181f]/90 text-white'
          }`}>
            <div className={`border-b p-3.5 space-y-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Selecciona el país</p>
                <span className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>
                  {smsCountries.filter(c => !smsCountrySearch || `${c.name} ${c.key}`.toLowerCase().includes(smsCountrySearch.toLowerCase())).length} disponibles
                </span>
              </div>
              <div className="relative">
                <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isWhiteTheme ? 'text-slate-400' : 'text-white/35'}`} />
                <input
                  value={smsCountrySearch}
                  onChange={e => setSmsCountrySearch(e.target.value)}
                  placeholder="Buscar país (ej: Estados Unidos, España, Colombia...)"
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs outline-none transition ${
                    isWhiteTheme
                      ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-slate-400'
                      : 'border-white/10 bg-black/40 text-white placeholder-white/35 focus:border-white/30'
                  }`}
                />
              </div>
            </div>

            <div className="p-3 max-h-[380px] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {smsCountries
                  .filter(c => !smsCountrySearch || `${c.name} ${c.key}`.toLowerCase().includes(smsCountrySearch.toLowerCase()))
                  .map(c => {
                    const isSelected = smsSelectedCountry === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          handleSelectSmsCountry(c.key)
                          setSmsCountrySearch('')
                        }}
                        className={`flex items-center gap-2 rounded-xl border p-2 text-left active:scale-[0.98] transition ${
                          isSelected
                            ? 'shadow-md border-transparent text-black'
                            : isWhiteTheme
                            ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                            : 'border-white/10 bg-black/30 hover:border-white/20 text-white'
                        }`}
                        style={isSelected ? { backgroundColor: primaryColor, color: '#000' } : {}}
                      >
                        <span className={`flex h-8 w-8 shrink-0 overflow-hidden rounded-lg text-base items-center justify-center border ${
                          isWhiteTheme ? 'bg-white border-slate-200' : 'bg-black/20 border-white/10'
                        }`}>
                          <SmsIcon src={smsCountryIconUrl(c)} fallback={<Globe className="h-4 w-4 text-slate-400" />} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black">{c.name}</span>
                          <span className={`block text-[10px] uppercase font-bold ${isSelected ? 'text-black/60' : isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>
                            {c.key}
                          </span>
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          </section>
        )}

        {/* Vista 2: Selector de Aplicaciones / Servicios */}
        {smsActivePicker === 'service' && (
          <section className={`flex flex-col rounded-2xl border overflow-hidden shadow-xl animate-in fade-in duration-200 ${
            isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#16181f]/90 text-white'
          }`}>
            <div className={`border-b p-3.5 space-y-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Selecciona la aplicación o servicio</p>
                  <p className={`text-[11px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                    País: {smsCountries.find(x => x.key === smsSelectedCountry)?.name || smsSelectedCountry.toUpperCase()}
                  </p>
                </div>
                <span className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>
                  {smsServices.filter(s => !smsServiceSearch || `${s.name} ${s.key}`.toLowerCase().includes(smsServiceSearch.toLowerCase())).length} apps
                </span>
              </div>
              <div className="relative">
                <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isWhiteTheme ? 'text-slate-400' : 'text-white/35'}`} />
                <input
                  value={smsServiceSearch}
                  onChange={e => setSmsServiceSearch(e.target.value)}
                  placeholder="Buscar app (ej: WhatsApp, Telegram, ChatGPT...)"
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs outline-none transition ${
                    isWhiteTheme
                      ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-slate-400'
                      : 'border-white/10 bg-black/40 text-white placeholder-white/35 focus:border-white/30'
                  }`}
                />
              </div>
            </div>

            <div className="p-3 max-h-[380px] overflow-y-auto">
              {smsServices.length === 0 && !smsLoadingServices ? (
                <div className={`text-center py-8 text-xs font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/45'}`}>
                  No hay aplicaciones disponibles en este momento para el país seleccionado.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {smsServices
                    .filter(s => !smsServiceSearch || `${s.name} ${s.key}`.toLowerCase().includes(smsServiceSearch.toLowerCase()))
                    .map(s => {
                      const isSelected = smsSelectedService === s.key
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => {
                            handleSelectSmsService(s.key)
                            setSmsServiceSearch('')
                          }}
                          className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left active:scale-[0.98] transition ${
                            isSelected
                              ? 'shadow-md border-transparent text-black'
                              : isWhiteTheme
                              ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                              : 'border-white/10 bg-black/30 hover:border-white/20 text-white'
                          }`}
                          style={isSelected ? { backgroundColor: primaryColor, color: '#000' } : {}}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`flex h-9 w-9 shrink-0 overflow-hidden rounded-xl items-center justify-center border ${
                              isWhiteTheme ? 'bg-white border-slate-200' : 'bg-black/30 border-white/10'
                            }`}>
                              <SmsIcon
                                src={smsServiceIconUrl(s)}
                                fallback={<Smartphone className="h-4 w-4 text-emerald-500" />}
                                fit="contain"
                              />
                            </span>
                            <div className="min-w-0">
                              <span className="block truncate text-xs font-black">{s.name}</span>
                              <span className={`block text-[10px] font-bold ${isSelected ? 'text-black/60' : 'text-emerald-500'}`}>
                                {s.qty} disponibles
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-black ${isSelected ? 'text-black' : ''}`} style={!isSelected ? { color: primaryColor } : {}}>
                              ${s.sell_price.toFixed(2)}
                            </span>
                            <span className={`block text-[9px] uppercase font-bold ${isSelected ? 'text-black/60' : isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>
                              USDT
                            </span>
                          </div>
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Vista 3: Selector de Operador cuando ambos están escogidos */}
        {!smsActivePicker && smsSelectedService && (
          <section className={`rounded-2xl border p-4 space-y-3 shadow-lg ${
            isWhiteTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#16181f]/90'
          }`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-black uppercase tracking-wider ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>Operador Telefónico</p>
              <span className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>
                {smsOperators.length} opciones disponibles
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSmsOperatorsOpen(true)}
              disabled={smsOperators.length === 0}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left active:scale-[0.99] transition disabled:opacity-50 ${
                isWhiteTheme
                  ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  : 'border-white/10 bg-black/40 hover:border-white/20'
              }`}
            >
              <div className="min-w-0">
                <span className={`block text-[10px] font-bold uppercase ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>Operador seleccionado</span>
                <span className={`block truncate text-sm font-black capitalize ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                  {smsOperator === 'any' ? 'Automático (Mejor precio)' : smsOperator}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 ${isWhiteTheme ? 'text-slate-500' : 'text-white/60'}`} />
            </button>
          </section>
        )}

        {/* Error si ocurre alguno */}
        {smsError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{smsError}</span>
          </div>
        )}

        {/* ORDEN SMS ACTIVA (CON NÚMERO Y CÓDIGO EN TIEMPO REAL) */}
        {smsActiveOrder && (
          <div className={`rounded-2xl border p-4 text-xs space-y-3 animate-in zoom-in-95 duration-200 ${
            isWhiteTheme ? 'border-emerald-500/40 bg-white text-slate-900 shadow-xl' : 'border-emerald-500/40 bg-[#16181f]/95 text-white shadow-2xl'
          }`}>
            <div className={`flex items-center justify-between border-b pb-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <span className="font-black text-sm flex items-center gap-1.5" style={{ color: primaryColor }}>
                <Smartphone className="h-4 w-4" />
                {smsActiveOrder.code ? '¡Código SMS Recibido con Éxito!' : 'Número Virtual Reservado'}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${isWhiteTheme ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-white/80'}`}>
                {smsActiveOrder.service || smsSelectedService}
              </span>
            </div>

            {/* Número asignado */}
            <div className={`flex items-center justify-between rounded-xl p-3 border ${
              isWhiteTheme ? 'bg-slate-50 border-slate-200' : 'bg-black/60 border-white/10'
            }`}>
              <div>
                <p className={`text-[10px] uppercase font-black ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>Número de teléfono asignado</p>
                <p className={`font-mono text-base sm:text-lg font-black select-all tracking-wider ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                  {smsActiveOrder.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(smsActiveOrder.phone)
                  setToast({ type: 'success', text: '¡Número copiado al portapapeles!' })
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-black active:scale-95 transition ${
                  isWhiteTheme ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                Copiar
              </button>
            </div>

            {/* Código recibido */}
            {smsActiveOrder.code ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/20 p-3.5 border border-emerald-500/50 animate-in zoom-in-95 duration-200">
                <div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-black uppercase">Código de verificación</p>
                  <p className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-300 tracking-widest select-all">
                    {smsActiveOrder.code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(smsActiveOrder.code)
                    setToast({ type: 'success', text: '¡Código copiado al portapapeles!' })
                  }}
                  className="rounded-xl bg-emerald-400 hover:bg-emerald-300 px-4 py-2.5 text-xs font-black text-black shadow-lg active:scale-95 transition"
                >
                  Copiar Código
                </button>
              </div>
            ) : smsActiveOrder.status === 'canceled' || smsActiveOrder.status === 'failed' || smsActiveOrder.status === 'refunded' ? (
              <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-xs font-bold">
                <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>Número cancelado con éxito. Tu saldo ha sido reembolsado a tu cuenta.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 text-amber-500" />
                  <span className="text-[11px] font-medium leading-relaxed">
                    Esperando código SMS... Ingresa este número en la app y solicita el código. Cuando llegue, aparecerá aquí automáticamente.
                  </span>
                </div>

                {/* Temporizador de seguridad de 2 minutos para cancelar */}
                {(() => {
                  const createdTs = Math.floor(smsActiveOrder.created_at || smsNowSec)
                  const elapsed = Math.max(0, smsNowSec - createdTs)
                  const remSecs = Math.max(0, 120 - elapsed)
                  const canCancel = remSecs <= 0
                  const mins = Math.floor(remSecs / 60)
                  const secs = String(remSecs % 60).padStart(2, '0')

                  return (
                    <button
                      type="button"
                      disabled={smsCanceling}
                      onClick={() => {
                        if (!canCancel) {
                          alert(`Las políticas del proveedor exigen esperar 2 minutos desde la reserva para poder cancelar. Tiempo restante: ${mins}:${secs} min.`)
                          return
                        }
                        handleCancelSmsNumber()
                      }}
                      className={`w-full rounded-xl border p-2.5 text-center text-xs font-black transition flex items-center justify-center gap-2 ${
                        canCancel
                          ? 'border-red-500/40 bg-red-500/15 text-red-500 hover:bg-red-500/25 active:scale-98 cursor-pointer'
                          : isWhiteTheme ? 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                      }`}
                    >
                      {smsCanceling ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Cancelando y reembolsando saldo...</span>
                        </>
                      ) : (
                        <>
                          <CircleX className="h-4 w-4 text-red-500" />
                          <span>{canCancel ? 'Cancelar número y recuperar saldo' : `Cancelar número (Disponible en ${mins}:${secs} min)`}</span>
                        </>
                      )}
                    </button>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* BARRA DE COMPRA FIJA / INLINE DE NÚMERO */}
        {smsSelectedService && (
          <div className={`rounded-2xl border p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isWhiteTheme ? 'border-slate-200 bg-white/95 text-slate-900 shadow-xl' : 'border-white/15 bg-[#16181f]/95 text-white shadow-xl'
          }`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                  {smsServices.find(s => s.key === smsSelectedService)?.name || smsSelectedService}
                </span>
                <span className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                  ({smsCountries.find(c => c.key === smsSelectedCountry)?.name || smsSelectedCountry.toUpperCase()})
                </span>
              </div>
              <p className={`text-[11px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>
                Operador: {smsOperator === 'any' ? 'Automático' : smsOperator} · Stock:{' '}
                {Number(
                  (smsOperator === 'any'
                    ? smsOperators.reduce((sum, op) => sum + Number(op.qty || 0), 0)
                    : smsOperators.find(o => o.name === smsOperator)?.qty) ||
                    smsServices.find(s => s.key === smsSelectedService)?.qty ||
                    0
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-lg font-black" style={{ color: primaryColor }}>
                  ${Number(
                    (smsOperator === 'any'
                      ? smsOperators[0]?.price
                      : smsOperators.find(o => o.name === smsOperator)?.price) ||
                      smsServices.find(s => s.key === smsSelectedService)?.sell_price ||
                      0
                  ).toFixed(2)}{' '}
                  <span className={`text-[10px] font-bold ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>USDT</span>
                </p>
              </div>

              {!currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthModalOpen(true)
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-black active:scale-95 transition shadow-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  Iniciar sesión para comprar
                </button>
              ) : Number(currentUser.balance || 0) <
                Number(
                  (smsOperator === 'any'
                    ? smsOperators[0]?.price
                    : smsOperators.find(o => o.name === smsOperator)?.price) ||
                    smsServices.find(s => s.key === smsSelectedService)?.sell_price ||
                    0
                ) ? (
                <button
                  type="button"
                  onClick={() => setDepositModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-black active:scale-95 transition shadow-lg flex items-center gap-1.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Recargar saldo USDT</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={smsBuying}
                  onClick={handleBuySmsNumber}
                  className="px-6 py-2.5 rounded-xl text-xs font-black text-black active:scale-95 transition shadow-lg disabled:opacity-50 flex items-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {smsBuying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Reservando...</span>
                    </>
                  ) : (
                    <span>Comprar número</span>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODAL DE SELECCIÓN DE OPERADOR */}
        {smsOperatorsOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setSmsOperatorsOpen(false)}
          >
            <div
              className={`max-h-[66vh] w-full max-w-md overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl ${
                isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#16181f] text-white'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between border-b p-4 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
                <h3 className={`text-sm font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Seleccionar Operador</h3>
                <button
                  type="button"
                  onClick={() => setSmsOperatorsOpen(false)}
                  className={`rounded-lg p-1.5 transition ${isWhiteTheme ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white/70 hover:text-white'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto p-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setSmsOperator('any')
                    setSmsOperatorsOpen(false)
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    smsOperator === 'any'
                      ? 'border-transparent text-black font-black'
                      : isWhiteTheme
                      ? 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      : 'border-white/10 bg-black/40 text-white/80 hover:border-white/20'
                  }`}
                  style={smsOperator === 'any' ? { backgroundColor: primaryColor, color: '#000' } : {}}
                >
                  <span className="block font-black text-xs">Automático</span>
                  <span className={`text-[11px] ${smsOperator === 'any' ? 'text-black/70' : isWhiteTheme ? 'text-slate-500' : 'text-white/45'}`}>
                    Mejor precio disponible · $
                    {Number(smsOperators[0]?.price || smsServices.find(s => s.key === smsSelectedService)?.sell_price || 0).toFixed(2)} USDT
                  </span>
                </button>
                {smsOperators.map(op => {
                  const isOpSelected = smsOperator === op.name
                  return (
                    <button
                      key={op.name}
                      type="button"
                      onClick={() => {
                        setSmsOperator(op.name)
                        setSmsOperatorsOpen(false)
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isOpSelected
                          ? 'border-transparent text-black font-black'
                          : isWhiteTheme
                          ? 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                          : 'border-white/10 bg-black/40 text-white/80 hover:border-white/20'
                      }`}
                      style={isOpSelected ? { backgroundColor: primaryColor, color: '#000' } : {}}
                    >
                      <span className="block truncate font-black text-xs capitalize">{op.name}</span>
                      <span className={`text-[11px] ${isOpSelected ? 'text-black/70' : isWhiteTheme ? 'text-slate-500' : 'text-white/45'}`}>
                        {op.qty} disponibles · ${Number(op.price || 0).toFixed(2)} USDT
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )}

    {/* ─── PESTAÑA: MIS PEDIDOS (ESTILO FRANCHO SHOP) ─────────── */}
    {activeView === 'orders' && (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Cabecera con flecha para volver */}
        <div className={`flex items-center justify-between gap-3 pb-3 border-b ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('store')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border active:scale-95 transition shadow-sm ${
                isWhiteTheme ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100' : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
              }`}
              aria-label="Volver a la tienda"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className={`text-base sm:text-lg font-black flex items-center gap-2 ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                <ClipboardList className="h-5 w-5" style={{ color: primaryColor }} />
                <span>Mis Pedidos</span>
                {ordersIsOwnerView && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    👑 Modo Dueño
                  </span>
                )}
              </h2>
              <p className={`text-[11px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                {ordersIsOwnerView
                  ? 'Historial de compras y recargas recibidas en tu tienda web'
                  : 'Consulta el estado de tus compras o busca por ID / Teléfono'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadOrders(ordersQuery.trim())}
            disabled={ordersLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold active:scale-95 transition disabled:opacity-50 ${
              isWhiteTheme ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white'
            }`}
            title="Actualizar pedidos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* Banner de Soporte & Reclamos (Estilo Francho Shop) */}
        {whatsappNumber && (
          <div
            className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 shadow-sm ${
              isWhiteTheme
                ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white border-emerald-200'
                : 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent'
            }`}
            style={{ borderColor: `${primaryColor}30` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${primaryColor}20`,
                  borderColor: `${primaryColor}40`,
                  color: primaryColor
                }}
              >
                <Headphones className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>¿Problemas con alguna compra?</p>
                <p className={`text-[11px] truncate ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>Escríbenos directamente a soporte para resolverlo al instante</p>
              </div>
            </div>
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-black text-black hover:opacity-90 active:scale-95 transition shadow-sm flex items-center gap-1.5"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Soporte WhatsApp</span>
            </a>
          </div>
        )}

        {/* Buscador de pedidos */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            loadOrders(ordersQuery.trim())
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`} />
            <input
              type="text"
              placeholder="Buscar por Player ID / UID, Teléfono o Nº Pedido..."
              value={ordersQuery}
              onChange={(e) => setOrdersQuery(e.target.value)}
              className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-xs focus:outline-none transition shadow-inner ${
                isWhiteTheme
                  ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
                  : 'bg-[#16181f]/90 border-white/10 text-white placeholder-white/40 focus:border-white/30'
              }`}
            />
            {ordersQuery && (
              <button
                type="button"
                onClick={() => {
                  setOrdersQuery('')
                  loadOrders('')
                }}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${isWhiteTheme ? 'text-slate-400 hover:text-slate-700' : 'text-white/40 hover:text-white'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={ordersLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-black text-black shrink-0 transition active:scale-95 disabled:opacity-50 shadow"
            style={{ backgroundColor: primaryColor }}
          >
            {ordersLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {/* Filtros Tipo de Pedido: Todos / Automáticos / Manuales */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[
            { id: 'all', label: 'Todos los Tipos', count: ordersList.length },
            { id: 'auto', label: '⚡ Automáticos', count: ordersList.filter(o => o.type !== 'manual').length },
            { id: 'manual', label: '✍️ Manuales', count: ordersList.filter(o => o.type === 'manual').length },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setOrdersFilterType(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 flex items-center gap-1.5 ${
                ordersFilterType === f.id
                  ? 'shadow-sm font-black'
                  : isWhiteTheme ? 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50' : 'bg-white/5 hover:bg-white/10 text-white/60 border border-white/5'
              }`}
              style={
                ordersFilterType === f.id
                  ? { backgroundColor: `${primaryColor}25`, borderColor: `${primaryColor}80`, color: isWhiteTheme ? '#0f172a' : '#ffffff' }
                  : {}
              }
            >
              <span>{f.label}</span>
              <span className="text-[10px] opacity-70">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Filtros de Estado tipo Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[
            { id: 'all', label: 'Todos', count: ordersList.filter(o => ordersFilterType === 'all' || (ordersFilterType === 'auto' ? o.type !== 'manual' : o.type === 'manual')).length },
            { id: 'completed', label: 'Completados', count: ordersList.filter(o => o.status_code === 'completed' && (ordersFilterType === 'all' || (ordersFilterType === 'auto' ? o.type !== 'manual' : o.type === 'manual'))).length },
            { id: 'processing', label: 'Procesando', count: ordersList.filter(o => o.status_code === 'processing' && (ordersFilterType === 'all' || (ordersFilterType === 'auto' ? o.type !== 'manual' : o.type === 'manual'))).length },
            { id: 'pending', label: 'Pendientes', count: ordersList.filter(o => o.status_code === 'pending' && (ordersFilterType === 'all' || (ordersFilterType === 'auto' ? o.type !== 'manual' : o.type === 'manual'))).length },
            { id: 'cancelled', label: 'Cancelados', count: ordersList.filter(o => o.status_code === 'cancelled' && (ordersFilterType === 'all' || (ordersFilterType === 'auto' ? o.type !== 'manual' : o.type === 'manual'))).length },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setOrdersFilterStatus(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 ${
                ordersFilterStatus === f.id
                  ? 'shadow-sm'
                  : isWhiteTheme ? 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm' : 'bg-white/5 hover:bg-white/10 text-white/60 border border-white/5'
              }`}
              style={
                ordersFilterStatus === f.id
                  ? { backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}60`, color: primaryColor }
                  : {}
              }
            >
              <span>{f.label}</span>
              <span className="ml-1 text-[10px] opacity-70">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Lista de Pedidos */}
        <div className="space-y-2.5">
          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-20 rounded-2xl animate-pulse border ${isWhiteTheme ? 'bg-slate-200/80 border-slate-300/50' : 'bg-white/5 border-white/5'}`} />
              ))}
            </div>
          ) : ordersList.length === 0 ? (
            <div className={`rounded-2xl border p-8 text-center space-y-3 ${isWhiteTheme ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-[#16181f]/40'}`}>
              <PackageOpen className={`w-12 h-12 mx-auto ${isWhiteTheme ? 'text-slate-300' : 'text-white/20'}`} />
              <p className={`text-sm font-bold ${isWhiteTheme ? 'text-slate-600' : 'text-white/70'}`}>
                {ordersSearched
                  ? 'No se encontraron pedidos con ese criterio de búsqueda.'
                  : currentUser
                  ? 'Aún no tienes pedidos registrados con tu cuenta.'
                  : 'Ingresa tu Player ID o teléfono arriba para consultar tus pedidos.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveView('store')}
                className="px-4 py-2 rounded-xl text-xs font-black text-black inline-flex items-center gap-1.5 transition active:scale-95 shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Explorar Tienda</span>
              </button>
            </div>
          ) : (
            (() => {
              const filtered = ordersList.filter(o => {
                if (ordersFilterType === 'auto' && o.type === 'manual') return false
                if (ordersFilterType === 'manual' && o.type !== 'manual') return false
                if (ordersFilterStatus !== 'all' && o.status_code !== ordersFilterStatus) return false
                return true
              })

              if (filtered.length === 0) {
                return (
                  <div className={`rounded-2xl border p-8 text-center ${isWhiteTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#16181f]/40'}`}>
                    <p className={`text-sm ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>No hay pedidos con el estado seleccionado.</p>
                  </div>
                )
              }

              return filtered.map(order => {
                const orderKey = `${order.id || order.merchant_order_id}`
                const isExpanded = expandedOrders.has(orderKey)
                const isCompleted = order.status_code === 'completed'
                const isProcessing = order.status_code === 'processing'
                const isCancelled = order.status_code === 'cancelled'
                const dateFormatted = order.created_at
                  ? new Date(order.created_at * 1000).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })
                  : '—'

                return (
                  <div
                    key={orderKey}
                    className={`rounded-2xl border transition overflow-hidden ${
                      isWhiteTheme
                        ? isExpanded
                          ? 'border-slate-300 bg-white shadow-lg'
                          : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                        : isExpanded
                        ? 'border-white/30 bg-[#121829] shadow-lg shadow-black/40'
                        : 'border-white/10 bg-[#0e1322] hover:border-white/20'
                    }`}
                    style={isExpanded ? { borderColor: `${primaryColor}60` } : {}}
                  >
                    {/* Cabecera Clickable de Tarjeta (Estilo Oficial Francho Shop) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpandOrder(orderKey)}
                      className={`w-full text-left p-3.5 flex items-center gap-3 cursor-pointer select-none transition ${
                        isWhiteTheme ? 'hover:bg-slate-50 active:bg-slate-100' : 'hover:bg-white/[0.02] active:bg-white/[0.04]'
                      }`}
                    >
                      {/* Thumbnail con imagen real y fallback icon */}
                      <div className={`h-12 w-12 sm:h-13 sm:w-13 flex-shrink-0 overflow-hidden rounded-xl border relative flex items-center justify-center shadow-inner ${
                        isWhiteTheme ? 'border-slate-200 bg-slate-100' : 'border-white/10 bg-black/50'
                      }`}>
                        {order.product_image ? (
                          <img
                            src={toFastImageUrl(order.product_image)}
                            alt={order.product_name || 'Producto'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ display: order.product_image ? 'none' : 'flex' }}
                        >
                          {order.type === 'sms' ? (
                            <Smartphone className="h-5 w-5 text-emerald-500" />
                          ) : order.type === 'streaming' ? (
                            <Tv className="h-5 w-5 text-purple-500" />
                          ) : order.game_name ? (
                            <Gamepad2 className="h-5 w-5" style={{ color: primaryColor }} />
                          ) : (
                            <Package className="h-5 w-5 text-amber-500" />
                          )}
                        </div>
                      </div>

                      {/* Resumen Central */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1 ${
                            order.type === 'manual'
                              ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                          }`}>
                            {order.type === 'manual' ? '✍️ Manual' : order.type === 'sms' ? '📱 SMS' : order.type === 'streaming' ? '📺 Streaming' : '⚡ Automático'}
                          </span>
                          {order.game_name && order.game_name !== order.product_name && (
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              isWhiteTheme ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-white/70'
                            }`}>
                              {order.game_name}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border inline-flex items-center gap-1 ${
                              isCompleted
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                                : isProcessing
                                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/30'
                                : isCancelled
                                ? 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isCompleted ? <CircleCheck className="w-3 h-3 text-emerald-500" /> : isCancelled ? <CircleX className="w-3 h-3 text-red-500" /> : <Clock className="w-3 h-3 text-amber-500 animate-spin" />}
                            <span>{order.status_label || (isCompleted ? 'Completado' : isProcessing ? 'Procesando' : 'Pendiente')}</span>
                          </span>
                        </div>

                        <p className={`text-xs sm:text-sm font-black leading-tight truncate mt-1 ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                          {order.product_name}
                        </p>

                        <div className={`flex items-center gap-2 text-[10px] mt-0.5 truncate ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                          {order.type === 'sms' && order.phone ? (
                            <span className="font-mono text-emerald-600 dark:text-emerald-300 font-bold">{order.phone}</span>
                          ) : order.player_id ? (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">ID: {order.player_id}</span>
                          ) : order.client_name ? (
                            <span>{order.client_name}</span>
                          ) : null}
                          {(order.phone || order.player_id || order.client_name) && <span>•</span>}
                          <span>{dateFormatted}</span>
                        </div>
                      </div>

                      {/* Precio y Chevron */}
                      <div className="flex flex-col items-end justify-center shrink-0 pl-1">
                        <span className={`text-sm sm:text-base font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                          ${Number(order.sell_price || 0).toFixed(2)} <span className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>USD</span>
                        </span>
                        {order.cup_amount && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {Number(order.cup_amount).toLocaleString()} CUP
                          </span>
                        )}
                        <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>
                          <span className="hidden sm:inline font-bold">{isExpanded ? 'Ocultar' : 'Detalles'}</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}
                            style={isExpanded ? { color: primaryColor } : {}}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detalle Expandible Completo Estilo Francho Shop */}
                    {isExpanded && (
                      <div className={`border-t p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-200 ${
                        isWhiteTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#0a0e1a]/90'
                      }`}>
                        {/* Caja de Datos Principales */}
                        <div className={`grid gap-1.5 rounded-xl p-3 text-xs border ${
                          isWhiteTheme ? 'bg-white border-slate-200 text-slate-700 shadow-sm' : 'bg-black/40 border-white/5 text-white/70'
                        }`}>
                          <div className="flex items-center justify-between">
                            <p><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>Nº Pedido:</span> <code className={`font-mono font-bold ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>#{order.id || order.merchant_order_id}</code></p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(String(order.id || order.merchant_order_id))
                                showToast('success', 'ID de pedido copiado')
                              }}
                              className={`text-[10px] px-2.5 py-1 rounded-lg transition active:scale-95 flex items-center gap-1 ${
                                isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'text-white/60 hover:text-white bg-white/10 hover:bg-white/20'
                              }`}
                            >
                              <Copy className="h-3 w-3" />
                              <span>Copiar ID</span>
                            </button>
                          </div>
                          <p><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>Fecha:</span> {dateFormatted}</p>

                          {/* ID de Jugador si existe */}
                          {order.player_id && (
                            <div className="flex items-center justify-between">
                              <p>
                                <span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>
                                  {order.order_type === 'streaming' || order.order_type === 'sms' || order.order_type === 'manual' || (order.game_name || '').toLowerCase().includes('streaming')
                                    ? 'Contacto / Entrega:'
                                    : 'ID Jugador:'}
                                </span> <code className="text-emerald-500 font-mono font-bold select-all">{order.player_id}</code>
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(String(order.player_id))
                                  showToast('success', 'ID de jugador copiado')
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded transition ${
                                  isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'text-white/60 hover:text-white bg-white/10 hover:bg-white/20'
                                }`}
                              >
                                Copiar
                              </button>
                            </div>
                          )}
                          {order.zone_id && (
                            <p><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>Zona / Servidor:</span> <code className={`font-mono ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>{order.zone_id}</code></p>
                          )}

                          {/* Detalles dinámicos adicionales */}
                          {order.recharge_details && order.recharge_details.map((item, idx) => (
                            <p key={idx}><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>{item.label}:</span> <span className={`font-semibold ${isWhiteTheme ? 'text-slate-900' : 'text-white/90'}`}>{item.value}</span></p>
                          ))}

                          <p><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>Método de Pago:</span> <span className={`font-semibold ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>{order.payment_method === 'cup' ? 'Transfermóvil / EnZona (CUP)' : order.payment_method === 'oxapay' ? 'Cripto OxaPay (USDT)' : (order.payment_method || 'Saldo USDT')}</span></p>
                          {order.cup_reference && (
                            <p><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>Referencia de Pago:</span> <code className={`font-mono ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>{order.cup_reference}</code></p>
                          )}

                          {/* Datos del Cliente y Contacto WhatsApp para el Dueño */}
                          {(isOwner || ordersIsOwnerView) && (order.client_name || order.client_contact || (order.type === 'sms' && order.phone)) && (
                            <div className={`mt-2 pt-2 border-t space-y-1.5 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
                              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">Datos del Cliente (Panel Dueño)</span>
                              {order.client_name && (
                                <p><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>Cliente:</span> <strong className={isWhiteTheme ? 'text-slate-900' : 'text-white'}>{order.client_name}</strong></p>
                              )}
                              {(order.client_contact || order.phone) && (
                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <p className="truncate"><span className={isWhiteTheme ? 'text-slate-400' : 'text-white/40'}>Contacto:</span> <span className="font-mono text-emerald-400 font-bold">{order.client_contact || order.phone}</span></p>
                                  <a
                                    href={`https://wa.me/${String(order.client_contact || order.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${order.client_name || ''}! Te contacto de ${storeName || 'la tienda'} referente a tu pedido #${order.id || order.merchant_order_id} de "${order.product_name}".`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-black flex items-center gap-1 transition active:scale-95 shrink-0"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* SECCIÓN NÚMEROS VIRTUALES SMS (EXPANDIBLE ESTILO FRANCHO SHOP) */}
                        {order.type === 'sms' && (
                          <div className={`space-y-2.5 p-3.5 rounded-xl border ${
                            isWhiteTheme ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/25'
                          }`}>
                            <div className={`flex items-center justify-between pb-1.5 border-b ${
                              isWhiteTheme ? 'border-emerald-200' : 'border-emerald-500/20'
                            }`}>
                              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                                <Smartphone className="h-3.5 w-3.5" />
                                <span>Número Virtual SMS</span>
                              </span>
                              <span className={`text-[10px] font-bold ${isWhiteTheme ? 'text-slate-500' : 'text-white/60'}`}>
                                {order.country ? order.country.toUpperCase() : ''} {order.service ? `· ${order.service.toUpperCase()}` : ''}
                              </span>
                            </div>

                            {/* Número Asignado con botón copiar */}
                            {order.phone && (
                              <div className={`flex items-center justify-between gap-2 p-2.5 rounded-xl text-xs border ${
                                isWhiteTheme ? 'bg-white border-slate-200 shadow-sm' : 'bg-black/40 border-white/10'
                              }`}>
                                <div className="min-w-0">
                                  <span className={`block text-[9px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>Número Asignado</span>
                                  <span className="block font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 select-all">{order.phone}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(order.phone)
                                    showToast('success', 'Número copiado al portapapeles')
                                  }}
                                  className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-200 text-xs font-bold transition active:scale-95 flex items-center gap-1"
                                >
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar</span>
                                </button>
                              </div>
                            )}

                            {/* Código SMS recibido */}
                            {(order.sms_code || order.code) ? (
                              <div className={`flex items-center justify-between gap-2 rounded-xl border p-3 shadow-lg ${
                                isWhiteTheme
                                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 shadow-emerald-500/5'
                                  : 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/40 shadow-emerald-500/10'
                              }`}>
                                <div className="min-w-0">
                                  <span className="block text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-300">¡Código Recibido!</span>
                                  <span className={`block font-mono text-xl font-black tracking-wider select-all ${isWhiteTheme ? 'text-emerald-700' : 'text-white'}`}>{order.sms_code || order.code}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(order.sms_code || order.code)
                                    showToast('success', '¡Código SMS copiado!')
                                  }}
                                  className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-black transition active:scale-95 shadow-md flex items-center gap-1.5"
                                >
                                  <Check className="h-4 w-4" />
                                  <span>Copiar Código</span>
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 py-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className={isWhiteTheme ? 'text-slate-500' : 'text-white/60'}>Estado de recepción:</span>
                                  <span className={order.status_code === 'cancelled' ? 'text-red-500 font-bold' : 'text-amber-500 font-bold animate-pulse'}>
                                    {order.status_code === 'cancelled' ? 'Cancelado / Reembolsado' : '⏳ Esperando código SMS...'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      await syncWebStoreSmsOrder(order)
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 ${
                                      isWhiteTheme ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm' : 'bg-white/10 hover:bg-white/20 text-white'
                                    }`}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    <span>Consultar si llegó el código</span>
                                  </button>
                                  {order.status_code === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        await cancelWebStoreSms(order)
                                      }}
                                      className="py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-bold transition active:scale-95 flex items-center gap-1"
                                    >
                                      <CircleX className="h-3 w-3" />
                                      <span>Cancelar</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SECCIÓN STREAMING / CUENTAS ENTREGADAS */}
                        {order.type === 'streaming' && order.credentials && order.credentials.length > 0 && (
                          <div className={`p-3.5 rounded-xl border space-y-2.5 ${
                            isWhiteTheme ? 'bg-purple-50/50 border-purple-200' : 'bg-purple-500/10 border-purple-500/25'
                          }`}>
                            <div className={`flex items-center justify-between pb-1 border-b ${
                              isWhiteTheme ? 'border-purple-200' : 'border-purple-500/20'
                            }`}>
                              <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-300 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Credenciales de Acceso Oficial</span>
                              </span>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                ✓ Entrega Inmediata
                              </span>
                            </div>

                            {order.credentials.map((cred, cIdx) => (
                              <div key={cIdx} className={`rounded-xl border p-3 space-y-2 ${
                                isWhiteTheme ? 'border-purple-200 bg-white shadow-sm' : 'border-white/10 bg-[#0d111d]'
                              }`}>
                                {cred.profile && (
                                  <div className="text-[10px] font-black text-purple-600 dark:text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded inline-block border border-purple-500/30">
                                    {cred.profile}
                                  </div>
                                )}
                                {cred.email && (
                                  <div className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${
                                    isWhiteTheme ? 'bg-slate-50 border border-slate-200' : 'bg-white/5'
                                  }`}>
                                    <div className="min-w-0">
                                      <span className={`block text-[9px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>Correo / Usuario</span>
                                      <span className={`block font-mono text-xs truncate select-all ${isWhiteTheme ? 'text-slate-900 font-bold' : 'text-white'}`}>{cred.email}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cred.email); showToast('success', 'Correo copiado') }}
                                      className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold transition active:scale-95 ${
                                        isWhiteTheme ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-white'
                                      }`}
                                    >
                                      Copiar
                                    </button>
                                  </div>
                                )}
                                {cred.password && (
                                  <div className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${
                                    isWhiteTheme ? 'bg-slate-50 border border-slate-200' : 'bg-white/5'
                                  }`}>
                                    <div className="min-w-0">
                                      <span className={`block text-[9px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>Contraseña</span>
                                      <span className={`block font-mono text-xs font-bold truncate select-all ${isWhiteTheme ? 'text-slate-900' : 'text-accent'}`}>{cred.password}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cred.password); showToast('success', 'Contraseña copiada') }}
                                      className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold transition active:scale-95 ${
                                        isWhiteTheme ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-white'
                                      }`}
                                    >
                                      Copiar
                                    </button>
                                  </div>
                                )}
                                {cred.pin && (
                                  <div className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${
                                    isWhiteTheme ? 'bg-slate-50 border border-slate-200' : 'bg-white/5'
                                  }`}>
                                    <div className="min-w-0">
                                      <span className={`block text-[9px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>PIN de Perfil</span>
                                      <span className="block font-mono text-xs font-black text-emerald-600 dark:text-emerald-300 tracking-widest">{cred.pin}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cred.pin); showToast('success', 'PIN copiado') }}
                                      className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold transition active:scale-95 ${
                                        isWhiteTheme ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-white'
                                      }`}
                                    >
                                      Copiar
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* SECCIÓN GIFT CARDS / PINES */}
                        {order.card_data && (
                          <div className={`p-3 rounded-xl border space-y-1.5 ${
                            isWhiteTheme ? 'bg-amber-50/60 border-amber-200' : 'bg-amber-500/10 border-amber-500/25'
                          }`}>
                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-300">Código / PIN Digital</span>
                            <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                              isWhiteTheme ? 'bg-white border-amber-200 shadow-sm' : 'bg-black/50 border-white/10'
                            }`}>
                              <code className={`font-mono text-sm font-black select-all ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>{order.card_data}</code>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order.card_data); showToast('success', 'PIN copiado') }}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition active:scale-95 ${
                                  isWhiteTheme ? 'bg-amber-100 hover:bg-amber-200 text-amber-900' : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Botón WhatsApp directo para soporte de este pedido */}
                        {whatsappNumber && (
                          <a
                            href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola! Tengo una consulta sobre mi pedido #${order.id || order.merchant_order_id} de "${order.product_name}" (ID / Referencia: ${order.phone || order.player_id || 'N/A'}).`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition active:scale-95 shadow-sm ${
                              isWhiteTheme
                                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span>Consultar a soporte por este pedido</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            })()
          )}
        </div>
      </div>
    )}

    {/* ─── PESTAÑA: PERFIL Y AJUSTES (ESTILO FRANCHO SHOP) ─────── */}
    {activeView === 'profile' && (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Cabecera con flecha para volver */}
        <div className={`flex items-center justify-between gap-3 pb-3 border-b ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('store')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border active:scale-95 transition shadow-sm ${
                isWhiteTheme ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100' : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
              }`}
              aria-label="Volver a la tienda"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className={`text-base sm:text-lg font-black leading-tight ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Mi Perfil</h1>
              <p className={`text-[11px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>Ajustes de cuenta, seguridad y saldo</p>
            </div>
          </div>
        </div>

        {currentUser ? (
          <div className="space-y-3.5">
            {/* Tarjeta de Perfil Principal (Estilo Francho Shop App.jsx:17770) */}
            <div className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 shadow-xl ${
              isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#16181f]/90 text-white'
            }`}>
              {/* Glowing line top */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`
                }}
              />
              <div
                className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full blur-3xl opacity-20"
                style={{ backgroundColor: primaryColor }}
              />

              <div className="relative flex items-center gap-3.5 sm:gap-4">
                {/* Avatar con anillo estilizado */}
                <div className="relative h-16 w-16 sm:h-18 sm:w-18 shrink-0">
                  <div
                    className={`h-16 w-16 sm:h-18 sm:w-18 overflow-hidden rounded-full border-2 ring-2 flex items-center justify-center text-2xl sm:text-3xl font-black shadow-lg ${
                      isWhiteTheme ? 'bg-slate-100' : 'bg-black/40'
                    }`}
                    style={{
                      borderColor: primaryColor,
                      color: primaryColor,
                      boxShadow: `0 0 15px ${primaryColor}30`
                    }}
                  >
                    {(currentUser.first_name || currentUser.username || 'U')[0].toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-1 -right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-md ${
                    isWhiteTheme ? 'border-white bg-slate-100 text-amber-500' : 'border-[#16181f] bg-black text-amber-400'
                  }`}>
                    {isOwner ? <Crown className="h-3 w-3 text-amber-500" /> : <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                  </span>
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className={`truncate text-base sm:text-lg font-black leading-tight ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                      {currentUser.display_name || currentUser.first_name || currentUser.username || 'Cliente'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileEditName(currentUser.display_name || currentUser.first_name || currentUser.username || '')
                        setProfileEditEmail(currentUser.email || '')
                        setProfileEditMsg(null)
                        setUserProfileModalOpen(true)
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer shrink-0 ${
                        isWhiteTheme ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/90'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                      <span>Editar</span>
                    </button>
                  </div>
                  <p className={`truncate text-xs ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                    {(currentUser.email) || (currentUser.username ? `@${currentUser.username}` : ((currentUser.id || currentUser.user_id) ? `ID: ${currentUser.id || currentUser.user_id}` : ''))}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <div
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderColor: `${primaryColor}40`,
                        color: primaryColor
                      }}
                    >
                      {isOwner ? (
                        <>
                          <Crown className="h-3 w-3 shrink-0" />
                          <span>👑 Dueño de la Tienda</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3 w-3 shrink-0" />
                          <span>Cliente Verificado</span>
                        </>
                      )}
                    </div>
                    <span className={`text-[10px] ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>
                      {storeName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Saldo y Recarga compacta integrada (Francho Shop App.jsx:17817) */}
              <div className={`mt-4 flex items-center justify-between gap-3 pt-3 border-t ${isWhiteTheme ? 'border-slate-200' : 'border-white/5'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>Tu Saldo:</span>
                  <strong className={`text-base sm:text-lg font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                    ${Number(currentUser.balance || 0).toFixed(2)}{' '}
                    <span className="text-xs font-bold text-emerald-500">USDT</span>
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDepositAmount('10')
                    setDepositResult(null)
                    setDepositError('')
                    setDepositModalOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black text-black active:scale-95 transition shadow cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  <span>Recargar</span>
                </button>
              </div>
            </div>

            {/* Lista de Acciones Simplificadas (Estilo Francho Shop space-y-1.5) */}
            <div className="space-y-1.5">
              {/* Mis pedidos */}
              <button
                type="button"
                onClick={() => openOrdersTab()}
                className={`w-full px-3.5 py-3 rounded-2xl flex items-center justify-between border active:scale-[0.99] transition shadow-sm ${
                  isWhiteTheme ? 'border-slate-200 bg-white hover:border-slate-300 text-slate-800' : 'border-white/10 hover:border-white/20 bg-[#16181f]/80'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                      borderColor: `${primaryColor}30`,
                      color: primaryColor
                    }}
                  >
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <span className={`text-left font-bold text-xs sm:text-sm truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Mis pedidos</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {ordersList.length > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                      isWhiteTheme ? 'text-slate-600 bg-slate-100 border-slate-200' : 'text-white/50 bg-white/5 border-white/5'
                    }`}>
                      {ordersList.length} pedidos
                    </span>
                  )}
                  <ChevronRight className={`h-4 w-4 ${isWhiteTheme ? 'text-slate-400' : 'text-white/30'}`} />
                </div>
              </button>

              {/* Centro de Ayuda & Contacto */}
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full px-3.5 py-3 rounded-2xl flex items-center justify-between border active:scale-[0.99] transition shadow-sm ${
                    isWhiteTheme ? 'border-slate-200 bg-white hover:border-emerald-300 text-slate-800' : 'border-white/10 hover:border-emerald-500/30 bg-[#16181f]/80'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-500">
                      <Headphones className="h-4 w-4" />
                    </div>
                    <span className={`text-left font-bold text-xs sm:text-sm truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Centro de Ayuda & Soporte</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                      WhatsApp
                    </span>
                    <ChevronRight className={`h-4 w-4 ${isWhiteTheme ? 'text-slate-400' : 'text-white/30'}`} />
                  </div>
                </a>
              )}

              {/* Personalizar Tienda Web (Solo si es dueño) */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setCustomizerOpen(true)}
                  className={`w-full px-3.5 py-3 rounded-2xl flex items-center justify-between border active:scale-[0.99] transition shadow-sm ${
                    isWhiteTheme
                      ? 'border-amber-300 hover:border-amber-400 bg-gradient-to-r from-amber-50 via-amber-50/50 to-white'
                      : 'border-amber-500/30 hover:border-amber-400/50 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-[#16181f]/80'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-500">
                      <Palette className="h-4 w-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <span className={`font-bold text-xs sm:text-sm block truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Personalizar Tienda Web</span>
                      <span className={`text-[10px] ${isWhiteTheme ? 'text-amber-800' : 'text-amber-300/80'}`}>Editar diseño, logo, banner y métodos de pago</span>
                    </div>
                  </span>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${isWhiteTheme ? 'text-amber-600' : 'text-amber-300/60'}`} />
                </button>
              )}

              {/* Editar información de perfil */}
              <button
                type="button"
                onClick={() => {
                  setProfileEditName(currentUser.display_name || currentUser.first_name || currentUser.username || '')
                  setProfileEditEmail(currentUser.email || '')
                  setProfileEditMsg(null)
                  setUserProfileModalOpen(true)
                }}
                className={`w-full px-3.5 py-3 rounded-2xl flex items-center justify-between border active:scale-[0.99] transition shadow-sm ${
                  isWhiteTheme ? 'border-slate-200 bg-white hover:border-slate-300 text-slate-800' : 'border-white/10 hover:border-white/20 bg-[#16181f]/80'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                      borderColor: `${primaryColor}30`,
                      color: primaryColor
                    }}
                  >
                    <User className="h-4 w-4" />
                  </div>
                  <span className={`text-left font-bold text-xs sm:text-sm truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                    Editar información de perfil
                  </span>
                </span>
                <ChevronRight className={`h-4 w-4 ${isWhiteTheme ? 'text-slate-400' : 'text-white/30'}`} />
              </button>

              {/* Contraseña de Acceso */}
              <button
                type="button"
                onClick={() => {
                  setPwdMsg(null)
                  setShowPwdModal(true)
                }}
                className={`w-full px-3.5 py-3 rounded-2xl flex items-center justify-between border active:scale-[0.99] transition shadow-sm ${
                  isWhiteTheme ? 'border-slate-200 bg-white hover:border-slate-300 text-slate-800' : 'border-white/10 hover:border-white/20 bg-[#16181f]/80'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isWhiteTheme ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/60'
                  }`}>
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <span className={`text-left font-bold text-xs sm:text-sm truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Contraseña de acceso</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>Seguridad</span>
                  <ChevronRight className={`h-4 w-4 ${isWhiteTheme ? 'text-slate-400' : 'text-white/30'}`} />
                </div>
              </button>

              {/* Sesión Activa y Cerrar Sesión */}
              <div className={`px-3.5 py-3 rounded-2xl flex items-center justify-between border shadow-sm ${
                isWhiteTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#16181f]/60'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isWhiteTheme ? 'bg-white border-slate-200 text-slate-400' : 'bg-white/5 border-white/10 text-white/40'
                  }`}>
                    <LockKeyhole className="h-4 w-4" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className={`font-bold text-xs truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Sesión activa</p>
                    <p className={`text-[10px] truncate ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>
                      {currentUser.email ? `Vía ${currentUser.email}` : 'Sesión activa'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-500 active:scale-95 transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-500" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Estado sin sesión iniciada */
          <div className={`rounded-3xl border p-6 text-center space-y-4 shadow-xl ${
            isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#16181f]/80 text-white'
          }`}>
            <div
              className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto"
              style={{
                backgroundColor: `${primaryColor}15`,
                borderColor: `${primaryColor}30`,
                color: primaryColor
              }}
            >
              <User className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className={`text-base font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Inicia Sesión en {storeName}</h3>
              <p className={`text-xs max-w-sm mx-auto ${isWhiteTheme ? 'text-slate-600' : 'text-white/60'}`}>
                Inicia sesión o regístrate para recargar saldo USDT, hacer seguimiento a tus compras y consultar tus pedidos en un solo lugar.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                  setAuthModalOpen(true)
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black text-black active:scale-95 transition shadow cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register')
                  setAuthError('')
                  setAuthModalOpen(true)
                }}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black border active:scale-95 transition cursor-pointer ${
                  isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200' : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                }`}
              >
                Crear Cuenta
              </button>
            </div>
          </div>
        )}
      </div>
    )}
      </main>

      {/* ─── PANTALLA DE COMPRA ESTILO FRANCHO SHOP (100% USDT) ─── */}
      {activeGameModal && (() => {
        const isModalStreaming = Boolean(
          activeGameModal.is_streaming ||
          activeGameModal.category === 'streaming' ||
          activeGameModal.provider_type === 'streaming' ||
          (activeGameModal.id && String(activeGameModal.id).startsWith('streaming_')) ||
          (activeGameModal.id && String(activeGameModal.id).startsWith('sz_')) ||
          (selectedProduct?.provider_type === 'streaming')
        )
        const isModalGiftcard = Boolean(
          activeGameModal.category === 'giftcard' ||
          activeGameModal.provider_type === 'giftcard' ||
          selectedProduct?.provider_type === 'giftcard'
        )
        const isModalManual = Boolean(
          activeGameModal.is_manual ||
          activeGameModal.category === 'manual' ||
          selectedProduct?.is_manual
        )
        const isModalSms = Boolean(
          activeGameModal.is_sms ||
          activeGameModal.category === 'sms' ||
          activeGameModal.provider_type === 'sms' ||
          selectedProduct?.is_sms
        )

        return (
        <div className={`fixed inset-0 z-50 flex flex-col h-full w-full ${isWhiteTheme ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#0b0f17] text-white'} overflow-hidden animate-in fade-in duration-200`}>
          {/* STEP 1: Encabezado Fijo del Juego (Hero Card + Paquetes) */}
          {checkoutStep === 1 && (
            <header className={`flex-shrink-0 z-30 w-full ${isWhiteTheme ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b0f17] border-white/10 shadow-xl'} border-b`}>
              <div className="mx-auto w-full max-w-lg px-3.5 pt-3 pb-2.5 space-y-2.5">
                {/* Hero Card */}
                <section className={`relative overflow-hidden rounded-2xl border ${isWhiteTheme ? 'border-slate-200 bg-gradient-to-b from-white to-slate-50 text-slate-900' : 'border-white/10 bg-gradient-to-b from-[#151c2a] to-[#0e131d] text-white'} p-3 sm:p-3.5 shadow-md`}>
                  <div
                    className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl opacity-20"
                    style={{ backgroundColor: primaryColor }}
                  />

                  {/* Acciones superiores dentro de la tarjeta */}
                  <div className="relative flex items-center justify-between gap-2 mb-2">
                    <button
                      type="button"
                      onClick={handleCloseGameModal}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border active:scale-90 transition shadow-sm cursor-pointer ${
                        isWhiteTheme ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      }`}
                      aria-label="Regresar"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400">
                        <Zap className="h-3 w-3 fill-emerald-400/20" /> Automático 24/7
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        <span className="inline-flex text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        </span>
                        5.0
                      </span>
                    </div>

                    {whatsappNumber ? (
                      <a
                        href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=Hola!%20Tengo%20una%20duda%20con%20${encodeURIComponent(activeGameModal.title || activeGameModal.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-7 px-2.5 items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black active:scale-90 transition"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCloseGameModal}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                          isWhiteTheme ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Imagen circular y detalles del juego */}
                  <div className="relative flex items-center gap-3">
                    <div
                      className={`relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 overflow-hidden rounded-full border-2 ${
                        isWhiteTheme ? 'bg-slate-100 shadow-md ring-2 ring-slate-200' : 'bg-[#0b0f17] shadow-lg shadow-black/50 ring-2 ring-white/10'
                      } flex items-center justify-center text-xl`}
                      style={{ borderColor: primaryColor }}
                    >
                      {activeGameModal.icon_url ? (
                        <OptimizedImage
                          src={activeGameModal.icon_url}
                          alt=""
                          className="h-full w-full object-cover"
                          fetchPriority="high"
                          fallbackSrc={null}
                        />
                      ) : (
                        <span>
                          {isModalManual ? <Package className="h-6 w-6" style={{ color: primaryColor }} /> : isModalGiftcard ? <Gift className="h-6 w-6" style={{ color: primaryColor }} /> : isModalStreaming ? <Tv className="h-6 w-6" style={{ color: primaryColor }} /> : <Gamepad2 className="h-6 w-6" style={{ color: primaryColor }} />}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${primaryColor}15`,
                            borderColor: `${primaryColor}30`,
                            color: primaryColor
                          }}
                        >
                          {isModalStreaming
                            ? 'Suscripción / Cuenta Oficial'
                            : isModalManual
                            ? 'Producto Exclusivo'
                            : isModalGiftcard
                            ? 'Código Digital / PIN'
                            : isModalSms
                            ? 'SMS Virtual'
                            : 'Recarga Directa ID'}
                        </span>
                        {(() => {
                          const rMatch = availableRegions.find(r => r.raw_name === selectedRegion || r.category_id === selectedRegion)
                          const regDisp = rMatch?.name || (selectedRegion && !selectedRegion.includes('_') ? selectedRegion : '')
                          return regDisp ? (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              isWhiteTheme ? 'text-slate-700 bg-slate-100 border-slate-200' : 'text-white/60 bg-white/5 border-white/10'
                            }`}>
                              {regDisp}
                            </span>
                          ) : null
                        })()}
                      </div>
                      <h2 className={`truncate text-base font-black tracking-tight leading-tight ${
                        isWhiteTheme ? 'text-slate-900' : 'text-white'
                      }`}>
                        {cleanFzrPackageName(activeGameModal.title || activeGameModal.name)}
                      </h2>
                      <p className={`text-[11px] line-clamp-1 mt-0.5 ${
                        isWhiteTheme ? 'text-slate-600' : 'text-white/60'
                      }`}>
                        {isModalStreaming
                          ? 'Cuenta oficial con garantía completa y entrega inmediata.'
                          : isModalGiftcard
                          ? 'Código digital oficial con entrega instantánea.'
                          : isModalManual
                          ? (activeGameModal.description ? activeGameModal.description.split('\n')[0] : 'Entrega garantizada por la tienda')
                          : (activeGameModal.instructions || activeGameModal.description || 'Recarga directa y oficial para tu cuenta.')}
                      </p>
                    </div>
                  </div>

                  {/* Nota de entrega */}
                  <div className={`mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] leading-snug ${
                    isWhiteTheme ? 'border-slate-200 bg-slate-100/90 text-slate-700' : 'border-white/5 bg-black/30 text-white/65'
                  }`}>
                    <ShieldCheck className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className={`font-bold ${isWhiteTheme ? 'text-slate-900' : 'text-white/85'}`}>Entrega: </span>
                      <span>
                        {isModalStreaming
                          ? 'Automática e inmediata. Recibirás tus credenciales por Telegram, Gmail y en los detalles del pedido.'
                          : isModalGiftcard
                          ? 'Código o PIN digital instantáneo. Lo recibirás en tu correo o WhatsApp.'
                          : isModalManual
                          ? `Estimada: ${activeGameModal.delivery_time || selectedProduct?.delivery_time || 'Inmediato'}.`
                          : (activeGameModal.instructions || 'Directa y automática a tu cuenta. Solo necesitas ingresar tu ID.')}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Barra "Selecciona tu paquete" (Solo si hay múltiples opciones y no es manual) */}
                {!isModalStreaming && !isModalManual && filteredModalProducts.length > 1 && (
                  <div className="flex items-center justify-between px-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4" style={{ color: primaryColor }} />
                      <span className={`text-xs font-black uppercase tracking-wider ${isWhiteTheme ? 'text-slate-900' : 'text-white/90'}`}>
                        Selecciona tu paquete
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-semibold border px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderColor: `${primaryColor}30`,
                        color: primaryColor
                      }}
                    >
                      {loadingProducts ? 'Cargando...' : `${filteredModalProducts.length} opciones`}
                    </span>
                  </div>
                )}
              </div>
            </header>
          )}

          {/* STEP 2: Encabezado Fijo del Checkout */}
          {checkoutStep === 2 && (
            <header className={`flex-shrink-0 z-30 w-full ${isWhiteTheme ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b0f17] border-white/10 shadow-lg'} border-b`}>
              <div className="mx-auto flex w-full max-w-lg items-center justify-between px-3.5 py-3">
                <button
                  type="button"
                  onClick={() => setCheckoutStep(1)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer active:scale-95 ${
                    isWhiteTheme ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ArrowLeft className="h-4 w-4" style={{ color: primaryColor }} />
                  <span>Volver a paquetes</span>
                </button>

                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    borderColor: `${primaryColor}30`,
                    color: primaryColor
                  }}
                >
                  Paso 2 · Finalizar en USDT
                </span>
              </div>
            </header>
          )}

          {/* CUERPO CON SCROLL */}
          <main className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto px-3.5 pt-2.5 pb-36 space-y-3 scrollbar-thin">
            {/* ─── VISTA PASO 1: Catálogo y Datos del Jugador ─── */}
            {checkoutStep === 1 && (
              isModalManual ? (
                <div className="space-y-3">
                  {/* 1. SELECCIÓN DE PLAN / VARIANTE (Si tiene opciones) */}
                  {filteredModalProducts.length > 1 ? (
                    <section className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                          <Layers className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                          <span>Selecciona tu Opción / Plan</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isWhiteTheme ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/60'}`}>
                          {filteredModalProducts.length} opciones disponibles
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredModalProducts.map(opt => {
                          const isSelected = selectedProduct?.id === opt.id
                          const priceUsdt = Number(opt.sell_price || opt.price || 0)
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSelectedProduct(opt)}
                              className={`group relative flex items-center justify-between w-full rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                                isSelected
                                  ? 'border-accent bg-accent/15 ring-2 ring-accent/70 shadow-md'
                                  : isWhiteTheme
                                  ? 'border-slate-200 bg-white hover:border-slate-300 text-slate-800 shadow-sm'
                                  : 'border-white/10 bg-[#121824]/90 hover:border-white/20'
                              }`}
                              style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : {}}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div
                                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
                                    isSelected ? 'shadow-sm font-black' : isWhiteTheme ? 'border-slate-300 bg-slate-100' : 'border-white/25 bg-white/5'
                                  }`}
                                  style={isSelected ? { backgroundColor: primaryColor, color: '#000', borderColor: primaryColor } : {}}
                                >
                                  {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                                </div>
                                <div className="min-w-0">
                                  <span className={`block text-xs font-black truncate ${isSelected ? (isWhiteTheme ? 'text-slate-950' : 'text-white') : (isWhiteTheme ? 'text-slate-800' : 'text-white/90')}`}>
                                    {opt.variant_name || opt.name}
                                  </span>
                                  {opt.delivery_time && (
                                    <span className={`block text-[10px] font-medium ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                                      ⏱️ {opt.delivery_time}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-xs font-black block" style={{ color: primaryColor }}>
                                  ${priceUsdt.toFixed(2)}
                                </span>
                                <span className={`text-[9px] font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>USDT</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ) : (
                    /* Tarjeta elegante de precio para producto sin variantes o con opción única */
                    <div className={`flex items-center justify-between p-3.5 rounded-2xl border shadow-sm ${
                      isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#121824] text-white'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" style={{ color: primaryColor }} />
                        <div>
                          <span className="text-xs font-black block">
                            {selectedProduct?.name && selectedProduct.name !== activeGameModal.name ? selectedProduct.name : 'Precio del Producto'}
                          </span>
                          <span className={`text-[10px] font-semibold ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                            {selectedProduct?.name && selectedProduct.name !== activeGameModal.name ? 'Plan o Variante Seleccionada' : 'Entrega directa garantizada'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black" style={{ color: primaryColor }}>
                          ${Number(selectedProduct?.sell_price || selectedProduct?.price || activeGameModal.price || 0).toFixed(2)} USDT
                        </span>
                        {selectedProduct?.cup_price ? (
                          <span className={`block text-[10px] font-bold ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                            ≈ {selectedProduct.cup_price.toLocaleString('es-ES')} CUP
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* 2. SECCIÓN: DESCRIPCIÓN DEL PRODUCTO */}
                  {(selectedProduct?.description || activeGameModal.description) && (
                    <section className={`rounded-2xl border p-3.5 space-y-2 shadow-sm ${
                      isWhiteTheme ? 'border-slate-200 bg-white text-slate-800' : 'border-white/10 bg-[#121824] text-white'
                    }`}>
                      <div className="flex items-center gap-1.5 border-b pb-2" style={{ borderColor: isWhiteTheme ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }}>
                        <FileText className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                        <span className={`text-xs font-black uppercase tracking-wider ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                          Descripción del Producto
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed whitespace-pre-line ${isWhiteTheme ? 'text-slate-700' : 'text-white/80'}`}>
                        {selectedProduct?.description || activeGameModal.description}
                      </p>
                    </section>
                  )}

                  {/* 3. SECCIÓN: INSTRUCCIONES DE ENTREGA */}
                  {(selectedProduct?.instructions || activeGameModal.instructions) && (
                    <section className={`rounded-2xl border p-3.5 space-y-2 shadow-sm ${
                      isWhiteTheme ? 'border-amber-200 bg-amber-50/70 text-slate-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                    }`}>
                      <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: isWhiteTheme ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.2)' }}>
                        <div className="flex items-center gap-1.5">
                          <ClipboardList className="h-4 w-4 text-amber-500" />
                          <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Instrucciones de Entrega
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
                          Importante
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed whitespace-pre-line font-medium ${isWhiteTheme ? 'text-slate-800' : 'text-amber-100/90'}`}>
                        {selectedProduct?.instructions || activeGameModal.instructions}
                      </p>
                    </section>
                  )}

                  {/* 4. SECCIÓN: DATOS REQUERIDOS PARA LA ENTREGA */}
                  <section className={`rounded-2xl border p-3.5 space-y-2.5 shadow-md ${
                    isWhiteTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#121824]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                        <User className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                        <span>Datos para la Entrega</span>
                      </span>
                      <span className={`text-[10px] font-semibold ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>* Requerido</span>
                    </div>

                    <div className="space-y-1">
                      <label className={`block text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>
                        Correo o Cuenta para la Entrega <span className="text-red-400">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={orderForm.player_id}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, player_id: e.target.value }))}
                          placeholder="Ej: micorreo@gmail.com o usuario de contacto"
                          className={`w-full rounded-xl border px-3.5 py-2.5 pr-20 text-sm font-medium outline-none transition font-mono ${
                            isWhiteTheme
                              ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400'
                              : 'border-white/10 bg-[#0d121d] text-white placeholder:text-white/30'
                          }`}
                          style={{
                            borderColor: orderForm.player_id ? primaryColor : (isWhiteTheme ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)')
                          }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText()
                              if (text) setOrderForm(prev => ({ ...prev, player_id: text.trim() }))
                            } catch {}
                          }}
                          className={`absolute right-2 px-2.5 py-1 rounded-lg text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                            isWhiteTheme ? 'bg-slate-200/80 hover:bg-slate-300 text-slate-800' : 'bg-white/10 hover:bg-white/15'
                          }`}
                          style={{ color: primaryColor }}
                        >
                          Pegar
                        </button>
                      </div>
                      <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                        A este correo o contacto se enviará el acceso o activación del producto.
                      </p>
                    </div>
                  </section>

                  {/* 5. SECCIÓN: GARANTÍA Y DETALLES */}
                  <section className={`rounded-2xl border p-3.5 space-y-2 shadow-sm text-xs ${
                    isWhiteTheme ? 'border-slate-200 bg-white text-slate-800' : 'border-white/10 bg-[#121824] text-white'
                  }`}>
                    <div className={`flex items-center justify-between border-b pb-1.5 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
                      <span className={`font-black flex items-center gap-1.5 text-xs ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>Garantía y Entrega</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Garantía Oficial
                      </span>
                    </div>

                    <div className={`space-y-1.5 text-[11px] ${isWhiteTheme ? 'text-slate-700' : 'text-white/80'}`}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <b>Tiempo de Entrega:</b>
                        </span>
                        <span className="font-bold text-emerald-600">
                          {selectedProduct?.delivery_time || activeGameModal.delivery_time || 'Inmediato'}
                        </span>
                      </div>
                      {selectedProduct?.stock > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <b>Stock Disponible:</b>
                          </span>
                          <span className="font-bold text-amber-600">
                            {selectedProduct.stock} unidades
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
              <>
                {/* Selector de Región si hay más de 1 */}
                {availableRegions.length > 1 && !activeGameModal.is_manual && (
                  <div className={`p-3 rounded-2xl border space-y-2 ${isWhiteTheme ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-[#121824]'}`}>
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>
                      <Globe2 className={`w-3.5 h-3.5 ${isWhiteTheme ? 'text-slate-500' : 'text-white/60'}`} />
                      <span>Región / Servidor:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableRegions.map(r => {
                        const rVal = r.raw_name || r.name
                        const isSel = selectedRegion === rVal
                        return (
                          <button
                            key={rVal}
                            type="button"
                            onClick={() => handleSelectGame(activeGameModal, rVal)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                              isSel ? 'text-black shadow-md font-black' : isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                            }`}
                            style={isSel ? { backgroundColor: primaryColor, color: '#000' } : {}}
                          >
                            {r.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 1. DATOS PARA LA ENTREGA (Solo para Juegos / Recargas directas con ID) */}
                {!isModalStreaming && (
                  <section className={`rounded-2xl border p-3.5 space-y-2.5 shadow-md ${isWhiteTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#121824]'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                        <User className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                        <span>
                          {isModalGiftcard
                            ? '1. Datos de Entrega del PIN'
                            : isModalManual
                            ? '1. Datos de Entrega'
                            : isModalSms
                            ? '1. Datos de Contacto SMS'
                            : '1. Datos del jugador / Entrega'}
                        </span>
                      </span>
                      <span className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>* Requerido</span>
                    </div>

                    <div className="space-y-1">
                      <label className={`block text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>
                        {isModalManual
                          ? 'Dato de Entrega / Identificador'
                          : isModalSms
                          ? 'Tu WhatsApp o Teléfono para recibir el código'
                          : isModalGiftcard
                          ? 'Correo o WhatsApp para recibir el PIN'
                          : 'ID de Jugador (UID / Player ID)'} <span className="text-red-400">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={orderForm.player_id}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, player_id: e.target.value }))}
                          placeholder={
                            isModalManual
                              ? (activeGameModal.instructions || 'Ej: correo o cuenta de entrega')
                              : isModalSms
                              ? 'Ej: +5351234567 o usuario de Telegram'
                              : isModalGiftcard
                              ? 'Ej: micorreo@gmail.com o +535...'
                              : 'Pega o escribe tu Player ID'
                          }
                          className={`w-full rounded-xl border px-3.5 py-2.5 pr-20 text-sm font-medium outline-none transition font-mono ${
                            isWhiteTheme
                              ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400'
                              : 'border-white/10 bg-[#0d121d] text-white placeholder:text-white/30'
                          }`}
                          style={{
                            borderColor: orderForm.player_id ? primaryColor : (isWhiteTheme ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)')
                          }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText()
                              if (text) setOrderForm(prev => ({ ...prev, player_id: text.trim() }))
                            } catch {}
                          }}
                          className={`absolute right-2 px-2.5 py-1 rounded-lg text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                            isWhiteTheme ? 'bg-slate-200/80 hover:bg-slate-300 text-slate-800' : 'bg-white/10 hover:bg-white/15'
                          }`}
                          style={{ color: primaryColor }}
                        >
                          Pegar
                        </button>
                      </div>
                      <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                        {isModalGiftcard
                          ? 'El código o PIN oficial será entregado de inmediato a este contacto.'
                          : isModalSms
                          ? 'Te avisaremos por este medio cuando llegue el código de verificación.'
                          : isModalManual
                          ? (activeGameModal.instructions || 'Indica los datos necesarios para procesar la entrega.')
                          : 'Copia tu ID desde tu perfil en el juego.'}
                      </p>
                    </div>

                    {/* ID de Zona / Servidor si aplica (Solo para juegos como Mobile Legends) */}
                    {!isModalManual && !isModalStreaming && !isModalGiftcard && !isModalSms && (activeGameModal.name || '').toLowerCase().includes('legends') && (
                      <div className={`space-y-1 pt-1 border-t ${isWhiteTheme ? 'border-slate-200' : 'border-white/5'}`}>
                        <label className={`block text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>
                          ID de Zona / Servidor <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={orderForm.zone_id}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, zone_id: e.target.value }))}
                          placeholder="Ej: 2024"
                          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium outline-none font-mono ${
                            isWhiteTheme
                              ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
                              : 'border-white/10 bg-[#0d121d] text-white'
                          }`}
                        />
                      </div>
                    )}


                  </section>
                )}

                {/* 2. SELECCIÓN DE PAQUETE / SUSCRIPCIÓN */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                      {isModalStreaming ? <Sparkles className="h-3.5 w-3.5" style={{ color: primaryColor }} /> : null}
                      <span>{isModalStreaming ? 'Selecciona tu Suscripción' : isModalManual ? '2. Precio del Producto' : '2. Selecciona el Paquete'}</span>
                    </span>
                    {isModalStreaming && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ⚡ Entrega Inmediata
                      </span>
                    )}
                  </div>

                  {/* Subcategorías / tabs si hay diamantes, pases, etc. */}
                  {!activeGameModal.is_manual && products.length > 0 && (() => {
                    const diamondsCount = products.filter(p => getProductSubcategory(p) === 'diamonds').length
                    const passesCount = products.filter(p => getProductSubcategory(p) === 'passes').length
                    const specialsCount = products.filter(p => getProductSubcategory(p) === 'specials').length
                    const hasMulti = diamondsCount > 0 && (passesCount > 0 || specialsCount > 0)
                    if (!hasMulti) return null

                    return (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        <button
                          type="button"
                          onClick={() => setActiveSubcategory('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 shrink-0 ${
                            activeSubcategory === 'all'
                              ? 'text-black shadow-md font-black'
                              : isWhiteTheme
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                          }`}
                          style={activeSubcategory === 'all' ? { backgroundColor: primaryColor, color: '#000' } : {}}
                        >
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Todos ({products.length})</span>
                          </span>
                        </button>
                        {diamondsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveSubcategory('diamonds')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 shrink-0 ${
                              activeSubcategory === 'diamonds'
                                ? 'text-black shadow-md font-black'
                                : isWhiteTheme
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                            }`}
                            style={activeSubcategory === 'diamonds' ? { backgroundColor: primaryColor, color: '#000' } : {}}
                          >
                            <span className="flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5" />
                              <span>Diamantes ({diamondsCount})</span>
                            </span>
                          </button>
                        )}
                        {passesCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveSubcategory('passes')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 shrink-0 ${
                              activeSubcategory === 'passes'
                                ? 'text-black shadow-md font-black'
                                : isWhiteTheme
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                            }`}
                            style={activeSubcategory === 'passes' ? { backgroundColor: primaryColor, color: '#000' } : {}}
                          >
                            <span className="flex items-center gap-1">
                              <Crown className="w-3.5 h-3.5" />
                              <span>Pases ({passesCount})</span>
                            </span>
                          </button>
                        )}
                        {specialsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveSubcategory('specials')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 shrink-0 ${
                              activeSubcategory === 'specials'
                                ? 'text-black shadow-md font-black'
                                : isWhiteTheme
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                            }`}
                            style={activeSubcategory === 'specials' ? { backgroundColor: primaryColor, color: '#000' } : {}}
                          >
                            <span className="flex items-center gap-1">
                              <Gift className="w-3.5 h-3.5" />
                              <span>Especiales ({specialsCount})</span>
                            </span>
                          </button>
                        )}
                      </div>
                    )
                  })()}

                  {/* Lista de paquetes */}
                  <div className="grid grid-cols-1 gap-2">
                    {loadingProducts ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`flex items-center justify-between w-full rounded-xl border p-3.5 animate-pulse ${
                          isWhiteTheme ? 'border-slate-200 bg-slate-100' : 'border-white/5 bg-[#121824]/60'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className={`h-5 w-5 flex-shrink-0 rounded-full ${isWhiteTheme ? 'bg-slate-200' : 'bg-white/10'}`} />
                            <div className="min-w-0 space-y-1.5">
                              <div className={`h-4 w-36 rounded ${isWhiteTheme ? 'bg-slate-200' : 'bg-white/10'}`} />
                              <div className={`h-2.5 w-20 rounded ${isWhiteTheme ? 'bg-slate-100' : 'bg-white/5'}`} />
                            </div>
                          </div>
                          <div className={`h-5 w-16 rounded flex-shrink-0 ${isWhiteTheme ? 'bg-slate-200' : 'bg-white/10'}`} />
                        </div>
                      ))
                    ) : filteredModalProducts.length === 0 ? (
                      <div className={`rounded-2xl border p-6 text-center space-y-3 ${
                        isWhiteTheme ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-[#121824]'
                      }`}>
                        <PackageOpen className={`mx-auto h-10 w-10 ${isWhiteTheme ? 'text-slate-400' : 'text-white/30'}`} />
                        <p className={`text-sm font-bold ${isWhiteTheme ? 'text-slate-800' : 'text-white/80'}`}>No hay paquetes disponibles en este momento</p>
                      </div>
                    ) : (
                      filteredModalProducts.map(product => {
                        const isSelected = selectedProduct?.id === product.id
                        const cleanName = cleanFzrPackageName(product.name)
                        const priceUsdt = Number(product.sell_price || product.price || 0)

                        return (
                          <div
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className={`group relative flex items-center justify-between w-full rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer ${
                              isSelected
                                ? 'border-accent bg-accent/15 ring-2 ring-accent/70 shadow-lg'
                                : isWhiteTheme
                                ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800 shadow-sm'
                                : 'border-white/10 bg-[#121824]/90 hover:border-white/20 hover:bg-[#161f2e]'
                            }`}
                            style={
                              isSelected
                                ? {
                                    borderColor: primaryColor,
                                    backgroundColor: `${primaryColor}20`
                                  }
                                : {}
                            }
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <div
                                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
                                  isSelected ? 'shadow-sm font-black text-xs' : isWhiteTheme ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-white/25 bg-white/5'
                                }`}
                                style={
                                  isSelected
                                    ? {
                                        backgroundColor: primaryColor,
                                        color: '#000',
                                        borderColor: primaryColor
                                      }
                                    : {}
                                }
                              >
                                {isSelected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                              </div>
                              <div className="min-w-0">
                                <span className={`block text-sm font-black truncate transition-colors ${
                                  isSelected
                                    ? (isWhiteTheme ? 'text-slate-950' : 'text-white')
                                    : (isWhiteTheme ? 'text-slate-800 group-hover:text-slate-950' : 'text-white/90 group-hover:text-white')
                                }`}>
                                  {cleanName}
                                </span>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <span className="text-sm font-black block" style={{ color: primaryColor }}>
                                ${priceUsdt.toFixed(2)}
                              </span>
                              <span className={`text-[10px] font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>USDT</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>

                {/* TÉRMINOS Y CONDICIONES / GARANTÍA DEL PROVEEDOR (Streaming / Suscripciones) */}
                {isModalStreaming && (
                  <section className={`rounded-2xl border p-3.5 space-y-2.5 shadow-md text-xs ${
                    isWhiteTheme ? 'border-slate-200 bg-white text-slate-800' : 'border-white/10 bg-[#121824] text-white'
                  }`}>
                    <div className={`flex items-center justify-between border-b pb-2 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
                      <span className={`font-black flex items-center gap-1.5 text-xs ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>Términos y Condiciones del Proveedor</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Garantía Oficial
                      </span>
                    </div>

                    {(() => {
                      const rawDesc = activeGameModal.description || ''
                      const cleanDesc = rawDesc
                        .replace(/^📌?\s*T[ÉE]RMINOS\s*Y\s*CONDICIONES\s*[-–—:]*\s*[A-Z\s()]*:?/i, '')
                        .replace(/^📌?\s*T[ÉE]RMINOS\s*Y\s*CONDICIONES\s*:?/i, '')
                        .trim()
                      if (!cleanDesc) return null
                      return (
                        <p className={`text-[11px] leading-relaxed whitespace-pre-line ${isWhiteTheme ? 'text-slate-600' : 'text-white/70'}`}>
                          {cleanDesc}
                        </p>
                      )
                    })()}

                    <div className={`space-y-1.5 text-[11px] ${isWhiteTheme ? 'text-slate-700' : 'text-white/80'}`}>
                      <div className="flex items-start gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span><b>Entrega Inmediata:</b> Las credenciales de acceso (correo, contraseña y perfil/PIN) se generan automáticamente y se muestran al instante en los detalles de tu pedido.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span><b>Garantía Total:</b> Soporte oficial y reemplazo garantizado durante toda la vigencia contratada.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span><b>Reglas de Uso:</b> No modificar el correo ni la clave asignada para conservar la garantía válida.</span>
                      </div>
                    </div>
                  </section>
                )}
              </>
            ))}

            {/* ─── VISTA PASO 2: Resumen del Pedido y Métodos de Pago (SOLO USDT) ─── */}
            {checkoutStep === 2 && selectedProduct && (
              <div className="space-y-4">
                {/* Resumen del Pedido */}
                <section className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 shadow-lg ${
                  isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#121824]'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-2.5 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border ${isWhiteTheme ? 'bg-slate-100' : 'bg-black'} flex items-center justify-center`}
                        style={{ borderColor: primaryColor }}
                      >
                        {activeGameModal.icon_url ? (
                          <OptimizedImage
                            src={activeGameModal.icon_url}
                            alt=""
                            className="h-full w-full object-cover"
                            fallbackEmoji={activeGameModal.emoji || '🎮'}
                          />
                        ) : (
                          <span className="text-sm font-black">{activeGameModal.emoji || '🎮'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-sm font-black truncate ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                          {activeGameModal.title || activeGameModal.name}
                        </h3>
                        <span className={`text-[10px] block truncate ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                          {isModalStreaming
                            ? 'Entrega: '
                            : isModalGiftcard || isModalManual || isModalSms
                            ? 'Contacto: '
                            : 'ID: '}
                          <b className={`font-mono ${isWhiteTheme ? 'text-slate-800' : 'text-white'}`}>
                            {isModalStreaming
                              ? (orderForm.client_contact || currentUser?.email || 'Detalles del Pedido, Telegram y Gmail')
                              : orderForm.player_id}
                          </b>
                          {orderForm.zone_id && !isModalStreaming ? ` (Zona: ${orderForm.zone_id})` : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCheckoutStep(1)}
                      className="text-xs font-bold hover:underline cursor-pointer"
                      style={{ color: primaryColor }}
                    >
                      Modificar
                    </button>
                  </div>

                  {/* Paquete seleccionado */}
                  <div className={`flex items-center justify-between text-xs py-2 px-3 rounded-xl border ${
                    isWhiteTheme ? 'bg-slate-100/90 border-slate-200 text-slate-900' : 'bg-black/40 border-white/5 text-white'
                  }`}>
                    <div className="min-w-0 pr-2">
                      <span className={`font-semibold truncate block ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                        {cleanFzrPackageName(selectedProduct.name)}
                      </span>
                    </div>
                    <span className="font-mono font-bold flex-shrink-0" style={{ color: primaryColor }}>
                      ${Number(selectedProduct.sell_price || selectedProduct.price).toFixed(2)} USDT
                    </span>
                  </div>

                  {/* Total */}
                  <div className={`flex items-center justify-between pt-2 border-t ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
                    <span className={`text-xs font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>Total a pagar:</span>
                    <span className="text-lg font-black" style={{ color: primaryColor }}>
                      ${Number(selectedProduct.sell_price || selectedProduct.price).toFixed(2)} USDT
                    </span>
                  </div>
                </section>

                {/* Métodos de Pago Disponibles (SOLO EN USDT) */}
                <section className="space-y-2">
                  <span className={`text-xs font-black uppercase tracking-wider block px-0.5 ${
                    isWhiteTheme ? 'text-slate-900' : 'text-white/80'
                  }`}>
                    Selecciona tu Método de Pago (USDT)
                  </span>

                  <div className="grid grid-cols-1 gap-2">
                    {/* Opción 1: OxaPay (USDT Automático) */}
                    <div
                      onClick={() => setCheckoutPaymentMethod('oxapay')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                        checkoutPaymentMethod === 'oxapay'
                          ? 'border-yellow-400 bg-yellow-400/10 ring-1 ring-yellow-400/40'
                          : isWhiteTheme
                          ? 'border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
                          : 'border-white/10 bg-[#121824]/90 text-white/70 hover:bg-[#161f2e]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-yellow-400/15 border border-yellow-400/30 text-yellow-500 flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>OxaPay (Cripto USDT Automático)</p>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-600 border border-yellow-400/30">
                              24/7
                            </span>
                          </div>
                          <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>USDT (TRC20, BEP20, TON, Polygon) con acreditación automática</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        checkoutPaymentMethod === 'oxapay' ? 'border-yellow-400 bg-yellow-400 text-black' : isWhiteTheme ? 'border-slate-300' : 'border-white/20'
                      }`}>
                        {checkoutPaymentMethod === 'oxapay' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Opción 2: Saldo USDT en Cuenta */}
                    <div
                      onClick={() => {
                        if (!currentUser) {
                          setAuthMode('login')
                          setAuthModalOpen(true)
                          return
                        }
                        setCheckoutPaymentMethod('balance')
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                        checkoutPaymentMethod === 'balance'
                          ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                          : isWhiteTheme
                          ? 'border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
                          : 'border-white/10 bg-[#121824]/90 text-white/70 hover:bg-[#161f2e]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Saldo en Cuenta USDT</p>
                            {currentUser && (
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                Number(currentUser.balance || 0) >= Number(selectedProduct.sell_price || selectedProduct.price)
                                  ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30'
                                  : 'bg-red-500/20 text-red-600 border-red-500/30'
                              }`}>
                                ${Number(currentUser.balance || 0).toFixed(2)} USDT
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>
                            {currentUser
                              ? (Number(currentUser.balance || 0) >= Number(selectedProduct.sell_price || selectedProduct.price)
                                  ? 'Descuento instantáneo de tu monedero'
                                  : 'Saldo insuficiente para esta compra')
                              : 'Inicia sesión para pagar con tu saldo USDT'}
                          </p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        checkoutPaymentMethod === 'balance' ? 'border-emerald-400 bg-emerald-400 text-black' : isWhiteTheme ? 'border-slate-300' : 'border-white/20'
                      }`}>
                        {checkoutPaymentMethod === 'balance' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Alerta de saldo insuficiente con botón directo a recargar con OxaPay */}
                    {checkoutPaymentMethod === 'balance' && currentUser && Number(currentUser.balance || 0) < Number(selectedProduct.sell_price || selectedProduct.price) && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-in fade-in">
                        <div className="min-w-0 text-xs">
                          <p className="font-bold text-amber-500">Saldo insuficiente en tu cuenta</p>
                          <p className={`text-[11px] ${isWhiteTheme ? 'text-slate-600' : 'text-white/60'}`}>
                            Tienes <span className={`font-mono font-bold ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>${Number(currentUser.balance || 0).toFixed(2)} USDT</span>. Faltan <span className="font-mono font-bold text-amber-500">${(Number(selectedProduct.sell_price || selectedProduct.price) - Number(currentUser.balance || 0)).toFixed(2)} USDT</span>.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const needed = Math.max(5, Math.ceil(Number(selectedProduct.sell_price || selectedProduct.price) - Number(currentUser.balance || 0)))
                            setDepositAmount(String(needed))
                            setDepositResult(null)
                            setDepositError('')
                            setDepositModalOpen(true)
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shrink-0 flex items-center gap-1 active:scale-95 transition shadow-sm cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Recargar</span>
                        </button>
                      </div>
                    )}

                    {/* Opción 3: Coordinar Pago USDT por WhatsApp */}
                    {whatsappNumber && (
                      <div
                        onClick={() => setCheckoutPaymentMethod('whatsapp')}
                        className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                          checkoutPaymentMethod === 'whatsapp'
                            ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                            : isWhiteTheme
                            ? 'border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
                            : 'border-white/10 bg-[#121824]/90 text-white/70 hover:bg-[#161f2e]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                            <MessageCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={`text-xs font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Pagar por WhatsApp (USDT)</p>
                            <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>Binance Pay o transferencia directa en USDT con el vendedor</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          checkoutPaymentMethod === 'whatsapp' ? 'border-emerald-400 bg-emerald-400 text-black' : isWhiteTheme ? 'border-slate-300' : 'border-white/20'
                        }`}>
                          {checkoutPaymentMethod === 'whatsapp' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* ─── VISTA PASO 3: Éxito / Confirmación ─── */}
            {checkoutStep === 3 && orderSuccessData && (
              <div className="space-y-4 text-center py-6 animate-in fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className={`text-lg font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>¡Pedido Registrado con Éxito!</h4>
                  <p className={`text-xs ${isWhiteTheme ? 'text-slate-600' : 'text-white/60'}`}>
                    {orderSuccessData.message || 'Tu solicitud ha sido recibida y será procesada en breve.'}
                  </p>
                </div>

                {/* TARJETA DE CREDENCIALES ENTREGADAS AL INSTANTE */}
                {orderSuccessData.credentials && orderSuccessData.credentials.length > 0 && (
                  <div className={`p-3.5 rounded-xl border space-y-2.5 text-left my-2 shadow-lg ${
                    isWhiteTheme ? 'border-purple-200 bg-purple-50/80 text-slate-800' : 'bg-purple-500/10 border-purple-500/25 text-white'
                  }`}>
                    <div className={`flex items-center justify-between pb-1 border-b ${isWhiteTheme ? 'border-purple-200' : 'border-purple-500/20'}`}>
                      <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isWhiteTheme ? 'text-purple-700' : 'text-purple-300'}`}>
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        <span>Tus Credenciales de Acceso Oficial</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ✓ Entrega Inmediata
                      </span>
                    </div>

                    {orderSuccessData.credentials.map((cred, cIdx) => (
                      <div key={cIdx} className={`rounded-xl border p-3 space-y-2 ${
                        isWhiteTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0d111d] text-white'
                      }`}>
                        {cred.profile && (
                          <div className="text-[10px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded inline-block border border-purple-200">
                            {cred.profile}
                          </div>
                        )}
                        {cred.email && (
                          <div className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${isWhiteTheme ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <div className="min-w-0">
                              <span className={`block text-[9px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>Correo / Usuario</span>
                              <span className={`block font-mono text-xs truncate select-all ${isWhiteTheme ? 'text-slate-900 font-bold' : 'text-white'}`}>{cred.email}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(cred.email); showToast('success', 'Correo copiado') }}
                              className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold transition active:scale-95 cursor-pointer ${
                                isWhiteTheme ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-white/10 hover:bg-white/20 text-white'
                              }`}
                            >
                              Copiar
                            </button>
                          </div>
                        )}
                        {cred.password && (
                          <div className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${isWhiteTheme ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <div className="min-w-0">
                              <span className={`block text-[9px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>Contraseña</span>
                              <span className="block font-mono text-xs font-bold text-emerald-600 truncate select-all">{cred.password}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(cred.password); showToast('success', 'Contraseña copiada') }}
                              className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold transition active:scale-95 cursor-pointer ${
                                isWhiteTheme ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-white/10 hover:bg-white/20 text-white'
                              }`}
                            >
                              Copiar
                            </button>
                          </div>
                        )}
                        {cred.pin && (
                          <div className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${isWhiteTheme ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <div className="min-w-0">
                              <span className={`block text-[9px] uppercase font-bold ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>PIN de Perfil</span>
                              <span className="block font-mono text-xs font-black text-emerald-600 tracking-widest">{cred.pin}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(cred.pin); showToast('success', 'PIN copiado') }}
                              className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold transition active:scale-95 cursor-pointer ${
                                isWhiteTheme ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-white/10 hover:bg-white/20 text-white'
                              }`}
                            >
                              Copiar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    <p className={`text-[10px] text-center pt-1 leading-snug ${isWhiteTheme ? 'text-slate-600' : 'text-white/70'}`}>
                      ✉️ Copia enviada también a tu Gmail y Telegram. Podrás consultar estos accesos en cualquier momento en <b>Mis Pedidos</b>.
                    </p>
                  </div>
                )}

                {orderSuccessData.pay_url && (
                  <a
                    href={orderSuccessData.pay_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 rounded-xl font-black text-sm text-black flex items-center justify-center gap-2 shadow-xl"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>Abrir Factura OxaPay en USDT</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=Hola!%20Acabo%20de%20hacer%20el%20pedido%20%23${orderSuccessData.order_id}%20para%20${encodeURIComponent(orderForm.player_id)}%20por%20$${Number(selectedProduct?.sell_price || selectedProduct?.price || 0).toFixed(2)}%20USDT.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Avisar al Vendedor por WhatsApp</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleCloseGameModal}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs ${
                    isWhiteTheme ? 'bg-slate-200 text-slate-800 hover:bg-slate-300' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  Volver a la Tienda
                </button>
              </div>
            )}
          </main>

          {/* BARRA INFERIOR FLOTANTE (Paso 1 y Paso 2) */}
          {checkoutStep === 1 && (
            <div className={`fixed inset-x-0 bottom-0 z-40 ${
              isWhiteTheme ? 'bg-white/95 border-slate-200 text-slate-900 shadow-xl' : 'bg-[#0d121d]/95 border-white/10 text-white shadow-2xl'
            } backdrop-blur-md border-t p-3.5 pb-[calc(env(safe-area-inset-bottom)+14px)]`}>
              <div className="mx-auto max-w-lg space-y-2">
                <div className="flex items-center justify-between text-xs px-0.5">
                  <span className={`${isWhiteTheme ? 'text-slate-600' : 'text-white/60'}`}>
                    {selectedProduct ? `Paquete: ${cleanFzrPackageName(selectedProduct.name)}` : 'Ningún paquete seleccionado'}
                  </span>
                  <span className="text-base font-black" style={{ color: primaryColor }}>
                    {selectedProduct ? `$${Number(selectedProduct.sell_price || selectedProduct.price).toFixed(2)} USDT` : '$0.00 USDT'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedProduct) return showToast('error', 'Por favor selecciona un paquete primero.')
                    if (!isModalStreaming && !orderForm.player_id.trim()) {
                      return showToast(
                        'error',
                        isModalGiftcard
                          ? 'Por favor ingresa tu correo o contacto para el PIN.'
                          : isModalSms
                          ? 'Por favor ingresa tu WhatsApp o contacto para el código.'
                          : isModalManual
                          ? 'Por favor ingresa el dato de entrega o identificador.'
                          : 'Por favor ingresa tu ID de jugador antes de continuar.'
                      )
                    }
                    if (isModalStreaming && !orderForm.player_id.trim()) {
                      const defVal = currentUser?.email || orderForm.client_contact || 'Detalles del Pedido, Telegram y Gmail'
                      setOrderForm(prev => ({ ...prev, player_id: defVal, client_contact: defVal }))
                    }
                    setCheckoutStep(2)
                  }}
                  disabled={!selectedProduct || (!isModalStreaming && !orderForm.player_id.trim())}
                  className="w-full rounded-xl py-3.5 px-4 text-sm font-black flex items-center justify-center gap-2 transition shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor, color: '#000' }}
                >
                  <span>Continuar a Pagar</span>
                  <ArrowRight className="h-4 w-4 stroke-[3]" />
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 2 && (
            <div className={`fixed inset-x-0 bottom-0 z-40 ${
              isWhiteTheme ? 'bg-white/95 border-slate-200 text-slate-900 shadow-xl' : 'bg-[#0d121d]/95 border-white/10 text-white shadow-2xl'
            } backdrop-blur-md border-t p-3.5 pb-[calc(env(safe-area-inset-bottom)+14px)]`}>
              <div className="mx-auto max-w-lg space-y-2">
                <button
                  type="button"
                  disabled={submittingOrder}
                  onClick={handleConfirmOrder}
                  className="w-full rounded-xl py-3.5 px-4 text-sm font-black flex items-center justify-center gap-2 transition shadow-lg active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: primaryColor, color: '#000' }}
                >
                  {submittingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Procesando pedido...</span>
                    </>
                  ) : checkoutPaymentMethod === 'oxapay' ? (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>Pagar ${Number(selectedProduct.sell_price || selectedProduct.price).toFixed(2)} USDT con OxaPay</span>
                    </>
                  ) : checkoutPaymentMethod === 'balance' ? (
                    currentUser && Number(currentUser.balance || 0) < Number(selectedProduct.sell_price || selectedProduct.price) ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          const needed = Math.max(5, Math.ceil(Number(selectedProduct.sell_price || selectedProduct.price) - Number(currentUser.balance || 0)))
                          setDepositAmount(String(needed))
                          setDepositResult(null)
                          setDepositError('')
                          setDepositModalOpen(true)
                        }}
                        className="w-full flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="h-4 w-4 stroke-[3]" />
                        <span>Recargar Saldo USDT con OxaPay (+${(Number(selectedProduct.sell_price || selectedProduct.price) - Number(currentUser.balance || 0)).toFixed(2)})</span>
                      </span>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        <span>Pagar ${Number(selectedProduct.sell_price || selectedProduct.price).toFixed(2)} USDT con Saldo</span>
                      </>
                    )
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4" />
                      <span>Coordinar Pago USDT por WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        )
      })()}



      {/* ─── FOOTER ─────────────────────────────────────────────────── */}
      <footer className={`border-t py-6 px-4 mt-12 ${isWhiteTheme ? 'border-slate-200 bg-white text-slate-800' : 'border-white/10 bg-black/60 text-white'}`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className={`font-black text-sm ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>{storeName}</span>
            <span className={`text-xs ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>© {new Date().getFullYear()}</span>
          </div>

          <div className={`flex items-center gap-4 text-xs ${isWhiteTheme ? 'text-slate-600' : 'text-white/60'}`}>
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 ${isWhiteTheme ? 'hover:text-slate-950' : 'hover:text-white'}`}>
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}
            {telegramUsername && (
              <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 ${isWhiteTheme ? 'hover:text-slate-950' : 'hover:text-white'}`}>
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>Telegram</span>
              </a>
            )}
            {store.contact_email && (
              <a href={`mailto:${store.contact_email}`} className={`flex items-center gap-1 ${isWhiteTheme ? 'hover:text-slate-950' : 'hover:text-white'}`}>
                <Mail className="w-3.5 h-3.5" />
                <span>{store.contact_email}</span>
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* ─── MODAL DE LOGIN / REGISTRO ──────────────────────────────── */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 space-y-4 ${
            isWhiteTheme ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900/95 text-white border-white/15'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl overflow-hidden border flex items-center justify-center font-black text-xs shrink-0 ${
                    isWhiteTheme ? 'bg-slate-100 border-slate-200' : 'bg-black/60 border-white/20'
                  }`}
                  style={{ color: primaryColor }}
                >
                  {logoUrl ? <OptimizedImage src={logoUrl} alt="" className="w-full h-full object-cover" /> : (storeName || "TG").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className={`text-sm font-black leading-tight ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>{storeName}</h3>
                  <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>{authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                  isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/10 hover:bg-white/20 text-white/70'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Botón de Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleAuthClick}
              disabled={googleAuthLoading || authSubmitting}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-md border transition active:scale-95 disabled:opacity-50 ${
                isWhiteTheme
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{googleAuthLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
            </button>

            <div className="relative flex items-center justify-center my-1">
              <div className={`border-t w-full ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}></div>
              <span className={`px-3 text-[10px] uppercase tracking-wider shrink-0 font-bold ${
                isWhiteTheme ? 'bg-white text-slate-400' : 'bg-slate-900 text-white/40'
              }`}>o con correo</span>
              <div className={`border-t w-full ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}></div>
            </div>

            {/* Selector de Modo */}
            <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${
              isWhiteTheme ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError('') }}
                className={`py-1.5 rounded-lg text-xs font-black transition ${
                  authMode === 'login'
                    ? isWhiteTheme ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/20 text-white'
                    : isWhiteTheme ? 'text-slate-500 hover:text-slate-900' : 'text-white/50 hover:text-white'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); setRegTermsAccepted(false); }}
                className={`py-1.5 rounded-lg text-xs font-black transition ${
                  authMode === 'register'
                    ? isWhiteTheme ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/20 text-white'
                    : isWhiteTheme ? 'text-slate-500 hover:text-slate-900' : 'text-white/50 hover:text-white'
                }`}
              >
                Registrarme
              </button>
            </div>

            {authError && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-500 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>Nombre Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Tu nombre"
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none transition ${
                      isWhiteTheme
                        ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
                        : 'bg-black/60 border-white/15 text-white placeholder-white/30 focus:border-emerald-500'
                    }`}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none transition ${
                    isWhiteTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
                      : 'bg-black/60 border-white/15 text-white placeholder-white/30 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none transition ${
                    isWhiteTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
                      : 'bg-black/60 border-white/15 text-white placeholder-white/30 focus:border-emerald-500'
                  }`}
                />
              </div>

              {authMode === 'register' && (
                <div className={`p-2.5 rounded-xl border ${isWhiteTheme ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'}`}>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={regTermsAccepted}
                      onChange={(e) => setRegTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 flex-shrink-0 cursor-pointer"
                    />
                    <span className={`text-[11px] leading-snug ${isWhiteTheme ? 'text-slate-700' : 'text-white/80'}`}>
                      He leído y acepto los{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermsModal(true); }}
                        className={`underline font-bold ${isWhiteTheme ? 'text-slate-900 hover:text-black' : 'text-white hover:text-white/80'}`}
                      >
                        Términos y Condiciones
                      </button>{' '}
                      de la tienda.
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting || (authMode === 'register' && !regTermsAccepted)}
                className="w-full py-2.5 rounded-xl font-black text-xs text-black shadow-lg transition active:scale-95 disabled:opacity-50 mt-2"
                style={{ backgroundColor: primaryColor }}
              >
                {authSubmitting ? 'Verificando...' : (authMode === 'login' ? 'Entrar a mi Cuenta' : 'Registrar y Continuar')}
              </button>
            </form>

            <div className={`p-2.5 rounded-xl border text-[10px] text-center leading-relaxed ${
              isWhiteTheme ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/60'
            }`}>
              {authMode === 'login'
                ? '¿Eres el dueño de esta tienda? Inicia sesión con tus credenciales o cuenta de Google para administrar tus productos y configuración.'
                : 'Crea tu cuenta para comprar más rápido y consultar el historial de tus pedidos.'}
            </div>
          </div>
        </div>
      )}

      {/* ─── DRAWER / MODAL DE ADMINISTRACIÓN EN VIVO (MODO DUEÑO COMPLETO) ─── */}
      {customizerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full sm:max-w-xl h-full sm:h-auto sm:max-h-[94vh] rounded-none sm:rounded-3xl border-0 sm:border border-white/15 bg-slate-900/98 shadow-2xl flex flex-col overflow-hidden text-white">
            {/* Header del Editor */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>Ajustes de Mi Tienda</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-amber-400 text-black">
                      Modo Dueño
                    </span>
                  </h3>
                  <p className="text-[10px] text-white/50 font-mono">@{store.slug}.franchoshop.com</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas del Editor (Scroll Horizontal Touch-Friendly) */}
            <div className="flex items-center gap-1.5 overflow-x-auto p-2 border-b border-white/10 bg-black/30 shrink-0 text-xs font-bold [scrollbar-width:none]">
              {[
                { id: 'orders', label: `Pedidos (${ordersList.length})`, icon: ClipboardList },
                { id: 'customers', label: `Clientes (${customersList.length})`, icon: Users },
                { id: 'branding', label: 'Marca', icon: Sliders },
                { id: 'colors', label: 'Colores', icon: Palette },
                { id: 'markups', label: 'Ganancias', icon: Percent },
                { id: 'sms', label: 'SMS Virtual', icon: Smartphone },
                { id: 'payments', label: 'Pagos', icon: CreditCard },
                { id: 'bot', label: 'Bot Telegram', icon: Bot },
                { id: 'email', label: 'Gmail / Correo', icon: Mail },
                { id: 'contact', label: 'Contacto', icon: Phone },
                { id: 'manual', label: `Productos (${manualProducts.length})`, icon: Package },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCustomizerTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 text-[11px] ${
                    customizerTab === tab.id
                      ? 'bg-white text-black font-black shadow-md'
                      : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Cuerpo del Editor con Scroll */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs [scrollbar-width:thin]">

              {/* TAB: PEDIDOS DE CLIENTES (AUTOMÁTICOS Y MANUALES) */}
              {customizerTab === 'orders' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-white/10">
                    <div>
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-amber-400" />
                        <span>Pedidos de tus Clientes</span>
                      </h4>
                      <p className="text-[10px] text-white/50">
                        Gestiona ventas automáticas y entregas manuales realizadas en tu tienda.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadOrders(ordersQuery)}
                      disabled={ordersLoading}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                      <span>Actualizar</span>
                    </button>
                  </div>

                  {/* Filtro Tipo de Pedido: Todos / Automáticos / Manuales */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {[
                      { id: 'all', label: 'Todos', count: ordersList.length },
                      { id: 'auto', label: '⚡ Automáticos', count: ordersList.filter(o => o.type !== 'manual').length },
                      { id: 'manual', label: '✍️ Manuales', count: ordersList.filter(o => o.type === 'manual').length },
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOrdersFilterType(f.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                          ordersFilterType === f.id
                            ? 'bg-amber-400 text-black font-black shadow-md'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className="text-[10px] opacity-70">({f.count})</span>
                      </button>
                    ))}
                  </div>

                  {/* Filtro de Estado */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'completed', label: 'Completados' },
                      { id: 'processing', label: 'Procesando' },
                      { id: 'pending', label: 'Pendientes' },
                      { id: 'cancelled', label: 'Cancelados' },
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOrdersFilterStatus(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition active:scale-95 cursor-pointer ${
                          ordersFilterStatus === f.id
                            ? 'bg-white/20 text-white font-black border border-white/30'
                            : 'bg-white/5 text-white/50 hover:text-white'
                        }`}
                      >
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Buscador de Pedidos en Modo Dueño */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por ID, nombre, Player ID o teléfono..."
                      value={ordersQuery}
                      onChange={e => setOrdersQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && loadOrders(ordersQuery)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-amber-400"
                    />
                    {ordersQuery && (
                      <button
                        type="button"
                        onClick={() => { setOrdersQuery(''); loadOrders(''); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Lista de Pedidos en Modo Dueño */}
                  {ordersLoading ? (
                    <div className="py-12 text-center text-white/40 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400" />
                      <p className="text-xs">Cargando pedidos de la tienda...</p>
                    </div>
                  ) : (
                    (() => {
                      const filtered = ordersList.filter(o => {
                        if (ordersFilterType === 'auto' && o.type === 'manual') return false
                        if (ordersFilterType === 'manual' && o.type !== 'manual') return false
                        if (ordersFilterStatus !== 'all' && o.status_code !== ordersFilterStatus) return false
                        if (ordersQuery.trim()) {
                          const q = ordersQuery.toLowerCase()
                          const strId = String(o.id || o.merchant_order_id || '').toLowerCase()
                          const strProd = String(o.product_name || '').toLowerCase()
                          const strPlayer = String(o.player_id || '').toLowerCase()
                          const strClient = String(o.client_name || '').toLowerCase()
                          const strContact = String(o.client_contact || o.phone || '').toLowerCase()
                          if (!strId.includes(q) && !strProd.includes(q) && !strPlayer.includes(q) && !strClient.includes(q) && !strContact.includes(q)) {
                            return false
                          }
                        }
                        return true
                      })

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center rounded-2xl border border-white/5 bg-black/30 space-y-2">
                            <ClipboardList className="w-8 h-8 text-white/20 mx-auto" />
                            <p className="text-xs font-bold text-white/60">No hay pedidos con el filtro actual</p>
                            <p className="text-[11px] text-white/40">Cuando tus clientes compren productos automáticos o manuales aparecerán aquí.</p>
                          </div>
                        )
                      }

                      return (
                        <div className="space-y-2.5">
                          {filtered.map(order => {
                            const oKey = `${order.id || order.merchant_order_id}`
                            const isComp = order.status_code === 'completed'
                            const isProc = order.status_code === 'processing'
                            const isCanc = order.status_code === 'cancelled'
                            const dStr = order.created_at
                              ? new Date(order.created_at * 1000).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : '—'

                            return (
                              <div
                                key={oKey}
                                className="p-3 rounded-2xl border border-white/10 bg-black/40 space-y-2 hover:border-white/20 transition"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                      order.type === 'manual'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    }`}>
                                      {order.type === 'manual' ? '✍️ Manual' : order.type === 'sms' ? '📱 SMS' : order.type === 'streaming' ? '📺 Streaming' : '⚡ Automático'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                      isComp ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                      isProc ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                                      isCanc ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                      'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    }`}>
                                      {order.status_label || (isComp ? 'Completado' : isProc ? 'Procesando' : 'Pendiente')}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-mono font-black text-emerald-400">${Number(order.sell_price || 0).toFixed(2)} USD</span>
                                    {order.cup_amount && (
                                      <span className="text-[10px] text-white/50 block font-mono">({Number(order.cup_amount).toLocaleString()} CUP)</span>
                                    )}
                                  </div>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs font-black text-white truncate">{order.product_name}</p>
                                  <p className="text-[10px] text-white/40 font-mono">#{order.id || order.merchant_order_id} • {dStr}</p>
                                </div>

                                {/* Datos de Entrega / Jugador */}
                                <div className="p-2 rounded-xl bg-black/60 border border-white/5 text-[11px] space-y-1">
                                  {order.player_id && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-white/50">{order.type === 'manual' ? 'Dato de Entrega:' : 'Player ID:'}</span>
                                      <div className="flex items-center gap-1">
                                        <code className="text-white font-mono font-bold">{order.player_id}</code>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(order.player_id)
                                            showToast('success', 'Copiado al portapapeles')
                                          }}
                                          className="p-1 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white cursor-pointer"
                                          title="Copiar"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  {order.zone_id && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-white/50">Zona / Servidor:</span>
                                      <span className="text-white font-mono">{order.zone_id}</span>
                                    </div>
                                  )}
                                  {order.client_name && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-white/50">Cliente:</span>
                                      <span className="text-white font-bold">{order.client_name}</span>
                                    </div>
                                  )}
                                  {(order.client_contact || order.phone) && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-white/50">Contacto:</span>
                                      <span className="text-emerald-400 font-mono font-bold">{order.client_contact || order.phone}</span>
                                    </div>
                                  )}
                                  {order.payment_method && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-white/50">Método de Pago:</span>
                                      <span className="text-white font-semibold capitalize">{order.payment_method === 'cup' ? 'Transfermóvil / EnZona' : order.payment_method === 'oxapay' ? 'OxaPay USDT' : order.payment_method}</span>
                                    </div>
                                  )}
                                  {order.cup_reference && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-white/50">Referencia Pago:</span>
                                      <code className="text-amber-400 font-mono">{order.cup_reference}</code>
                                    </div>
                                  )}
                                </div>

                                {/* Acciones Rápidas */}
                                <div className="flex items-center gap-2 pt-1">
                                  {(order.client_contact || order.phone) && (
                                    <a
                                      href={`https://wa.me/${String(order.client_contact || order.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${order.client_name || ''}! Te escribo de ${storeName || 'la tienda'} referente a tu pedido #${order.id || order.merchant_order_id} de "${order.product_name}".`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}
                                  {order.type === 'sms' && (
                                    <button
                                      type="button"
                                      onClick={() => syncWebStoreSmsOrder(order)}
                                      className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      <span>Consultar SMS</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()
                  )}
                </div>
              )}

              {/* TAB: MIS CLIENTES */}
              {customizerTab === 'customers' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-white/10">
                    <div>
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-sky-400" />
                        <span>Clientes de Mi Tienda Web</span>
                      </h4>
                      <p className="text-[10px] text-white/50">
                        Clientes que compran o se registran en tu tienda, saldos y ganancias netas generadas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadCustomers}
                      disabled={customersLoading}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${customersLoading ? 'animate-spin' : ''}`} />
                      <span>Actualizar</span>
                    </button>
                  </div>

                  {/* Tarjetas KPI de Clientes */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-0.5">
                      <span className="text-[9px] font-black uppercase text-white/40 block">Total Clientes</span>
                      <span className="text-lg font-black text-white font-mono">{customersStats.total_customers}</span>
                      <span className="text-[9px] text-sky-400 block font-bold">{customersStats.registered_count} registrados</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-0.5">
                      <span className="text-[9px] font-black uppercase text-white/40 block">Ventas Generadas</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">${customersStats.total_revenue_usdt?.toFixed(2) || '0.00'}</span>
                      <span className="text-[9px] text-white/40 block">Volumen USDT</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-0.5">
                      <span className="text-[9px] font-black uppercase text-white/40 block">Tu Ganancia Neta</span>
                      <span className="text-lg font-black text-yellow-400 font-mono">+${customersStats.total_profit_usdt?.toFixed(2) || '0.00'}</span>
                      <span className="text-[9px] text-emerald-400 block font-bold">Acreditada en tu saldo</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-0.5">
                      <span className="text-[9px] font-black uppercase text-white/40 block">Ticket Promedio</span>
                      <span className="text-lg font-black text-cyan-400 font-mono">
                        ${customersStats.total_customers > 0 ? (customersStats.total_revenue_usdt / customersStats.total_customers).toFixed(2) : '0.00'}
                      </span>
                      <span className="text-[9px] text-white/40 block">USDT por cliente</span>
                    </div>
                  </div>

                  {/* Buscador de Clientes */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, email, teléfono o ID..."
                      value={customersSearch}
                      onChange={e => setCustomersSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-sky-400"
                    />
                  </div>

                  {/* Lista de Clientes */}
                  {customersLoading ? (
                    <div className="py-12 text-center text-white/40 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400" />
                      <p className="text-xs">Cargando clientes de tu tienda...</p>
                    </div>
                  ) : (() => {
                    const filteredCust = customersList.filter(c => {
                      if (!customersSearch.trim()) return true
                      const q = customersSearch.toLowerCase()
                      return (
                        (c.name && c.name.toLowerCase().includes(q)) ||
                        (c.contact && c.contact.toLowerCase().includes(q)) ||
                        (c.player_id && String(c.player_id).toLowerCase().includes(q)) ||
                        (c.id && String(c.id).toLowerCase().includes(q))
                      )
                    })

                    if (filteredCust.length === 0) {
                      return (
                        <div className="p-8 text-center rounded-2xl border border-white/5 bg-black/30 space-y-2">
                          <Users className="w-8 h-8 text-white/20 mx-auto" />
                          <p className="text-xs font-bold text-white/60">No hay clientes con compras o registros todavía</p>
                          <p className="text-[11px] text-white/40 max-w-xs mx-auto">
                            A medida que compartas el enlace de tu tienda y tus clientes creen cuenta o hagan pedidos, aparecerán aquí.
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div className="space-y-2.5">
                        {filteredCust.map(c => (
                          <div
                            key={c.id}
                            className="p-3 rounded-2xl border border-white/10 bg-black/40 space-y-2 hover:border-white/20 transition"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center justify-center font-black text-xs shrink-0">
                                {(c.name || 'C')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="text-xs font-black text-white truncate">{c.name}</h5>
                                  {c.is_registered ? (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      Registrado
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-white/10 text-white/60 border border-white/10">
                                      Invitado
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-white/50 truncate flex items-center gap-1 mt-0.5">
                                  <Mail className="w-2.5 h-2.5 text-white/40" />
                                  <span>{c.contact}</span>
                                  {c.player_id && <span>• ID: {c.player_id}</span>}
                                </p>
                              </div>
                            </div>

                            {/* Estadísticas del cliente */}
                            <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-black/60 border border-white/5 text-[10px]">
                              <div>
                                <span className="text-white/40 block">Saldo Cuenta:</span>
                                <span className="font-mono font-black text-emerald-400">${c.balance?.toFixed(2) || '0.00'}</span>
                              </div>
                              <div>
                                <span className="text-white/40 block">Compras ({c.orders_count}):</span>
                                <span className="font-mono font-black text-white">${c.total_spent?.toFixed(2) || '0.00'}</span>
                              </div>
                              <div>
                                <span className="text-white/40 block">Tu Ganancia:</span>
                                <span className="font-mono font-black text-yellow-400">+${c.total_profit?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>

                            {/* Botón WhatsApp si tiene contacto numérico */}
                            {c.contact && c.contact !== 'N/A' && /\d/.test(c.contact) && (
                              <a
                                href={`https://wa.me/${c.contact.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${c.name || ''}! Te contacto de ${storeName || 'la tienda'}.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Contactar por WhatsApp</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* TAB 1: BRANDING Y TEXTOS */}
              {customizerTab === 'branding' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Identidad Principal</span>
                    </h4>

                    <div className="space-y-1">
                      <label className="font-bold text-white/90">Nombre de tu Tienda:</label>
                      <input
                        type="text"
                        value={storeName}
                        onChange={e => setStoreName(e.target.value)}
                        placeholder="Ej: Pro Game Store"
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-white/90">Eslogan o Subtítulo:</label>
                      <input
                        type="text"
                        value={tagline}
                        onChange={e => setTagline(e.target.value)}
                        placeholder="Ej: Recargas automáticas 24/7"
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-2 pt-1 border-t border-white/5">
                      <label className="font-bold text-white/90 block">Logo Oficial de tu Tienda:</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden relative shadow-md">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-black" style={{ color: primaryColor }}>
                              {(storeName || "TG").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          {uploadingStoreLogo && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1.5">
                          <input
                            type="file"
                            id="reseller-store-logo-file-mini"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setUploadingStoreLogo(true)
                              try {
                                const res = await api.uploadWebStoreImage(file)
                                if (res && res.url) {
                                  setLogoUrl(res.url)
                                  showToast('success', '¡Logo subido con éxito!')
                                }
                              } catch (err) {
                                showToast('error', 'Error al subir la imagen')
                              } finally {
                                setUploadingStoreLogo(false)
                                e.target.value = ''
                              }
                            }}
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <label
                              htmlFor="reseller-store-logo-file-mini"
                              className="cursor-pointer px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-black flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{uploadingStoreLogo ? 'Subiendo...' : 'Subir desde galería'}</span>
                            </label>
                            {logoUrl && (
                              <button
                                type="button"
                                onClick={() => setLogoUrl('')}
                                className="px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[11px] font-bold transition active:scale-95"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="O escribe una URL directa https://..."
                            value={logoUrl}
                            onChange={e => setLogoUrl(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-[10px] text-white/80 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Textos de Portada & Aviso */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Portada Hero y Barra de Anuncios</span>
                    </h4>

                    <div className="space-y-1">
                      <label className="font-bold text-white/90">Barra de Anuncios Superior:</label>
                      <input
                        type="text"
                        placeholder="Ej: 🔥 ¡Recargas 24/7! Diamantes al instante en tu cuenta"
                        value={announcementBar}
                        onChange={e => setAnnouncementBar(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-white/90">Badge Superior Portada:</label>
                      <input
                        type="text"
                        value={heroBadge}
                        onChange={e => setHeroBadge(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-white/90">Título Principal Portada:</label>
                      <input
                        type="text"
                        value={heroTitle}
                        onChange={e => setHeroTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-white/90">Subtítulo Descriptivo:</label>
                      <textarea
                        rows={2}
                        value={heroSubtitle}
                        onChange={e => setHeroSubtitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COLORES Y TEMA */}
              {customizerTab === 'colors' && (
                <div className="space-y-4">
                  {/* Color Primario / Acento */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                    <ColorBarPicker
                      value={primaryColor}
                      onChange={setPrimaryColor}
                      label="Color Primario (Acento)"
                      presetColors={COLOR_PRESETS}
                    />
                  </div>

                  {/* Color Secundario */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                    <ColorBarPicker
                      value={secondaryColor}
                      onChange={setSecondaryColor}
                      label="Color Secundario"
                      presetColors={COLOR_PRESETS}
                    />
                  </div>

                  {/* Tema de Fondo */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                    <label className="font-black text-white">Estilo de Fondo Predeterminado:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'clean_white', label: '☀️ Blanco Pro (Clean Light)' },
                        { id: 'midnight', label: 'Midnight Blue' },
                        { id: 'cyberpunk', label: 'Cyberpunk Violet' },
                        { id: 'matrix', label: 'Matrix Dark' },
                        { id: 'sunset', label: 'Sunset Ember' },
                        { id: 'obsidian', label: 'Obsidian Black' },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBgStyle(t.id)}
                          className={`p-2 rounded-xl border text-left font-bold transition text-[11px] ${
                            bgStyle === t.id
                              ? 'border-white text-white bg-white/15 shadow-sm'
                              : 'border-white/10 text-white/60 hover:bg-white/5'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Hex de Fondo Personalizado */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1.5">
                    <label className="font-black text-white/90">Fondo Hexadecimal Opcional:</label>
                    <input
                      type="text"
                      placeholder="Ej: #0f172a (dejar vacío para usar tema de fondo)"
                      value={customBgColor}
                      onChange={e => setCustomBgColor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono"
                    />
                  </div>

                  {/* Redondeo de Botones */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                    <label className="font-black text-white/90">Estilo de Botones:</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'rounded-lg', label: 'Clásico' },
                        { id: 'rounded-xl', label: 'Moderno' },
                        { id: 'rounded-full', label: 'Píldora' }
                      ].map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setButtonRadius(b.id)}
                          className={`py-2 px-2 rounded-xl border text-center font-bold text-[11px] transition ${
                            buttonRadius === b.id ? 'border-white bg-white/20 text-white shadow-sm' : 'border-white/10 text-white/50 hover:bg-white/5'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MÁRGENES DE GANANCIA (%) */}
              {customizerTab === 'markups' && (
                <div className="space-y-4">
                  {/* Margen Global */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Margen de Ganancia Global</span>
                        </h4>
                        <p className="text-[10px] text-white/50">Se aplica por defecto a todos los juegos.</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={markupPercent}
                          onChange={e => setMarkupPercent(Number(e.target.value))}
                          className="w-16 px-2 py-1 rounded-xl bg-black/60 border border-emerald-500/40 text-emerald-400 font-mono font-black text-sm text-center outline-none"
                        />
                        <span className="font-black text-emerald-400 text-sm">%</span>
                      </div>
                    </div>

                    {/* Botones rápidos */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
                      <span className="text-[10px] text-white/40 font-bold">Rápido:</span>
                      {[8, 10, 12, 15, 20].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setMarkupPercent(pct)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition active:scale-95 ${
                            markupPercent === pct
                              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-black'
                              : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          +{pct}%
                        </button>
                      ))}

                      {Object.keys(gameMarkups).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('¿Restablecer todos los juegos al margen global?')) {
                              setGameMarkups({})
                              showToast('info', 'Todos los juegos usan ahora el margen global')
                            }
                          }}
                          className="ml-auto px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition active:scale-95 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restablecer todo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Simulador de Ganancia en Tiempo Real */}
                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                    <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Simulador en Tiempo Real</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/60 font-bold">Costo Mayorista:</label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-white/60">$</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0.1"
                            value={simCost}
                            onChange={e => setSimCost(Math.max(0.1, Number(e.target.value)))}
                            className="w-full px-2 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs font-mono font-bold text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-white/60 font-bold">Juego de Referencia:</label>
                        <select
                          value={simGameName}
                          onChange={e => setSimGameName(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs font-bold text-white outline-none"
                        >
                          <option value="Free Fire">Free Fire</option>
                          <option value="Mobile Legends">Mobile Legends</option>
                          <option value="Roblox">Roblox</option>
                          <option value="Call of Duty">Call of Duty</option>
                          <option value="PUBG Mobile">PUBG Mobile</option>
                          <option value="Tarjetas de Regalo">Tarjetas de Regalo</option>
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const effectivePct = gameMarkups[simGameName] !== undefined
                        ? Number(gameMarkups[simGameName])
                        : markupPercent
                      const retailUSD = simCost * (1 + effectivePct / 100)
                      const profitUSD = retailUSD - simCost
                      return (
                        <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-white/50 block">Margen ({effectivePct}%):</span>
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              +${profitUSD.toFixed(2)} USDT
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-white/50 block">Cliente Paga:</span>
                            <span className="font-mono font-black text-white text-sm">
                              ${retailUSD.toFixed(2)} USDT
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Márgenes Específicos por Juego */}
                  {/* Márgenes Específicos por Juego & Apps (API Completa: 650+ items) */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <Gamepad2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Márgenes por Producto (API Completa)</span>
                      </h4>
                      <span className="text-[10px] text-amber-300 font-bold">
                        {Object.keys(gameMarkups).length} personalizados
                      </span>
                    </div>

                    {/* Filtros de Categorías */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                      <button
                        type="button"
                        onClick={() => { setMarkupCategoryFilter('all'); setMarkupPage(1) }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition active:scale-95 ${
                          markupCategoryFilter === 'all'
                            ? 'bg-white text-black font-black shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        Todos ({allCatalogGames.length || 652})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMarkupCategoryFilter('topup'); setMarkupPage(1) }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition active:scale-95 ${
                          markupCategoryFilter === 'topup'
                            ? 'bg-emerald-500 text-black font-black shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        🎮 Recargas ({allCatalogGames.filter(g => g.kind === 'topup').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMarkupCategoryFilter('giftcard'); setMarkupPage(1) }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition active:scale-95 ${
                          markupCategoryFilter === 'giftcard'
                            ? 'bg-cyan-500 text-black font-black shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        🎁 Gift Cards ({allCatalogGames.filter(g => g.kind === 'giftcard').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMarkupCategoryFilter('streaming'); setMarkupPage(1) }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition active:scale-95 ${
                          markupCategoryFilter === 'streaming'
                            ? 'bg-purple-500 text-white font-black shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        📺 Streaming ({allCatalogGames.filter(g => g.kind === 'streaming').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMarkupCategoryFilter('custom'); setMarkupPage(1) }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition active:scale-95 ${
                          markupCategoryFilter === 'custom'
                            ? 'bg-amber-400 text-black font-black shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        ⭐ Personalizados ({Object.keys(gameMarkups).length})
                      </button>
                    </div>

                    {/* Buscador en tiempo real de todos los productos */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                      <input
                        type="text"
                        placeholder="Buscar entre los más de 650 juegos, gift cards o apps..."
                        value={markupGameSearch}
                        onChange={e => { setMarkupGameSearch(e.target.value); setMarkupPage(1) }}
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder:text-white/30 outline-none focus:border-amber-400/50"
                      />
                      {markupGameSearch && (
                        <button
                          type="button"
                          onClick={() => { setMarkupGameSearch(''); setMarkupPage(1) }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Lista de productos */}
                    {loadingAllCatalogGames && allCatalogGames.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                        <span className="text-[11px] text-white/50">Cargando catálogo completo desde la API...</span>
                      </div>
                    ) : filteredCatalogForMarkups.length === 0 ? (
                      <div className="text-center py-6 text-white/40 text-xs">
                        No se encontraron productos que coincidan con la búsqueda.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {paginatedMarkupGames.map(game => {
                          const isCustom = gameMarkups[game.name] !== undefined || (game.base_name && gameMarkups[game.base_name] !== undefined)
                          const currentVal = isCustom ? Number(gameMarkups[game.name] ?? gameMarkups[game.base_name]) : markupPercent
                          return (
                            <div
                              key={`${game.kind || 'k'}_${game.name}`}
                              className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                                isCustom
                                  ? 'border-amber-500/40 bg-amber-500/5 shadow-sm'
                                  : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                  {game.icon_url ? (
                                    <img src={toFastImageUrl(game.icon_url)} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                  ) : (
                                    <span className="text-xs">{game.kind === 'topup' ? '🎮' : game.kind === 'streaming' ? '📺' : game.kind === 'sms' ? '📱' : '🎁'}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-white text-xs truncate max-w-[170px]" title={game.name}>
                                      {game.name}
                                    </span>
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-white/60">
                                      {game.kind === 'topup' ? 'Top-Up' : game.kind === 'streaming' ? 'Streaming' : game.kind === 'sms' ? 'SMS' : game.kind === 'apps' ? 'App' : 'Gift Card'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px]">
                                    <span className={isCustom ? 'text-amber-300 font-bold' : 'text-white/40'}>
                                      {isCustom ? '⭐ Personalizado' : `Hereda global (${markupPercent}%)`}
                                    </span>
                                    {game.wholesale_cost !== undefined && game.wholesale_cost > 0 && (
                                      <span className="text-white/40 font-mono">
                                        Base: ${game.wholesale_cost.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-center">
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="100"
                                    value={currentVal}
                                    onChange={e => {
                                      const val = Math.max(0, Math.min(100, Number(e.target.value)))
                                      setGameMarkups(prev => ({ ...prev, [game.name]: val }))
                                    }}
                                    className={`w-14 px-1.5 py-1 rounded-lg bg-black/60 border text-xs font-mono font-bold text-center outline-none transition ${
                                      isCustom
                                        ? 'border-amber-400 text-amber-300 font-black'
                                        : 'border-white/20 text-white focus:border-amber-400'
                                    }`}
                                  />
                                  <span className="text-xs font-bold text-white/60 ml-0.5">%</span>
                                </div>

                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = { ...gameMarkups }
                                      delete next[game.name]
                                      if (game.base_name) delete next[game.base_name]
                                      setGameMarkups(next)
                                    }}
                                    title="Restablecer al margen global"
                                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition active:scale-95"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* Paginación */}
                        {totalMarkupPages > 1 && (
                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-white/60">
                            <button
                              type="button"
                              disabled={markupPage <= 1}
                              onClick={() => setMarkupPage(p => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 text-[11px] font-bold"
                            >
                              <ChevronLeft className="w-3 h-3" />
                              <span>Anterior</span>
                            </button>
                            <span className="text-[11px] font-mono">
                              Página <strong className="text-white">{markupPage}</strong> de {totalMarkupPages} ({filteredCatalogForMarkups.length} productos)
                            </span>
                            <button
                              type="button"
                              disabled={markupPage >= totalMarkupPages}
                              onClick={() => setMarkupPage(p => Math.min(totalMarkupPages, p + 1))}
                              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 text-[11px] font-bold"
                            >
                              <span>Siguiente</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: NÚMEROS VIRTUALES SMS */}
              {customizerTab === 'sms' && (
                <div className="space-y-4">
                  {/* Switch Activar / Pausar */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-black/40 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Estado de la Sección SMS</h4>
                      <p className="text-[10px] text-white/50">Muestra u oculta la categoría de números en tu tienda.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsConfig.enabled !== false}
                        onChange={e => setSmsConfig({
                          ...smsConfig,
                          enabled: e.target.checked
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>

                  {/* Margen de Ganancia SMS */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Margen de Ganancia en Números SMS</span>
                        </h4>
                        <p className="text-[10px] text-white/50">Porcentaje que ganas en cada número activado.</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={smsConfig.markup_percent ?? 15}
                          onChange={e => setSmsConfig({
                            ...smsConfig,
                            markup_percent: Number(e.target.value)
                          })}
                          className="w-16 px-2 py-1 rounded-xl bg-black/60 border border-cyan-500/40 text-cyan-400 font-mono font-black text-sm text-center outline-none"
                        />
                        <span className="font-black text-cyan-400 text-sm">%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                      <span className="text-[10px] text-white/40 font-bold">Rápido:</span>
                      {[10, 15, 20, 25, 30].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setSmsConfig({ ...smsConfig, markup_percent: pct })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition active:scale-95 ${
                            (smsConfig.markup_percent ?? 15) === pct
                              ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 font-black'
                              : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          +{pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nombre y Logo de la Categoría SMS */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-3">
                    <div className="space-y-1">
                      <label className="font-bold text-white/90">Nombre Visible de la Categoría:</label>
                      <input
                        type="text"
                        value={smsConfig.display_name || '📱 Números Virtuales (SMS)'}
                        onChange={e => setSmsConfig({
                          ...smsConfig,
                          display_name: e.target.value
                        })}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-2 pt-1 border-t border-white/5">
                      <label className="font-bold text-white/90 block">Icono de la Categoría SMS:</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden relative shadow-md">
                          {smsConfig.category_logo_url ? (
                            <img src={toFastImageUrl(smsConfig.category_logo_url)} alt="SMS" className="w-full h-full object-contain p-1" loading="lazy" />
                          ) : (
                            <Smartphone className="w-5 h-5 text-cyan-400" />
                          )}
                          {uploadingSmsLogo && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1.5">
                          <input
                            type="file"
                            id="reseller-sms-logo-file-mini"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setUploadingSmsLogo(true)
                              try {
                                const res = await api.uploadWebStoreImage(file)
                                if (res && res.url) {
                                  setSmsConfig({ ...smsConfig, category_logo_url: res.url })
                                  showToast('success', '¡Icono SMS subido!')
                                }
                              } catch (err) {
                                showToast('error', 'Error al subir la imagen')
                              } finally {
                                setUploadingSmsLogo(false)
                                e.target.value = ''
                              }
                            }}
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <label
                              htmlFor="reseller-sms-logo-file-mini"
                              className="cursor-pointer px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-black flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{uploadingSmsLogo ? 'Subiendo...' : 'Subir icono'}</span>
                            </label>
                            {smsConfig.category_logo_url && (
                              <button
                                type="button"
                                onClick={() => setSmsConfig({ ...smsConfig, category_logo_url: '' })}
                                className="px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[11px] font-bold transition active:scale-95"
                              >
                                Restablecer
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Presets rápidos */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-white/40 font-bold">Presets:</span>
                        {[
                          { label: 'SIM 3D', url: 'https://img.icons8.com/color/512/sim-card.png' },
                          { label: 'Smartphone', url: 'https://img.icons8.com/isometric/512/iphone-x.png' },
                          { label: 'Chip', url: 'https://img.icons8.com/fluency/512/microchip.png' },
                          { label: 'Chat SMS', url: 'https://img.icons8.com/fluency/512/chat--v1.png' }
                        ].map(preset => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() => setSmsConfig({ ...smsConfig, category_logo_url: preset.url })}
                            className="px-2 py-0.5 rounded-lg border border-white/10 bg-white/5 text-[10px] font-bold text-white/70 hover:bg-white/10 transition active:scale-95"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: MÉTODOS DE PAGO */}
              {customizerTab === 'payments' && (
                <div className="space-y-4">
                  {/* Pasarela USDT Automática OxaPay */}
                  <div className="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-white">Pasarela Cripto OxaPay (Automática)</h4>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Activo 24/7
                          </span>
                        </div>
                        <p className="text-[11px] text-white/70 leading-relaxed">
                          ¡100% automático! Tus clientes pagan en <b>USDT (TRC20, BEP20, TON, Polygon)</b> y tus ganancias netas se acreditan al instante a tu balance. Cero riesgo cambiario.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Coordinar Pedido por WhatsApp */}
                  <div className="p-3.5 rounded-2xl border border-sky-500/30 bg-sky-500/5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white">Coordinar Pedido por WhatsApp</h4>
                        <p className="text-[10px] text-white/50">Permite enviar el pedido directamente al chat</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(paymentMethods.whatsapp_checkout?.enabled !== false)}
                        onChange={e => setPaymentMethods({
                          ...paymentMethods,
                          whatsapp_checkout: {
                            ...paymentMethods.whatsapp_checkout,
                            enabled: e.target.checked
                          }
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  {/* Cobros y Liquidación Oficial */}
                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-black text-white">Retiro de Ganancias Acumuladas</h4>
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      Todas tus ventas en USDT acumulan tu comisión neta en tu saldo de Francho Shop. Puedes solicitar el retiro directo de tus fondos en cualquier momento desde tu panel.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 6: BOT TELEGRAM & NOTIFICACIONES */}
              {customizerTab === 'bot' && (
                <div className="space-y-4">
                  {/* Conexión de Bot con @BotFather */}
                  <div className="p-4 rounded-2xl bg-card border border-white/10 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-sky-400" />
                        <h4 className="text-xs font-black text-white">Bot de Telegram (@BotFather)</h4>
                      </div>
                      {botActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold uppercase flex items-center gap-1 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Conectado y Activo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-sky-500 text-black font-black uppercase">
                          One-Click
                        </span>
                      )}
                    </div>

                    {botActive && botUsername && (
                      <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between text-xs">
                        <span className="text-white/70">Usuario del Bot:</span>
                        <a
                          href={`https://t.me/${botUsername}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono font-bold text-sky-400 hover:underline flex items-center gap-1"
                        >
                          @{botUsername}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-white/80">Token de Telegram (HTTP API):</label>
                        <a
                          href="https://t.me/BotFather"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
                        >
                          <span>Abrir @BotFather</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <input
                        type="text"
                        placeholder="Ej: 7182938192:AAHkm-..."
                        value={botToken}
                        onChange={e => setBotToken(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono focus:border-sky-400 outline-none"
                      />
                      <p className="text-[10px] text-white/40">
                        Crea un bot con <code className="text-sky-300">/newbot</code> en @BotFather y pega el token aquí. Se configurará el botón de Mini App automáticamente.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleConnectBot}
                        disabled={connectingBot || !botToken.trim()}
                        className="flex-1 py-2.5 px-4 rounded-xl font-black text-xs text-black bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition active:scale-95 disabled:opacity-50"
                      >
                        {connectingBot ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                        <span>{connectingBot ? 'Vinculando...' : (botActive ? 'Actualizar Token' : 'Vincular Bot de Telegram')}</span>
                      </button>

                      {botActive && (
                        <button
                          type="button"
                          onClick={handleDisconnectBot}
                          disabled={disconnectingBot}
                          className="px-3 py-2.5 rounded-xl font-bold text-xs text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition active:scale-95 disabled:opacity-50"
                        >
                          {disconnectingBot ? 'Desconectando...' : 'Desconectar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Modo de Tienda (Web vs Mini App) */}
                  <div className="p-4 rounded-2xl bg-card border border-white/10 space-y-3">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <Globe2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Modo de Apertura de la Tienda</span>
                    </h4>

                    <div className="space-y-1.5">
                      {[
                        {
                          id: 'both',
                          title: '🌐 Ambos Modos (Tienda Web + Telegram)',
                          desc: 'Se puede abrir por navegador web y también dentro de Telegram.'
                        },
                        {
                          id: 'miniapp_only',
                          title: '📱 Solo Telegram Mini App (Recomendado)',
                          desc: 'Optimizado para Telegram. Si entran por web se les invita a abrir el bot.'
                        },
                        {
                          id: 'webapp_only',
                          title: '💻 Solo Tienda Web',
                          desc: 'Navegación web tradicional.'
                        }
                      ].map(mode => (
                        <label
                          key={mode.id}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                            storeMode === mode.id
                              ? 'border-sky-500/60 bg-sky-500/10 text-white'
                              : 'border-white/5 bg-black/40 text-white/70 hover:bg-white/5'
                          }`}
                        >
                          <input
                            type="radio"
                            name="mini_app_store_mode"
                            value={mode.id}
                            checked={storeMode === mode.id}
                            onChange={() => setStoreMode(mode.id)}
                            className="mt-0.5 text-sky-400 accent-sky-400 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-xs block text-white">{mode.title}</span>
                            <span className="text-[10px] text-white/50">{mode.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Notificaciones de Pedidos */}
                  <div className="p-4 rounded-2xl bg-card border border-white/10 space-y-3">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Notificaciones de Nuevos Pedidos</span>
                    </h4>

                    <div className="space-y-2">
                      <div className="p-3 rounded-xl border border-white/5 bg-black/40 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-white block">Alertas por Telegram</span>
                          <span className="text-[10px] text-white/50">Mensaje instantáneo en Telegram al recibir una compra</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationPrefs.notify_telegram !== false)}
                            onChange={e => setNotificationPrefs({
                              ...notificationPrefs,
                              notify_telegram: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                      </div>

                      <div className="p-3 rounded-xl border border-white/5 bg-black/40 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-white block">Alertas por Correo (Gmail)</span>
                          <span className="text-[10px] text-white/50">Recibe un correo electrónico con los detalles del pedido</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationPrefs.notify_email !== false)}
                            onChange={e => setNotificationPrefs({
                              ...notificationPrefs,
                              notify_email: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: GMAIL SMTP Y NOTIFICACIONES A CLIENTES */}
              {customizerTab === 'email' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-4 rounded-2xl bg-card border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <Mail className="w-4 h-4 text-sky-400" />
                          <span>Notificaciones Gmail (SMTP)</span>
                        </h4>
                        <p className="text-[10px] text-white/50 mt-0.5">
                          Envía recibos de compra y accesos a tus clientes con tu propio correo.
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border shrink-0 flex items-center gap-1 ${
                        emailConfig.smtp_app_password
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        {emailConfig.smtp_app_password ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SMTP Activo</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" />
                            <span>Falta Contraseña</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Switch Envíos a Clientes */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white">Activar Envíos de Correo</p>
                        <p className="text-[10px] text-white/50">Enviar correos a clientes al comprar en la tienda</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(emailConfig.enabled ?? true)}
                          onChange={e => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                      </label>
                    </div>

                    {/* Inputs de Correo */}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="font-black text-white flex items-center gap-1.5 text-xs">
                          <Mail className="w-3.5 h-3.5 text-sky-400" />
                          <span>Tu Correo Gmail:</span>
                        </label>
                        <input
                          type="email"
                          placeholder="mitienda@gmail.com"
                          value={emailConfig.smtp_user || contactEmail || ''}
                          onChange={e => {
                            const val = e.target.value.trim()
                            setEmailConfig({ ...emailConfig, smtp_user: val })
                            setContactEmail(val)
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:border-sky-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-black text-white flex items-center gap-1.5 text-xs">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <span>Nombre Comercial del Remitente:</span>
                        </label>
                        <input
                          type="text"
                          placeholder={storeName || "Mi Tienda Games"}
                          value={emailConfig.sender_name || ''}
                          onChange={e => setEmailConfig({ ...emailConfig, sender_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:border-sky-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="font-black text-white flex items-center gap-1.5 text-xs">
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            <span>Contraseña de Aplicación de Google (16 letras):</span>
                          </label>
                          <a
                            href="https://myaccount.google.com/apppasswords"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
                          >
                            <span>Obtener</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <div className="relative">
                          <input
                            type={showAppPassword ? "text" : "password"}
                            placeholder="xxxx xxxx xxxx xxxx"
                            value={emailConfig.smtp_app_password || ''}
                            onChange={e => setEmailConfig({ ...emailConfig, smtp_app_password: e.target.value })}
                            className="w-full px-3 py-2 pr-10 rounded-xl bg-black/60 border border-white/15 text-xs font-mono text-white focus:border-sky-400 tracking-wider"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAppPassword(!showAppPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white"
                          >
                            {showAppPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-white/40">
                          Debe ser una clave de 16 caracteres generada en Google con verificación en 2 pasos activa.
                        </p>
                      </div>
                    </div>

                    {/* Casillas de Eventos */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
                        Eventos a Notificar
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2.5 text-xs cursor-pointer p-2 rounded-xl bg-black/20 border border-white/5 hover:border-white/15 transition">
                          <input
                            type="checkbox"
                            checked={Boolean(emailConfig.notify_client_receipt ?? true)}
                            onChange={e => setEmailConfig({ ...emailConfig, notify_client_receipt: e.target.checked })}
                            className="w-4 h-4 accent-sky-400 cursor-pointer shrink-0"
                          />
                          <div>
                            <p className="font-bold text-white text-[11px]">Enviar recibo de compra al cliente</p>
                            <p className="text-[9px] text-white/40">Comprobante oficial con ID y detalles del pedido</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 text-xs cursor-pointer p-2 rounded-xl bg-black/20 border border-white/5 hover:border-white/15 transition">
                          <input
                            type="checkbox"
                            checked={Boolean(emailConfig.notify_client_delivery ?? true)}
                            onChange={e => setEmailConfig({ ...emailConfig, notify_client_delivery: e.target.checked })}
                            className="w-4 h-4 accent-sky-400 cursor-pointer shrink-0"
                          />
                          <div>
                            <p className="font-bold text-white text-[11px]">Enviar cuentas de streaming y pines</p>
                            <p className="text-[9px] text-white/40">Entrega de credenciales directo al correo del cliente</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 text-xs cursor-pointer p-2 rounded-xl bg-black/20 border border-white/5 hover:border-white/15 transition">
                          <input
                            type="checkbox"
                            checked={Boolean(emailConfig.notify_on_order ?? true)}
                            onChange={e => setEmailConfig({ ...emailConfig, notify_on_order: e.target.checked })}
                            className="w-4 h-4 accent-sky-400 cursor-pointer shrink-0"
                          />
                          <div>
                            <p className="font-bold text-white text-[11px]">Aviso de venta a mi propio correo</p>
                            <p className="text-[9px] text-white/40">Alerta con el monto de tu ganancia neta</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Botón de Prueba */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleTestSmtp}
                        disabled={testingSmtp}
                        className="w-full py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-xs border border-sky-500/30 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {testingSmtp ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Probando Conexión con Google...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Probar Conexión SMTP con Google</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Guía Desplegable para Móvil */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowSmtpGuide(!showSmtpGuide)}
                      className="w-full flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px] font-black text-white">¿Cómo generar la Contraseña de 16 letras?</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform ${showSmtpGuide ? 'rotate-180' : ''}`} />
                    </button>

                    {showSmtpGuide && (
                      <div className="space-y-2 pt-2 border-t border-white/10 text-[10px] text-white/70 animate-in fade-in">
                        <p>1. Ve a <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">Seguridad de tu Cuenta Google</a> y activa la <b>Verificación en 2 pasos</b>.</p>
                        <p>2. Abre <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">Contraseñas de aplicaciones</a>.</p>
                        <p>3. Escribe un nombre como <i>"Mi Tienda"</i> y presiona <b>Crear</b>.</p>
                        <p>4. Copia las 16 letras amarillas y pégalas aquí arriba.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: CONTACTO Y REDES */}
              {customizerTab === 'contact' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="font-black text-white flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp de Soporte para Clientes:</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: +5351234567"
                      value={whatsappNumber}
                      onChange={e => setWhatsappNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                    <p className="text-[10px] text-white/40">Los clientes podrán hacer clic en WhatsApp para consultarte o pedir ayuda.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-white flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                      <span>Usuario de Telegram (sin @):</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: mitienda_soporte"
                      value={telegramUsername}
                      onChange={e => setTelegramUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      <span>Correo Electrónico de Contacto / Notificaciones:</span>
                    </label>
                    <input
                      type="email"
                      placeholder="Ej: soporte@mitienda.com"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-white flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5 text-pink-400" />
                      <span>Perfil de Instagram o Red Social:</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: https://instagram.com/mitienda"
                      value={instagramUrl}
                      onChange={e => setInstagramUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* TAB 8: PRODUCTOS PROPIOS */}
              {customizerTab === 'manual' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-sky-400" />
                          <span>Productos Exclusivos / Propios</span>
                        </h4>
                        <p className="text-[10px] text-white/50">Cuentas de juegos, pantallas streaming, combos y servicios.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomizerOpen(false)
                          handleOpenCreateManual()
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-black text-black flex items-center gap-1 shadow-md transition active:scale-95"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Crear Producto</span>
                      </button>
                    </div>
                  </div>

                  {/* Listado de Productos Manuales */}
                  <div className="space-y-2">
                    {loadingManual ? (
                      <div className="p-8 text-center text-white/40">Cargando productos...</div>
                    ) : manualProducts.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl space-y-2">
                        <Package className="w-8 h-8 text-white/20 mx-auto" />
                        <p className="text-xs text-white/60">Aún no has creado productos propios en tu tienda.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomizerOpen(false)
                            handleOpenCreateManual()
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-black text-black shadow-md"
                          style={{ backgroundColor: primaryColor }}
                        >
                          + Crear Mi Primer Producto
                        </button>
                      </div>
                    ) : (
                      manualProducts.map(p => (
                        <div
                          key={p.id}
                          className="p-3 rounded-2xl border border-white/10 bg-black/40 flex items-center justify-between gap-3 hover:border-white/20 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                              {p.icon_url ? (
                                <img src={toFastImageUrl(p.icon_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <Tag className="w-4 h-4 text-white/40" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-black text-white truncate">{p.name}</h5>
                              <p className="text-[10px] text-white/50 truncate">
                                ${Number(p.price || 0).toFixed(2)} USDT • {p.category}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleManualActive(p)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border transition active:scale-95 ${
                                p.is_active
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-red-500/20 text-red-400 border-red-500/30'
                              }`}
                            >
                              {p.is_active ? 'Activo' : 'Pausado'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCustomizerOpen(false)
                                handleOpenEditManual(p)
                              }}
                              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition active:scale-95"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteManualProduct(p.id)}
                              className="w-7 h-7 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition active:scale-95"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer con Botón Guardar */}
            <div className="p-4 border-t border-white/10 bg-black/60 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[10px] text-white/50">Los cambios se aplican de inmediato.</span>
              <button
                type="button"
                disabled={savingCustomizer}
                onClick={handleSaveCustomization}
                className="px-5 py-2.5 rounded-xl font-black text-xs text-black flex items-center gap-2 shadow-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {savingCustomizer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{savingCustomizer ? 'Guardando...' : 'Guardar Ajustes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE GESTIÓN DE PRODUCTOS MANUALES ─────────────────── */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[92vh] rounded-3xl border border-white/15 bg-slate-900/98 shadow-2xl flex flex-col overflow-hidden text-white">
            {/* Header Modal */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm sm:text-base font-black">
                  {manualView === 'form'
                    ? (editingManualProduct ? 'Editar Producto Manual' : 'Crear Nuevo Producto Propio')
                    : 'Mis Productos Exclusivos'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {manualView === 'list' && (
                  <button
                    type="button"
                    onClick={handleOpenCreateManual}
                    className="px-3 py-1.5 rounded-xl text-xs font-black text-black flex items-center gap-1 shadow-md transition active:scale-95"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear Producto</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* VISTA 1: LISTADO DE PRODUCTOS */}
            {manualView === 'list' && (
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {loadingManual ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-2xl bg-white/5" />
                    ))}
                  </div>
                ) : manualProducts.length === 0 ? (
                  <div className="text-center py-12 space-y-3 border border-dashed border-white/10 rounded-2xl p-6">
                    <Package className="w-10 h-10 text-white/20 mx-auto" />
                    <div>
                      <h4 className="text-sm font-black text-white">Aún no has creado productos manuales</h4>
                      <p className="text-xs text-white/50 max-w-sm mx-auto mt-1">
                        Puedes vender cuentas de juegos, pantallas de streaming (Netflix), combos de diamantes o servicios con tus propios precios.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenCreateManual}
                      className="px-4 py-2 rounded-xl text-xs font-black text-black shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      + Crear Mi Primer Producto
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {manualProducts.map(p => (
                      <div
                        key={p.id}
                        className="p-3 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-3 hover:border-white/20 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                            {p.icon_url ? (
                              <img src={toFastImageUrl(p.icon_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Tag className="w-5 h-5 text-white/40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs sm:text-sm font-black text-white truncate">{p.name}</h5>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
                                p.is_active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {p.is_active ? 'Activo' : 'Pausado'}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/50 truncate">
                              {p.category} • Entrega: {p.delivery_time || 'Manual'}
                            </p>
                            <p className="text-xs font-black text-emerald-400 pt-0.5">
                              ${Number(p.price || p.sell_price).toFixed(2)} USDT
                            </p>
                          </div>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleManualActive(p)}
                            title={p.is_active ? 'Pausar producto' : 'Activar producto'}
                            className={`p-2 rounded-xl border transition ${
                              p.is_active ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            {p.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditManual(p)}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteManualProduct(p.id)}
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VISTA 2: FORMULARIO CREAR / EDITAR */}
            {manualView === 'form' && (
              <form onSubmit={handleSaveManualProduct} className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-black text-white">Nombre del Producto <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Cuenta Free Fire Veterana con Sakura"
                    value={manualForm.name}
                    onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-black text-white">Categoría:</label>
                    <select
                      value={manualForm.category}
                      onChange={e => setManualForm({ ...manualForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    >
                      {MANUAL_CATEGORIES.map(c => (
                        <option key={c} value={c} className="bg-slate-900">{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-white">Precio en USD <span className="text-red-400">*</span></label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.10"
                        required
                        placeholder="Ej: 15.00"
                        value={manualForm.price}
                        onChange={e => setManualForm({ ...manualForm, price: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* VARIANTES / PAQUETES DEL MISMO PRODUCTO */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                        <span>Variantes / Paquetes de este Producto (Opcional)</span>
                      </h4>
                      <p className="text-[10px] text-white/50">
                        ¿Vendes diferentes opciones o montos? (Ej: Saldo Móvil 110, 230, 500 CUP o 100💎, 310💎, 520💎)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setManualForm(prev => ({
                          ...prev,
                          options: [...(prev.options || []), { name: '', price: '', stock: -1 }]
                        }))
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 active:scale-95 transition cursor-pointer"
                      style={{ backgroundColor: `${primaryColor}20`, color: primaryColor, border: `1px solid ${primaryColor}40` }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Variante</span>
                    </button>
                  </div>

                  {(!manualForm.options || manualForm.options.length === 0) ? (
                    <p className="text-[11px] text-white/40 italic">
                      Sin variantes adicionales. Se venderá al precio base establecido de arriba (${manualForm.price || '0.00'} USD).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {manualForm.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10">
                          <input
                            type="text"
                            placeholder="Nombre (ej: 110 CUP, 1 Mes, 100 Diamantes)"
                            value={opt.name}
                            onChange={(e) => {
                              const val = e.target.value
                              setManualForm(prev => {
                                const next = [...prev.options]
                                next[idx] = { ...next[idx], name: val }
                                return { ...prev, options: next }
                              })
                            }}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-white"
                          />
                          <div className="flex items-center gap-1 w-24">
                            <span className="text-[11px] text-white/40">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="USD"
                              value={opt.price}
                              onChange={(e) => {
                                const val = e.target.value
                                setManualForm(prev => {
                                  const next = [...prev.options]
                                  next[idx] = { ...next[idx], price: val }
                                  return { ...prev, options: next }
                                })
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setManualForm(prev => ({
                                ...prev,
                                options: prev.options.filter((_, i) => i !== idx)
                              }))
                            }}
                            className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center shrink-0 cursor-pointer"
                            title="Eliminar variante"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-black text-white">Tiempo Estimado de Entrega:</label>
                    <input
                      type="text"
                      placeholder="Ej: 5 - 15 min, 1 hora, Inmediato"
                      value={manualForm.delivery_time}
                      onChange={e => setManualForm({ ...manualForm, delivery_time: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-black text-white">Stock / Unidades disponibles (-1 = Ilimitado):</label>
                    <input
                      type="number"
                      placeholder="-1"
                      value={manualForm.stock}
                      onChange={e => setManualForm({ ...manualForm, stock: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-black text-white block">Imagen o Foto del Producto:</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="manual-product-img-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploadingManualImage(true)
                        try {
                          const res = await api.uploadWebStoreImage(file)
                          if (res?.ok && res.url) {
                            setManualForm(prev => ({ ...prev, icon_url: res.url }))
                            showToast('success', '¡Foto de producto subida!')
                          } else {
                            showToast('error', res?.message || 'Error al subir foto')
                          }
                        } catch (err) {
                          showToast('error', err.message || 'Error al subir')
                        } finally {
                          setUploadingManualImage(false)
                          e.target.value = ''
                        }
                      }}
                    />
                    <label
                      htmlFor="manual-product-img-file"
                      className="cursor-pointer px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-sm shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingManualImage ? 'Subiendo...' : '📁 Subir foto'}</span>
                    </label>

                    <input
                      type="text"
                      placeholder="O ingresa enlace directo..."
                      value={manualForm.icon_url}
                      onChange={e => setManualForm({ ...manualForm, icon_url: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />

                    {manualForm.icon_url && (
                      <div className="relative group shrink-0">
                        <img src={manualForm.icon_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/20" />
                        <button
                          type="button"
                          onClick={() => setManualForm(prev => ({ ...prev, icon_url: '' }))}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px]"
                          title="Quitar imagen"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-black text-white">Instrucciones para el Comprador:</label>
                  <input
                    type="text"
                    placeholder="Ej: Envía tu ID de juego o número de teléfono por WhatsApp"
                    value={manualForm.instructions}
                    onChange={e => setManualForm({ ...manualForm, instructions: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                  />
                  <p className="text-[10px] text-white/40">Este texto se le mostrará al cliente en la pantalla de compra.</p>
                </div>

                <div className="space-y-1">
                  <label className="font-black text-white">Descripción Completa y Detalles:</label>
                  <textarea
                    rows={3}
                    placeholder="Detalles de la cuenta o servicio, skins, armas, nivel, términos de garantía, etc."
                    value={manualForm.description}
                    onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setManualView('list')}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold"
                  >
                    Volver a la lista
                  </button>

                  <button
                    type="submit"
                    disabled={savingManual}
                    className="px-5 py-2 rounded-xl font-black text-black shadow-lg flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingManual ? 'Guardando...' : (editingManualProduct ? 'Guardar Cambios' : 'Crear y Publicar')}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL EDITAR PERFIL (DATOS Y CORREO) ────────────────────────── */}
      {userProfileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setUserProfileModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-t-3xl sm:rounded-3xl border shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-thin animate-in zoom-in-95 ${
              isWhiteTheme ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900/98 text-white border-white/15'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    borderColor: `${primaryColor}30`,
                    color: primaryColor
                  }}
                >
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Editar Perfil</h3>
                  <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/40'}`}>Actualiza tu nombre y correo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserProfileModalOpen(false)}
                className={`p-1.5 rounded-xl transition ${isWhiteTheme ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-white/50'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStoreProfile} className="space-y-3.5">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                  Nombre visible / Identificador
                </label>
                <input
                  type="text"
                  value={profileEditName}
                  onChange={e => setProfileEditName(e.target.value)}
                  placeholder="Tu nombre completo o de usuario"
                  maxLength={60}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition ${
                    isWhiteTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'
                      : 'bg-black/40 border-white/10 text-white focus:border-white/30'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={profileEditEmail}
                  onChange={e => setProfileEditEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  maxLength={120}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition ${
                    isWhiteTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'
                      : 'bg-black/40 border-white/10 text-white focus:border-white/30'
                  }`}
                />
                <p className={`text-[10px] mt-1 ${isWhiteTheme ? 'text-slate-400' : 'text-white/35'}`}>
                  Utilizado para recibos y notificaciones de compras.
                </p>
              </div>

              {profileEditMsg && (
                <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                  profileEditMsg.startsWith('✓')
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                }`}>
                  {profileEditMsg}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUserProfileModalOpen(false)}
                  className={`w-1/2 py-2.5 rounded-xl text-xs font-bold border transition ${
                    isWhiteTheme ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={profileEditSaving}
                  className="w-1/2 py-2.5 rounded-xl text-xs font-black text-black active:scale-95 transition shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {profileEditSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{profileEditSaving ? 'Guardando...' : 'Guardar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CAMBIAR CONTRASEÑA ───────────────────────────────── */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 ${
            isWhiteTheme ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900/98 text-white border-white/15'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Cambiar Contraseña</h3>
                  <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>Actualiza tu clave de acceso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPwdModal(false)
                  setPwdMsg(null)
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                  isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/10 hover:bg-white/20 text-white/70'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                  Contraseña Actual (opcional si es primera vez)
                </label>
                <input
                  type="password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  placeholder="Tu contraseña actual..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none transition ${
                    isWhiteTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'
                      : 'bg-white/5 border-white/10 text-white focus:border-white/30'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                  Nueva Contraseña (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="Nueva contraseña segura..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none transition ${
                    isWhiteTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'
                      : 'bg-white/5 border-white/10 text-white focus:border-white/30'
                  }`}
                />
              </div>

              {pwdMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold border ${
                  pwdMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : 'bg-red-500/10 border-red-500/30 text-red-500'
                }`}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPwdModal(false)
                    setPwdMsg(null)
                  }}
                  className={`py-2.5 rounded-xl border text-xs font-bold active:scale-95 transition ${
                    isWhiteTheme
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleChangePwd}
                  disabled={pwdLoading}
                  className="py-2.5 rounded-xl text-xs font-black text-black active:scale-95 transition disabled:opacity-50 shadow cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  {pwdLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE RECARGA DE SALDO USDT (OXAPAY) ──────────────── */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 ${
            isWhiteTheme ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-white border-white/15'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-3 ${isWhiteTheme ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-yellow-400/20 text-yellow-500 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm sm:text-base font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>Recargar Saldo USDT</h3>
                  <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>Pasarela Oficial Cripto OxaPay (24/7 Automático)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDepositModalOpen(false)
                  setDepositResult(null)
                  setDepositError('')
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                  isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/10 hover:bg-white/20 text-white/70'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Estado Si se acaba de generar la orden */}
            {depositResult ? (
              <div className="space-y-4 py-2 animate-in fade-in">
                <div className={`p-4 rounded-2xl border text-center space-y-2 ${
                  isWhiteTheme ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className={`text-sm font-black ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>¡Factura OxaPay Generada!</h4>
                  <p className={`text-xs ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>
                    Monto de recarga: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-300">${depositResult.amount_usd} USDT</span>
                  </p>
                  <p className={`text-[11px] leading-relaxed ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                    Hemos abierto la pasarela en una pestaña nueva. Si tu navegador la bloqueó, pulsa el botón abajo para abrirla y pagar en tu red favorita (TRC20, BEP20, TON, Polygon, Solana, etc.).
                  </p>
                </div>

                <div className="space-y-2">
                  <a
                    href={depositResult.pay_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
                  >
                    <span>Abrir Pasarela de Pago OxaPay</span>
                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                  </a>

                  <button
                    type="button"
                    onClick={async () => {
                      await refreshUserData()
                      showToast('info', 'Actualizando estado de saldo...')
                    }}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                      isWhiteTheme
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Ya pagué / Actualizar mi Saldo</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario de selección de monto */
              <div className="space-y-4">
                {depositError && (
                  <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-500 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{depositError}</span>
                  </div>
                )}

                {/* Presets de monto */}
                <div className="space-y-1.5">
                  <label className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>Monto a Recargar (USDT)</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['5', '10', '20', '50', '100'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDepositAmount(val)}
                        className={`py-2 rounded-xl text-xs font-black transition active:scale-95 border cursor-pointer ${
                          depositAmount === val
                            ? 'bg-yellow-400 text-black border-yellow-400 shadow-md'
                            : isWhiteTheme
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                            : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
                        }`}
                      >
                        ${val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input personalizado */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold ${isWhiteTheme ? 'text-slate-700' : 'text-white/70'}`}>O ingresa un monto personalizado</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-sm font-bold text-yellow-500 font-mono">$</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="10.00"
                      className={`w-full pl-8 pr-16 py-2.5 rounded-xl border text-sm font-mono font-bold outline-none transition ${
                        isWhiteTheme
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-yellow-500'
                          : 'bg-black/60 border-white/15 text-white focus:border-yellow-400'
                      }`}
                    />
                    <span className={`absolute right-3.5 text-xs font-black ${isWhiteTheme ? 'text-slate-400' : 'text-white/50'}`}>USDT</span>
                  </div>
                  <p className={`text-[10px] ${isWhiteTheme ? 'text-slate-400' : 'text-white/40'}`}>Monto mínimo: $1.00 USDT · Sin comisiones de recarga</p>
                </div>

                {/* Ventajas OxaPay */}
                <div className={`p-3 rounded-xl border space-y-1.5 text-[11px] ${
                  isWhiteTheme ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white/70'
                }`}>
                  <div className={`flex items-center gap-2 font-bold ${isWhiteTheme ? 'text-slate-900' : 'text-white'}`}>
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Acreditación Automática en Segundos</span>
                  </div>
                  <p className={`text-[10px] leading-relaxed ${isWhiteTheme ? 'text-slate-500' : 'text-white/50'}`}>
                    Paga con USDT en cualquier red soportada (TRC20, BEP20, TON, Polygon, Solana, Arbitrum). Una vez que la red confirme la transacción, tu saldo se actualizará al instante.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={depositLoading || !depositAmount || parseFloat(depositAmount) < 1}
                  onClick={handleCreateDeposit}
                  className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {depositLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando orden OxaPay...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Generar Pago de ${parseFloat(depositAmount || 0).toFixed(2)} USDT</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL DE TÉRMINOS Y CONDICIONES (UNIVERSAL) ─────────────── */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/98 shadow-2xl overflow-hidden p-5 space-y-4 text-white max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black">Términos y Condiciones de Compra</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 text-xs text-white/80 leading-relaxed flex-1">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <h4 className="font-bold text-white mb-1">1. Entrega y Activación Digital</h4>
                <p className="text-white/70">
                  Los productos digitales, recargas y suscripciones se entregan conforme a los datos suministrados por el comprador. Una vez procesada la entrega, la compra se considera perfeccionada e irreversible.
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-amber-400" />
                  2. Plataformas Externas e IA (Google Gemini, ChatGPT, etc.)
                </h4>
                <p className="text-white/80">
                  La tienda facilita licencias activas pero <b>NO opera los servidores ni modelos de Google ni OpenAI</b>:
                </p>
                <ul className="list-disc pl-4 mt-2 space-y-1.5 text-white/70">
                  <li><b>Fallas o caídas del modelo:</b> Si Google Gemini o ChatGPT no responde, da errores de saturación ("rate limit") o sufre caídas globales en sus servidores, esto corresponde a la plataforma externa de Google y <b>NO da derecho a reembolso ni anulación</b>.</li>
                  <li><b>Requisitos de red / VPN:</b> En zonas con restricciones de IP (ej. Cuba ante Google), el usuario es responsable de contar con una conexión y VPN compatible.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <h4 className="font-bold text-red-300 mb-1">3. Política Estricta de No Devolución</h4>
                <p className="text-white/70">
                  No se realizan reembolsos por cambios de opinión, desconexiones locales ni caídas de servidores de Google u otros proveedores externos una vez entregado el servicio funcional.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-full py-2.5 rounded-xl font-black text-xs text-black active:scale-95 transition"
                style={{ backgroundColor: primaryColor }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegación Móvil Inferior (Estilo Francho Shop) */}
      <nav className={`fixed inset-x-0 bottom-0 z-40 border-t ${
        isWhiteTheme ? 'border-slate-200 bg-white/95 text-slate-700 shadow-xl' : 'border-white/10 bg-[#0c101c]/95 text-white/60'
      } px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-1.5 backdrop-blur-md md:hidden`}>
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {/* 1. Tienda */}
          <button
            type="button"
            onClick={() => {
              setActiveView('store')
              handleSelectCategory('all')
            }}
            className={`flex min-h-[50px] flex-col items-center justify-center rounded-xl border text-[10px] font-bold transition active:scale-95 ${
              activeView === 'store' && catalogCategoryFilter === 'all' && !searchQuery
                ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400 shadow-sm'
                : isWhiteTheme ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900' : 'border-white/5 bg-[#16181f]/60 text-white/60 hover:text-white'
            }`}
            style={
              activeView === 'store' && catalogCategoryFilter === 'all' && !searchQuery
                ? { borderColor: `${primaryColor}80`, backgroundColor: `${primaryColor}26`, color: primaryColor }
                : {}
            }
          >
            <Store className="h-4 w-4" style={activeView === 'store' && catalogCategoryFilter === 'all' && !searchQuery ? { color: primaryColor } : {}} />
            <span className="mt-1 truncate">Tienda</span>
          </button>

          {/* 2. Pedidos */}
          <button
            type="button"
            onClick={() => openOrdersTab()}
            className={`flex min-h-[50px] flex-col items-center justify-center rounded-xl border text-[10px] font-bold transition active:scale-95 ${
              activeView === 'orders'
                ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400 shadow-sm'
                : isWhiteTheme ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900' : 'border-white/5 bg-[#16181f]/60 text-white/60 hover:text-white'
            }`}
            style={
              activeView === 'orders'
                ? { borderColor: `${primaryColor}80`, backgroundColor: `${primaryColor}26`, color: primaryColor }
                : {}
            }
          >
            <Package className="h-4 w-4" style={activeView === 'orders' ? { color: primaryColor } : {}} />
            <span className="mt-1 truncate">Pedidos</span>
          </button>

          {/* 3. SMS (Números Virtuales) */}
          <button
            type="button"
            onClick={() => openSmsTab()}
            className={`flex min-h-[50px] flex-col items-center justify-center rounded-xl border text-[10px] font-bold transition active:scale-95 ${
              activeView === 'sms'
                ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400 shadow-sm'
                : isWhiteTheme ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900' : 'border-white/5 bg-[#16181f]/60 text-white/60 hover:text-white'
            }`}
            style={
              activeView === 'sms'
                ? { borderColor: `${primaryColor}80`, backgroundColor: `${primaryColor}26`, color: primaryColor }
                : {}
            }
          >
            <Smartphone className="h-4 w-4" style={activeView === 'sms' ? { color: primaryColor } : {}} />
            <span className="mt-1 truncate">SMS</span>
          </button>

          {/* 4. Perfil / Ajustes */}
          <button
            type="button"
            onClick={() => openProfileTab()}
            className={`flex min-h-[50px] flex-col items-center justify-center rounded-xl border text-[10px] font-bold transition active:scale-95 ${
              activeView === 'profile'
                ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400 shadow-sm'
                : isWhiteTheme ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900' : 'border-white/5 bg-[#16181f]/60 text-white/60 hover:text-white'
            }`}
            style={
              activeView === 'profile'
                ? { borderColor: `${primaryColor}80`, backgroundColor: `${primaryColor}26`, color: primaryColor }
                : {}
            }
          >
            <User className="h-4 w-4" style={activeView === 'profile' ? { color: primaryColor } : {}} />
            <span className="mt-1 truncate">
              {currentUser ? 'Perfil' : 'Ingresar'}
            </span>
          </button>
        </div>
      </nav>
    </div>
  )
}
