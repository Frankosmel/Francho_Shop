// build:1781971166
import { useState, useEffect, useRef, useMemo, Component } from 'react'
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Ban, BookOpen, BriefcaseBusiness, Check,
  CircleCheck, CircleHelp, CircleX, ClipboardList, Clock, Crown, DollarSign, ExternalLink, Paperclip,
  Edit3, FileText, Flame, Gamepad2, Gem, Gift, Globe2, Headphones, Home, Inbox, Info, KeyRound,
  Link as LinkIcon, Loader2, Lock, LockKeyhole, LogOut, Mail, MessageCircle,
  Menu, Package, PackageOpen, Phone, RefreshCcw, Save, Search, Send, Share2, Shield, ShieldAlert,
  ShieldCheck, ShoppingCart, Smile, Smartphone, Sparkles, Store, Trash2, Truck, User,
  WalletCards, Wrench, Zap, Eye, EyeOff, ChevronDown, ChevronRight, X, Bell
} from 'lucide-react'
import { api, tg, setSellerId, getSellerId } from './api/client'

const iconClass = 'h-5 w-5 flex-shrink-0'
const bigIconClass = 'h-12 w-12 flex-shrink-0'
const DEPOSIT_PRESETS = [5, 10, 25, 50, 100, 250]
const NAV_STATE_KEY = 'fs_last_nav_v1'
const WHATSAPP_SUPPORT_URL = 'https://wa.me/5363785631'
const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VaRW8KgGehETCBaAnN2K'
const SAFE_NAV_SCREENS = new Set(['home', 'regions', 'products', 'detail', 'profile', 'orders', 'help', 'terms', 'faq', 'contact', 'partner-help', 'seller-store', 'guides', 'guide-detail', 'case', 'panel'])
const PREMIUM_STICKERS = [
  { code: ':fs_fire:', label: 'Popular', icon: Flame, color: 'text-orange-400' },
  { code: ':fs_diamond:', label: 'Premium', icon: Gem, color: 'text-cyan-300' },
  { code: ':fs_check:', label: 'Verificado', icon: BadgeCheck, color: 'text-emerald-400' },
  { code: ':fs_gift:', label: 'Regalo', icon: Gift, color: 'text-pink-400' },
  { code: ':fs_star:', label: 'Destacado', icon: Sparkles, color: 'text-yellow-300' },
  { code: ':fs_bolt:', label: 'Entrega rápida', icon: Zap, color: 'text-lime-300' },
  { code: ':fs_usdt:', label: 'USDT', icon: DollarSign, color: 'text-emerald-300' },
  { code: ':fs_crown:', label: 'Exclusivo', icon: Crown, color: 'text-amber-300' },
  { code: ':fs_alert:', label: 'Importante', icon: AlertTriangle, color: 'text-red-400' },
  { code: ':fs_support:', label: 'Soporte', icon: Headphones, color: 'text-sky-300' },
  { code: ':fs_game:', label: 'Juego', icon: Gamepad2, color: 'text-violet-300' },
  { code: ':fs_secure:', label: 'Seguro', icon: ShieldCheck, color: 'text-emerald-300' },
  { code: ':fs_time:', label: 'Tiempo', icon: Clock, color: 'text-blue-300' },
  { code: ':fs_stock:', label: 'Stock', icon: Package, color: 'text-orange-300' },
  { code: ':fs_key:', label: 'Acceso', icon: KeyRound, color: 'text-yellow-300' },
  { code: ':fs_store:', label: 'Tienda', icon: Store, color: 'text-fuchsia-300' },
  { code: ':fs_delivery:', label: 'Entrega', icon: Truck, color: 'text-cyan-300' },
  { code: ':fs_wallet:', label: 'Saldo', icon: WalletCards, color: 'text-green-300' },
  { code: ':fs_done:', label: 'Completado', icon: CircleCheck, color: 'text-emerald-400' },
  { code: ':fs_chat:', label: 'Mensaje', icon: MessageCircle, color: 'text-sky-300' },
  { code: ':fs_lock:', label: 'Protegido', icon: Lock, color: 'text-slate-300' },
  { code: ':fs_mobile:', label: 'Móvil', icon: Smartphone, color: 'text-indigo-300' },
  { code: ':fs_global:', label: 'Global', icon: Globe2, color: 'text-blue-300' },
  { code: ':fs_info:', label: 'Detalles', icon: FileText, color: 'text-white/70' },
  { code: ':fs_help:', label: 'Ayuda', icon: CircleHelp, color: 'text-teal-300' },
]
const PREMIUM_STICKER_MAP = Object.fromEntries(PREMIUM_STICKERS.map(s => [s.code, s]))
const PREMIUM_STICKER_RE = /(:fs_[a-z0-9_]+:)/g
const GUEST_USER = { user_id: null, name: 'Visitante', balance: 0, role: 'guest', pricing_role: 'user', is_guest: true }
const stripEmoji = (value = '') => String(value).replace(/^\s*[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F]+\s*/u, '').trim()
const storeAssetUrl = (value = '') => String(value || '').replace(/^https?:\/\/\/api\//i, '/api/')
const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true }
  catch { window.prompt('Copia este enlace', text); return false }
}

const SEO_DEFAULT = {
  title: 'Francho Shop | Recargas de juegos y gift cards para Cuba',
  description: 'Compra recargas de juegos, gift cards, suscripciones y productos digitales en Francho Shop. Plataforma pensada para Cuba y el mundo.',
}

const cacheBust = Math.floor(Date.now() / 3600000);

const GUIDE_ARTICLES = [
  {
    slug: 'como-recargar-free-fire-en-cuba',
    title: 'Cómo recargar Free Fire en Cuba | Diamantes Free Fire en Francho Shop',
    description: 'Aprende cómo recargar diamantes de Free Fire en Cuba de forma fácil usando Francho Shop. Compra desde la web, paga con saldo o USDT y deja tu pedido registrado.',
    h1: 'Cómo recargar Free Fire en Cuba',
    cardTitle: 'Cómo recargar Free Fire en Cuba',
    cta: 'Comprar diamantes de Free Fire',
    intro: [
      'Recargar Free Fire desde Cuba puede ser complicado cuando no tienes acceso directo a métodos de pago internacionales. En Francho Shop queremos hacerlo más fácil, organizado y seguro para los jugadores cubanos.',
      'Desde nuestra web puedes seleccionar el paquete de diamantes que necesitas, revisar el precio, pagar usando tu saldo disponible o USDT, y dejar tu pedido registrado dentro de la plataforma.',
    ],
    sections: [
      { title: 'Ventajas de recargar Free Fire en Francho Shop', list: ['Puedes comprar desde Cuba', 'Puedes usar saldo dentro de la web', 'Puedes pagar en USDT cuando esté disponible', 'Tu pedido queda registrado', 'Puedes revisar el estado de tu compra', 'Puedes contactar soporte si tienes dudas', 'Próximamente habrá opciones para revendedores'] },
      { title: 'Cómo hacer una recarga de Free Fire', steps: ['Entra a Francho Shop.', 'Busca Free Fire.', 'Selecciona el paquete de diamantes.', 'Escribe correctamente los datos solicitados.', 'Revisa el pedido antes de pagar.', 'Confirma la compra.', 'Espera a que la recarga sea procesada.'] },
      { title: 'Consejos antes de comprar', text: 'Antes de pagar, revisa siempre que los datos estén correctos. Si escribes mal un ID, servidor o dato solicitado, la recarga puede enviarse a otra cuenta y no siempre será posible recuperar el dinero.' },
    ],
    faq: [
      ['¿Puedo recargar Free Fire desde Cuba?', 'Sí. En Francho Shop puedes comprar recargas de Free Fire desde Cuba usando los métodos disponibles en la plataforma.'],
      ['¿Necesito contraseña de mi cuenta?', 'No. Francho Shop nunca solicita contraseña, códigos OTP ni acceso directo a tu cuenta.'],
      ['¿La recarga es inmediata?', 'Algunas recargas pueden procesarse rápido, pero el tiempo puede variar según disponibilidad, proveedor, conexión o volumen de pedidos.'],
    ],
  },
  {
    slug: 'como-recargar-roblox-en-cuba',
    title: 'Cómo recargar Roblox en Cuba | Comprar Robux en Francho Shop',
    description: 'Guía para comprar Robux o productos de Roblox desde Cuba usando Francho Shop. Compra fácil, segura y con pedido registrado en la web.',
    h1: 'Cómo recargar Roblox en Cuba',
    cardTitle: 'Cómo recargar Roblox en Cuba',
    cta: 'Ver productos de Roblox',
    intro: ['Roblox es uno de los juegos más populares entre jugadores de Cuba y del mundo. En Francho Shop podrás encontrar opciones para comprar productos relacionados con Roblox de forma más organizada.'],
    sections: [
      { title: 'Qué puedes comprar para Roblox', list: ['Robux según disponibilidad', 'Gift cards relacionadas con Roblox', 'Productos digitales compatibles', 'Servicios disponibles en la plataforma'] },
      { title: 'Cómo comprar Roblox en Francho Shop', steps: ['Entra a la web.', 'Busca Roblox.', 'Selecciona el producto disponible.', 'Revisa la descripción y las instrucciones.', 'Confirma la compra.', 'Espera la entrega o procesamiento.'] },
      { title: 'Consejo de seguridad', text: 'Nunca compartas la contraseña de tu cuenta de Roblox. Para comprar productos digitales, revisa siempre el nombre, la región y las instrucciones antes de pagar.' },
    ],
    faq: [['¿Francho Shop pide contraseña de Roblox?', 'No. Nunca pedimos contraseña ni códigos de seguridad.']],
  },
  {
    slug: 'recargas-de-juegos-online-en-cuba',
    title: 'Recargas de juegos online en Cuba | Francho Shop',
    description: 'Compra recargas de juegos online desde Cuba. Free Fire, Roblox, Mobile Legends, Blood Strike, PUBG Mobile, gift cards y más productos digitales.',
    h1: 'Recargas de juegos online en Cuba',
    cardTitle: 'Recargas de juegos online en Cuba',
    cta: 'Ver catálogo de recargas',
    intro: ['Francho Shop es una plataforma pensada para facilitar la compra de recargas de juegos, gift cards, suscripciones y productos digitales para clientes de Cuba y otros países.'],
    sections: [
      { title: 'Juegos y productos disponibles', list: ['Free Fire', 'Roblox', 'Mobile Legends', 'Blood Strike', 'PUBG Mobile', 'Genshin Impact', 'Arena Breakout', 'Delta Force', 'Google Play', 'PlayStation', 'Gift cards', 'Suscripciones digitales'] },
      { title: 'Por qué usar Francho Shop', list: ['Web organizada', 'Pedidos registrados', 'Saldo interno', 'Soporte oficial', 'Productos digitales variados', 'Opción de pagar con USDT según disponibilidad', 'Pensado para Cuba y el mundo'] },
    ],
    faq: [['¿Puedo comprar desde Cuba?', 'Sí, la plataforma está pensada especialmente para clientes cubanos y también para clientes internacionales.']],
  },
]
const GUIDE_BY_SLUG = Object.fromEntries(GUIDE_ARTICLES.map(article => [article.slug, article]))

function setMetaContent(selector, attr, value) {
  if (!value) return
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    const match = selector.match(/meta\[(name|property)=\"([^\"]+)\"\]/)
    if (match) el.setAttribute(match[1], match[2])
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

function applySeoMeta({ title, description }) {
  const finalTitle = title || SEO_DEFAULT.title
  const finalDescription = description || SEO_DEFAULT.description
  document.title = finalTitle
  setMetaContent('meta[name="description"]', 'content', finalDescription)
  setMetaContent('meta[property="og:title"]', 'content', finalTitle)
  setMetaContent('meta[property="og:description"]', 'content', finalDescription)
  setMetaContent('meta[property="og:type"]', 'content', 'website')
  setMetaContent('meta[property="og:url"]', 'content', window.location.href)
}

const readSavedNav = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_STATE_KEY) || 'null')
    if (!saved || !SAFE_NAV_SCREENS.has(saved.screen)) return null
    if (saved.savedAt && Date.now() - saved.savedAt > 7 * 24 * 60 * 60 * 1000) return null
    if (['regions', 'products', 'detail'].includes(saved.screen) && !saved.currentGame?.name) return null
    if (['products', 'detail'].includes(saved.screen) && !saved.currentRegion) return null
    if (saved.screen === 'detail' && !saved.currentProduct?.id) return null
    return saved
  } catch { return null }
}

const getProductSortValue = (product) => {
  const name = String(product?.name || '')
  const match = name.match(/\d+(?:[.,]\d+)?/)
  if (match) return Number(match[0].replace(',', '.'))
  return Number(product?.price || 0)
}
const sortProductsByValue = (items) => [...items].sort((a, b) => {
  const av = getProductSortValue(a)
  const bv = getProductSortValue(b)
  if (av !== bv) return av - bv
  return Number(a.price || 0) - Number(b.price || 0)
})

function OptimizedImage({ src, alt = '', className = '', eager = false, onError, onLoad }) {
  if (!src) return null
  return (
    <img
      src={storeAssetUrl(src)}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'low'}
      onError={onError}
      onLoad={onLoad}
    />
  )
}

let cachedBotUsername = null
const openTelegramTopUp = async () => {
  let username = cachedBotUsername || import.meta.env.VITE_BOT_USERNAME
  if (!username) {
    try {
      const cfg = await api.publicConfig()
      username = cfg?.bot_username
      cachedBotUsername = username || null
    } catch {}
  }
  if (username) {
    const url = 'https://t.me/' + username.replace('@', '') + '?start=wallet'
    try {
      tg?.openTelegramLink?.(url)
      return
    } catch {}
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  if (tg?.close) {
    tg.close()
    return
  }
  window.alert('Para recargar saldo, abre el bot de Telegram y entra a Billetera.')
}
const LabelIcon = ({ icon: Icon, className = '' }) => <Icon className={iconClass + ' ' + className} strokeWidth={2.2} aria-hidden="true" />
const BigIcon = ({ icon: Icon, className = '' }) => <Icon className={bigIconClass + ' ' + className} strokeWidth={1.8} aria-hidden="true" />
const CategoryIcon = ({ category, className = iconClass }) => {
  const Icon = category === 'service' ? Wrench : category === 'account' || category === 'game_account' ? User : category === 'code' ? KeyRound : Package
  return <Icon className={className} strokeWidth={2.1} aria-hidden="true" />
}

function categoryLabel(category) {
  const labels = {
    service: 'Servicio',
    account: 'Cuenta',
    game_account: 'Cuenta de juego',
    code: 'Código',
    giftcard: 'Gift card',
    digital: 'Producto digital',
  }
  return labels[category] || 'Producto digital'
}

function deliveryTypeLabel(type, category) {
  if (category === 'game_account') return 'Cuenta manual'
  const labels = {
    manual: 'Entrega manual',
    code: 'Código',
    auto_text: 'Entrega automática',
    auto_file: 'Archivo automático',
    digital_stock: 'Stock digital',
    file: 'Archivo',
    stock: 'Stock digital',
    text: 'Texto automático',
  }
  return labels[type] || 'Producto digital'
}

function manualProductPriceRange(product) {
  const optionPrices = (product?.options || [])
    .filter((o) => o && o.stock !== 0 && o.is_active !== false)
    .map((o) => Number(o.price))
    .filter((n) => Number.isFinite(n) && n >= 0)
  const prices = optionPrices.length ? optionPrices : [Number(product?.price || 0)]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '$0.00 USDT'
  if (Math.abs(min - max) < 0.0001) return `$${min.toFixed(2)} USDT`
  return `Desde $${min.toFixed(2)} hasta $${max.toFixed(2)} USDT`
}

const StatusIcon = ({ status, className = 'h-4 w-4' }) => {
  const Icon = status === 'completed' ? CircleCheck
    : status === 'processing' ? RefreshCcw
    : status === 'failed' ? CircleX
    : status === 'partial' ? AlertTriangle
    : status === 'active' ? CircleCheck
    : status === 'inactive' ? CircleX
    : Clock
  return <Icon className={className} strokeWidth={2.1} aria-hidden="true" />
}


// ErrorBoundary: captura cualquier error de render y lo muestra en lugar de pantalla negra
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('UI Error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg p-8 text-center">
          <BigIcon icon={AlertTriangle} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Algo salió mal</h2>
          <p className="text-sm text-white/60 mb-4">
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <button onClick={() => location.reload()} className="btn-primary max-w-xs mx-auto">
            <span className="inline-flex items-center justify-center gap-2"><LabelIcon icon={RefreshCcw} />Recargar</span>
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}

function AppInner() {
  const [me, setMe] = useState(null)
  const [screen, setScreen] = useState('home')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentGame, setCurrentGame] = useState(null)
  const [currentRegion, setCurrentRegion] = useState(null)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [orderResult, setOrderResult] = useState(null)
  const [regionsCount, setRegionsCount] = useState({})
  const [authScreen, setAuthScreen] = useState(null) // login, register, forgot, verify, reset
  const [showTopUp, setShowTopUp] = useState(false)
  const [sellerStoreSlug, setSellerStoreSlug] = useState('')
  const [guideSlug, setGuideSlug] = useState('')
  const [showExitToast, setShowExitToast] = useState(false)
  const lastBackPress = useRef(0)
  const isPopStateNavigation = useRef(false)
  const hasInitializedHistory = useRef(false)
  const [caseOrderId, setCaseOrderId] = useState(null)
  const [caseIsAdmin, setCaseIsAdmin] = useState(false)
  
  // Estados de Notificaciones (Fase 1)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0)
  const [showNotifsDropdown, setShowNotifsDropdown] = useState(false)

  // Helper de fecha para el listado de notificaciones
  const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'

  // Permiso de notificaciones y referencia para evitar duplicar alertas
  const [notifPermission, setNotifPermission] = useState('Notification' in window ? Notification.permission : 'denied')
  const lastSeenNotifId = useRef(null)

  // Desbloqueo del Audio Context en la app
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        }
      } catch (e) {
        console.warn("Root audio unlock failed:", e);
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
          playNotificationSound();
        }
        return permission;
      } catch (e) {
        console.error("Error requesting notification permission:", e);
      }
    }
    return 'denied';
  }

  const showDesktopNotification = (notif) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = notif.title || "Nueva notificación";
        const body = notif.message || "";
        const notification = new Notification(title, {
          body: body,
          tag: `notif-${notif.id}`,
          renotify: true
        });
        
        notification.onclick = () => {
          window.focus();
          handleNotificationClick(notif);
          notification.close();
        };
      } catch (errNotif) {
        console.warn("Desktop Notification constructor failed, fallback to ServiceWorker:", errNotif)
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(notif.title || "Nueva notificación", {
              body: notif.message || "",
              tag: `notif-${notif.id}`,
              renotify: true
            }).catch(e => console.error("SW notification failed:", e))
          })
        }
      }
    }
  }

  async function fetchNotifications() {
    if (!me || me.is_guest) return
    try {
      const data = await api.getNotifications(50)
      setNotifications(data.items || [])
      if (data.items && data.items.length > 0) {
        const maxId = Math.max(...data.items.map(n => n.id))
        if (lastSeenNotifId.current === null || maxId > lastSeenNotifId.current) {
          lastSeenNotifId.current = maxId
        }
      }
    } catch (e) {
      console.warn("Failed to fetch notifications:", e)
    }
  }

  async function fetchUnreadCount() {
    if (!me || me.is_guest) return
    try {
      const data = await api.getUnreadNotificationsCount()
      const newCount = data.count || 0
      
      // Si la cantidad de no leídas aumentó, alertamos con sonido y notificación de escritorio
      if (newCount > unreadNotifsCount) {
        try {
          const listData = await api.getNotifications(5)
          const items = listData.items || []
          
          if (items.length > 0) {
            if (lastSeenNotifId.current === null) {
              lastSeenNotifId.current = Math.max(...items.map(n => n.id))
            } else {
              const newItems = items.filter(n => n.id > lastSeenNotifId.current && !n.is_read)
              if (newItems.length > 0) {
                lastSeenNotifId.current = Math.max(lastSeenNotifId.current, ...newItems.map(n => n.id))
                playNotificationSound()
                newItems.forEach(notif => {
                  showDesktopNotification(notif)
                })
              }
            }
          }
        } catch (errList) {
          console.warn("Failed to fetch notification details for alert:", errList)
        }
      } else if (lastSeenNotifId.current === null) {
        try {
          const listData = await api.getNotifications(5)
          const items = listData.items || []
          if (items.length > 0) {
            lastSeenNotifId.current = Math.max(...items.map(n => n.id))
          } else {
            lastSeenNotifId.current = 0
          }
        } catch (e) {}
      }

      setUnreadNotifsCount(newCount)
    } catch (e) {
      console.warn("Failed to fetch unread count:", e)
    }
  }

  const handleNotificationClick = async (notif) => {
    setShowNotifsDropdown(false)
    try {
      await api.markNotificationRead(notif.id)
      setUnreadNotifsCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n))
    } catch (e) {
      console.warn("Failed to mark notification read:", e)
    }

    if (notif.url) {
      if (notif.url.includes('/seguimiento') || notif.url.includes('/case')) {
        const orderId = notif.related_order_id || notif.url.match(/\/pedido\/(\d+)/)?.[1]
        if (orderId) {
          setCaseOrderId(Number(orderId))
          setCaseIsAdmin(notif.url.includes('admin=true'))
          setScreen('case')
        }
      } else if (notif.url.includes('/perfil')) {
        setScreen('profile')
      } else if (notif.url.includes('/pedidos') || notif.url.includes('/orders')) {
        setScreen('orders')
      }
    } else if (notif.related_order_id) {
      setCaseOrderId(Number(notif.related_order_id))
      setCaseIsAdmin(me?.role === 'admin' || me?.role === 'seller')
      setScreen('case')
    }
  }

  // Polling de conteo de notificaciones
  useEffect(() => {
    if (loading || !me || me.is_guest) return
    fetchUnreadCount()
    const timer = setInterval(() => {
      fetchUnreadCount()
    }, 12000)
    return () => clearInterval(timer)
  }, [loading, me?.user_id, unreadNotifsCount])

  // Obtener lista completa cuando se abre el panel
  useEffect(() => {
    if (showNotifsDropdown && me && !me.is_guest) {
      fetchNotifications()
      // Si el permiso está en default, intentamos pedirlo de forma nativa al abrir las notificaciones
      if ('Notification' in window && Notification.permission === 'default') {
        requestNotificationPermission()
      }
    }
  }, [showNotifsDropdown, me?.user_id])

  const openGuide = (slug = '') => {
    const cleanSlug = GUIDE_BY_SLUG[slug] ? slug : ''
    setGuideSlug(cleanSlug)
    setScreen(cleanSlug ? 'guide-detail' : 'guides')
    const path = cleanSlug ? `/guias/${cleanSlug}` : '/guias'
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
  }

  const goHome = () => {
    setScreen('home')
    setOrderResult(null)
    if (window.location.pathname.startsWith('/guias')) window.history.pushState({}, '', '/')
  }

  const applyGuideRoute = () => {
    const guideMatch = window.location.pathname.match(/^\/guias(?:\/([^/?#]+))?\/?$/)
    if (!guideMatch) return false
    const slug = decodeURIComponent(guideMatch[1] || '')
    setGuideSlug(GUIDE_BY_SLUG[slug] ? slug : '')
    setScreen(GUIDE_BY_SLUG[slug] ? 'guide-detail' : 'guides')
    return true
  }

  const goBack = () => {
    window.history.back()
  }

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      try { tg.setHeaderColor('#0f1419'); tg.setBackgroundColor('#0f1419') } catch {}
    }

    // El SDK de Telegram crea window.Telegram.WebApp incluso en navegadores normales.
    // Para distinguir: dentro de Telegram real, platform es "android", "ios", "tdesktop", etc.
    // En navegador normal, platform es "unknown".
    const isInsideTelegram = !!(tg && tg.platform && tg.platform !== 'unknown')

    api.me()
      .then((data) => {
        setMe(data)
        if (window.location.pathname.startsWith('/panel')) {
          if (['admin', 'seller', 'reseller'].includes(data?.role)) {
            setScreen('panel')
          } else {
            window.history.replaceState({ screen: 'home' }, '', '/')
            setScreen('home')
          }
          setLoading(false)
          return
        }
        const params = new URLSearchParams(window.location.search)
        const ref = params.get('ref')
        if (ref && Number(ref) && String(ref) !== String(data.user_id)) api.applyReferral(Number(ref)).catch(() => {})
        const seller = params.get('seller')
        if (seller && Number(seller) && String(seller) !== String(data.user_id)) setSellerId(Number(seller))
        if (applyGuideRoute()) {
          setLoading(false)
          return
        }
        const pathSeller = window.location.pathname.match(/^\/(?:seller|tienda)\/([^/?#]+)/)
        const storeParam = params.get('store') || params.get('tienda')
        if (pathSeller?.[1] || storeParam) {
          setSellerStoreSlug(decodeURIComponent(pathSeller?.[1] || storeParam))
          setScreen('seller-store')
          setLoading(false)
          return
        }
        const productId = params.get('product')
        const gameParam = params.get('game')
        const caseParam = params.get('case') || params.get('seguimiento')
        if (productId && Number(productId)) {
          setCurrentRegion(params.get('region') || '__standard__')
          setCurrentProduct({ id: Number(productId) })
          setScreen('detail')
        } else if (gameParam) {
          // Enlace compartido de un juego completo: ?game=Free Fire&region=Global
          const regionParam = params.get('region') || '__standard__'
          setCurrentGame({ name: decodeURIComponent(gameParam) })
          setCurrentRegion(regionParam)
          setScreen('products')
        } else if (caseParam && Number(caseParam)) {
          setCaseOrderId(Number(caseParam))
          setCaseIsAdmin(params.get('admin') === 'true')
          setScreen('case')
        } else {
          const saved = readSavedNav()
          if (saved) {
            setCurrentGame(saved.currentGame || null)
            setCurrentRegion(saved.currentRegion || null)
            setCurrentProduct(saved.currentProduct || null)
            setCaseOrderId(saved.caseOrderId || null)
            setCaseIsAdmin(saved.caseIsAdmin || false)
            setScreen(saved.screen || 'home')
          }
        }
        setLoading(false)
      })
      .catch((err) => {
        if (window.location.pathname.startsWith('/panel')) {
          api.clearSession()
          setMe(GUEST_USER)
          setAuthScreen('login')
          setLoading(false)
          return
        }
        if (isInsideTelegram) {
          // Dentro de Telegram real pero initData falló
          setError(
            'No se pudo iniciar sesión automáticamente.\n\n' +
            'Cierra esta ventana y usa el botón "Shop" al lado del campo de texto, ' +
            'o envía /shop al bot.'
          )
          setLoading(false)
        } else if (api.isLoggedIn()) {
          // Navegador con token expirado
          api.clearSession()
          const params = new URLSearchParams(window.location.search)
          if (applyGuideRoute()) {
            setMe(GUEST_USER)
            setLoading(false)
            return
          }
          const pathSeller = window.location.pathname.match(/^\/(?:seller|tienda)\/([^/?#]+)/)
          const storeParam = params.get('store') || params.get('tienda')
          if (pathSeller?.[1] || storeParam) {
            setSellerStoreSlug(decodeURIComponent(pathSeller?.[1] || storeParam))
            setScreen('seller-store')
          }
          const productId = params.get('product')
          const gameParam2 = params.get('game')
          const caseParam2 = params.get('case') || params.get('seguimiento')
          if (productId && Number(productId)) {
            setCurrentRegion(params.get('region') || '__standard__')
            setCurrentProduct({ id: Number(productId) })
            setScreen('detail')
          } else if (gameParam2) {
            setCurrentGame({ name: decodeURIComponent(gameParam2) })
            setCurrentRegion(params.get('region') || '__standard__')
            setScreen('products')
          } else if (caseParam2 && Number(caseParam2)) {
            setCaseOrderId(Number(caseParam2))
            setCaseIsAdmin(params.get('admin') === 'true')
            setScreen('case')
          }
          setMe(GUEST_USER)
          // visitante con token expirado
          setLoading(false)
        } else {
          // Navegador normal → login web
          const params = new URLSearchParams(window.location.search)
          if (applyGuideRoute()) {
            setMe(GUEST_USER)
            setLoading(false)
            return
          }
          const pathSeller = window.location.pathname.match(/^\/(?:seller|tienda)\/([^/?#]+)/)
          const storeParam = params.get('store') || params.get('tienda')
          if (pathSeller?.[1] || storeParam) {
            setSellerStoreSlug(decodeURIComponent(pathSeller?.[1] || storeParam))
            setScreen('seller-store')
          }
          const productId = params.get('product')
          const gameParam3 = params.get('game')
          const caseParam3 = params.get('case') || params.get('seguimiento')
          if (productId && Number(productId)) {
            setCurrentRegion(params.get('region') || '__standard__')
            setCurrentProduct({ id: Number(productId) })
            setScreen('detail')
          } else if (gameParam3) {
            setCurrentGame({ name: decodeURIComponent(gameParam3) })
            setCurrentRegion(params.get('region') || '__standard__')
            setScreen('products')
          } else if (caseParam3 && Number(caseParam3)) {
            setCaseOrderId(Number(caseParam3))
            setCaseIsAdmin(params.get('admin') === 'true')
            setScreen('case')
          }
          setMe(GUEST_USER)
          setLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    if (currentGame && currentGame.name && !currentGame.icon_url) {
      (me?.is_guest ? api.publicGames() : api.games())
        .then((list) => {
          if (Array.isArray(list)) {
            const found = list.find(g => g.name === currentGame.name)
            if (found) {
              setCurrentGame(found)
            }
          }
        })
        .catch(() => {})
    }
  }, [currentGame, me?.is_guest])

  useEffect(() => {
    if (loading) return
    // Cleanups on screen transition
    if (screen !== 'detail' && screen !== 'confirm' && screen !== 'result') {
      const params = new URLSearchParams(window.location.search)
      if (params.has('product')) {
        const newParams = new URLSearchParams(params)
        newParams.delete('product')
        newParams.delete('region')
        const newSearch = newParams.toString() ? '?' + newParams.toString() : ''
        try { window.history.replaceState(window.history.state, '', window.location.pathname + newSearch) } catch {}
      }
    }
    if (screen !== 'result') {
      setOrderResult(null)
    }
  }, [screen, loading])

  useEffect(() => {
    if (loading) return
    if (hasInitializedHistory.current) return
    hasInitializedHistory.current = true

    if (screen === 'detail') {
      window.history.replaceState({ screen: 'exit_sentinel' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'home' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'detail' }, '', window.location.pathname + window.location.search)
    } else if (screen === 'products') {
      window.history.replaceState({ screen: 'exit_sentinel' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'home' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'products' }, '', window.location.pathname + window.location.search)
    } else if (screen === 'case') {
      window.history.replaceState({ screen: 'exit_sentinel' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'home' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'case' }, '', window.location.pathname + window.location.search)
    } else {
      window.history.replaceState({ screen: 'exit_sentinel' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'home' }, '', window.location.pathname + window.location.search)
    }
  }, [loading])

  useEffect(() => {
    if (loading) return
    const handlePopState = (event) => {
      const state = event.state
      if (state?.screen === 'exit_sentinel') {
        const now = Date.now()
        if (now - lastBackPress.current < 2000) {
          if (tg) {
            tg.close()
          } else {
            window.close()
          }
        } else {
          lastBackPress.current = now
          try {
            if (tg?.HapticFeedback) {
              tg.HapticFeedback.impactOccurred('light')
            }
          } catch {}
          setShowExitToast(true)
          setTimeout(() => setShowExitToast(false), 2000)
          window.history.pushState({ screen: 'home' }, '', window.location.pathname + window.location.search)
        }
      } else if (state?.screen) {
        isPopStateNavigation.current = true
        setScreen(state.screen)
      } else {
        isPopStateNavigation.current = true
        setScreen('home')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [loading, screen])

  useEffect(() => {
    if (loading || authScreen) return
    if (isPopStateNavigation.current) {
      isPopStateNavigation.current = false
      return
    }
    if (screen === 'home') {
      window.history.replaceState({ screen: 'exit_sentinel' }, '', window.location.pathname + window.location.search)
      window.history.pushState({ screen: 'home' }, '', window.location.pathname + window.location.search)
    } else {
      if (window.history.state?.screen !== screen) {
        window.history.pushState({ screen }, '', window.location.pathname + window.location.search)
      }
    }
  }, [loading, authScreen, screen])

  useEffect(() => {
    if (loading || authScreen || !SAFE_NAV_SCREENS.has(screen)) return
    if (screen === 'seller-store') return
    const state = {
      screen,
      currentGame: currentGame || null,
      currentRegion: currentRegion || null,
      currentProduct: currentProduct?.id ? { id: currentProduct.id } : null,
      caseOrderId: caseOrderId || null,
      caseIsAdmin: caseIsAdmin || false,
      savedAt: Date.now(),
    }
    try { localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state)) } catch {}
  }, [loading, authScreen, screen, currentGame, currentRegion, currentProduct])

  useEffect(() => {
    if (loading || authScreen) return
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
  }, [screen, loading, authScreen])

  useEffect(() => {
    if (screen === 'guides') {
      applySeoMeta({
        title: 'Guías de recargas, juegos y productos digitales | Francho Shop',
        description: 'Aprende cómo recargar juegos, comprar gift cards, usar saldo y solicitar productos digitales en Francho Shop desde Cuba o cualquier país.',
      })
      return
    }
    if (screen === 'guide-detail') {
      applySeoMeta(GUIDE_BY_SLUG[guideSlug] || SEO_DEFAULT)
      return
    }
    applySeoMeta(SEO_DEFAULT)
  }, [screen, guideSlug])

  useEffect(() => {
    if (!tg?.BackButton) return
    if (screen === 'home') {
      tg.BackButton.hide()
      return
    }
    tg.BackButton.show()
    const handler = () => goBack()
    tg.BackButton.onClick(handler)
    return () => {
      try { tg.BackButton.offClick(handler) } catch {}
    }
  }, [screen, currentGame, regionsCount])

  if (loading) return <LoadingScreen />

  // Si no autenticado: mostrar pantallas de auth web
  if (authScreen) {
    const onLoginSuccess = (userData) => {
      setMe(userData)
      setAuthScreen(null)
      if (window.location.pathname.startsWith('/panel')) {
        if (['admin', 'seller', 'reseller'].includes(userData?.role)) {
          setScreen('panel')
        } else {
          window.history.replaceState({ screen: 'home' }, '', '/')
          setScreen('home')
        }
      }
    }
    return (
      <div className="min-h-screen bg-bg">
        {authScreen === 'login' && (
          <LoginScreen
            onSuccess={onLoginSuccess}
            onRegister={() => setAuthScreen('register')}
            onForgot={() => setAuthScreen('forgot')}
          />
        )}
        {authScreen === 'register' && (
          <RegisterScreen
            onSuccess={(email) => { setAuthScreen('verify'); }}
            onLogin={() => setAuthScreen('login')}
          />
        )}
        {authScreen === 'forgot' && (
          <ForgotScreen
            onCodeSent={() => setAuthScreen('reset')}
            onLogin={() => setAuthScreen('login')}
          />
        )}
        {authScreen === 'verify' && (
          <VerifyScreen onSuccess={() => setAuthScreen('login')} />
        )}
        {authScreen === 'reset' && (
          <ResetScreen onSuccess={() => setAuthScreen('login')} />
        )}
      </div>
    )
  }

  if (error) return <ErrorView msg={error} />
  if (!me) return <ErrorView msg="No se pudo cargar tu perfil" />
  const requireLogin = () => { setShowTopUp(false); setAuthScreen('login') }
  const isGuest = !!me.is_guest

  return (
    <div className={screen === 'panel' ? "h-screen bg-bg overflow-hidden flex flex-col" : "min-h-screen bg-bg pb-24"}>
      {screen !== 'home' && screen !== 'panel' && (
        <Header me={me} onBack={goBack}
                onProfile={() => isGuest ? requireLogin() : setScreen('profile')}
                onTopUp={() => isGuest ? requireLogin() : setShowTopUp(true)}
                onOpenNotifications={() => isGuest ? requireLogin() : setShowNotifsDropdown(true)}
                unreadNotifsCount={unreadNotifsCount} />
      )}
      {screen === 'home' && <HomeScreen me={me} onLoginRequired={requireLogin} onSelectGame={(g) => { setCurrentGame(g); setScreen('regions') }} onNav={(target) => target === 'guides' ? openGuide('') : setScreen(target)} onOpenNotifications={() => isGuest ? requireLogin() : setShowNotifsDropdown(true)} unreadNotifsCount={unreadNotifsCount} />}
      {screen === 'regions' && currentGame && (
        <RegionsScreen
          me={me}
          game={currentGame.name}
          gameData={currentGame}
          onCountKnown={(count) => setRegionsCount(prev => ({ ...prev, [currentGame.name]: count }))}
          onSelectRegion={(r) => { setCurrentRegion(r); setScreen('products') }}
        />
      )}
      {screen === 'products' && currentGame && currentRegion && (
        <ProductsScreen game={currentGame.name} gameData={currentGame} region={currentRegion} me={me} onLoginRequired={requireLogin}
          onSelectProduct={(p) => {
            // Si trae _orderResult (compra exitosa) saltar a result
            if (p._orderResult) {
              setOrderResult(p._orderResult)
              setScreen('result')
              api.me().then(setMe).catch(() => {})
            } else {
              setCurrentProduct(p); setScreen('detail')
            }
          }} />
      )}
      {screen === 'detail' && currentProduct && (
        <ProductDetailScreen productId={currentProduct.id} region={currentRegion} onLoginRequired={requireLogin}
          me={me}
          onCancel={goBack}
          onBought={(result) => {
            setOrderResult(result); setScreen('result')
            api.me().then(setMe).catch(() => {})
          }} />
      )}
      {screen === 'case' && caseOrderId && (
        <OrderCaseChatScreen orderId={caseOrderId} admin={caseIsAdmin} me={me} onBack={goBack} />
      )}
      {screen === 'confirm' && currentProduct?.detail && (
        <ConfirmScreen product={currentProduct} region={currentRegion} me={me}
          onSuccess={(result) => {
            setOrderResult(result); setScreen('result')
            api.me().then(setMe).catch(() => {})
          }} />
      )}
      {screen === 'result' && orderResult && (
        <ResultScreen result={orderResult} onHome={() => { setScreen('home'); setOrderResult(null) }} />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          onOrders={() => setScreen('orders')}
          onHome={() => setScreen('home')}
          onAdmin={() => {
            window.history.pushState({ screen: 'panel' }, '', '/panel')
            setScreen('panel')
          }}
          onPartnerHelp={() => setScreen('partner-help')}
        />
      )}
      {screen === 'orders' && (
        <OrdersScreen
          onOpenCase={(orderId, isAdmin) => {
            setCaseOrderId(orderId)
            setCaseIsAdmin(isAdmin)
            setScreen('case')
          }}
        />
      )}
      {screen === 'admin' && (
        <AdminProductsScreen
          onEdit={(p) => { setCurrentProduct(p); setScreen('admin-edit') }}
          onOpenCase={(orderId, isAdmin) => {
            setCaseOrderId(orderId)
            setCaseIsAdmin(isAdmin)
            setScreen('case')
          }}
        />
      )}
      {screen === 'admin-edit' && (
        <AdminEditProductScreen
          product={currentProduct}
          me={me}
          onSaved={() => {
            if (window.location.pathname.startsWith('/panel')) {
              setScreen('panel')
            } else {
              setScreen('admin')
            }
          }}
          onCancel={() => {
            if (window.location.pathname.startsWith('/panel')) {
              setScreen('panel')
            } else {
              setScreen('admin')
            }
          }}
        />
      )}
      {screen === 'help' && <HelpScreen onNav={setScreen} />}
      {screen === 'terms' && <TermsScreen />}
      {screen === 'faq' && <FaqScreen />}
      {screen === 'contact' && <ContactScreen />}
      {screen === 'guides' && <GuidesScreen onOpenGuide={openGuide} onHome={goHome} />}
      {screen === 'guide-detail' && <GuideArticleScreen slug={guideSlug} onOpenGuide={openGuide} onHome={goHome} />}
      {screen === 'seller-store' && <SellerStoreScreen slug={sellerStoreSlug} me={me} onLoginRequired={requireLogin} />}
      {screen === 'partner-help' && <PartnerHelpScreen me={me} onTopUp={() => isGuest ? requireLogin() : setShowTopUp(true)} />}

      {screen === 'panel' && (
        <PanelScreen
          me={me}
          onLogout={() => {
            api.clearSession()
            setMe(GUEST_USER)
            window.history.replaceState({ screen: 'home' }, '', '/')
            setScreen('home')
          }}
          onHome={() => {
            window.history.pushState({ screen: 'home' }, '', '/')
            setScreen('home')
          }}
          onOpenCase={(orderId, isAdmin) => {
            setCaseOrderId(orderId)
            setCaseIsAdmin(isAdmin)
            setScreen('case')
          }}
          onEditProduct={(p) => {
            setCurrentProduct(p)
            setScreen('admin-edit')
          }}
        />
      )}

      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} onPaid={(balance) => { setMe(prev => ({ ...prev, balance })); setShowTopUp(false) }} />}

      {/* Panel Desplegable de Notificaciones */}
      {showNotifsDropdown && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translate(0); }
            }
            .animate-fade-in {
              animation: fadeIn 0.2s ease-out forwards;
            }
            .animate-slide-in-right {
              animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div className="absolute inset-0" onClick={() => setShowNotifsDropdown(false)} />
          
          <div className="relative w-full max-w-md bg-bg border-l border-white/10 flex flex-col h-full shadow-2xl animate-slide-in-right">
            {/* Header del drawer */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-card">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-accent" />
                <h2 className="font-bold text-base">Notificaciones</h2>
                {unreadNotifsCount > 0 && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                    {unreadNotifsCount} nuevas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadNotifsCount > 0 && (
                  <button
                    onClick={async () => {
                      try {
                        await api.markAllNotificationsRead()
                        setUnreadNotifsCount(0)
                        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
                      } catch (e) {
                        console.warn("Failed to mark all read:", e)
                      }
                    }}
                    className="text-[11px] text-accent font-bold hover:underline active:scale-95 transition"
                  >
                    Marcar todo leído
                  </button>
                )}
                <button
                  onClick={() => setShowNotifsDropdown(false)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 transition"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Banner de Permiso de Notificaciones de Escritorio */}
            {notifPermission === 'default' && 'Notification' in window && (
              <div className="bg-accent/10 border-b border-white/5 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-accent text-sm flex-shrink-0 animate-bounce">🔔</span>
                  <p className="text-white/80 font-medium truncate">Activa notificaciones de escritorio para enterarte al instante.</p>
                </div>
                <button
                  onClick={requestNotificationPermission}
                  className="rounded-lg bg-accent px-2.5 py-1 font-bold text-bg hover:bg-accent/90 active:scale-95 transition-all text-[11px] flex-shrink-0"
                >
                  Activar
                </button>
              </div>
            )}
            {notifPermission === 'denied' && 'Notification' in window && (
              <div className="bg-red-500/10 border-b border-white/5 px-4 py-2 flex items-center gap-2 text-[10px] text-red-300">
                <span className="flex-shrink-0">⚠️</span>
                <p className="font-medium">Notificaciones de escritorio bloqueadas en tu navegador.</p>
              </div>
            )}

            {/* Lista de notificaciones */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-white/40">
                  <Inbox className="h-12 w-12 mb-3 opacity-30 animate-pulse" />
                  <p className="text-sm font-semibold">No tienes notificaciones aún.</p>
                  <p className="text-xs opacity-60 mt-1">Te avisaremos cuando ocurra algo importante.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                      notif.is_read 
                        ? 'bg-card/45 border-white/5 opacity-70' 
                        : 'bg-card border-accent/20 shadow-sm relative overflow-hidden'
                    }`}
                  >
                    {!notif.is_read && (
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-accent animate-pulse" />
                    )}
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-bold text-[10px] uppercase text-accent tracking-wider">
                        {notif.type === 'new_message' && '💬 Chat'}
                        {notif.type === 'new_order' && '📦 Pedido'}
                        {notif.type === 'order_status' && '⚙️ Estado'}
                        {notif.type === 'case_status' && '⚠️ Soporte'}
                        {notif.type === 'balance' && '💰 Saldo'}
                        {!['new_message', 'new_order', 'order_status', 'case_status', 'balance'].includes(notif.type) && '🔔 Alerta'}
                      </div>
                      <span className="text-[9px] text-white/35 font-semibold">
                        {fmt(notif.created_at)}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-white mt-1 leading-snug">{notif.title}</h3>
                    <p className="text-xs text-white/70 mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {screen !== 'case' && screen !== 'panel' && (
        <BottomNav active={screen} me={me} onNav={(target) => {
        if (target === 'home') {
          goHome()
          return
        }
        if (target === 'guides') {
          openGuide('')
          return
        }
        if (isGuest && ['orders', 'profile', 'admin', 'partner-help'].includes(target)) {
          requireLogin()
          return
        }
        setScreen(target)
      }} />
      )}

      {/* Fallback: si el screen no matchea ningún componente, mostrar home */}
      {!['home', 'regions', 'products', 'detail', 'confirm', 'result',
         'profile', 'orders', 'help', 'terms', 'faq', 'contact', 'guides', 'guide-detail', 'seller-store', 'partner-help', 'admin', 'admin-edit', 'case', 'panel'].includes(screen) && (
        <div className="p-8 text-center">
          <p className="text-white/60 mb-4">Estado no reconocido: {screen}</p>
          <button onClick={() => setScreen('home')} className="btn-primary max-w-xs mx-auto">
            <span className="inline-flex items-center justify-center gap-2"><LabelIcon icon={Home} />Volver al inicio</span>
          </button>
        </div>
      )}

      {showExitToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          Presiona atrás una vez más para salir
        </div>
      )}
    </div>
  )
}

function BottomNav({ active, me, onNav }) {
  const items = [
    { id: 'home', label: 'Inicio', icon: '⌂' },
    { id: 'orders', label: 'Pedidos', icon: '▤' },
    { id: 'profile', label: 'Perfil', icon: '◉' },
  ]
  if (['admin', 'seller'].includes(me?.role)) items.push({ id: 'admin', label: me?.role === 'admin' ? 'Admin' : 'Vender', icon: '⚙' })
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-bg/95 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-md gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const selected = active === item.id || (item.id === 'home' && active === 'result')
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className={`flex min-h-[52px] flex-col items-center justify-center rounded-lg border text-xs font-semibold transition active:scale-95 ${selected ? "border-accent/60 bg-accent/15 text-white" : "border-white/5 bg-card/80 text-white/55"}`}
              aria-current={selected ? 'page' : undefined}
            >
              <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
              <span className="mt-1 truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function LoadingScreen() {
  // Logo de Francho Shop — el icono de tu marca.
  // Para usar tu logo real: súbelo al bot con /icons o pon la URL aquí
  const LOGO_URL = "/api/icons/franchoshop.jpg"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg">
      <style>{`
        @keyframes pulse-green {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7),
                        0 0 0 0 rgba(34, 197, 94, 0.5),
                        0 0 30px 5px rgba(34, 197, 94, 0.4);
          }
          50% {
            box-shadow: 0 0 0 15px rgba(34, 197, 94, 0),
                        0 0 0 30px rgba(34, 197, 94, 0),
                        0 0 50px 15px rgba(34, 197, 94, 0.6);
          }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .logo-pulse {
          animation: pulse-green 1.5s ease-in-out infinite;
        }
        .ring-spin {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>

      <div className="relative">
        {/* Anillo giratorio externo */}
        <div className="absolute inset-0 -m-4 ring-spin pointer-events-none">
          <div className="w-32 h-32 rounded-full border-2 border-transparent
                          border-t-green-400 border-r-green-400/30"></div>
        </div>

        {/* Logo circular con luz verde pulsante */}
        <div className="logo-pulse w-24 h-24 rounded-full overflow-hidden
                        bg-gradient-to-br from-accent to-accent2
                        flex items-center justify-center
                        border-4 border-green-400/80">
          <img
            src={LOGO_URL}
            alt="Francho Shop"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback: emoji shop si no hay logo subido
              e.target.style.display = 'none'
              e.target.parentElement.innerHTML += '<span class="text-5xl">FS</span>'
            }}
          />
        </div>
      </div>

      {/* Marca */}
      <h1 className="mt-8 text-2xl font-bold bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
        Francho Shop
      </h1>
      <p className="text-sm text-white/50 mt-2">Cargando recargas...</p>

      {/* Indicador de carga sutil */}
      <div className="flex gap-1 mt-4">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  )
}

function CoolLoading({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
      <div className="relative mb-4 flex items-center justify-center">
        {/* Ring rotating */}
        <div className="absolute h-14 w-14 animate-spin rounded-full border-2 border-green-400/20 border-t-green-400"></div>
        {/* Inner pulsing glowing sphere */}
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 opacity-75 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse flex items-center justify-center">
          <Gamepad2 className="h-4 w-4 text-bg" />
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-green-400 animate-pulse text-center">
        {label}
      </p>
      <div className="mt-2 flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400/40 animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-1.5 h-1.5 rounded-full bg-green-400/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-1.5 h-1.5 rounded-full bg-green-400/80 animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  )
}


function PublicReviewsPanel({ productId, manualProductId, gameName, compact = false }) {
  const [reviews, setReviews] = useState(null)
  useEffect(() => {
    const params = { limit: compact ? 3 : 6 }
    if (productId) params.product_id = productId
    if (manualProductId) params.manual_product_id = manualProductId
    if (gameName) params.game_name = gameName
    api.publicReviews(params).then(setReviews).catch(() => setReviews(null))
  }, [productId, manualProductId, gameName, compact])
  if (!reviews || !reviews.count) return null
  return (
    <div className="card p-4 mb-4 border-yellow-500/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-yellow-300"><BadgeCheck className="h-4 w-4" />Valoraciones</p>
        <p className="text-sm font-bold text-yellow-300">{Number(reviews.avg_rating || 0).toFixed(1)} ★ <span className="text-xs text-white/40">({reviews.count})</span></p>
      </div>
      <div className="space-y-2">
        {(reviews.items || []).slice(0, compact ? 2 : 4).map((r, idx) => (
          <div key={idx} className="rounded-lg bg-black/20 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-white/60">{r.customer_name}</p>
              <p className="flex-shrink-0 text-xs text-yellow-300">{'★'.repeat(Number(r.rating || 0))}</p>
            </div>
            {r.comment ? <p className="text-sm text-white/72">{r.comment}</p> : <p className="text-sm text-white/35">Sin comentario escrito.</p>}
            {!productId && !manualProductId && !gameName && <p className="mt-1 truncate text-[11px] text-white/35">{r.product_name}</p>}
            {gameName && <p className="mt-1 truncate text-[11px] text-white/35">{r.product_name}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function SocialStatsLine({ item, compact = false }) {
  const ratingCount = Number(item?.rating_count || 0)
  const ordersCount = Number(item?.orders_count || 0)
  const hasStats = ratingCount > 0 || ordersCount > 0
  return (
    <div className={`mt-1 flex h-3.5 min-w-0 items-center gap-1 text-[9px] leading-none ${compact ? 'text-[8px]' : ''} ${hasStats ? 'text-white/45' : 'text-transparent'}`}>
      {ratingCount > 0 ? <span className="min-w-0 truncate text-yellow-300">★ {Number(item.avg_rating || 0).toFixed(1)} ({ratingCount})</span> : <span className="min-w-0 truncate">&nbsp;</span>}
      {ordersCount > 0 && <span className="min-w-0 truncate">{ordersCount} compras</span>}
    </div>
  )
}


function PremiumSticker({ code, size = 'md' }) {
  const sticker = PREMIUM_STICKER_MAP[code]
  if (!sticker) return <span>{code}</span>
  const StickerIcon = sticker.icon
  const sizeClass = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <span title={sticker.label} data-premium-code={code} contentEditable={false} className={'mx-0.5 inline-flex align-text-bottom ' + sticker.color}>
      <StickerIcon className={sizeClass} strokeWidth={2} aria-hidden="true" />
    </span>
  )
}

function PremiumStickerPicker({ onInsert, value = '' }) {
  const [open, setOpen] = useState(false)

  const handleStickerClick = (code) => {
    const activeEl = document.activeElement
    if (activeEl && activeEl.getAttribute('contenteditable') === 'true') {
      const textToInsert = `${code} `
      document.execCommand('insertText', false, textToInsert)
      activeEl.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      onInsert?.(code)
    }
  }

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(value => !value)}
        className={'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors active:scale-95 ' + (open ? 'border-yellow-300/40 bg-yellow-400/10 text-yellow-200' : 'border-white/10 bg-card text-white/55 hover:border-white/20 hover:text-white')}
        title="Emojis premium"
        aria-label="Abrir emojis premium"
        aria-expanded={open}
      >
        <Smile className="h-5 w-5" />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-yellow-400/15 bg-card p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-yellow-200">Emojis premium</p>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/45 hover:bg-white/5 hover:text-white" title="Cerrar" aria-label="Cerrar emojis">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid max-h-44 grid-cols-5 gap-1.5 overflow-y-auto overscroll-contain pr-1" onWheel={(event) => event.stopPropagation()}>
            {PREMIUM_STICKERS.map((sticker) => (
              <button
                key={sticker.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleStickerClick(sticker.code)}
                className="rounded-lg border border-white/10 bg-bg px-1 py-2 text-center transition-colors hover:border-white/20 hover:bg-white/5 active:scale-95"
                title={sticker.label + ' ' + sticker.code}
              >
                <PremiumSticker code={sticker.code} size="lg" />
                <span className="mt-1 block truncate text-[9px] text-white/45">{sticker.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function renderStickerTextSegment(segment, keyPrefix = 'txt') {
  return String(segment || '').split(PREMIUM_STICKER_RE).map((piece, idx) => {
    if (PREMIUM_STICKER_MAP[piece]) return <PremiumSticker key={`${keyPrefix}-st-${idx}`} code={piece} />
    return <span key={`${keyPrefix}-tx-${idx}`}>{piece}</span>
  })
}

function appendPremiumStickerText(setter, code) {
  setter((value) => `${value || ''}${value && !String(value).endsWith(' ') ? ' ' : ''}${code} `)
}

function readPremiumEditorValue(root) {
  const readNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const code = node.getAttribute?.('data-premium-code')
    if (code) return code
    if (node.tagName === 'BR') return '\n'
    const text = Array.from(node.childNodes || []).map(readNode).join('')
    return node !== root && (node.tagName === 'DIV' || node.tagName === 'P') ? text + '\n' : text
  }
  return readNode(root).replace(/\n+$/, '')
}

function PremiumRichTextEditor({ value = '', onChange, placeholder = '', rows = 3, className = '' }) {
  const [editorKey, setEditorKey] = useState(0)
  const isFocused = useRef(false)
  const lastBlurredValueRef = useRef(value)

  useEffect(() => {
    if (!isFocused.current && value !== lastBlurredValueRef.current) {
      lastBlurredValueRef.current = value
      setEditorKey(k => k + 1)
    }
  }, [value])

  const handlePaste = (event) => {
    event.preventDefault()
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
  }

  return (
    <div
      key={editorKey}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder || 'Editor de texto'}
      data-placeholder={placeholder}
      onPaste={handlePaste}
      onFocus={() => { isFocused.current = true }}
      onBlur={(event) => {
        isFocused.current = false
        const newValue = readPremiumEditorValue(event.currentTarget)
        lastBlurredValueRef.current = newValue
        onChange?.(newValue)
      }}
      className={'empty:before:pointer-events-none empty:before:text-white/30 empty:before:content-[attr(data-placeholder)] whitespace-pre-wrap break-words overflow-y-auto rounded-xl border border-white/20 bg-card px-4 py-3 text-sm text-white outline-none focus:border-accent ' + (rows >= 5 ? 'min-h-36 max-h-72 ' : 'min-h-24 max-h-56 ') + className}
    >
      {renderStickerTextSegment(value, 'editor')}
    </div>
  )
}

function ProductTrustPanel({ product, price }) {
  const orders = Number(product?.orders_count || 0)
  const ratings = Number(product?.rating_count || 0)
  const avg = Number(product?.avg_rating || 0)
  const deliveryLabel = deliveryTypeLabel(product?.delivery_type, product?.category)
  const cards = [
    { label: 'Precio', value: price === undefined || price === null ? manualProductPriceRange(product) : `$${Number(price || 0).toFixed(2)}`, tone: 'text-accent' },
    { label: 'Entrega', value: deliveryLabel, tone: 'text-white/80' },
    { label: 'Compras', value: orders > 0 ? orders : 'Nuevo', tone: orders > 0 ? 'text-green-300' : 'text-white/55' },
    { label: 'Valoración', value: ratings > 0 ? `${avg.toFixed(1)} ★` : 'Sin valorar', tone: ratings > 0 ? 'text-yellow-300' : 'text-white/55' },
  ]
  return (
    <div className="mb-4 grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-white/10 bg-card p-3">
          <p className="text-[10px] font-semibold uppercase text-white/35">{card.label}</p>
          <p className={`mt-1 truncate text-sm font-black ${card.tone}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}

function SellerTrustSummary({ seller, compact = false }) {
  if (!seller) return null
  const orders = Number(seller.orders_count || seller.total_orders || 0)
  const ratings = Number(seller.rating_count || 0)
  const avg = Number(seller.avg_rating || seller.rating || 0)
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3'} text-center`}>
      <div className="rounded-lg bg-bg/75 p-2">
        <p className="text-[10px] text-white/35">Ventas</p>
        <p className="text-sm font-black text-green-300">{orders || 0}</p>
      </div>
      <div className="rounded-lg bg-bg/75 p-2">
        <p className="text-[10px] text-white/35">Rating</p>
        <p className="text-sm font-black text-yellow-300">{ratings > 0 ? `${avg.toFixed(1)}★` : '-'}</p>
      </div>
      <div className="rounded-lg bg-bg/75 p-2">
        <p className="text-[10px] text-white/35">Estado</p>
        <p className="truncate text-sm font-black text-accent">Verificado</p>
      </div>
    </div>
  )
}

function Header({ me, onBack, onProfile, onTopUp, onOpenNotifications, unreadNotifsCount }) {
  return (
    <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-white/5">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack}
              className="w-9 h-9 rounded-full bg-card flex items-center justify-center active:scale-90 transition">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
              Francho Shop
            </h1>
            <p className="text-xs text-white/50">Hola, {me.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <button onClick={onTopUp} className="card px-3 py-2 text-right active:scale-95 transition">
              <p className="text-[10px] text-white/50 leading-none mb-1">Saldo</p>
              <p className="text-lg font-bold leading-none">${me.balance.toFixed(2)}</p>
            </button>
            {me.role === 'reseller' && (
              <span className="inline-block mt-1 text-[10px] bg-accent2/20 text-accent2 px-2 py-0.5 rounded-full">
                <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="h-3 w-3" />Revendedor</span>
              </span>
            )}
          </div>
          {onOpenNotifications && (
            <button onClick={onOpenNotifications}
              className="relative w-10 h-10 rounded-full bg-card hover:bg-white/10 flex items-center justify-center active:scale-90 transition flex-shrink-0">
              <Bell className="h-5 w-5 text-white" aria-hidden="true" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-accent text-[9px] font-black text-bg ring-2 ring-bg animate-pulse" style={{ width: '17px', height: '17px' }}>
                  {unreadNotifsCount}
                </span>
              )}
            </button>
          )}
          {onProfile && (
            <button onClick={onProfile}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center active:scale-90 transition flex-shrink-0">
              <User className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Disclaimer() {
  return (
    <div className="mx-4 mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-200/90">
      <span className="inline-flex items-center gap-1"><AlertTriangle className="h-4 w-4" aria-hidden="true" /><b>Importante:</b></span> Verifica bien tu <b>ID de jugador</b> y <b>región</b>.
      Las recargas son instantáneas e <b>irreversibles</b>. No hay reembolso por datos incorrectos.
    </div>
  )
}


const CATALOG_FILTERS = [
  { id: 'all', label: 'Todo', title: 'Todo el catalogo', icon: Store, description: 'Recargas, tarjetas y productos digitales.' },
  { id: 'direct-topup', label: 'Direct Top-Up', title: 'Direct Top-Up', icon: Smartphone, description: 'Recargas directas con ID de jugador.' },
  { id: 'game', label: 'Game', title: 'Game', icon: Gamepad2, description: 'Juegos y servicios principales.' },
  { id: 'game-cdkey', label: 'Game CD-Key', title: 'Game CD-Key', icon: KeyRound, description: 'Codigos y licencias digitales.' },
  { id: 'game-cards', label: 'Game Cards', title: 'Game Cards', icon: Gift, description: 'Tarjetas para juegos.' },
  { id: 'mobile-game-cards', label: 'Mobile Game Cards', title: 'Mobile Game Cards', icon: Phone, description: 'Tarjetas para juegos moviles.' },
  { id: 'game-console', label: 'Game Console', title: 'Game Console', icon: Gamepad2, description: 'PlayStation, Xbox, Nintendo y consolas.' },
  { id: 'card', label: 'Card', title: 'Card', icon: WalletCards, description: 'Gift cards y tarjetas generales.' },
  { id: 'digital-service', label: 'Servicios', title: 'Servicios digitales', icon: Globe2, description: 'eSIM y servicios digitales.' },
  { id: 'subscription', label: 'Suscripciones', title: 'Suscripciones', icon: Sparkles, description: 'Nitro, membresias y suscripciones.' },
  { id: 'game-accounts', label: 'Cuentas', title: 'Cuentas de Juegos', icon: User, description: 'Cuentas digitales revisadas con entrega manual.' },
  { id: 'manual', label: 'Servicios', title: 'Servicios y cuentas', icon: Wrench, description: 'Productos manuales o entregables.' },
]

function normalizeCatalogText(value = '') {
  return stripEmoji(String(value || '').toLowerCase())
}

function classifyCatalogItem(item, type = 'game') {
  if (type === 'manual') return item?.category === 'game_account' ? 'game-accounts' : 'manual'
  if (item?.catalog_type) return item.catalog_type
  const text = normalizeCatalogText(`${item?.title || ''} ${item?.name || ''}`)
  if (/airalo|esim/.test(text)) return 'digital-service'
  if (/discord nitro|nitro/.test(text)) return 'subscription'
  if (/xbox global games|nintendo games|global games|xbox:/.test(text)) return 'game-console'
  if (item?.category === 'giftcard' || /apple|app store|google play|amazon|steam|spotify|netflix|eneba|jd\.com|nintendo|razer gold|garena shells|cherry credits|paypal instant top up|paypal top up|paypal|walmart|neosurf|culture land|payeer|vanilla visa|visa vanilla|mastercard|transcash|rewarble|gift|card|tarjeta|voucher|wallet/.test(text)) return 'card'
  if (/cd\s*-?\s*key|key|code|codigo|c[oó]digo|license|licencia/.test(text)) return 'game-cdkey'
  if (/playstation|psn|xbox|nintendo|switch|console|consola/.test(text)) return 'game-console'
  if (/mobile|ios|android/.test(text) && /card|gift|tarjeta/.test(text)) return 'mobile-game-cards'
  if (/game card|gaming card|tarjeta.*juego|juego.*tarjeta/.test(text)) return 'game-cards'
  if (/top\s*-?\s*up|recarga|diamonds|diamantes|coins|uc|cp|robux|saldo/.test(text)) return 'direct-topup'
  return 'game'
}

function CatalogLogo({ compact = false } = {}) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={'flex ' + (compact ? 'h-9 w-9' : 'h-10 w-10') + ' flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-card shadow-lg shadow-black/20'}>
      {!failed ? (
        <img src="/api/icons/franchoshop.jpg" alt="Francho Shop" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-sm font-black text-accent">FS</span>
      )}
    </div>
  )
}

function SellerStoreScreen({ slug, me, onLoginRequired }) {
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [buyingManual, setBuyingManual] = useState(null)
  const [buyResult, setBuyResult] = useState(null)

  useEffect(() => {
    setLoading(true); setErr(null)
    api.publicAccountSellerStore(slug)
      .then((data) => { setStore(data); setLoading(false) })
      .catch((e) => { setErr(e.message); setLoading(false) })
  }, [slug])

  if (loading) return <CoolLoading label="Cargando tienda..." />
  if (err) return <ErrorView msg={err} />
  const seller = store?.seller || {}
  const products = store?.products || []
  const externalLinks = [seller.whatsapp_url, seller.social_url_1, seller.social_url_2].filter(Boolean)
  return (
    <div className="px-2.5 py-4 md:p-6">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-card">
        <div className="relative h-32 bg-gradient-to-br from-accent/20 via-black/20 to-green-500/10">
          {seller.banner_image && <OptimizedImage src={seller.banner_image} className="h-full w-full object-cover opacity-80" alt="" eager />}
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
        <div className="px-4 pb-4">
          <div className="mt-3 flex items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-bg shadow-xl">
              {seller.store_image ? <OptimizedImage src={seller.store_image} className="h-full w-full object-cover" alt={seller.store_name || 'Tienda'} eager /> : <Store className="m-5 h-10 w-10 text-accent" />}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-bold text-green-300"><BadgeCheck className="h-3.5 w-3.5" />Tienda verificada en Francho Shop</p>
              <h2 className="truncate text-xl font-black">{seller.store_name}</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/65">{seller.store_description || 'Aquí puedes ver los productos publicados por este vendedor. Todas las compras se procesan dentro de Francho Shop y quedan registradas en tu historial de pedidos.'}</p>
          <p className="mt-3 rounded-lg border border-accent/20 bg-accent/10 p-3 text-xs text-accent">Las compras se procesan dentro de Francho Shop</p>
          <div className="mt-3"><SellerTrustSummary seller={seller} /></div>
          {externalLinks.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{externalLinks.map((url, idx) => <button key={url} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white/75"><span className="inline-flex items-center gap-1"><ExternalLink className="h-3.5 w-3.5" />Enlace {idx + 1}</span></button>)}</div>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{seller.seller_type === 'general' ? 'Productos disponibles' : 'Cuentas disponibles'}</p>
          <p className="text-xs text-white/45">Compra usando saldo de tu cuenta.</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">{products.length}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.map((product) => (
          <button key={product.id} onClick={() => { setBuyingManual(product); setBuyResult(null) }} className="overflow-hidden rounded-xl border border-white/10 bg-card text-left active:scale-[0.99]">
            <div className="aspect-square bg-bg">
              {product.icon_url ? <OptimizedImage src={product.icon_url} className="h-full w-full object-cover" alt={product.name} /> : <div className="flex h-full items-center justify-center"><User className="h-8 w-8 text-white/35" /></div>}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug">{product.name}</p>
              <p className="mt-1 text-[11px] text-white/45">{product.account_game || categoryLabel(product.category)}</p>
              <SocialStatsLine item={product} compact />
              <p className="mt-2 text-sm font-black text-accent">${Number(product.price || 0).toFixed(2)} USDT</p>
            </div>
          </button>
        ))}
      </div>
      {products.length === 0 && <div className="card mt-3 p-8 text-center text-white/45">Esta tienda no tiene productos disponibles ahora.</div>}
      {buyingManual && <ManualBuyModal me={me} onLoginRequired={onLoginRequired} product={buyingManual} onClose={() => { setBuyingManual(null); setBuyResult(null) }} onBought={(result) => setBuyResult(result)} buyResult={buyResult} />}
    </div>
  )
}

function HomeReviewsPanel({ onNav }) {
  const [reviews, setReviews] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.publicReviews({ limit: 10 })
      .then((res) => {
        setReviews(res)
        setLoading(false)
      })
      .catch(() => {
        setReviews(null)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-4 text-center text-xs text-white/40">Cargando opiniones de clientes...</div>
  if (!reviews || !reviews.items || reviews.items.length === 0) return null

  return (
    <div className="mt-8 border-t border-white/10 pt-6">
      <div className="mb-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-green-400" />
          Qué piensan nuestros usuarios de nuestros servicios
        </h2>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="text-green-400 font-semibold">✓ Excelente reputación</span>
          <div className="flex items-center gap-0.5 text-green-400 font-bold">
            <span>{Number(reviews.avg_rating || 5.0).toFixed(1)}</span>
            <span className="ml-1 text-green-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={star <= Math.round(reviews.avg_rating || 5.0) ? "text-green-400" : "text-white/20"}>
                  ★
                </span>
              ))}
            </span>
            <span className="text-white/40 font-normal ml-1">({reviews.count} valoraciones)</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {reviews.items.map((r, idx) => (
          <div key={idx} className="rounded-xl border border-white/5 bg-card p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold text-white/70">{r.customer_name || 'Usuario'}</p>
              <div className="flex text-[10px] text-green-400">
                {'★'.repeat(Number(r.rating || 5))}
              </div>
            </div>
            {r.comment ? (
              <p className="text-xs text-white/80 leading-normal">{r.comment}</p>
            ) : (
              <p className="text-xs italic text-white/40">Valoró con {r.rating} estrellas</p>
            )}
            <p className="mt-1.5 text-[9px] text-white/35 font-medium truncate">
              Compra: {r.product_name || 'Producto'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-green-500/20 bg-green-500/5 p-3 text-center">
        <p className="text-xs text-white/60 mb-2.5">¿Has comprado con nosotros y quieres valorar tu experiencia?</p>
        <button
          onClick={() => onNav?.('profile')}
          className="w-full rounded-lg bg-green-500/25 border border-green-400/30 px-3 py-2 text-xs font-bold text-green-400 active:scale-[0.98] transition-all"
        >
          Dejar una valoración sobre mi compra
        </button>
      </div>
    </div>
  )
}

function HomeScreen({ me, onSelectGame, onNav, onLoginRequired, onOpenNotifications, unreadNotifsCount }) {
  const [games, setGames] = useState([])
  const [manualProducts, setManualProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [buyingManual, setBuyingManual] = useState(null)
  const [buyResult, setBuyResult] = useState(null)

  useEffect(() => {
    Promise.all([
      (me?.is_guest ? api.publicGames() : api.games()).catch(() => []),
      (me?.is_guest ? api.publicManualProducts() : api.manualProducts()).catch(() => []),
    ]).then(([g, mp]) => {
      const manualList = Array.isArray(mp) ? mp : []
      setGames(Array.isArray(g) ? g : [])
      setManualProducts(manualList)
      const manualId = Number(new URLSearchParams(window.location.search).get('manual_product') || 0)
      if (manualId) {
        const match = manualList.find(p => Number(p.id) === manualId)
        if (match) setBuyingManual(match)
      }
      setLoading(false)
    }).catch((e) => { setErr(e.message); setLoading(false) })
  }, [me?.is_guest])

  useEffect(() => {
    if (!games.length) return
    const topGames = games.slice(0, 6)
    const timer = setTimeout(() => {
      topGames.forEach((g, index) => {
        setTimeout(() => {
          const load = me?.is_guest ? api.publicRegions(g.name) : api.regions(g.name)
          load.catch(() => {})
        }, index * 250)
      })
    }, 900)
    return () => clearTimeout(timer)
  }, [games, me?.is_guest])

  const enrichedGames = useMemo(() => games.map(g => ({ ...g, catalogType: classifyCatalogItem(g, 'game') })), [games])
  const enrichedManual = useMemo(() => manualProducts.map(p => ({ ...p, catalogType: 'manual' })), [manualProducts])
  const q = search.trim().toLowerCase()
  const { filteredGames, filteredManual, filterCounts } = useMemo(() => {
    const matchesSearch = (value) => !q || normalizeCatalogText(value).includes(q)
    const matchesFilter = (item) => activeFilter === 'all' || item.catalogType === activeFilter
    const fg = enrichedGames.filter(g => matchesSearch(`${g.title || ''} ${g.name || ''}`) && matchesFilter(g))
    const fm = enrichedManual.filter(p => matchesSearch(p.name || '') && matchesFilter(p))
    const counts = CATALOG_FILTERS.reduce((acc, item) => {
      acc[item.id] = item.id === 'all'
        ? enrichedGames.length + enrichedManual.length
        : enrichedGames.filter(g => g.catalogType === item.id).length + enrichedManual.filter(p => p.catalogType === item.id).length
      return acc
    }, {})
    return { filteredGames: fg, filteredManual: fm, filterCounts: counts }
  }, [q, activeFilter, enrichedGames, enrichedManual])
  const activeFilterData = useMemo(() => CATALOG_FILTERS.find(item => item.id === activeFilter) || CATALOG_FILTERS[0], [activeFilter])
  const totalProducts = useMemo(() => games.reduce((sum, g) => sum + Number(g.count || 0), 0) + manualProducts.length, [games, manualProducts])
  const manualGameAccounts = useMemo(() => filteredManual.filter(p => p.catalogType === 'game-accounts'), [filteredManual])
  const manualOther = useMemo(() => filteredManual.filter(p => p.catalogType !== 'game-accounts'), [filteredManual])

  if (loading) return <CoolLoading label="Preparando catálogo..." />
  if (err) return <ErrorView msg={err} />
  if (games.length === 0 && manualProducts.length === 0) {
    return (
      <div className="p-8 text-center">
        <BigIcon icon={PackageOpen} className="mx-auto mb-4 text-white/35" />
        <p className="text-white/60">Catalogo vacio</p>
        <p className="mt-2 text-xs text-white/40">Avisa al admin</p>
      </div>
    )
  }

  const setFilter = (id) => {
    setActiveFilter(id)
    setMenuOpen(false)
  }

  return (
    <div className="px-2.5 py-4 md:p-6">
      <div className="sticky top-0 z-30 -mx-4 mb-3 border-b border-white/5 bg-bg/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CatalogLogo compact />
            <button onClick={() => setMenuOpen(true)} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-card text-white active:scale-95" aria-label="Abrir filtros">
              <Menu className="h-4 w-4" />
            </button>
            {onOpenNotifications && (
              <button onClick={onOpenNotifications} className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-card text-white active:scale-95" aria-label="Notificaciones">
                <Bell className="h-4 w-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-accent text-[9px] font-black text-bg ring-2 ring-bg animate-pulse" style={{ width: '16px', height: '16px' }}>
                    {unreadNotifsCount}
                  </span>
                )}
              </button>
            )}
          </div>
          <button onClick={() => me?.is_guest ? typeof onLoginRequired === 'function' ? onLoginRequired() : null : openTelegramTopUp()} className="rounded-lg border border-white/10 bg-card px-3 py-1.5 text-right active:scale-95">
            <p className="text-[10px] leading-none text-white/45">Saldo</p>
            <p className="mt-1 text-xs font-black leading-none text-white">{me?.is_guest ? "Entrar" : "$" + Number(me.balance || 0).toFixed(2)}</p>
          </button>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-card">
        <div className="relative aspect-[16/7] min-h-[148px] bg-[#101820]">
          <div className="absolute inset-y-0 right-0 w-2/3 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=75')] bg-cover bg-center opacity-60" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,17,23,.96),rgba(11,17,23,.65),rgba(11,17,23,.25))]" />
          <div className="relative z-10 flex h-full max-w-[78%] flex-col justify-center p-4">
            <p className="text-[11px] font-bold uppercase text-accent">{activeFilterData.title}</p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-white">Compra rapido y seguro</h2>
            <p className="mt-2 text-xs leading-relaxed text-white/58">{totalProducts} productos disponibles. Filtra por tipo y encuentra la recarga correcta.</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-white/10 bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input type="text" placeholder="Buscar juego, tarjeta o servicio" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bg py-3 pl-10 pr-3 text-sm text-white outline-none placeholder-white/35 focus:border-accent" />
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-sm">
          <div className="ml-auto flex h-full max-w-sm flex-col overflow-hidden rounded-lg border border-white/10 bg-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <CatalogLogo compact />
                <div>
                  <p className="font-bold">Francho Shop</p>
                  <p className="text-xs text-white/45">Filtros del catalogo</p>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 active:scale-95" aria-label="Cerrar filtros">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {CATALOG_FILTERS.map(item => {
                const Icon = item.icon
                const selected = activeFilter === item.id
                const count = filterCounts[item.id] || 0
                return (
                  <button key={item.id} onClick={() => setFilter(item.id)} className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left active:scale-[0.99] ${selected ? 'border-accent bg-accent/15' : 'border-white/10 bg-card'}`}>
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-accent text-white' : 'bg-white/8 text-white/65'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{item.title}</span>
                      <span className="block truncate text-xs text-white/45">{item.description}</span>
                    </span>
                    <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/55">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {filteredGames.length === 0 && filteredManual.length === 0 ? (
        <p className="py-8 text-center text-white/50">Sin resultados para "{search || activeFilterData.label}"</p>
      ) : activeFilter !== 'all' ? (
        <CatalogGridView
          title={activeFilterData.title}
          icon={activeFilterData.icon}
          count={filteredGames.length + filteredManual.length}
          onBack={() => { setActiveFilter('all'); setSearch('') }}
        >
          {filteredGames.map((g) => <GameCard key={g.name} game={g} onSelect={() => onSelectGame(g)} />)}
          {filteredManual.map((p) => <ManualCatalogCard key={p.id} product={p} onSelect={() => setBuyingManual(p)} />)}
        </CatalogGridView>
      ) : (
        <>
          {CATALOG_FILTERS.filter(f => !['all', 'manual'].includes(f.id)).map((section) => {
            const items = filteredGames.filter(g => g.catalogType === section.id)
            return items.length > 0 ? <CatalogSection key={section.id} title={section.title} icon={section.icon} count={items.length} onViewAll={() => setFilter(section.id)}>{items.map((g) => <GameCard key={g.name} game={g} onSelect={() => onSelectGame(g)} />)}</CatalogSection> : null
          })}
          {manualGameAccounts.length > 0 && <GameAccountsIntro count={manualGameAccounts.length} onViewAll={() => setFilter('game-accounts')}>{manualGameAccounts.map((p) => <ManualCatalogCard key={p.id} product={p} onSelect={() => setBuyingManual(p)} />)}</GameAccountsIntro>}
          {manualOther.length > 0 && <CatalogSection title="Servicios y cuentas" icon={Wrench} count={manualOther.length} onViewAll={() => setFilter('manual')}>{manualOther.map((p) => <ManualCatalogCard key={p.id} product={p} onSelect={() => setBuyingManual(p)} />)}</CatalogSection>}
        </>
      )}

      {buyingManual && <ManualBuyModal me={me} onLoginRequired={onLoginRequired} product={buyingManual} onClose={() => { setBuyingManual(null); setBuyResult(null) }} onBought={(result) => setBuyResult(result)} buyResult={buyResult} />}

      <HomeReviewsPanel onNav={onNav} />

      <div className="mt-8 border-t border-white/10 pt-6">
        <p className="mb-3 inline-flex w-full items-center justify-center gap-1 text-center text-xs text-white/40"><Info className="h-3.5 w-3.5" aria-hidden="true" />Informacion</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button onClick={() => onNav?.('guides')} className="card p-3 text-center active:scale-95"><Globe2 className="mx-auto mb-1 h-6 w-6" aria-hidden="true" /><p className="text-[11px] font-semibold">Guías</p><p className="mt-0.5 text-[9px] leading-tight text-white/40">Recargas y compras</p></button>
          <button onClick={() => onNav?.('help')} className="card p-3 text-center active:scale-95"><BookOpen className="mx-auto mb-1 h-6 w-6" aria-hidden="true" /><p className="text-[11px] font-semibold">Ayuda</p></button>
          <button onClick={() => onNav?.('faq')} className="card p-3 text-center active:scale-95"><CircleHelp className="mx-auto mb-1 h-6 w-6" aria-hidden="true" /><p className="text-[11px] font-semibold">FAQ</p></button>
          <button onClick={() => onNav?.('terms')} className="card p-3 text-center active:scale-95"><FileText className="mx-auto mb-1 h-6 w-6" aria-hidden="true" /><p className="text-[11px] font-semibold">Términos</p></button>
          <button onClick={() => onNav?.('contact')} className="card p-3 text-center active:scale-95"><MessageCircle className="mx-auto mb-1 h-6 w-6" aria-hidden="true" /><p className="text-[11px] font-semibold">Contacto</p><p className="mt-0.5 text-[9px] leading-tight text-white/40">Soporte y novedades oficiales</p></button>
        </div>
        <div className="mt-4 space-y-1 text-center text-[10px] text-white/30">
          <p>Francho Shop · Recargas de juegos · Gift cards · Suscripciones · Productos digitales</p>
          <p>Recargas de juegos, gift cards, suscripciones y productos digitales para Cuba y el mundo.</p>
          <p>Soporte y canal oficial de WhatsApp</p>
          <p>© 2026 Francho Shop · Hecho con dedicación para Cuba y el mundo</p>
        </div>
      </div>
    </div>
  )
}


function GameAccountsIntro({ count, children, onViewAll }) {
  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-card p-4 [content-visibility:auto] [contain-intrinsic-size:420px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-black"><User className="h-5 w-5 text-accent" />Cuentas de Juegos</h3>
          <p className="mt-1 text-sm text-white/60">Compra cuentas digitales de juegos seleccionadas y revisadas por Francho Shop.</p>
        </div>
        {count > 5 && <button onClick={onViewAll} className="rounded-lg bg-white/10 p-2 text-accent active:scale-95" aria-label="Ver todas las cuentas"><ChevronRight className="h-5 w-5" /></button>}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-white/50">En esta sección encontrarás cuentas de juegos disponibles para compra. Cada cuenta incluye detalles importantes como juego, región, nivel, rango, artículos destacados, método de acceso y garantía. La entrega se realiza de forma manual después de confirmar el pago.</p>
      <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] text-white/60">
        {['Cuentas revisadas antes de publicar','Información clara antes de comprar','Entrega manual y organizada','Pedido registrado en tu historial','Soporte disponible en caso de dudas','Compra usando saldo de tu cuenta'].map(item => <div key={item} className="rounded-lg bg-bg/70 p-2"><Check className="mb-1 h-3.5 w-3.5 text-green-400" />{item}</div>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {flattenCatalogChildren(children).slice(0, 5).map((child, index) => <div key={child?.key || index} className="w-[31%] min-w-[31%] max-w-[150px] flex-shrink-0">{child}</div>)}
        {count > 5 && <div className="w-[31%] min-w-[31%] max-w-[150px] flex-shrink-0"><CatalogViewMoreCard title="Cuentas" onClick={onViewAll} /></div>}
      </div>
      <p className="mt-3 text-center text-[10px] text-white/35">Compra cuentas digitales con información clara, entrega organizada y soporte de Francho Shop.</p>
    </section>
  )
}

function flattenCatalogChildren(children) {
  return (Array.isArray(children) ? children.flat(Infinity) : [children]).filter(Boolean)
}

function CatalogViewMoreCard({ title, onClick }) {
  return (
    <button onClick={onClick} className="group block w-full min-w-0 overflow-hidden rounded-lg border border-white/10 bg-card text-left transition active:scale-95 hover:border-accent/50" aria-label={`Ver más ${title}`}>
      <div className="flex aspect-square items-center justify-center bg-white/5 text-accent">
        <ChevronRight className="h-8 w-8" />
      </div>
      <div className="p-1.5">
        <p className="line-clamp-2 min-h-[28px] break-words text-[11px] font-bold leading-tight text-accent">Ver más</p>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-1"><span className="truncate text-[9px] text-white/45">{title}</span><ChevronRight className="h-3 w-3 flex-shrink-0 text-white/35" /></div>
        <div className="mt-1 h-3.5 text-[8px] leading-none text-transparent">&nbsp;</div>
      </div>
    </button>
  )
}

function CatalogGridView({ title, icon: Icon, count, children, onBack }) {
  const items = flattenCatalogChildren(children)
  return (
    <section className="mb-6 [content-visibility:auto] [contain-intrinsic-size:360px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="inline-flex min-w-0 items-center gap-2 text-sm font-black uppercase text-white/75">
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{title}</span>
          </h3>
          <p className="mt-1 text-xs text-white/40">{count} productos</p>
        </div>
        <button onClick={onBack} className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-card px-3 py-2 text-xs font-bold text-white/75 active:scale-95">
          <ArrowLeft className="h-3.5 w-3.5" />
          Atrás
        </button>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {items.map((child, index) => (
          <div key={child?.key || index} className="min-w-0">
            {child}
          </div>
        ))}
      </div>
    </section>
  )
}

function CatalogSection({ title, icon: Icon, count, children, onViewAll }) {
  const items = flattenCatalogChildren(children)
  const visibleItems = items.slice(0, 5)
  return (
    <section className="mb-6 [content-visibility:auto] [contain-intrinsic-size:360px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="inline-flex min-w-0 items-center gap-2 text-sm font-black uppercase text-white/75">
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{title}</span>
          <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-white/45">{count}</span>
        </h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {visibleItems.map((child, index) => (
          <div key={child?.key || index} className="w-[31%] min-w-[31%] max-w-[150px] flex-shrink-0">
            {child}
          </div>
        ))}
        {count > 5 && (
          <div className="w-[31%] min-w-[31%] max-w-[150px] flex-shrink-0">
            <CatalogViewMoreCard title={title} onClick={onViewAll} />
          </div>
        )}
      </div>
    </section>
  )
}

function ManualCatalogCard({ product, onSelect }) {
  // Local cacheBust removed
  return (
    <button onClick={onSelect} className="group block w-full min-w-0 overflow-hidden rounded-lg border border-white/10 bg-card text-left transition active:scale-95 hover:border-accent/50">
      <div className="aspect-square bg-[#101820]">
        {product.icon_url ? <OptimizedImage src={`${product.icon_url}?v=${cacheBust}`} className="h-full w-full object-cover transition group-hover:scale-[1.03]" alt={product.name} /> : <div className="flex h-full w-full items-center justify-center bg-white/5"><CategoryIcon category={product.category} className="h-9 w-9 text-white/55" /></div>}
      </div>
      <div className="p-1.5">
        <p className="line-clamp-2 min-h-[28px] break-words text-[11px] font-bold leading-tight">{product.name}</p>
        <div className="mt-1 min-w-0">
          <span className="block truncate text-xs font-black text-accent">{manualProductPriceRange(product)}</span>
          <span className="mt-0.5 inline-block max-w-full truncate rounded bg-white/8 px-1 py-0.5 text-[8px] text-white/45">{deliveryTypeLabel(product.delivery_type, product.category)}</span>
          <SocialStatsLine item={product} compact />
        </div>
      </div>
    </button>
  )
}

function GameCard({ game, onSelect }) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const showImage = game.icon_url && !imgError
  // Local cacheBust removed
  const imgSrc = showImage && game.icon_url.startsWith('/api/') ? `${game.icon_url}?v=${cacheBust}` : game.icon_url
  const TypeIcon = game.catalogType === 'card' ? Gift : game.catalogType === 'game-cdkey' ? KeyRound : game.catalogType === 'game-console' ? Gamepad2 : Smartphone

  return (
    <button onClick={onSelect} className="group block w-full min-w-0 overflow-hidden rounded-lg border border-white/10 bg-card text-left transition active:scale-95 hover:border-accent/50">
      <div className="relative aspect-square bg-[#101820]">
        {showImage && <OptimizedImage src={imgSrc} alt={game.title || game.name} className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} onError={() => setImgError(true)} onLoad={() => setImgLoaded(true)} />}
        {(!showImage || !imgLoaded) && <div className="absolute inset-0 flex items-center justify-center bg-white/5"><TypeIcon className="h-10 w-10 text-white/55" aria-hidden="true" /></div>}
        <div className="absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white/80 backdrop-blur">{game.catalogType === 'card' ? 'Card' : game.catalogType === 'direct-topup' ? 'Top-Up' : game.catalogType === 'game-cdkey' ? 'CD-Key' : 'Game'}</div>
      </div>
      <div className="p-1.5">
        <p className="line-clamp-2 min-h-[28px] break-words text-[11px] font-bold leading-tight">{game.title || game.name}</p>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-1"><span className="truncate text-[9px] text-white/45">{game.count} productos</span><ChevronDown className="h-3 w-3 flex-shrink-0 -rotate-90 text-white/35" /></div>
        <SocialStatsLine item={game} compact />
      </div>
    </button>
  )
}

function RegionsScreen({ game, gameData, me, onSelectRegion, onCountKnown }) {
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  function markReviewed(order, review) {
    setOrders(items => items.map(item => item.type === order.type && item.id === order.id ? { ...item, review } : item))
  }

  useEffect(() => {
    let cancelled = false;
    (me?.is_guest ? api.publicRegions(game) : api.regions(game)).then((r) => {
      if (cancelled) return
      const arr = Array.isArray(r) ? r : []
      setRegions(arr)
      setLoading(false)
    }).catch((e) => {
      if (cancelled) return
      setErr(e.message)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [game, me?.is_guest])

  useEffect(() => {
    if (loading || err) return
    if (typeof onCountKnown === 'function') onCountKnown(regions.length)
    if (regions.length === 1 && regions[0]?.raw_name) {
      const t = setTimeout(() => onSelectRegion(regions[0].raw_name), 0)
      return () => clearTimeout(t)
    }
  }, [regions, loading, err])

  if (loading) return <CoolLoading label="Obteniendo regiones..." />
  if (err) return <ErrorView msg={err} />
  if (regions.length <= 1) return <CoolLoading label="Cargando productos..." />

  const iconUrl = gameData?.icon_url
  // Local cacheBust removed

  return (
    <div className="px-2.5 py-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        {iconUrl ? (
          <OptimizedImage src={`${iconUrl}?v=${cacheBust}`} alt="" className="w-14 h-14 rounded-xl object-cover" eager />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-card flex items-center justify-center text-2xl">
            <Gamepad2 className="h-7 w-7 text-white/60" aria-hidden="true" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold">{gameData?.title || game}</h2>
          <p className="text-sm text-white/50 inline-flex items-center gap-1"><Globe2 className="h-4 w-4" aria-hidden="true" />Selecciona tu región</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {regions.map((r) => (
          <button key={r.raw_name} onClick={() => onSelectRegion(r.raw_name)}
            className="card flex min-h-[82px] flex-col items-center justify-center p-2 text-center transition active:scale-95 hover:border-accent/50">
            <span className="line-clamp-2 break-words text-xs font-black leading-tight">{r.name}</span>
            <span className="mt-1 text-[10px] text-white/45">{r.count} productos</span>
          </button>
        ))}
      </div>
    </div>
  )
}


function getDenominationLabel(productName = '', gameTitle = '') {
  const original = stripEmoji(String(productName || '')).replace(/\s+/g, ' ').trim()
  let text = original
  const title = stripEmoji(String(gameTitle || '')).replace(/\s+/g, ' ').trim()
  if (title) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text.replace(new RegExp(`^${escaped}\\s+`, 'i'), '').trim()
  }
  text = text
    .replace(/^Genshin Impact\s+/ig, '')
    .replace(/^Blood Strike\s+/ig, '')
    .replace(/^Arena Breakou?t\s+/ig, '')
    .replace(/\(\s*O\s*\)/ig, '')
    .replace(/^Top\s*-?\s*Up\s+/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (/^\d/.test(original) && !/^\d/.test(text)) return original
  return text || original
}

function formatRechargeDetails(details = []) {
  return (Array.isArray(details) ? details : []).filter(item => item && item.value).map(item => ({
    label: item.kind === 'id' ? 'ID de cuenta' : item.kind === 'region' ? 'Región / servidor' : item.label,
    value: item.value,
  }))
}


function getGenshinAmountKey(name = '') {
  const text = normalizeCatalogText(name).replace(/,/g, '')
  const pair = text.match(/(\d+)\s*\+\s*(\d+)/)
  if (pair) return `${Number(pair[1])}+${Number(pair[2])}`
  const single = text.match(/(^|\s)(\d+)(?=\s+(genesis\s+)?crystals?\b|\s+chronal\s+nexus\b)/)
  if (single) return `${Number(single[2])}+0`
  return text
}

function getGenshinDisplayName(product, groupId) {
  const raw = String(product?.name || '').replace(/\s+/g, ' ').trim()
  const key = getGenshinAmountKey(raw)
  const pair = key.match(/^(\d+)\+(\d+)$/)
  if (!pair) return raw
  const base = Number(pair[1])
  const bonus = Number(pair[2])
  const amount = bonus > 0 ? `${base} + ${bonus}` : `${base}`
  if (groupId === 'chronal') return `${amount} Chronal Nexus`
  if (groupId === 'genesis') return `${amount} Genesis Crystals`
  return raw
}

function getGenshinPreferenceScore(product, groupId) {
  const name = normalizeCatalogText(product?.name || '')
  let score = 0
  if (groupId === 'genesis' && /genesis crystals/.test(name)) score += 50
  if (groupId === 'chronal' && /chronal nexus/.test(name)) score += 50
  if (/\bcrystals\b/.test(name)) score += 10
  if (/\bcrystal\b/.test(name)) score += 5
  if (/all pack|blessing|welkin|pass|bundle|monthly|quarterly/.test(name)) score -= 100
  return score
}

function dedupeGenshinGroup(items, groupId) {
  const byAmount = new Map()
  items.forEach((product) => {
    const key = getGenshinAmountKey(product.name)
    const candidate = { ...product, displayName: getGenshinDisplayName(product, groupId) }
    const current = byAmount.get(key)
    if (!current) {
      byAmount.set(key, candidate)
      return
    }
    const candidateScore = getGenshinPreferenceScore(candidate, groupId)
    const currentScore = getGenshinPreferenceScore(current, groupId)
    if (candidateScore > currentScore || (candidateScore === currentScore && Number(candidate.price || 0) < Number(current.price || 0))) {
      byAmount.set(key, candidate)
    }
  })
  return sortProductsByValue([...byAmount.values()])
}

function getProductDisplayGroups(products = [], gameTitle = '') {
  const title = normalizeCatalogText(gameTitle)
  if (!/genshin/.test(title)) return [{ id: 'all', title: null, items: products }]

  const groups = [
    { id: 'genesis', title: 'Genesis Crystals', items: [] },
    { id: 'chronal', title: 'Chronal Nexus', items: [] },
    { id: 'passes', title: 'Pases y paquetes', items: [] },
  ]
  products.forEach((product) => {
    const name = normalizeCatalogText(product.name)
    if (/all pack|blessing|welkin|pass|bundle|monthly|quarterly/.test(name)) groups[2].items.push(product)
    else if (/chronal nexus/.test(name)) groups[1].items.push(product)
    else if (/genesis crystals?|\bcrystals?\b/.test(name)) groups[0].items.push(product)
    else groups[2].items.push(product)
  })
  groups[0].items = dedupeGenshinGroup(groups[0].items, 'genesis')
  groups[1].items = dedupeGenshinGroup(groups[1].items, 'chronal')
  groups[2].items = sortProductsByValue(groups[2].items)
  return groups.filter(group => group.items.length > 0)
}

function ProductsScreen({ game, gameData, region, me, onSelectProduct, onLoginRequired }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [fields, setFields] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const [shareTarget, setShareTarget] = useState(null) // { link, name }
  const descriptionRef = useRef(null)
  const instructionsRef = useRef(null)
  // Local cacheBust removed
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    (me?.is_guest ? api.publicProducts(game, region) : api.products(game, region))
      .then((p) => { setProducts(sortProductsByValue(Array.isArray(p) ? p : [])); setLoading(false) })
      .catch((e) => { setErr(e.message); setLoading(false) })
  }, [game, region, me?.is_guest])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    (me?.is_guest ? api.publicProductDetail(selectedId, region) : api.productDetail(selectedId, region))
      .then(d => setDetail(d))
      .catch(e => setOrderError(e.message))
  }, [selectedId, region, me?.is_guest])

  const selectedProduct = products.find(p => p.id === selectedId)
  const gameTitle = gameData?.title || game.split(' ').slice(1).join(' ') || game
  const productGroups = useMemo(() => getProductDisplayGroups(products, gameTitle), [products, gameTitle])

  const sellerParam = !me?.is_guest && ['seller', 'admin'].includes(me.role) ? '&seller=' + me.user_id : ''
  const refParam = !me?.is_guest ? '&ref=' + me.user_id + sellerParam : ''
  const gameShareLink = window.location.origin + window.location.pathname + '?game=' + encodeURIComponent(game) + (region && region !== '__standard__' ? '&region=' + encodeURIComponent(region) : '') + refParam
  const productShareLink = selectedId ? (window.location.origin + window.location.pathname + '?product=' + selectedId + (region && region !== '__standard__' ? '&region=' + encodeURIComponent(region) : '') + refParam) : gameShareLink

  if (loading) return <CoolLoading label="Cargando productos..." />
  if (err) return <ErrorView msg={err} />

  const iconUrl = gameData?.icon_url
  // Local cacheBust removed
  const detailFields = detail?.fields || []
  const infoDescription = String(detail?.description || gameData?.description || "").trim()
  const infoInstructions = String(detail?.instructions || gameData?.instructions || "").trim()
  const hasInfoSections = !!(infoDescription || infoInstructions)
  const jumpTo = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  const allFilled = detail
    ? detailFields.every(f => {
        const k = f.field_name || f.name
        return fields[k] && String(fields[k]).trim() !== ''
      })
    : false

  async function handleBuy() {
    if (!detail || submitting) return
    if (me?.is_guest) { if (typeof onLoginRequired === 'function') onLoginRequired(); return }
    setSubmitting(true)
    setOrderError(null)
    try {
      const result = await api.createOrder({
        product_id: detail.id,
        fields: { ...fields, __region__: region },
      })
      onSelectProduct({ ...selectedProduct, _orderResult: result })
    } catch (e) {
      setOrderError(e.message)
      setSubmitting(false)
    }
  }

  function clearSelection() {
    setSelectedId(null)
    setDetail(null)
    setFields({})
    setOrderError(null)
    setSubmitting(false)
  }

  const renderRechargeFields = () => {
    if (!selectedProduct) return null
    if (!detail) return <p className="inline-flex items-center gap-2 text-sm text-white/45"><Loader2 className="h-4 w-4 animate-spin" />Cargando datos del producto...</p>
    if (detailFields.length === 0) return <p className="text-sm text-white/45">Este producto no pide datos adicionales.</p>
    return (
      <div className="space-y-3">
        {detailFields.map(f => {
          const key = f.field_name || f.name
          const isIdField = /id|player|usuario|uid/i.test(`${f.name || ''} ${key || ''}`)
          return (
            <div key={key}>
              <label className="mb-1 block text-sm font-semibold">{isIdField ? 'ID de jugador / usuario' : f.name}</label>
              {f.is_select && f.values?.length > 0 ? (
                <select
                  value={fields[key] || ''}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-bg px-4 py-3 outline-none focus:border-accent">
                  <option value="">Seleccionar {f.name}</option>
                  {f.values.map((v) => (
                    <option key={v.serverId} value={v.serverId}>
                      {v.serverName || v.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  inputMode={isIdField ? 'numeric' : 'text'}
                  placeholder={f.tip || (isIdField ? 'Escribe el ID exacto de la cuenta' : `Por favor llena ${f.name}`)}
                  value={fields[key] || ''}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-bg px-4 py-3 outline-none focus:border-accent" />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={selectedProduct ? "pb-80" : "pb-8"}>
      {showShare && shareTarget && (
        <ShareProductModal
          shareLink={shareTarget.link}
          productName={shareTarget.name}
          onClose={() => { setShowShare(false); setShareTarget(null) }}
        />
      )}
      {submitting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-bg p-5 text-center shadow-2xl">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-accent" />
            <p className="text-lg font-black">Procesando compra</p>
            <p className="mt-2 text-sm text-white/55">Enviando el pedido al proveedor. No cierres esta pantalla.</p>
          </div>
        </div>
      )}
      <div className="bg-gradient-to-br from-accent/30 via-accent2/20 to-transparent p-4 mb-4">
        <div className="flex items-center gap-3 mb-2">
          {iconUrl ? (
            <OptimizedImage src={`${iconUrl}?v=${cacheBust}`} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" eager />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-card flex items-center justify-center text-3xl flex-shrink-0">
              <Gamepad2 className="h-8 w-8 text-white/60" aria-hidden="true" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold uppercase tracking-wide truncate flex-1">{gameTitle}</h1>
              <button
                onClick={() => { setShareTarget({ link: gameShareLink, name: gameTitle }); setShowShare(true) }}
                aria-label="Compartir este juego"
                className="flex-shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold active:scale-95 transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
                  border: '1px solid rgba(139,92,246,0.4)',
                  color: '#c4b5fd'
                }}
              >
                <Share2 className="h-3 w-3" />
                <span>Compartir</span>
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="text-green-400 font-semibold">✓ Excelente</span>
              <div className="flex items-center gap-0.5 text-green-400">
                {gameData?.avg_rating > 0 ? (
                  <>
                    <span className="font-bold mr-1">{Number(gameData.avg_rating).toFixed(1)}</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= Math.round(gameData.avg_rating) ? "text-green-400" : "text-white/20"}>
                        ★
                      </span>
                    ))}
                    {gameData.rating_count > 0 && (
                      <span className="text-white/45 ml-1">({gameData.rating_count})</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-bold mr-1">5.0</span>
                    <span className="text-green-400">★★★★★</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1 text-white/60">
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />Entrega instantánea</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Pago seguro</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-white/50 mt-2">
          Recargas oficiales · Sin verificación · {products.length} ofertas disponibles
        </p>
      </div>

      <div className="px-4">
        <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide">
          <span className="inline-flex items-center gap-2"><DollarSign className="h-4 w-4" aria-hidden="true" />Selecciona denominación</span>
        </h2>

        <div className="mb-4 space-y-4">
          {productGroups.map((group) => (
            <div key={group.id}>
              {group.title && (
                <p className="mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-wide text-white/65">{group.title}</p>
              )}
              <div className="space-y-1.5">
                {group.items.map((p) => {
                  const isSelected = p.id === selectedId
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setFields({}); setOrderError(null); setSubmitting(false) }}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition active:scale-[0.99] ${
                        isSelected ? 'border-accent bg-accent/15' : 'border-white/10 bg-card hover:border-accent/50'
                      }`}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-accent/20 to-accent2/20">
                          {iconUrl ? <OptimizedImage src={`${iconUrl}?v=${cacheBust}`} alt="" className="h-full w-full object-cover" /> : <Gamepad2 className="h-5 w-5 text-white/60" aria-hidden="true" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-bold leading-snug text-white/90">{p.displayName || p.name}</p>
                          <SocialStatsLine item={p} compact />
                        </div>
                        <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-accent bg-accent' : 'border-white/25'}`}>
                          {isSelected && <span className="text-[10px]">✓</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <PublicReviewsPanel gameName={game} compact />

        {hasInfoSections && (
          <div className="mb-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {infoDescription && (
                <button onClick={() => jumpTo(descriptionRef)} className="rounded-lg border border-white/10 bg-card px-3 py-2 text-xs font-semibold text-white/75 active:scale-95">Descripción</button>
              )}
              {infoInstructions && (
                <button onClick={() => jumpTo(instructionsRef)} className="rounded-lg border border-white/10 bg-card px-3 py-2 text-xs font-semibold text-white/75 active:scale-95">Cómo usar</button>
              )}
            </div>

            {infoDescription && (
              <section ref={descriptionRef} className="scroll-mt-20 rounded-xl border border-white/10 bg-card p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-accent" />Descripción</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-white/70"><Linkify>{infoDescription}</Linkify></p>
              </section>
            )}

            {infoInstructions && (
              <section ref={instructionsRef} className="scroll-mt-20 rounded-xl border border-white/10 bg-card p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-yellow-300" />Cómo usar</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-white/65"><Linkify>{infoInstructions}</Linkify></p>
              </section>
            )}
          </div>
        )}

        {selectedProduct && (
          <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-lg border-t border-white/10 bg-bg/95 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl shadow-black/50 backdrop-blur">
            <div className="mb-3 max-h-[42vh] overflow-y-auto pr-1">
              <div className="mb-3 rounded-xl border border-white/10 bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Producto seleccionado</p>
                <div className="flex items-start justify-between gap-2 mt-1">
                  <p className="text-sm font-bold leading-tight flex-1">{selectedProduct.displayName || selectedProduct.name}</p>
                  <button
                    onClick={() => { setShareTarget({ link: productShareLink, name: selectedProduct.displayName || selectedProduct.name }); setShowShare(true) }}
                    aria-label="Compartir producto"
                    className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold active:scale-95 transition-all"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                      border: '1px solid rgba(139,92,246,0.35)',
                      color: '#a78bfa'
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Compartir</span>
                  </button>
                </div>
              </div>
              {renderRechargeFields()}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={clearSelection}
                className="h-12 w-12 flex-shrink-0 rounded-xl border border-red-400/30 bg-red-500/15 text-lg font-bold text-red-200 active:scale-95">
                X
              </button>
              <button
                disabled={!allFilled || submitting}
                onClick={handleBuy}
                className="min-w-0 flex-1 rounded-xl bg-gradient-to-r from-accent to-accent2 px-3 py-3 font-bold active:scale-95 disabled:opacity-50">
                {submitting ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Procesando...</span> : <span className="inline-flex items-center justify-center gap-2"><ShoppingCart className="h-5 w-5" />Comprar por ${Number(selectedProduct.price).toFixed(2)} USDT</span>}
              </button>
            </div>
            {orderError && <p className="text-xs text-red-400 text-center mt-2">{orderError}</p>}
            {!allFilled && selectedId && (
              <p className="text-xs text-yellow-400/70 text-center mt-2">
                <span className="inline-flex items-center justify-center gap-1"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Completa los datos de compra</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ShareProductModal({ shareLink, productName, onClose }) {
  const [copied, setCopied] = useState(false)

  // Actualizar URL del navegador automáticamente al montar
  useEffect(() => {
    try { window.history.replaceState({}, '', shareLink) } catch {}
    // Al desmontar, no limpiamos aquí (lo hace goBack)
  }, [shareLink])

  const handleCopy = async () => {
    await copyText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: productName, url: shareLink })
      } catch {}
    } else {
      handleCopy()
    }
  }

  const whatsappUrl = 'https://wa.me/?text=' + encodeURIComponent('🎮 ' + productName + '\n' + shareLink)
  const telegramUrl = 'https://t.me/share/url?url=' + encodeURIComponent(shareLink) + '&text=' + encodeURIComponent('🎮 ' + productName)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]"
        style={{
          background: 'linear-gradient(135deg, #1a1f2e 0%, #141820 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)'
        }}
      >
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 mb-0.5">Compartir producto</p>
            <p className="font-bold text-white line-clamp-1">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* URL preview */}
        <div
          className="mb-5 flex items-center gap-3 rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <LinkIcon className="h-4 w-4 flex-shrink-0 text-white/40" />
          <p className="flex-1 truncate text-xs text-white/50 font-mono">{shareLink}</p>
        </div>

        {/* Share buttons grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 rounded-2xl p-4 active:scale-95 transition-transform"
            style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)' }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-green-400" fill="currentColor">
              <path d="M12.012 2C6.485 2 2 6.485 2 12.012c0 1.765.458 3.424 1.258 4.887L2 22l5.225-1.218a9.92 9.92 0 0 0 4.787 1.23c5.527 0 10.012-4.485 10.012-10.012S17.539 2 12.012 2zm0 18.23c-1.572 0-3.056-.42-4.35-1.153l-.312-.178-3.238.756.77-3.155-.195-.31a8.218 8.218 0 0 1-1.264-4.331c0-4.542 3.696-8.238 8.238-8.238 4.542 0 8.238 3.696 8.238 8.238S16.554 20.23 12.012 20.23zm4.52-6.175c-.247-.123-1.464-.723-1.691-.806-.228-.083-.393-.123-.559.123-.166.248-.642.806-.787.97-.145.166-.29.187-.538.063a6.786 6.786 0 0 1-1.996-1.23 7.487 7.487 0 0 1-1.38-1.719c-.146-.247-.016-.381.108-.504.111-.11.247-.289.37-.433.125-.145.167-.248.249-.413.083-.166.042-.31-.02-.433-.063-.124-.559-1.345-.765-1.84-.201-.487-.406-.42-.56-.428-.145-.007-.31-.008-.475-.008a.913.913 0 0 0-.662.31c-.228.248-.87.848-.87 2.067 0 1.22.888 2.398.988 2.563.1.165 1.747 2.668 4.233 3.74.59.255 1.053.407 1.412.521.597.19 1.141.162 1.57.098.479-.072 1.465-.599 1.671-1.157.207-.558.207-1.033.145-1.137-.061-.103-.227-.165-.475-.29z"/>
            </svg>
            <span className="text-xs font-semibold text-green-400">WhatsApp</span>
          </a>

          {/* Telegram */}
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 rounded-2xl p-4 active:scale-95 transition-transform"
            style={{ background: 'rgba(36,161,222,0.12)', border: '1px solid rgba(36,161,222,0.25)' }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-400" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75l-2.58-1.7-2.49 2.4c-.28.28-.52.52-.96.52l.37-5.24 9.54-8.62c.41-.37-.09-.57-.64-.2L6.49 14.33l-5.08-1.58c-1.1-.35-1.12-1.1.23-1.63l19.85-7.65c.92-.35 1.72.2 1.43 1.33z"/>
            </svg>
            <span className="text-xs font-semibold text-sky-400">Telegram</span>
          </a>

          {/* Compartir nativo / Más */}
          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-2 rounded-2xl p-4 active:scale-95 transition-transform"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}
          >
            <Share2 className="h-6 w-6 text-violet-400" />
            <span className="text-xs font-semibold text-violet-400">Más</span>
          </button>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="w-full rounded-2xl py-3.5 font-bold text-sm transition-all active:scale-95"
          style={{
            background: copied
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: copied ? '0 4px 20px rgba(16,185,129,0.3)' : '0 4px 20px rgba(99,102,241,0.3)'
          }}
        >
          <span className="inline-flex items-center justify-center gap-2">
            {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
          </span>
        </button>
      </div>
    </div>
  )
}

function ProductDetailScreen({ productId, region, me, onCancel, onBought, onLoginRequired }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [fields, setFields] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const descriptionRef = useRef(null)
  const instructionsRef = useRef(null)
  // Local cacheBust removed

  useEffect(() => {
    // IMPORTANTE: pasamos region para preseleccionar server
    (me?.is_guest ? api.publicProductDetail(productId, region) : api.productDetail(productId, region))
      .then((d) => { setDetail(d); setLoading(false) })
      .catch((e) => { setErr(e.message); setLoading(false) })
  }, [productId, region, me?.is_guest])

  // Actualizar URL automáticamente cuando cargue el detalle
  useEffect(() => {
    if (!detail) return
    const params = new URLSearchParams()
    params.set('product', detail.id)
    if (region && region !== '__standard__') params.set('region', region)
    if (!me?.is_guest) params.set('ref', me.user_id)
    const newUrl = window.location.origin + window.location.pathname + '?' + params.toString()
    try { window.history.replaceState({}, '', newUrl) } catch {}
  }, [detail, region, me?.is_guest, me?.user_id])

  if (loading || !detail) return <CoolLoading label="Cargando detalles del producto..." />
  if (err) return <ErrorView msg={err} />

  const detailFields = detail.fields || []
  const allFilled = detailFields.every((f) => {
    const key = f.field_name || f.name
    return fields[key] && String(fields[key]).trim() !== ''
  })
  const canBuy = !me?.is_guest && me.balance >= detail.price && allFilled && !submitting
  const sellerParam = !me?.is_guest && ['seller', 'admin'].includes(me.role) ? '&seller=' + me.user_id : ''
  const shareLink = window.location.origin + window.location.pathname + '?product=' + detail.id + (region ? '&region=' + encodeURIComponent(region) : '') + (me?.is_guest ? '' : '&ref=' + me.user_id + sellerParam)
  const hasDescription = !!String(detail.description || "").trim()
  const hasInstructions = !!String(detail.instructions || "").trim()
  const jumpTo = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  async function handleDirectBuy() {
    if (me?.is_guest) { if (typeof onLoginRequired === 'function') onLoginRequired(); return }
    if (!canBuy || submitting) return
    setSubmitting(true)
    setOrderError(null)
    try {
      const result = await api.createOrder({
        product_id: detail.id,
        fields: { ...fields, __region__: region },
      })
      onBought(result)
    } catch (e) {
      setOrderError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 pb-28">
      {showShare && (
        <ShareProductModal
          shareLink={shareLink}
          productName={detail.name}
          onClose={() => setShowShare(false)}
        />
      )}

      <div className="card bg-gradient-to-br from-accent/10 to-accent2/10 p-4 mb-4 border-accent/20">
        <div className="flex gap-3 items-center mb-3">
          {detail.icon_url ? (
            <OptimizedImage src={`${storeAssetUrl(detail.icon_url)}?v=${cacheBust}`} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" eager />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-card flex items-center justify-center text-3xl flex-shrink-0">
              <Gamepad2 className="h-8 w-8 text-white/60" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/50 mb-0.5">{stripEmoji(detail.game)}</p>
            <h2 className="text-xl font-bold leading-tight truncate">{detail.name}</h2>
          </div>
          {/* Botón compartir destacado */}
          <button
            onClick={() => setShowShare(true)}
            aria-label="Compartir producto"
            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold active:scale-95 transition-all self-start"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(139,92,246,0.35)',
              color: '#a78bfa'
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Compartir</span>
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-accent">${detail.price.toFixed(2)}</span>
          <span className="text-xs text-white/40">USDT</span>
        </div>
        {region && region !== '__standard__' && (
          <p className="text-xs text-white/60 mt-2">Región: {stripEmoji(region)}</p>
        )}
      </div>

      {detailFields.length > 0 && (
        <div className="space-y-3 mb-4">
          <p className="text-sm font-semibold text-white/70 inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" aria-hidden="true" />Datos requeridos</p>
          {detailFields.map((f) => {
            const key = f.field_name || f.name
            return (
              <div key={key}>
                <label className="text-xs text-white/50 block mb-1">{f.name}</label>
                {f.is_select && f.values?.length > 0 ? (
                  <select
                    value={fields[key] || ''}
                    onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                    className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent">
                    <option value="">Selecciona...</option>
                    {f.values.map((v) => (
                      <option key={v.serverId} value={v.serverId}>
                        {v.serverName || v.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder={f.tip || `Ingresa ${f.name}`}
                    value={fields[key] || ''}
                    onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                    className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {(hasDescription || hasInstructions) && (
        <div className="mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {hasDescription && (
              <button onClick={() => jumpTo(descriptionRef)} className="rounded-lg border border-white/10 bg-card px-3 py-2 text-xs font-semibold text-white/75 active:scale-95">Descripción</button>
            )}
            {hasInstructions && (
              <button onClick={() => jumpTo(instructionsRef)} className="rounded-lg border border-white/10 bg-card px-3 py-2 text-xs font-semibold text-white/75 active:scale-95">Cómo usar</button>
            )}
          </div>

          {hasDescription && (
            <section ref={descriptionRef} className="scroll-mt-20 rounded-xl border border-white/10 bg-card p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-accent" />Descripción</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/70"><Linkify>{detail.description}</Linkify></p>
            </section>
          )}

          {hasInstructions && (
            <section ref={instructionsRef} className="scroll-mt-20 rounded-xl border border-white/10 bg-card p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-yellow-300" />Cómo usar</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/65"><Linkify>{detail.instructions}</Linkify></p>
            </section>
          )}
        </div>
      )}

      <div className="card p-3 mb-4 text-sm">
        <div className="flex justify-between"><span className="text-white/50">Tu saldo:</span><span>${me.balance.toFixed(2)} USDT</span></div>
        <div className="flex justify-between">
          <span className="text-white/50">Después:</span>
          <span className={me.balance >= detail.price ? '' : 'text-red-400'}>
            ${(me.balance - detail.price).toFixed(2)} USDT
          </span>
        </div>
      </div>

      {!me?.is_guest && me.balance < detail.price && (
        <div className="card mb-4 border-yellow-500/20 bg-yellow-500/10 p-3 text-center">
          <p className="text-sm font-semibold text-yellow-300 inline-flex items-center justify-center gap-1">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />Saldo insuficiente
          </p>
          <p className="mt-1 text-xs text-white/60">Las recargas de saldo se hacen desde el bot de Telegram.</p>
          <button onClick={openTelegramTopUp} className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white active:scale-95">
            <span className="inline-flex items-center justify-center gap-2"><Send className="h-4 w-4" aria-hidden="true" />Recargar en Telegram</span>
          </button>
        </div>
      )}

      {orderError && <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-300">{orderError}</p>}

      <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-lg border-t border-white/10 bg-bg/95 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl shadow-black/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={onCancel}
            className="h-12 w-12 flex-shrink-0 rounded-xl border border-red-400/30 bg-red-500/15 text-lg font-bold text-red-200 active:scale-95">
            X
          </button>
          <button
            onClick={() => setShowShare(true)}
            aria-label="Compartir"
            className="h-12 w-12 flex-shrink-0 rounded-xl active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
              border: '1px solid rgba(139,92,246,0.4)'
            }}
          >
            <Share2 className="h-5 w-5 mx-auto text-violet-400" />
          </button>
          <button disabled={me?.is_guest ? false : !canBuy} onClick={handleDirectBuy}
            className="min-w-0 flex-1 rounded-xl bg-gradient-to-r from-accent to-accent2 px-3 py-3 font-bold active:scale-95 disabled:opacity-50">
            {submitting ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Procesando...</span> : <span className="inline-flex items-center justify-center gap-2"><ShoppingCart className="h-5 w-5" />Comprar por ${Number(detail.price).toFixed(2)} USDT</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmScreen({ product, region, me, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const { detail, fields } = product

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      // IMPORTANTE: enviar __region__ para que el backend auto-complete server
      const payload = {
        product_id: detail.id,
        fields: { ...fields, __region__: region },
      }
      const result = await api.createOrder(payload)
      onSuccess(result)
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="px-2.5 py-4 md:p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ClipboardList className="h-5 w-5" aria-hidden="true" />Confirmar compra</h2>
      <div className="card p-4 space-y-3">
        <div>
          <p className="text-xs text-white/50">Producto</p>
          <p className="font-semibold">{detail.name}</p>
        </div>
        {region && region !== '__standard__' && (
          <div>
            <p className="text-xs text-white/50">Región</p>
            <p className="font-semibold">{stripEmoji(region)}</p>
          </div>
        )}
        {Object.entries(fields).map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-white/50">{k}</p>
            <p className="font-mono text-sm">{v}</p>
          </div>
        ))}
        <div className="border-t border-white/10 pt-3">
          <p className="text-xs text-white/50">Total</p>
          <p className="text-3xl font-bold text-accent">${detail.price.toFixed(2)} <span className="text-sm text-white/40">USDT</span></p>
        </div>
      </div>

      <p className="text-xs text-yellow-500/80 my-4 text-center">
        <span className="inline-flex items-center justify-center gap-1"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Las recargas son irreversibles. Verifica tus datos.</span>
      </p>

      {error && <p className="text-red-400 text-center text-sm mb-3">{error}</p>}

      <button disabled={submitting} onClick={handleConfirm} className="btn-primary">
        {submitting ? 'Procesando...' : <span className="inline-flex items-center justify-center gap-2"><Check className="h-5 w-5" aria-hidden="true" />Confirmar (${detail.price.toFixed(2)} USDT)</span>}
      </button>
    </div>
  )
}

function ResultScreen({ result, onHome }) {
  const [current, setCurrent] = useState(result || {})
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    const orderId = result?.order_id || result?.id
    if (!orderId) {
      setPolling(false)
      return undefined
    }
    let stopped = false
    let attempts = 0
    const loadOrder = async () => {
      attempts += 1
      try {
        const orders = await api.myOrders()
        const found = (orders || []).find((o) => String(o.id) === String(orderId))
        if (found && !stopped) {
          setCurrent((prev) => ({ ...prev, ...found, order_id: found.id, status_text: found.status }))
          if (['completed', 'failed', 'partial'].includes(found.status) || attempts >= 40) {
            setPolling(false)
            return true
          }
        }
      } catch (_) {
        if (attempts >= 40 && !stopped) setPolling(false)
      }
      return false
    }
    loadOrder()
    const timer = setInterval(async () => {
      const done = await loadOrder()
      if (done) clearInterval(timer)
    }, 3000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [result?.order_id, result?.id])

  const statusText = current.status_text || current.status || 'processing'
  const isOk = current.status === 2 || statusText === 'completed'
  const isFailed = current.status === 3 || current.status === 4 || ['failed', 'partial'].includes(statusText)
  const details = formatRechargeDetails(current.recharge_details)
  const rawDate = current.created_at
  const date = rawDate ? new Date(Number(rawDate) > 9999999999 ? Number(rawDate) : Number(rawDate) * 1000).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div className="p-4 text-center">
      <div className="mx-auto mt-6 mb-4 flex justify-center"><CatalogLogo compact /></div>
      <div className="mb-5 flex justify-center">
        {isOk ? <CircleCheck className="h-16 w-16 text-green-400" aria-hidden="true" /> : isFailed ? <CircleX className="h-16 w-16 text-red-300" aria-hidden="true" /> : <Loader2 className="h-16 w-16 animate-spin text-yellow-400" aria-hidden="true" />}
      </div>
      <h2 className="mb-2 text-2xl font-black">
        {isOk ? 'Recarga completada exitosamente' : isFailed ? 'La recarga no pudo completarse' : 'Pedido creado, esperando confirmación'}
      </h2>
      <p className="mb-4 text-sm text-white/65">
        {isOk ? 'El proveedor confirmó la entrega del producto.' : isFailed ? 'No se pudo completar la recarga. Revisa el pedido o contacta soporte.' : polling ? 'Estamos actualizando el estado automáticamente.' : 'El proveedor sigue procesando la recarga. Puedes revisar el estado en tus pedidos.'}
      </p>
      <div className="card mb-6 p-4 text-left text-sm">
        <p className="mb-3 text-base font-bold leading-tight">{current.product || 'Producto automático'}</p>
        <div className="grid gap-2 text-xs text-white/70">
          <p><span className="text-white/40">Orden:</span> <code>{current.order_id || current.id}</code></p>
          <p><span className="text-white/40">Estado:</span> {statusText}</p>
          {date && <p><span className="text-white/40">Creada:</span> {date}</p>}
          {current.price !== undefined && <p><span className="text-white/40">Total:</span> ${Number(current.price || 0).toFixed(2)} USDT</p>}
          {details.map((item, index) => <p key={index}><span className="text-white/40">{item.label}:</span> {item.value}</p>)}
          {isFailed && current.error && <p className="rounded-lg bg-red-500/10 p-2 text-red-200"><span className="text-red-100/70">Detalle:</span> {current.error}</p>}
        </div>
      </div>
      <button onClick={onHome} className="btn-primary"><span className="inline-flex items-center justify-center gap-2"><LabelIcon icon={Home} />Volver al inicio</span></button>
    </div>
  )
}


// ════════════════════════════════════════════════════════
//  PANTALLAS DE AUTENTICACIÓN WEB
// ════════════════════════════════════════════════════════

function AuthWrapper({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-5">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl shadow-black/30">
          <div className="relative min-h-[260px] bg-[#101820]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/72 to-black/20" />
            <div className="relative flex min-h-[260px] flex-col justify-between p-5">
              <div className="flex items-center justify-between gap-3">
                <CatalogLogo compact />
                <span className="rounded-full border border-green-400/25 bg-green-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-green-200">Página oficial</span>
              </div>
              <div>
                <h1 className="text-3xl font-black leading-tight text-white">Francho Shop</h1>
                <p className="mt-2 text-sm leading-relaxed text-white/70">Recargas de juegos, gift cards, suscripciones y productos digitales para Cuba y el mundo.</p>
                {subtitle && <p className="mt-2 text-xs font-semibold text-accent">{subtitle}</p>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 border-t border-white/10 p-2 text-center text-[10px] font-semibold text-white/60">
            <span className="rounded bg-white/5 py-2">Pedidos registrados</span>
            <span className="rounded bg-white/5 py-2">Saldo USDT</span>
            <span className="rounded bg-white/5 py-2">Soporte oficial</span>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-1 text-xl font-black">{title}</h2>
          <p className="mb-4 text-xs leading-relaxed text-white/45">Accede a tu cuenta para comprar, revisar pedidos, recibir entregas y mantener tu historial protegido.</p>
          {children}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/55">
          <a href="/guias" className="rounded-xl border border-white/10 bg-card p-3 text-center font-semibold active:scale-95">Guías de compra</a>
          <button onClick={() => openExternalUrl(WHATSAPP_SUPPORT_URL)} className="rounded-xl border border-white/10 bg-card p-3 text-center font-semibold active:scale-95">Soporte WhatsApp</button>
        </div>
        <div className="mt-4 space-y-1 text-center text-[10px] text-white/30">
          <p>Usa siempre los canales oficiales de Francho Shop.</p>
          <p>© 2026 Francho Shop · Recargas gamer y productos digitales</p>
        </div>
      </div>
    </div>
  )
}

function PasswordInput({ placeholder, value, onChange, onKeyDown }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative mb-3">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 pr-12 outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 active:text-white/70 text-lg p-1"
      >
        {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  )
}

function LoginScreen({ onSuccess, onRegister, onForgot }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  async function handleLogin(e) {
    e?.preventDefault()
    setLoading(true); setErr(null)
    try {
      const data = await api.login(email, password)
      const me = await api.me()
      onSuccess(me)
    } catch (e) { setErr(e.message); setLoading(false) }
  }

  return (
    <AuthWrapper title="Iniciar sesión" subtitle="Recargas oficiales de juegos y gift cards">
      {err && <p className="text-red-400 text-sm mb-3 card p-2 text-center">{err}</p>}
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none focus:border-accent" />
      <PasswordInput placeholder="Contraseña" value={password}
        onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
      <button onClick={handleLogin} disabled={loading || !email || !password}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2 active:scale-95 transition disabled:opacity-50">
        <>{loading ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Entrando...</span> : <span className="inline-flex items-center justify-center gap-2"><LockKeyhole className="h-4 w-4" />Entrar</span>}</>
      </button>
      <div className="flex justify-between mt-4 text-sm">
        <button onClick={onForgot} className="text-accent">¿Olvidaste la contraseña?</button>
        <button onClick={onRegister} className="text-accent2">Crear cuenta</button>
      </div>
      {api.isTelegram() && (
        <p className="text-[10px] text-white/30 text-center mt-6">
          Abierto desde Telegram — la sesión debería ser automática
        </p>
      )}
    </AuthWrapper>
  )
}

function RegisterScreen({ onSuccess, onLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)

  async function handleRegister() {
    if (password !== password2) { setErr('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setErr('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true); setErr(null)
    try {
      await api.register(email, password, name)
      setDone(true)
    } catch (e) { setErr(e.message); setLoading(false) }
  }

  if (done) return (
    <AuthWrapper title={<span className="inline-flex items-center gap-2"><Mail className="h-5 w-5" />Revisa tu email</span>}>
      <div className="card p-4 text-center">
        <Inbox className="mx-auto mb-3 h-10 w-10 text-accent" aria-hidden="true" />
        <p className="text-sm text-white/70 mb-4">
          Enviamos un código de verificación a <b>{email}</b>
        </p>
        <button onClick={() => onSuccess(email)}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2">
          Verificar email
        </button>
      </div>
      <button onClick={onLogin} className="text-accent text-sm mt-4 block mx-auto">
        Volver al login
      </button>
    </AuthWrapper>
  )

  return (
    <AuthWrapper title="Crear cuenta">
      {err && <p className="text-red-400 text-sm mb-3 card p-2 text-center">{err}</p>}
      <input type="text" placeholder="Tu nombre" value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none focus:border-accent" />
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none focus:border-accent" />
      <PasswordInput placeholder="Contraseña (mín. 8 caracteres)" value={password}
        onChange={e => setPassword(e.target.value)} />
      <PasswordInput placeholder="Repetir contraseña" value={password2}
        onChange={e => setPassword2(e.target.value)} />
      <button onClick={handleRegister} disabled={loading || !email || !password}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2 active:scale-95 transition disabled:opacity-50">
        <>{loading ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creando...</span> : <span className="inline-flex items-center justify-center gap-2"><Edit3 className="h-4 w-4" />Crear cuenta</span>}</>
      </button>
      <button onClick={onLogin} className="text-accent text-sm mt-4 block mx-auto">
        Ya tengo cuenta — Iniciar sesión
      </button>
    </AuthWrapper>
  )
}

function ForgotScreen({ onCodeSent, onLogin }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    setLoading(true)
    try {
      await api.forgotPassword(email)
      setSent(true)
    } catch { setSent(true) } // siempre decir "enviado" por seguridad
  }

  if (sent) return (
    <AuthWrapper title={<span className="inline-flex items-center gap-2"><Mail className="h-5 w-5" />Revisa tu email</span>}>
      <div className="card p-4 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-accent" aria-hidden="true" />
        <p className="text-sm text-white/70 mb-4">
          Si existe una cuenta con <b>{email}</b>, recibirás un código para cambiar la contraseña.
        </p>
        <button onClick={onCodeSent}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2">
          Tengo el código
        </button>
      </div>
      <button onClick={onLogin} className="text-accent text-sm mt-4 block mx-auto">
        Volver al login
      </button>
    </AuthWrapper>
  )

  return (
    <AuthWrapper title="Recuperar contraseña">
      <p className="text-sm text-white/60 mb-4">Ingresa tu email y te enviaremos un código.</p>
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-4 outline-none focus:border-accent" />
      <button onClick={handleSend} disabled={loading || !email}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2 disabled:opacity-50">
        <>{loading ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Enviando...</span> : <span className="inline-flex items-center justify-center gap-2"><Mail className="h-4 w-4" />Enviar código</span>}</>
      </button>
      <button onClick={onLogin} className="text-accent text-sm mt-4 block mx-auto">
        Volver al login
      </button>
    </AuthWrapper>
  )
}

function VerifyScreen({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  async function handleVerify() {
    setLoading(true); setErr(null)
    try {
      await api.verifyEmail(email, code)
      onSuccess()
    } catch (e) { setErr(e.message); setLoading(false) }
  }

  return (
    <AuthWrapper title="Verificar email">
      {err && <p className="text-red-400 text-sm mb-3 card p-2 text-center">{err}</p>}
      <p className="text-sm text-white/60 mb-4">Ingresa el código de 6 dígitos que te enviamos.</p>
      <input type="email" placeholder="Tu email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none focus:border-accent" />
      <input type="text" placeholder="Código de 6 dígitos" value={code} maxLength={6}
        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-4 outline-none focus:border-accent text-center text-2xl tracking-widest font-mono" />
      <button onClick={handleVerify} disabled={loading || !email || code.length < 6}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2 disabled:opacity-50">
        <>{loading ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Verificando...</span> : <span className="inline-flex items-center justify-center gap-2"><Check className="h-4 w-4" />Verificar</span>}</>
      </button>
    </AuthWrapper>
  )
}

function ResetScreen({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)

  async function handleReset() {
    if (password.length < 8) { setErr('Mínimo 8 caracteres'); return }
    setLoading(true); setErr(null)
    try {
      await api.resetPassword(email, code, password)
      setDone(true)
    } catch (e) { setErr(e.message); setLoading(false) }
  }

  if (done) return (
    <AuthWrapper title={<span className="inline-flex items-center gap-2"><CircleCheck className="h-5 w-5 text-green-400" />Contraseña actualizada</span>}>
      <div className="card p-4 text-center">
        <LockKeyhole className="mx-auto mb-3 h-10 w-10 text-accent" aria-hidden="true" />
        <p className="text-sm text-white/70 mb-4">Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <button onClick={onSuccess}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2">
          Ir al login
        </button>
      </div>
    </AuthWrapper>
  )

  return (
    <AuthWrapper title="Nueva contraseña">
      {err && <p className="text-red-400 text-sm mb-3 card p-2 text-center">{err}</p>}
      <input type="email" placeholder="Tu email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none focus:border-accent" />
      <input type="text" placeholder="Código de 6 dígitos" value={code} maxLength={6}
        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 mb-3 outline-none focus:border-accent text-center text-xl tracking-widest font-mono" />
      <PasswordInput placeholder="Nueva contraseña (mín. 8)" value={password}
        onChange={e => setPassword(e.target.value)} />
      <button onClick={handleReset} disabled={loading || !email || code.length < 6 || !password}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-accent to-accent2 disabled:opacity-50">
        <>{loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <span className="inline-flex items-center justify-center gap-2"><Lock className="h-4 w-4" />Cambiar contraseña</span>}</>
      </button>
    </AuthWrapper>
  )
}


function ErrorView({ msg }) {
  const isInTelegram = !!(tg && tg.platform && tg.platform !== 'unknown')
  return (
    <div className="p-8 text-center">
      <BigIcon icon={AlertTriangle} className="mx-auto mb-4 text-yellow-400" />
      <p className="text-red-400 font-semibold whitespace-pre-line">{msg}</p>
      {isInTelegram ? (
        <div className="mt-4">
          <p className="text-white/50 text-xs mb-3">
            Cierra esta ventana y usa el botón "Shop" al lado del campo de texto del bot.
          </p>
          <button onClick={() => window.Telegram?.WebApp?.close?.()} className="card px-6 py-3 text-accent font-semibold active:scale-95">
            ✕ Cerrar
          </button>
        </div>
      ) : (
        <button onClick={() => location.reload()} className="card px-6 py-3 mt-6 text-accent font-semibold active:scale-95">
          <span className="inline-flex items-center justify-center gap-2"><LabelIcon icon={RefreshCcw} />Reintentar</span>
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════
//   PANTALLAS DE INFORMACIÓN LEGAL
// ════════════════════════════════════════

function HelpScreen({ onNav }) {
  return (
    <div className="px-2.5 py-4 md:p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><BookOpen className="h-6 w-6" aria-hidden="true" />¿Cómo funciona?</h2>

      <Section title={<span className="inline-flex items-center gap-2"><WalletCards className="h-4 w-4" />1. Recarga tu saldo</span>}>
        <p>Antes de comprar necesitas tener saldo en tu cuenta. Recarga desde el bot
        de Telegram con USDT (criptomoneda) usando OxaPay. Mínimo $1 USDT.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><Gamepad2 className="h-4 w-4" />2. Elige producto</span>}>
        <p>Selecciona un juego o gift card del catálogo. Filtra por región si aplica
        (Free Fire, Mobile Legends, Arena Breakout suelen tener regiones).</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" />3. Llena tus datos</span>}>
        <p>Para juegos: ingresa tu <b>Player ID</b> y selecciona el <b>servidor</b>.
        Para gift cards: solo necesitas elegir la denominación.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><Check className="h-4 w-4" />4. Confirma</span>}>
        <p>Verifica todo dos veces. Las recargas son <b>instantáneas e irreversibles</b>.
        Toca "Comprar" — el saldo se descuenta automáticamente.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><Package className="h-4 w-4" />5. Recibe el producto</span>}>
        <p><b>Recargas a juego:</b> llegan directo a tu cuenta en el juego en menos
        de 60 segundos.</p>
        <p className="mt-2"><b>Gift Cards:</b> recibes el código de canje en pantalla
        y también te llega por el bot de Telegram. Cópialo y úsalo en la app oficial
        (Apple, Google Play, Steam, etc).</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><CircleHelp className="h-4 w-4" />¿Problemas?</span>}>
        <p>Si la recarga no llega en 5 minutos o el código no funciona, contacta al
        soporte por WhatsApp. Tenemos auto-reembolso por fallos técnicos.</p>
      </Section>

      <button onClick={() => onNav?.('faq')} className="btn-ghost mt-4">
        <span className="inline-flex items-center justify-center gap-2"><CircleHelp className="h-5 w-5" />Ver preguntas frecuentes</span>
      </button>
    </div>
  )
}



function PartnerHelpScreen({ me, onTopUp }) {
  const [selectedId, setSelectedId] = useState(null)
  const role = me?.role || 'user'
  const isAdmin = role === 'admin'
  const minDeposit = Number(me?.reseller_min_deposit || 50)
  const remaining = Number(me?.reseller_deposit_remaining || 0)
  const discountActive = !!me?.reseller_discount_active

  const sections = [
    {
      id: 'seller-start',
      audience: 'seller',
      title: 'Cómo crear un producto',
      subtitle: 'Nombre, precio, categoría, imagen, campos y visibilidad.',
      icon: Package,
      goal: 'Crear un producto claro, vendible y fácil de entregar sin confundir al cliente.',
      when: [
        'Cuando vas a vender un curso, cuenta, licencia, archivo, servicio o acceso digital.',
        'Cuando necesitas que el producto salga en el catálogo como parte de Francho Shop.',
        'Cuando quieres dejar listo el flujo antes de recibir pedidos reales.',
      ],
      steps: [
        'Entra a Perfil y abre Panel Vendedor o Panel Admin.',
        'Toca Productos y luego Crear producto.',
        'Escribe un nombre corto y directo. Ejemplo: Canva Pro 30 días, Curso Marketing PDF o Licencia Office 2021.',
        'En descripción explica qué recibe el cliente, cuánto dura, condiciones y qué no incluye. Evita promesas ambiguas.',
        'Elige categoría: Servicio, Cuenta, Código, Suscripción u Otro. Esto ayuda a ordenar y entender el catálogo.',
        'Define precio en USDT. Si agregas opciones, el sistema usará el menor precio activo como precio visible principal.',
        'Configura stock: -1 ilimitado, 0 sin stock, o un número fijo si quieres limitar ventas.',
        'Sube una imagen clara del producto. La imagen debe ayudar a reconocer lo que se vende.',
        'Elige el tipo de entrega correcto antes de activar el producto.',
        'Guarda el producto y revisa cómo se ve desde el catálogo antes de vender mucho.',
      ],
      examples: [
        'Producto simple: Curso PDF, precio 10 USDT, entrega automática por archivo.',
        'Producto con variantes: Canva Pro con opciones 7 días, 30 días y 90 días.',
        'Producto con datos del cliente: Recarga o servicio donde pides email, usuario o ID.',
      ],
      mistakes: [
        'Poner una descripción muy corta y luego tener que explicar todo por soporte.',
        'Usar entrega manual para algo que podía entregarse automático.',
        'Activar el producto sin stock digital cargado cuando cada cliente necesita un código distinto.',
      ],
    },
    {
      id: 'seller-manual',
      audience: 'seller',
      title: 'Entrega manual',
      subtitle: 'Para servicios o pedidos que necesitan revisión humana.',
      icon: Wrench,
      goal: 'Usar entrega manual solo cuando una persona debe preparar, revisar o personalizar la entrega.',
      when: [
        'Servicios personalizados.',
        'Recargas externas que requieren confirmar datos.',
        'Cuentas que se crean después del pago.',
        'Pedidos donde necesitas hablar con el cliente antes de entregar.',
      ],
      steps: [
        'Al crear el producto, selecciona entrega manual.',
        'Agrega instrucciones para que el cliente sepa qué dato debe enviar o cuánto tarda la entrega.',
        'Si necesitas datos, crea campos obligatorios como email, usuario de Telegram, ID de jugador o nota del cliente.',
        'Cuando entre un pedido, ve a Pedidos y filtra por pendientes.',
        'Abre el pedido, revisa datos del cliente y prepara la entrega.',
        'Toca Entregar, escribe el contenido o adjunta archivo si aplica.',
        'Agrega una nota interna si hubo una condición especial.',
        'El sistema marca el pedido como completado y guarda la entrega para auditoría.',
      ],
      examples: [
        'Configuración de bot, diseño personalizado, activación manual o recarga que requiere revisión.',
        'Una cuenta que debes crear con datos específicos del cliente.',
      ],
      mistakes: [
        'No poner tiempo estimado de entrega.',
        'No pedir los datos necesarios al cliente desde el formulario.',
        'Entregar sin dejar nota cuando hubo una corrección especial.',
      ],
    },
    {
      id: 'seller-auto-text',
      audience: 'seller',
      title: 'Entrega automática por texto',
      subtitle: 'Todos los clientes reciben el mismo texto, link o instrucciones.',
      icon: MessageCircle,
      goal: 'Automatizar productos donde la entrega es igual para todos los compradores.',
      when: [
        'Links a grupos, instrucciones generales o claves compartidas.',
        'Accesos donde no importa que todos reciban el mismo texto.',
        'Cursos alojados en un link común.',
      ],
      steps: [
        'Selecciona Automática: texto en el tipo de entrega.',
        'Escribe el mensaje exacto que recibirá el cliente después de pagar.',
        'Incluye pasos de uso: dónde entrar, cómo descargar, cómo reclamar soporte.',
        'No pongas información que deba cambiar por cliente.',
        'Guarda y prueba con una compra pequeña para confirmar que el mensaje llega bien.',
      ],
      examples: [
        'Link de grupo privado con instrucciones de acceso.',
        'Texto con pasos para descargar un curso desde una plataforma externa.',
      ],
      mistakes: [
        'Usar texto automático para licencias únicas. Para eso usa stock digital único.',
        'Escribir un mensaje incompleto que obliga al cliente a pedir ayuda.',
      ],
    },
    {
      id: 'seller-auto-file',
      audience: 'seller',
      title: 'Entrega automática por archivo',
      subtitle: 'PDF, TXT, imagen, ZIP o RAR entregado después del pago.',
      icon: FileText,
      goal: 'Vender productos descargables que son iguales para todos los clientes.',
      when: [
        'Cursos en PDF.',
        'Plantillas, recursos, imágenes o paquetes comprimidos.',
        'Instrucciones en TXT o documentos descargables.',
      ],
      steps: [
        'Selecciona Automática: archivo.',
        'Sube el archivo correcto desde el editor del producto.',
        'Usa nombres claros para tus archivos, por ejemplo curso-basico.pdf o plantillas.zip.',
        'En descripción indica qué contiene el archivo y si necesita contraseña o app específica.',
        'Guarda el producto y verifica que el archivo quedó cargado.',
        'Haz una compra de prueba si el archivo es importante o pesado.',
      ],
      examples: [
        'Curso PDF, paquete ZIP de recursos, imagen personalizada ya preparada o guía en TXT.',
      ],
      mistakes: [
        'Subir el archivo equivocado y activar el producto sin probar.',
        'Usar archivo automático si cada cliente debe recibir un archivo diferente.',
      ],
    },
    {
      id: 'seller-stock',
      audience: 'seller',
      title: 'Stock digital único',
      subtitle: 'Códigos, cuentas, licencias o links que se entregan una sola vez.',
      icon: KeyRound,
      goal: 'Evitar que dos clientes reciban el mismo código, cuenta, licencia o link privado.',
      when: [
        'Licencias únicas.',
        'Cuentas usuario:clave.',
        'Códigos de regalo o cupones únicos.',
        'Links privados diferentes para cada cliente.',
      ],
      steps: [
        'Crea el producto y selecciona Stock digital único.',
        'Guarda el producto primero. El bloque de stock aparece después de guardar.',
        'Elige el tipo de stock: código/licencia, cuenta, link privado o texto.',
        'Pega un item por línea. Puedes usar solo el contenido o el formato Etiqueta | Contenido.',
        'Si el producto tiene opciones, elige si el stock será para todas las opciones o para una opción específica.',
        'Importa el stock y revisa los contadores: disponible, usado y total.',
        'Cuando el cliente compra, el sistema toma un item disponible, lo marca usado y lo entrega automáticamente.',
      ],
      examples: [
        'ABC-123-XYZ',
        'Cuenta 1 | correo1@example.com:clave123',
        'Licencia Pro | XXXX-YYYY-ZZZZ',
      ],
      mistakes: [
        'Cargar varias cuentas en una sola línea.',
        'No separar stocks por opción cuando cada plan usa códigos distintos.',
        'Quedarse sin stock y no revisar el contador antes de promocionar.',
      ],
    },
    {
      id: 'seller-options',
      audience: 'seller',
      title: 'Opciones y campos del cliente',
      subtitle: 'Variantes de precio y datos que el comprador debe llenar.',
      icon: ClipboardList,
      goal: 'Hacer que un producto tenga variantes claras y pedir solo los datos necesarios.',
      when: [
        'Un mismo producto tiene duraciones, planes o cantidades diferentes.',
        'Necesitas email, usuario, teléfono, ID de juego o país del cliente.',
        'Quieres evitar mensajes manuales después de la compra.',
      ],
      steps: [
        'Usa opciones para variantes como 7 días, 30 días, Básico, Premium o 1 pantalla.',
        'Cada opción puede tener precio y stock propio.',
        'Usa campos del cliente solo si realmente necesitas ese dato para entregar.',
        'Pon nombres de campo claros: Email de acceso, Usuario Telegram, ID de jugador.',
        'Si la entrega es automática y no necesitas datos, no agregues campos.',
      ],
      examples: [
        'Canva Pro: 7 días, 30 días, 90 días.',
        'Curso: Básico y Premium.',
        'Servicio manual: Usuario Telegram y descripción del trabajo.',
      ],
      mistakes: [
        'Pedir demasiados datos y hacer lenta la compra.',
        'No crear opciones y terminar con muchos productos repetidos.',
      ],
    },
    {
      id: 'seller-orders',
      audience: 'seller',
      title: 'Pedidos, cambios y auditoría',
      subtitle: 'Entregar, reenviar, cambiar, revocar, cancelar o reembolsar.',
      icon: ShieldCheck,
      goal: 'Mantener control de cada venta y dejar historial claro de lo que pasó.',
      when: [
        'Cuando un cliente no recibió la entrega.',
        'Cuando necesitas corregir una clave, cuenta o archivo.',
        'Cuando corresponde cancelar o devolver saldo.',
      ],
      steps: [
        'Entra a Pedidos y usa filtros por estado, cliente, vendedor o fecha.',
        'Abre el detalle para ver datos del cliente, producto, precio y estado.',
        'Usa Reenviar si la entrega era correcta pero el cliente no la encuentra.',
        'Usa Cambiar si la entrega anterior tenía error o debe actualizarse.',
        'Usa Revocar cuando esa entrega ya no debe ser válida.',
        'Usa Cancelar para pedidos pendientes que no se van a entregar.',
        'Usa Reembolsar cuando el pedido ya fue procesado pero hay que devolver saldo.',
        'Escribe notas claras. Todo queda guardado en auditoría.',
      ],
      examples: [
        'Cliente borró el mensaje: reenviar.',
        'Clave incorrecta: cambiar entrega y explicar en nota.',
        'Fraude o devolución: revocar y reembolsar según corresponda.',
      ],
      mistakes: [
        'Cambiar una entrega sin nota.',
        'Reembolsar sin revisar si ya se entregó algo útil al cliente.',
      ],
    },
    {
      id: 'reseller-activate',
      audience: 'reseller',
      title: 'Activar precios preferenciales',
      subtitle: `Depósito mínimo requerido: $${minDeposit.toFixed(2)} USDT.`,
      icon: WalletCards,
      goal: 'Entender cuándo se activa el precio de revendedor y por qué puede no aparecer todavía.',
      when: [
        'Cuando ya fuiste aprobado como revendedor.',
        'Cuando ves precios normales aunque tu rol diga Revendedor.',
        'Cuando quieres empezar a comprar con margen para revender.',
      ],
      steps: [
        `Deposita al menos $${minDeposit.toFixed(2)} USDT en total.`,
        'El sistema cuenta depósitos pagados, no facturas pendientes.',
        'Cuando el total depositado llega al mínimo, el catálogo empieza a mostrar precios preferenciales.',
        'No importa si después gastas el saldo: lo que se revisa es el total depositado histórico.',
        'Si todavía falta, el perfil muestra cuánto debes depositar para activar el beneficio.',
      ],
      examples: [
        discountActive ? 'Tu precio preferencial ya está activo.' : `Ahora mismo faltan $${remaining.toFixed(2)} USDT para activar precios preferenciales.`,
        'Si depositas 30 USDT y luego 20 USDT, llegas a 50 USDT total y se activa.',
      ],
      mistakes: [
        'Pensar que el rol revendedor solo ya activa el descuento.',
        'Crear una factura y no pagarla. Solo cuentan depósitos pagados.',
      ],
    },
    {
      id: 'reseller-buy',
      audience: 'reseller',
      title: 'Cómo comprar para revender',
      subtitle: 'Elegir producto, revisar datos y confirmar sin errores.',
      icon: ShoppingCart,
      goal: 'Comprar productos para tus clientes finales sin perder dinero por datos incorrectos.',
      when: [
        'Cuando un cliente te paga por fuera y tú compras dentro del sistema.',
        'Cuando necesitas hacer recargas o comprar códigos con precio preferencial.',
      ],
      steps: [
        'Confirma primero el pago de tu cliente final por tu canal externo.',
        'Entra al catálogo y selecciona juego, región y producto correcto.',
        'Revisa si el producto pide Player ID, servidor, email u otro dato.',
        'Copia los datos exactamente como te los dio el cliente. Si hay duda, confirma antes de comprar.',
        'Verifica precio, región y datos antes de tocar Comprar.',
        'Después de comprar, revisa Mis pedidos para ver estado, código o resultado.',
        'Entrega al cliente final solo la información necesaria, sin mostrar datos internos de tu cuenta.',
      ],
      examples: [
        'Recarga de juego: confirma ID y servidor antes de pagar.',
        'Gift card: copia el código desde Mis pedidos y envíalo al cliente final.',
      ],
      mistakes: [
        'Comprar con región equivocada.',
        'No revisar el ID del jugador.',
        'Vender sin calcular tu margen entre precio preferencial y precio final.',
      ],
    },
    {
      id: 'reseller-business',
      audience: 'reseller',
      title: 'Buenas prácticas para revender',
      subtitle: 'Márgenes, soporte y control de pedidos.',
      icon: BriefcaseBusiness,
      goal: 'Revender con orden, margen claro y menos problemas de soporte.',
      when: [
        'Cuando vendes por WhatsApp, Telegram, redes o una comunidad propia.',
        'Cuando manejas varios clientes y necesitas controlar ganancias.',
      ],
      steps: [
        'Define tu precio final antes de publicar. Tu ganancia es precio final menos precio del sistema.',
        'Guarda comprobante de pago de tu cliente antes de comprar.',
        'Pide datos completos en un formato fijo para evitar errores.',
        'No prometas tiempos exactos si dependen de proveedor externo.',
        'Revisa Mis pedidos antes de responder a reclamos.',
        'Si algo falla, contacta soporte con ID de pedido y explicación clara.',
      ],
      examples: [
        'Plantilla para pedir datos: Juego, región, Player ID, servidor, producto y comprobante.',
        'Control simple: anota precio cobrado, precio pagado y ganancia por pedido.',
      ],
      mistakes: [
        'No guardar comprobantes.',
        'Responder al cliente sin revisar el estado real del pedido.',
        'Vender productos sin entender si son instantáneos, manuales o códigos.',
      ],
    },
  ]

  const visibleSections = sections.filter((section) => {
    if (isAdmin) return true
    if (section.audience === 'seller') return role === 'seller'
    if (section.audience === 'reseller') return role === 'reseller'
    return true
  })
  const selected = visibleSections.find((section) => section.id === selectedId)

  if (selected) {
    const Icon = selected.icon
    return (
      <div className="p-4">
        <button onClick={() => setSelectedId(null)} className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/75 active:scale-95">
          <ArrowLeft className="h-4 w-4" />Volver a secciones
        </button>
        <div className="card mb-4 border-accent/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent/15 p-2"><Icon className="h-5 w-5 text-accent" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">{selected.title}</h2>
              <p className="mt-1 text-sm text-white/55">{selected.subtitle}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/70">{selected.goal}</p>
        </div>

        <PartnerHelpBlock title="Cuándo usarlo" icon={Info} items={selected.when} />
        <PartnerHelpBlock title="Paso a paso" icon={Check} items={selected.steps} ordered />
        <PartnerHelpBlock title="Ejemplos" icon={Sparkles} items={selected.examples} />
        <PartnerHelpBlock title="Errores comunes" icon={AlertTriangle} items={selected.mistakes} tone="warning" />
      </div>
    )
  }

  return (
    <div className="px-2.5 py-4 md:p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6 text-accent" />Ayuda para vender</h2>
        <p className="mt-1 text-sm text-white/50">
          {role === 'reseller' ? 'Aprende a comprar con precio preferencial y revender con control.' : role === 'seller' ? 'Aprende a crear productos, entregar pedidos y mantener todo auditable.' : 'Vista completa de ayuda para vendedores y revendedores.'}
        </p>
      </div>

      {role === 'reseller' && (
        <div className={`card mb-4 p-4 border ${discountActive ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
          <div className="flex items-start gap-3">
            {discountActive ? <CircleCheck className="mt-0.5 h-5 w-5 text-green-400" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-300" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{discountActive ? 'Precio preferencial activo' : 'Falta depósito mínimo'}</p>
              <p className="mt-1 text-sm text-white/60">
                {discountActive ? `Ya superaste el mínimo de $${minDeposit.toFixed(2)} USDT.` : `Deposita $${remaining.toFixed(2)} USDT más para activar precios preferenciales.`}
              </p>
              {!discountActive && <button onClick={onTopUp} className="mt-3 rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent"><span className="inline-flex items-center gap-1"><WalletCards className="h-4 w-4" />Depositar ahora</span></button>}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visibleSections.map((section) => {
          const Icon = section.icon
          return (
            <button key={section.id} onClick={() => setSelectedId(section.id)} className="card w-full p-4 text-left active:scale-[0.99]">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-accent/15 p-2"><Icon className="h-5 w-5 text-accent" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{section.title}</p>
                  <p className="mt-1 text-sm text-white/55">{section.subtitle}</p>
                  <p className="mt-2 text-xs text-white/35">Tocar para ver explicación completa</p>
                </div>
                <span className="text-lg text-white/25">›</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PartnerHelpBlock({ title, icon: Icon, items, ordered = false, tone = 'default' }) {
  const ListTag = ordered ? 'ol' : 'ul'
  return (
    <div className={`card mb-3 p-4 ${tone === 'warning' ? 'border-yellow-500/20' : ''}`}>
      <p className="mb-3 flex items-center gap-2 font-semibold"><Icon className={`h-4 w-4 ${tone === 'warning' ? 'text-yellow-300' : 'text-accent'}`} />{title}</p>
      <ListTag className={`space-y-2 text-sm text-white/68 ${ordered ? 'list-decimal pl-5' : ''}`}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className={ordered ? '' : 'flex gap-2'}>
            {!ordered && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />}
            <span>{item}</span>
          </li>
        ))}
      </ListTag>
    </div>
  )
}

function openExternalUrl(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function GuidesScreen({ onOpenGuide, onHome }) {
  return (
    <main className="p-4">
      <section className="rounded-2xl border border-accent/20 bg-card p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black leading-tight">Guías de recargas, juegos y productos digitales</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/65">Aprende cómo recargar tus juegos favoritos, comprar gift cards, usar saldo en Francho Shop y solicitar productos digitales desde Cuba o cualquier país.</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-white/70">En esta sección encontrarás guías rápidas y fáciles para comprar recargas de juegos, diamantes, monedas, gift cards, suscripciones y productos digitales usando Francho Shop.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button onClick={onHome} className="btn-primary flex-1"><span className="inline-flex items-center justify-center gap-2"><ShoppingCart className="h-5 w-5" />Comprar ahora</span></button>
          <button onClick={() => openExternalUrl(WHATSAPP_SUPPORT_URL)} className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white/80"><span className="inline-flex items-center justify-center gap-2"><MessageCircle className="h-5 w-5" />Contactar soporte</span></button>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        {GUIDE_ARTICLES.map(article => (
          <button key={article.slug} onClick={() => onOpenGuide(article.slug)} className="card p-4 text-left active:scale-[0.99]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg text-accent"><Gamepad2 className="h-5 w-5" /></div>
              <ChevronRight className="h-5 w-5 text-white/30" />
            </div>
            <h2 className="text-base font-bold leading-snug">{article.cardTitle}</h2>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/50">{article.description}</p>
          </button>
        ))}
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-yellow-300" />También podrás aprender</h2>
        <div className="grid gap-2 text-sm text-white/65 sm:grid-cols-2">
          {['Cómo comprar gift cards en Cuba', 'Cómo recargar Mobile Legends', 'Cómo recargar Blood Strike', 'Cómo recargar juegos con USDT'].map(item => (
            <div key={item} className="rounded-lg bg-bg p-3">{item}</div>
          ))}
        </div>
      </section>
    </main>
  )
}

function GuideArticleScreen({ slug, onOpenGuide, onHome }) {
  const article = GUIDE_BY_SLUG[slug] || GUIDE_ARTICLES[0]
  const related = GUIDE_ARTICLES.filter(item => item.slug !== article.slug)
  return (
    <main className="p-4">
      <article className="mx-auto max-w-3xl">
        <button onClick={() => onOpenGuide('')} className="mb-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/70 active:scale-95"><ArrowLeft className="h-4 w-4" />Guías</button>
        <header className="rounded-2xl border border-accent/20 bg-card p-5">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent"><Globe2 className="h-4 w-4" />Centro de ayuda Francho Shop</p>
          <h1 className="text-2xl font-black leading-tight md:text-3xl">{article.h1}</h1>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/70">
            {article.intro.map((text, index) => <p key={index}>{text}</p>)}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button onClick={onHome} className="btn-primary flex-1"><span className="inline-flex items-center justify-center gap-2"><ShoppingCart className="h-5 w-5" />{article.cta || 'Comprar ahora'}</span></button>
            <button onClick={() => openExternalUrl(WHATSAPP_SUPPORT_URL)} className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white/80"><span className="inline-flex items-center justify-center gap-2"><MessageCircle className="h-5 w-5" />Contactar soporte</span></button>
          </div>
        </header>

        <div className="mt-4 space-y-4">
          {article.sections.map(section => (
            <section key={section.title} className="card p-4">
              <h2 className="mb-3 text-xl font-bold">{section.title}</h2>
              {section.text && <p className="text-sm leading-relaxed text-white/70">{section.text}</p>}
              {section.list && <ul className="space-y-2 text-sm text-white/70">{section.list.map(item => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-300" />{item}</li>)}</ul>}
              {section.steps && <ol className="space-y-2 text-sm text-white/70">{section.steps.map((item, index) => <li key={item} className="flex gap-2"><span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{index + 1}</span><span className="pt-0.5">{item}</span></li>)}</ol>}
            </section>
          ))}
        </div>

        <section className="mt-4 card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><CircleHelp className="h-5 w-5 text-accent" />Preguntas frecuentes</h2>
          <div className="space-y-2">
            {article.faq.map(([q, a]) => (
              <div key={q} className="rounded-lg bg-bg p-3">
                <h3 className="font-semibold">{q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 card p-4">
          <h2 className="mb-3 text-lg font-bold">Otras guías útiles</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {related.map(item => <button key={item.slug} onClick={() => onOpenGuide(item.slug)} className="rounded-lg bg-bg p-3 text-left text-sm font-semibold text-white/75 active:scale-[0.99]">{item.cardTitle}</button>)}
          </div>
        </section>
      </article>
    </main>
  )
}

function ContactScreen() {
  return (
    <div className="px-2.5 py-4 md:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold"><MessageCircle className="h-6 w-6" aria-hidden="true" />Contacto oficial</h2>

      <Section title={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Canales oficiales</span>}>
        <p>En Francho Shop queremos que cada cliente tenga una forma clara y segura de comunicarse con nosotros.</p>
        <p className="mt-2">Desde nuestros canales oficiales podrás recibir ayuda, consultar dudas sobre pedidos, conocer novedades, promociones, productos disponibles y actualizaciones importantes de la plataforma.</p>
      </Section>

      <div className="space-y-3">
        <div className="card p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-green-300">
              <Phone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold">WhatsApp de soporte</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/65">Si tienes dudas sobre un pedido, saldo, recarga, producto digital o necesitas ayuda con tu cuenta, puedes escribirnos directamente por WhatsApp.</p>
            </div>
          </div>
          <button onClick={() => openExternalUrl(WHATSAPP_SUPPORT_URL)} className="btn-primary w-full">
            <span className="inline-flex items-center justify-center gap-2"><MessageCircle className="h-5 w-5" />Escribir por WhatsApp</span>
          </button>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Send className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold">Canal oficial de WhatsApp</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/65">Únete a nuestro canal oficial para recibir noticias, avisos, promociones, productos nuevos y actualizaciones importantes de Francho Shop.</p>
            </div>
          </div>
          <button onClick={() => openExternalUrl(WHATSAPP_CHANNEL_URL)} className="btn-primary w-full">
            <span className="inline-flex items-center justify-center gap-2"><ExternalLink className="h-5 w-5" />Unirme al canal de WhatsApp</span>
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100/85">
        <p className="inline-flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />Usa siempre nuestros canales oficiales para evitar estafas, enlaces falsos o confusiones.</p>
      </div>

      <div className="mt-6 space-y-1 text-center text-[10px] text-white/30">
        <p>Francho Shop · Recargas de juegos · Gift cards · Suscripciones · Productos digitales</p>
        <p>Soporte y canal oficial de WhatsApp</p>
        <p>© 2026 Francho Shop · Hecho con dedicación para Cuba y el mundo</p>
      </div>
    </div>
  )
}


function FaqScreen() {
  const faqs = [
    {
      q: "¿Cuánto tarda la recarga?",
      a: "Recargas a juegos: 10-60 segundos. Gift cards: instantáneo (al recibir el código)."
    },
    {
      q: "¿Las recargas son oficiales?",
      a: "Sí, 100%. Trabajamos con distribuidores autorizados, así que los productos llegan a tu cuenta exactamente igual que si los compraras en la tienda oficial del juego."
    },
    {
      q: "¿Qué pasa si meto mal mi Player ID?",
      a: "Las recargas se envían al ID que pongas. Si lo escribes mal, el proveedor lo enviará a esa cuenta y NO hay reembolso. Verifica TRES veces antes de confirmar."
    },
    {
      q: "¿Cómo recibo las gift cards?",
      a: "Apple, Google Play, Steam y similares: recibes el código en pantalla al instante + por el bot de Telegram. Cópialo y canjéalo en la app oficial. Los códigos no expiran (excepto Spotify Premium que sí tiene fecha)."
    },
    {
      q: "¿Por qué hay diferentes regiones?",
      a: "Cada juego tiene servidores separados (Asia, Europa, América, etc.). El precio puede variar entre regiones. ASEGÚRATE de elegir tu región correcta — no se pueden transferir entre servidores."
    },
    {
      q: "¿Qué pasa si la recarga falla?",
      a: "Si hay un error técnico al procesar tu orden, el saldo se REEMBOLSA AUTOMÁTICAMENTE a tu billetera Francho Shop. Verás el reembolso en tu historial."
    },
    {
      q: "¿Puedo pedir factura?",
      a: "Esto es un servicio personal de revendedor, no emitimos facturas formales. El historial de tu cuenta sirve como comprobante."
    },
    {
      q: "¿Son seguros mis datos?",
      a: "Solo pedimos tu Player ID (no tu contraseña). Nunca pediríamos credenciales de tu cuenta de juego — si alguien te las pide, es estafa."
    },
    {
      q: "¿Cómo puedo ser revendedor?",
      a: "Desde el bot, toca 'Ser revendedor'. Llena el formulario con tu negocio. Los revendedores aprobados tienen precios con descuento."
    },
    {
      q: "¿Aceptan otras monedas además de USDT?",
      a: "Por ahora solo USDT (Tether) vía OxaPay. Estamos preparando soporte para CUP (Cuba) y otras opciones."
    },
  ]

  return (
    <div className="px-2.5 py-4 md:p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><CircleHelp className="h-6 w-6" aria-hidden="true" />Preguntas Frecuentes</h2>
      <div className="space-y-2">
        {faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
      </div>
      <p className="text-xs text-white/40 text-center mt-6">
        ¿No encuentras tu respuesta?<br />
        Escríbenos por WhatsApp
      </p>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card p-3">
      <button onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">{q}</span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <p className="text-sm text-white/70 mt-2 pt-2 border-t border-white/10">{a}</p>
      )}
    </div>
  )
}

function TermsScreen() {
  return (
    <div className="px-2.5 py-4 md:p-6">
      <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><FileText className="h-6 w-6" aria-hidden="true" />Términos y condiciones</h2>
      <p className="text-xs text-white/40 mb-4">Última actualización: 2026</p>

      <Section title={<span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Descargo de responsabilidad</span>}>
        <p>Francho Shop es una plataforma de <b>recargas oficiales</b> para juegos
        y servicios digitales. Trabajamos con distribuidores autorizados para
        garantizar que tus recargas lleguen directo a tu cuenta oficial.</p>
        <p className="mt-2">Las marcas mencionadas (juegos, gift cards, etc.) son
        propiedad de sus respectivos dueños. Francho Shop opera como un servicio
        independiente de venta autorizada.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><Ban className="h-4 w-4" />Sin reembolso por error del usuario</span>}>
        <p>Las recargas son <b>INSTANTÁNEAS e IRREVERSIBLES</b>. Una vez confirmada
        la compra:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>NO hay reembolso si pones el Player ID equivocado</li>
          <li>NO hay reembolso si eliges la región/servidor incorrecto</li>
          <li>NO hay reembolso si compras el producto equivocado</li>
        </ul>
        <p className="mt-2">Es <b>tu responsabilidad</b> verificar todos los datos
        antes de confirmar.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Reembolso por fallo técnico</span>}>
        <p>Si la orden falla por un error técnico al procesarse, el saldo se
        reembolsa <b>automáticamente</b> a tu billetera Francho Shop sin necesidad
        de reclamarlo.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4" />Privacidad de datos</span>}>
        <p>Solo recopilamos:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Tu ID de Telegram (para autenticarte)</li>
          <li>Tu nombre y username de Telegram</li>
          <li>El historial de tus compras</li>
          <li>El Player ID que ingreses al comprar</li>
        </ul>
        <p className="mt-2">No vendemos ni compartimos tus datos con terceros.
        Los Player IDs se usan SOLO para procesar tu orden.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Uso prohibido</span>}>
        <p>Está prohibido usar Francho Shop para:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Lavado de dinero o actividades ilegales</li>
          <li>Comprar para cuentas hackeadas</li>
          <li>Fraude o uso de tarjetas robadas (todos los pagos son en USDT trazable)</li>
          <li>Revender los productos a precio especulativo sin ser revendedor aprobado</li>
        </ul>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><Wrench className="h-4 w-4" />Modificaciones del servicio</span>}>
        <p>Nos reservamos el derecho de modificar precios, productos disponibles
        y términos en cualquier momento. Los cambios aplican desde su publicación.</p>
      </Section>

      <Section title={<span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />Contacto</span>}>
        <p>Para soporte, reclamos o consultas: contacta al admin desde el bot de
        Telegram desde el menú principal.</p>
      </Section>

      <p className="text-xs text-white/40 text-center mt-6 pb-4">
        Al usar Francho Shop aceptas estos términos.
      </p>
    </div>
  )
}


function TopUpModal({ onClose, onPaid }) {
  const [amount, setAmount] = useState('10')
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [err, setErr] = useState(null)
  const [status, setStatus] = useState(null)
  const selectedAmount = Number(String(amount).replace(',', '.'))
  const payLabel = selectedAmount > 0 ? `Recargar ${selectedAmount.toFixed(2)} USDT` : 'Recargar'

  async function createInvoice(value = amount) {
    const numeric = Number(String(value).replace(',', '.'))
    if (!numeric || numeric <= 0) { setErr('Escribe un monto válido'); return }
    setLoading(true); setErr(null); setStatus(null)
    try {
      const inv = await api.createDeposit(numeric)
      setInvoice(inv)
      try { tg?.openLink?.(inv.pay_link) } catch {}
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  async function checkPayment() {
    if (!invoice?.track_id) return
    setChecking(true); setErr(null)
    try {
      const res = await api.checkDeposit(invoice.track_id)
      setStatus(res.status)
      if (res.status === 'paid') onPaid?.(res.balance)
    } catch (e) { setErr(e.message) }
    setChecking(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-t-3xl bg-bg p-5 animate-slide-up">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Recargar saldo</h3>
            <p className="mt-1 text-xs text-white/50">Paga con USDT vía OxaPay. En la página de pago puedes elegir red y moneda disponible.</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-white/60">x</button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {DEPOSIT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => { setAmount(String(preset)); setInvoice(null); setStatus(null); setErr(null) }}
              className={`rounded-lg border px-3 py-3 text-sm font-bold active:scale-95 ${Number(amount) === preset ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 bg-card'}`}
            >
              ${preset}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-xs font-semibold text-white/50">Monto personalizado</label>
        <div className="mb-3 flex gap-2">
          <input
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setInvoice(null); setStatus(null); setErr(null) }}
            inputMode="decimal"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-card px-3 py-3 text-sm outline-none focus:border-accent"
            placeholder="10"
          />
          <button
            onClick={() => createInvoice()}
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
          >
            {loading ? 'Creando...' : payLabel}
          </button>
        </div>

        {err && <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}

        {invoice && (
          <div className="rounded-xl border border-white/10 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-white/50">Factura OxaPay</p>
                <p className="text-lg font-bold">${Number(invoice.amount).toFixed(2)} USDT</p>
              </div>
              <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-bold text-yellow-300">
                {status || invoice.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => tg?.openLink?.(invoice.pay_link) || window.open(invoice.pay_link, '_blank')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-3 text-sm font-bold"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir pago
              </button>
              <button
                onClick={checkPayment}
                disabled={checking}
                className="rounded-lg bg-accent/20 px-3 py-3 text-sm font-bold text-accent disabled:opacity-60"
              >
                {checking ? 'Verificando...' : 'Ya pagué'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════



function getAccountImages(product) {
  const images = Array.isArray(product?.account_images) ? product.account_images : []
  const all = [...images, product?.icon_url].filter(Boolean)
  return [...new Set(all)]
}

function AccountImageGallery({ product }) {
  if (product.category !== 'game_account') return null
  const images = getAccountImages(product)
  const [selected, setSelected] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const current = images[selected] || images[0]
  if (!images.length) return null
  const move = (delta) => setSelected((selected + delta + images.length) % images.length)
  return (
    <div className="mb-4">
      <button onClick={() => setViewerOpen(true)} className="block w-full overflow-hidden rounded-xl border border-white/10 bg-card active:scale-[0.995]">
        <div className="relative aspect-video bg-black/30">
          <OptimizedImage src={current} className="h-full w-full object-cover" alt={product.name} eager />
          <div className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white/80">{selected + 1}/{images.length}</div>
        </div>
      </button>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((url, index) => (
            <button key={url} onClick={() => setSelected(index)} className={(index === selected ? 'border-accent' : 'border-white/10') + ' h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border'}>
              <OptimizedImage src={url} className="h-full w-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
      {viewerOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 p-3">
          <div className="mb-3 flex items-center justify-between gap-3 text-white">
            <p className="truncate text-sm font-bold">{product.name}</p>
            <button onClick={() => setViewerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <OptimizedImage src={current} className="max-h-full max-w-full object-contain" alt={product.name} eager />
            {images.length > 1 && <button onClick={() => move(-1)} className="absolute left-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><ArrowLeft className="h-5 w-5" /></button>}
            {images.length > 1 && <button onClick={() => move(1)} className="absolute right-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><ChevronRight className="h-5 w-5" /></button>}
          </div>
          {images.length > 1 && <p className="mt-3 text-center text-xs text-white/55">{selected + 1} de {images.length}</p>}
        </div>
      )}
    </div>
  )
}

function AccountDetailsPanel({ product }) {
  if (product.category !== 'game_account') return null
  const details = [
    ['Juego', product.account_game],
    ['Plataforma', product.account_platform],
    ['Región', product.account_region],
    ['Nivel', product.account_level],
    ['Rango', product.account_rank],
    ['Moneda disponible', product.account_currency],
    ['Método de acceso', product.account_access_method],
    ['Estado', product.account_status === 'sold' ? 'Vendida' : product.account_status === 'inactive' ? 'Inactiva' : 'Disponible'],
    ['Garantía', product.account_warranty],
  ].filter(([, value]) => String(value || '').trim())
  return (
    <div className="mb-4 space-y-3">
      <div className="card border-accent/20 p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold"><User className="h-4 w-4 text-accent" />Información de la cuenta</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {details.map(([label, value]) => <div key={label} className="rounded-lg bg-bg p-2"><p className="text-white/35">{label}</p><p className="mt-0.5 font-semibold text-white/80">{value}</p></div>)}
        </div>
        {product.account_items && <div className="mt-2 rounded-lg bg-bg p-2 text-xs"><p className="text-white/35">Skins o artículos importantes</p><p className="mt-1 whitespace-pre-line text-white/75">{product.account_items}</p></div>}
      </div>
      <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs leading-relaxed text-yellow-100/85">
        <p className="font-bold">Instrucciones de compra:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Revisa todos los detalles de la cuenta.</li><li>Verifica juego, región, nivel, rango y método de acceso.</li><li>Confirma que la cuenta cumple con lo que necesitas.</li><li>Realiza la compra usando tu saldo disponible.</li><li>El pedido quedará pendiente de entrega manual.</li><li>El administrador enviará los datos de acceso cuando el pedido sea revisado.</li><li>Después de recibir la cuenta, revisa el acceso lo antes posible.</li>
        </ol>
      </div>
    </div>
  )
}

function ManualBuyModal({ product, onClose, onBought, buyResult, me, onLoginRequired }) {
  const activeOptions = (product.options || []).filter(o => o.stock !== 0)
  const activeFields = (product.fields || []).filter(f => f.is_required || f.is_active !== false)
  const [selectedOptionId, setSelectedOptionId] = useState(activeOptions[0]?.id || null)
  const [customerData, setCustomerData] = useState({})
  const [buying, setBuying] = useState(false)
  const [err, setErr] = useState(null)
  const descriptionRef = useRef(null)
  const instructionsRef = useRef(null)
  // Local cacheBust removed
  const reviewsRef = useRef(null)
  const selectedOption = activeOptions.find(o => o.id === selectedOptionId)
  const displayPrice = selectedOption ? selectedOption.price : product.price
  const shareLink = `${window.location.origin}${window.location.pathname}?manual_product=${product.id}`
  const [showShare, setShowShare] = useState(false)

  async function handleBuy() {
    if (buying) return
    if (me?.is_guest) { if (typeof onLoginRequired === 'function') onLoginRequired(); return }
    if (activeOptions.length > 0 && !selectedOptionId) { setErr('Selecciona una opción'); return }
    const missing = activeFields.find(f => f.is_required && !String(customerData[f.id] || '').trim())
    if (missing) { setErr(`Completa: ${missing.label}`); return }
    setBuying(true); setErr(null)
    try {
      const res = await api.buyManualProduct(product.id, selectedOptionId, customerData)
      onBought(res)
    } catch (e) { setErr(e.message); setBuying(false) }
  }

  const jumpTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Local cacheBust removed

  return (
    <div className="fixed inset-0 z-50 bg-bg flex justify-center">
      {showShare && (
        <ShareProductModal
          shareLink={shareLink}
          productName={product.name}
          onClose={() => setShowShare(false)}
        />
      )}
      <div className="relative h-screen w-full max-w-lg overflow-hidden bg-bg">
        {buyResult ? (
          <div className="flex h-full flex-col justify-center p-6 text-center">
            <CircleCheck className="mx-auto mb-4 h-12 w-12 text-green-400" aria-hidden="true" />
            <h3 className="text-xl font-bold mb-2">¡Pedido creado!</h3>
            <div className="card p-4 mb-4">
              <p className="text-sm font-semibold">{buyResult.product}</p>
              <p className="text-2xl font-bold text-accent mt-1">${buyResult.price?.toFixed(2)} USDT</p>
              <p className="text-xs text-white/50 mt-2">Pedido #{buyResult.order_id}</p>
            </div>
            <p className="text-sm text-white/60 mb-6">{buyResult.message}</p>
            <button onClick={onClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-accent2 font-bold active:scale-95">
              Entendido
            </button>
          </div>
        ) : (
          <>
            <div className="h-full overflow-y-auto pb-28">
              <div className="relative">
                {product.icon_url ? (
                  <div className="h-56 w-full bg-card">
                    <OptimizedImage src={`${product.icon_url}?v=${cacheBust}`} className="h-full w-full object-cover" alt={product.name} eager />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
                  </div>
                ) : (
                  <div className="h-40 w-full bg-gradient-to-br from-purple-500/20 to-accent/20 flex items-center justify-center">
                    <CategoryIcon category={product.category} className="h-14 w-14 text-white/70" />
                  </div>
                )}
                <button onClick={onClose}
                  className="absolute left-3 top-3 h-9 w-9 rounded-full bg-black/55 flex items-center justify-center text-white/80 active:scale-95">
                  ✕
                </button>
                <button
                  onClick={() => setShowShare(true)}
                  aria-label="Compartir producto"
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold active:scale-95 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.75), rgba(139,92,246,0.75))',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(139,92,246,0.5)',
                    color: '#e9d5ff'
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Compartir</span>
                </button>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold leading-tight">{product.name}</h3>
                  <p className="mt-2 text-xs text-white/50">
                    <span className="inline-flex items-center gap-1"><CategoryIcon category={product.category} className="h-3.5 w-3.5" />{categoryLabel(product.category)}</span> · {deliveryTypeLabel(product.delivery_type, product.category)}
                  </p>
                </div>

                <ProductTrustPanel product={product} />

                {product.seller_store && (
                  <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-bg">
                        {product.seller_store.store_image ? <OptimizedImage src={product.seller_store.store_image} className="h-full w-full object-cover" alt={product.seller_store.store_name || 'Tienda'} /> : <Store className="m-2.5 h-6 w-6 text-green-300" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-green-300">Vendido por:</p>
                        <p className="truncate text-sm font-bold">{product.seller_store.store_name}</p>
                      </div>
                      <button onClick={() => { window.location.href = `/seller/${encodeURIComponent(product.seller_store.store_slug)}` }} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/75">Ver tienda</button>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/60">Este producto es ofrecido por un vendedor verificado dentro de Francho Shop. La compra, el pago, el seguimiento y la entrega se realizan de forma segura desde nuestra plataforma.</p>
                    <div className="mt-3"><SellerTrustSummary seller={product.seller_store} compact /></div>
                  </div>
                )}

                <AccountImageGallery product={product} />
                <AccountDetailsPanel product={product} />

                {activeOptions.length > 0 && (
                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-semibold text-white/50">Selecciona una opción</label>
                    <select
                      value={selectedOptionId || ''}
                      onChange={(e) => { setSelectedOptionId(Number(e.target.value)); setErr(null) }}
                      className="w-full rounded-xl border border-white/10 bg-card px-3 py-3 text-sm font-semibold outline-none focus:border-accent"
                    >
                      {activeOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} - ${Number(opt.price).toFixed(2)} USDT{opt.stock >= 0 ? ` - Stock ${opt.stock}` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedOption && (
                      <div className="mt-2 rounded-lg border border-accent/15 bg-accent/10 p-3 text-xs text-white/65">
                        <p><span className="text-white/40">Opción:</span> <span className="font-semibold text-white/85">{selectedOption.name}</span></p>
                        <p className="mt-1"><span className="text-white/40">Precio:</span> <span className="font-bold text-accent">${Number(selectedOption.price || 0).toFixed(2)} USDT</span></p>
                        {selectedOption.stock >= 0 && <p className="mt-1"><span className="text-white/40">Stock:</span> {selectedOption.stock}</p>}
                      </div>
                    )}
                  </div>
                )}

                {activeFields.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold text-white/50">Datos para entregar tu pedido</p>
                    <div className="space-y-2">
                      {activeFields.map(field => (
                        <div key={field.id}>
                          <label className="mb-1 block text-xs text-white/50">
                            {field.label}{field.is_required ? ' *' : ''}
                          </label>
                          <input
                            value={customerData[field.id] || ''}
                            onChange={(e) => { setCustomerData(prev => ({ ...prev, [field.id]: e.target.value })); setErr(null) }}
                            type={field.field_type === 'number' ? 'number' : field.field_type === 'phone' ? 'tel' : 'text'}
                            inputMode={field.field_type === 'phone' ? 'tel' : field.field_type === 'number' ? 'decimal' : 'text'}
                            placeholder={field.placeholder || field.label}
                            className="w-full rounded-xl border border-white/10 bg-card px-3 py-3 text-sm outline-none focus:border-accent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="sticky top-0 z-10 mb-4 grid grid-cols-3 gap-2 bg-bg/95 py-2 backdrop-blur">
                  <button onClick={() => jumpTo(descriptionRef)} className="rounded-lg border border-white/10 bg-card px-2 py-2 text-xs font-semibold text-white/75 active:scale-95">Descripción</button>
                  <button onClick={() => jumpTo(instructionsRef)} className="rounded-lg border border-white/10 bg-card px-2 py-2 text-xs font-semibold text-white/75 active:scale-95">Instrucciones</button>
                  <button onClick={() => jumpTo(reviewsRef)} className="rounded-lg border border-white/10 bg-card px-2 py-2 text-xs font-semibold text-white/75 active:scale-95">Valoraciones</button>
                </div>

                <div ref={descriptionRef} className="scroll-mt-16 mb-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-accent" />Descripción</p>
                  <div className="card p-3">
                    {product.description ? (
                      <p className="text-sm text-white/70 whitespace-pre-line"><Linkify>{product.description}</Linkify></p>
                    ) : (
                      <p className="text-sm text-white/40">Este producto no tiene descripción adicional.</p>
                    )}
                  </div>
                </div>

                <div ref={instructionsRef} className="scroll-mt-16 mb-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-yellow-300" />Instrucciones</p>
                  <div className="card border-yellow-500/20 p-3">
                    {product.instructions ? (
                      <p className="text-sm text-white/60 whitespace-pre-line"><Linkify>{product.instructions}</Linkify></p>
                    ) : (
                      <p className="text-sm text-white/40">No hay instrucciones especiales para este producto.</p>
                    )}
                  </div>
                </div>

                {product.category === 'game_account' && (
                  <div className="mb-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-yellow-300" />Términos importantes</p>
                    <div className="card border-yellow-500/20 p-3 text-sm text-white/65">
                      <p className="whitespace-pre-line"><Linkify>{product.account_terms || `El cliente debe revisar cuidadosamente toda la información de la cuenta antes de comprar.

Una vez entregados correctamente los datos de acceso, no se aceptan reembolsos, salvo que la cuenta no funcione al momento de la entrega.

La garantía solo cubre problemas de acceso inicial durante el período indicado en el producto.

No se aceptan reclamaciones por cambios realizados por el cliente después de recibir la cuenta.

Algunos juegos pueden tener restricciones sobre la compra o venta de cuentas. El cliente acepta comprar bajo su responsabilidad.

Francho Shop no vende cuentas robadas, hackeadas, recuperadas, baneadas o con datos personales de terceros.`}</Linkify></p>
                    </div>
                  </div>
                )}

                <div ref={reviewsRef} className="scroll-mt-16 mb-6">
                  <PublicReviewsPanel manualProductId={product.id} />
                </div>

                {err && <p className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-300">{err}</p>}
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-lg border-t border-white/10 bg-bg/95 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl shadow-black/50 backdrop-blur">
              <div className="flex items-center gap-3">
                <button onClick={onClose}
                  className="h-12 w-12 flex-shrink-0 rounded-xl border border-red-400/30 bg-red-500/15 text-lg font-bold text-red-200 active:scale-95">
                  X
                </button>
                <button
                  onClick={() => setShowShare(true)}
                  aria-label="Compartir"
                  className="h-12 w-12 flex-shrink-0 rounded-xl active:scale-95 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
                    border: '1px solid rgba(139,92,246,0.4)'
                  }}
                >
                  <Share2 className="h-5 w-5 mx-auto text-violet-400" />
                </button>
                <button onClick={handleBuy} disabled={buying}
                  className="min-w-0 flex-1 rounded-xl bg-gradient-to-r from-accent to-accent2 px-3 py-3 font-bold active:scale-95 disabled:opacity-50">
                  <>{buying ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Procesando...</span> : <span className="inline-flex items-center justify-center gap-2"><ShoppingCart className="h-5 w-5" />Comprar por ${Number(displayPrice).toFixed(2)} USDT</span>}</>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  ADMIN — Productos manuales
// ════════════════════════════════════════════════════════


function personDisplay(data = {}, kind = 'customer') {
  const prefix = kind === 'seller' ? 'seller' : 'customer'
  const id = data[`${prefix}_id`] || (kind === 'customer' ? data.user_id : (data.seller_id || data.product_owner_id))
  const name = data[`${prefix}_name`] || data[`${prefix}_store_name`] || ''
  const username = data[`${prefix}_username`] || ''
  const email = data[`${prefix}_email`] || ''
  const store = data[`${prefix}_store_name`] || data.store_name || ''
  return { id, name, username, email, store }
}

function PersonInfoCard({ title, data, kind = 'customer' }) {
  const person = personDisplay(data, kind)
  return (
    <div className="card p-3">
      <p className="mb-2 flex items-center gap-1 text-xs font-bold text-white/45"><User className="h-3.5 w-3.5" />{title}</p>
      <p className="text-sm font-black">{person.store || person.name || 'Sin nombre'}</p>
      <div className="mt-1 space-y-0.5 text-xs text-white/55">
        {person.name && person.store && <p>Responsable: {person.name}</p>}
        <p>ID: <code>{person.id || '-'}</code></p>
        {person.username && <p>Telegram: @{person.username}</p>}
        {person.email && <p>Email: {person.email}</p>}
      </div>
    </div>
  )
}

function AccountSellerSalesPanel({ sales, onOpenOrder, title = 'Ventas de cuentas' }) {
  const items = sales?.items || []
  const summary = sales?.summary || {}
  return (
    <div className="card border-accent/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-4 w-4 text-accent" />{title}</p>
          <p className="mt-1 text-xs text-white/45">Registro auditable por pedido, vendedor, comisión, ganancia y caso de entrega.</p>
        </div>
        <span className="rounded-full bg-accent/15 px-2 py-1 text-xs font-bold text-accent">{summary.orders || items.length}</span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg bg-bg p-3"><p className="text-xs text-white/45">Vendido</p><p className="text-lg font-bold text-accent">${Number(summary.gross || 0).toFixed(2)}</p></div>
        <div className="rounded-lg bg-bg p-3"><p className="text-xs text-white/45">Comisión</p><p className="text-lg font-bold text-yellow-300">${Number(summary.platform_commission || 0).toFixed(2)}</p></div>
        <div className="rounded-lg bg-bg p-3"><p className="text-xs text-white/45">Ganancia vendedor</p><p className="text-lg font-bold text-green-300">${Number(summary.seller_earning || 0).toFixed(2)}</p></div>
        <div className="rounded-lg bg-bg p-3"><p className="text-xs text-white/45">Pendientes</p><p className="text-lg font-bold">{summary.pending || 0}</p></div>
      </div>
      <div className="space-y-2">
        {items.slice(0, 12).map((sale) => {
          const date = sale.created_at ? new Date(sale.created_at * 1000).toLocaleString('es-ES') : ''
          return (
            <button key={sale.order_id} onClick={() => onOpenOrder?.({ id: sale.order_id })} className="w-full rounded-lg border border-white/10 bg-bg p-3 text-left active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">#{sale.order_id} · {sale.product_name}</p>
                  <p className="text-xs text-white/45">{sale.store_name ? `Tienda: ${sale.store_name} · ` : ''}{sale.customer_name || sale.customer_username || 'Cliente'} #{sale.customer_id} · Caso {sale.case_id || sale.case_id_live || '-'}</p>
                  <p className="text-[11px] text-white/35">{date}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-black text-accent">${Number(sale.sale_price || 0).toFixed(2)}</p>
                  <p className={sale.status === 'completed' ? 'text-xs text-green-300' : sale.status === 'pending' ? 'text-xs text-yellow-300' : 'text-xs text-red-300'}>{sale.status}</p>
                </div>
              </div>
            </button>
          )
        })}
        {items.length === 0 && <p className="rounded-lg bg-bg p-4 text-center text-sm text-white/45">Todavía no hay ventas de cuentas registradas.</p>}
      </div>
    </div>
  )
}


function AccountStorePanel({ accountStore, onSave }) {
  const seller = accountStore?.seller
  const [draft, setDraft] = useState(() => ({
    store_name: seller?.store_name || '',
    store_slug: seller?.store_slug || '',
    store_description: seller?.store_description || '',
    store_image: storeAssetUrl(seller?.store_image || ''),
    banner_image: storeAssetUrl(seller?.banner_image || ''),
    whatsapp_url: seller?.whatsapp_url || '',
    social_url_1: seller?.social_url_1 || '',
    social_url_2: seller?.social_url_2 || '',
  }))
  useEffect(() => {
    setDraft({
      store_name: seller?.store_name || '',
      store_slug: seller?.store_slug || '',
      store_description: seller?.store_description || '',
      store_image: storeAssetUrl(seller?.store_image || ''),
      banner_image: storeAssetUrl(seller?.banner_image || ''),
      whatsapp_url: seller?.whatsapp_url || '',
      social_url_1: seller?.social_url_1 || '',
      social_url_2: seller?.social_url_2 || '',
    })
  }, [seller?.user_id, seller?.updated_at])
  const [uploadingStoreAsset, setUploadingStoreAsset] = useState('')
  async function uploadStoreAsset(kind, file) {
    if (!file) return
    if (!file.type?.startsWith('image/')) { alert('Selecciona una imagen válida'); return }
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede pasar de 5 MB'); return }
    setUploadingStoreAsset(kind)
    try {
      const uploadFile = await compressImageForUpload(file)
      const res = await api.uploadIcon(uploadFile)
      setDraft(d => ({ ...d, [kind]: res.url }))
    } catch (e) { alert(e.message) }
    setUploadingStoreAsset('')
  }
  if (!seller) return null
  const publicUrl = `${window.location.origin}/seller/${seller.store_slug || ''}`
  return (
    <div className="card border-green-500/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-green-300" />Mi tienda</p>
          <p className="mt-1 text-xs text-white/45">Perfil público de tienda dentro de Francho Shop.</p>
        </div>
        <span className={seller.status === 'active' ? 'text-xs text-green-300' : 'text-xs text-yellow-300'}>{seller.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={draft.store_name} onChange={e => setDraft(d => ({ ...d, store_name: e.target.value }))} placeholder="Nombre de tienda" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
        <input value={draft.store_slug} onChange={e => setDraft(d => ({ ...d, store_slug: e.target.value }))} placeholder="slug" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
        <div className="col-span-2 rounded-xl border border-white/10 bg-bg p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-card">
                {draft.store_image ? <img src={storeAssetUrl(draft.store_image)} className="h-full w-full object-cover" /> : <Store className="m-3 h-6 w-6 text-white/35" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Logo/avatar</p>
                <p className="text-xs text-white/40">Sube desde la galería o pega URL.</p>
              </div>
            </div>
            <label className="cursor-pointer rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/75 active:scale-95">
              {uploadingStoreAsset === 'store_image' ? 'Subiendo...' : 'Galería'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={!!uploadingStoreAsset} onChange={(e) => { uploadStoreAsset('store_image', e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          <input value={draft.store_image} onChange={e => setDraft(d => ({ ...d, store_image: e.target.value }))} placeholder="URL logo/avatar" className="w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
        </div>
        <div className="col-span-2 rounded-xl border border-white/10 bg-bg p-3">
          <div className="mb-2 overflow-hidden rounded-lg border border-white/10 bg-card">
            <div className="aspect-[3/1] bg-black/20">{draft.banner_image ? <img src={storeAssetUrl(draft.banner_image)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-white/35">Banner de tienda</div>}</div>
          </div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Banner</p>
              <p className="text-xs text-white/40">Imagen horizontal para la portada.</p>
            </div>
            <label className="cursor-pointer rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/75 active:scale-95">
              {uploadingStoreAsset === 'banner_image' ? 'Subiendo...' : 'Galería'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={!!uploadingStoreAsset} onChange={(e) => { uploadStoreAsset('banner_image', e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          <input value={draft.banner_image} onChange={e => setDraft(d => ({ ...d, banner_image: e.target.value }))} placeholder="URL banner" className="w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
        </div>
        <input value={draft.whatsapp_url} onChange={e => setDraft(d => ({ ...d, whatsapp_url: e.target.value }))} placeholder="WhatsApp opcional" className="col-span-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
        <input value={draft.social_url_1} onChange={e => setDraft(d => ({ ...d, social_url_1: e.target.value }))} placeholder="Enlace externo 1" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
        <input value={draft.social_url_2} onChange={e => setDraft(d => ({ ...d, social_url_2: e.target.value }))} placeholder="Enlace externo 2" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
        <textarea value={draft.store_description} onChange={e => setDraft(d => ({ ...d, store_description: e.target.value }))} rows={3} placeholder="Descripción de la tienda" className="col-span-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => onSave?.(draft)} className="flex-1 rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent"><span className="inline-flex items-center justify-center gap-1"><Save className="h-4 w-4" />Guardar tienda</span></button>
        <button onClick={() => copyText(publicUrl)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/75"><LinkIcon className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 truncate text-xs text-white/40">{publicUrl}</p>
    </div>
  )
}


function AccountSellerFinancePanel({ finance, onRefresh }) {
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  if (!finance) return null
  const wallet = finance.wallet || {}
  const settings = finance.settings || {}
  const summary = finance.summary || {}
  const withdrawals = finance.withdrawals || []
  const movements = finance.movements || []
  const money = (n) => `$${Number(n || 0).toFixed(2)}`
  async function requestWithdrawal() {
    const value = Number(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) { alert('Monto inválido'); return }
    setLoading(true)
    try {
      await api.requestSellerWithdrawal(value, address, note)
      setAmount(''); setAddress(''); setNote('')
      onRefresh?.()
    } catch (e) { alert(e.message) }
    setLoading(false)
  }
  const Metric = ({ label, value, tone = '' }) => (
    <div className="rounded-lg bg-bg p-3">
      <p className="text-xs text-white/45">{label}</p>
      <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
    </div>
  )
  return (
    <div className="card border-green-500/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold"><WalletCards className="h-4 w-4 text-green-300" />Finanzas de cuentas</p>
          <p className="mt-1 text-xs text-white/45">Comisiones, saldo retenido, saldo disponible y retiros USDT BEP20.</p>
        </div>
        <span className="rounded-full bg-green-500/15 px-2 py-1 text-xs font-bold text-green-300">{wallet.currency || 'USDT'} {wallet.network || 'BEP20'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Disponible" value={money(wallet.available_balance)} tone="text-green-300" />
        <Metric label="Retenido" value={money(wallet.held_balance)} tone="text-yellow-300" />
        <Metric label="En retiro" value={money(wallet.pending_withdrawal)} />
        <Metric label="Retirado" value={money(wallet.withdrawn_total)} />
        <Metric label="Vendido en cuentas" value={money(summary.gross)} tone="text-accent" />
        <Metric label="Comisión plataforma" value={money(summary.platform_commission)} tone="text-yellow-300" />
        <Metric label="Ganancia vendedor" value={money(summary.seller_earning)} tone="text-green-300" />
        <Metric label="Pedidos" value={summary.orders || 0} />
      </div>
      <div className="mt-3 rounded-lg border border-white/10 bg-bg p-3 text-xs text-white/50">
        Mínimo de retiro: <b className="text-white/75">{money(settings.min_withdrawal)}</b> · Fee: <b className="text-white/75">{money(settings.seller_withdraw_fee_usdt)}</b> · Retención manual: <b className="text-white/75">{Number(settings.seller_hold_days_manual || 0)} días</b>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="Monto USDT" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Wallet BEP20 0x..." className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent md:col-span-2" />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota opcional" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent md:col-span-2" />
        <button onClick={requestWithdrawal} disabled={loading || Number(wallet.available_balance || 0) <= 0} className="rounded-lg bg-green-500/15 px-3 py-2 text-sm font-bold text-green-300 disabled:opacity-50">{loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Solicitar retiro'}</button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-bg p-3">
          <p className="mb-2 text-sm font-semibold">Retiros recientes</p>
          {withdrawals.slice(0, 4).map(w => <p key={w.id} className="border-t border-white/5 py-2 text-xs text-white/50">#{w.id} · {w.status} · {money(w.amount)} · neto {money(w.net_amount)}</p>)}
          {withdrawals.length === 0 && <p className="text-xs text-white/40">No hay retiros todavía.</p>}
        </div>
        <div className="rounded-lg bg-bg p-3">
          <p className="mb-2 text-sm font-semibold">Movimientos recientes</p>
          {movements.slice(0, 4).map(m => <p key={m.id} className="border-t border-white/5 py-2 text-xs text-white/50">{m.status} · {money(m.amount)} · {m.movement_type}</p>)}
          {movements.length === 0 && <p className="text-xs text-white/40">No hay movimientos todavía.</p>}
        </div>
      </div>
    </div>
  )
}


function SellerDashboardPanel({ dashboard, onGoProducts, onGoOrders, onRefresh }) {
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawNote, setWithdrawNote] = useState('')
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false)
  if (!dashboard) {
    return <div className="card p-6 text-center text-white/50">No se pudo cargar el resumen.</div>
  }
  const summary = dashboard.summary || {}
  const wallet = dashboard.wallet || {}
  const Metric = ({ label, value, sub, icon: Icon, tone = 'default' }) => (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-white/45">{label}</p>
          <p className={`mt-1 text-xl font-bold ${tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-yellow-300' : tone === 'good' ? 'text-green-300' : ''}`}>{value}</p>
          {sub && <p className="mt-1 text-[11px] text-white/40">{sub}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 flex-shrink-0 text-white/35" />}
      </div>
    </div>
  )
  const money = (n) => `$${Number(n || 0).toFixed(2)}`
  const stockAlerts = dashboard.stock_alerts || []
  const pendingAlerts = dashboard.pending_alerts || []
  const topProducts = dashboard.top_products || []
  const recentPending = dashboard.recent_pending || []
  const withdrawals = dashboard.withdrawals || []

  async function requestWithdrawal() {
    const amount = Number(String(withdrawAmount).replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) { alert('Monto inválido'); return }
    setRequestingWithdrawal(true)
    try {
      await api.requestSellerWithdrawal(amount, withdrawAddress, withdrawNote)
      setWithdrawAmount(''); setWithdrawAddress(''); setWithdrawNote('')
      onRefresh?.()
    } catch (e) { alert(e.message) }
    setRequestingWithdrawal(false)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Ventas hoy" value={money(summary.today?.revenue)} sub={`${summary.today?.orders || 0} pedidos`} icon={DollarSign} tone="accent" />
        <Metric label="Ventas 7 días" value={money(summary.week?.revenue)} sub={`${summary.week?.orders || 0} pedidos`} icon={Clock} tone="good" />
        <Metric label="Ventas 30 días" value={money(summary.month?.revenue)} sub={`${summary.month?.orders || 0} pedidos`} icon={ClipboardList} />
        <Metric label="Pendientes" value={summary.pending_orders || 0} sub={`${summary.products_active || 0}/${summary.products_total || 0} productos activos`} icon={Inbox} tone={(summary.pending_orders || 0) > 0 ? 'warn' : 'default'} />
        <Metric label="Retenido" value={money(wallet.held_balance)} sub={`${wallet.currency || 'USDT'} ${wallet.network || 'BEP20'}`} icon={LockKeyhole} tone="warn" />
        <Metric label="Disponible" value={money(wallet.available_balance)} sub="USDT BEP20" icon={WalletCards} tone="good" />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-semibold"><WalletCards className="h-4 w-4 text-green-300" />Retiro USDT BEP20</p>
          <span className="text-xs text-white/40">Disponible {money(wallet.available_balance)}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} inputMode="decimal" placeholder="Monto USDT" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
          <input value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} placeholder="Wallet BEP20 0x..." className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent md:col-span-2" />
          <input value={withdrawNote} onChange={e => setWithdrawNote(e.target.value)} placeholder="Nota opcional" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent md:col-span-2" />
          <button onClick={requestWithdrawal} disabled={requestingWithdrawal || Number(wallet.available_balance || 0) <= 0} className="rounded-lg bg-green-500/15 px-3 py-2 text-sm font-bold text-green-300 disabled:opacity-50">{requestingWithdrawal ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Solicitar retiro'}</button>
        </div>
        {(withdrawals || []).slice(0, 3).map(w => <p key={w.id} className="mt-2 border-t border-white/5 pt-2 text-xs text-white/50">#{w.id} · {w.status} · ${Number(w.amount || 0).toFixed(2)} · neto ${Number(w.net_amount || 0).toFixed(2)}</p>)}
      </div>

      {(stockAlerts.length > 0 || pendingAlerts.length > 0) && (
        <div className="card border-yellow-500/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-semibold text-yellow-300"><AlertTriangle className="h-4 w-4" />Alertas</p>
            <span className="rounded-full bg-yellow-500/15 px-2 py-1 text-[10px] text-yellow-200">{stockAlerts.length + pendingAlerts.length}</span>
          </div>
          <div className="space-y-2">
            {stockAlerts.slice(0, 5).map((a, i) => (
              <button key={`stock-${i}`} onClick={onGoProducts} className="w-full rounded-lg bg-black/20 p-3 text-left active:scale-[0.99]">
                <p className="text-sm font-semibold">{a.name}</p>
                <p className={a.level === 'critical' ? 'text-xs text-red-300' : 'text-xs text-yellow-200'}>{a.message}</p>
              </button>
            ))}
            {pendingAlerts.slice(0, 5).map((a) => (
              <button key={`pending-${a.order_id}`} onClick={onGoOrders} className="w-full rounded-lg bg-black/20 p-3 text-left active:scale-[0.99]">
                <p className="text-sm font-semibold">Pedido #{a.order_id} · {a.product_name}</p>
                <p className="text-xs text-yellow-200">{a.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-accent" />Productos más vendidos</p>
          <button onClick={onGoProducts} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">Ver productos</button>
        </div>
        {topProducts.length === 0 ? (
          <p className="rounded-lg bg-black/20 p-3 text-sm text-white/45">Todavía no hay ventas completadas.</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((p, idx) => (
              <div key={p.product_id || idx} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{idx + 1}. {p.name}</p>
                  <p className="text-xs text-white/40">{p.orders} ventas</p>
                </div>
                <p className="text-sm font-bold text-accent">{money(p.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4 text-accent" />Pedidos pendientes recientes</p>
          <button onClick={onGoOrders} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">Ver pedidos</button>
        </div>
        {recentPending.length === 0 ? (
          <p className="rounded-lg bg-black/20 p-3 text-sm text-white/45">No hay pedidos pendientes.</p>
        ) : (
          <div className="space-y-2">
            {recentPending.map((o) => (
              <button key={o.id} onClick={onGoOrders} className="w-full rounded-lg bg-black/20 p-3 text-left active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">#{o.id} · {o.product_name}</p>
                    <p className="text-xs text-white/40">Cliente #{o.user_id} · {o.option_name || 'Sin opción'}</p>
                  </div>
                  <p className="text-sm font-bold text-accent">{money(o.price)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RechargeSellerPanel({ dashboard }) {
  if (!dashboard) return <div className="card p-8 text-center text-white/50">Cargando panel de recargas...</div>
  const sellerLink = `${window.location.origin}${window.location.pathname}?seller=${dashboard.seller_id}`
  const summary = dashboard.summary || {}
  const wallet = dashboard.wallet || {}
  const recent = dashboard.recent || []
  return (
    <div className="space-y-3">
      <div className={`card p-4 ${dashboard.enabled ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Panel de recargas</p>
            <p className="mt-1 text-xs text-white/50">Comparte tu enlace. Las recargas compradas desde ese enlace se guardan en tu panel y generan comisión sobre la ganancia.</p>
          </div>
          <span className={dashboard.enabled ? 'text-xs text-green-300' : 'text-xs text-yellow-300'}>{dashboard.enabled ? 'Activo' : 'No activo'}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <input readOnly value={sellerLink} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-bg px-3 py-2 text-xs text-white/70 outline-none" />
          <button onClick={() => copyText(sellerLink)} className="rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent"><span className="inline-flex items-center gap-1"><LinkIcon className="h-4 w-4" />Copiar</span></button>
        </div>
        <p className="mt-2 text-xs text-white/40">Comisión recargas: {Number(dashboard.commission_pct || 0).toFixed(1)}% de la ganancia.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="card p-3"><p className="text-xs text-white/45">Ventas</p><p className="text-xl font-bold">{summary.completed || 0}/{summary.orders || 0}</p></div>
        <div className="card p-3"><p className="text-xs text-white/45">Vendido</p><p className="text-xl font-bold text-accent">${Number(summary.revenue || 0).toFixed(2)}</p></div>
        <div className="card p-3"><p className="text-xs text-white/45">Ganancia</p><p className="text-xl font-bold text-green-300">${Number(summary.earned || 0).toFixed(2)}</p></div>
        <div className="card p-3"><p className="text-xs text-white/45">Disponible</p><p className="text-xl font-bold text-green-300">${Number(wallet.available_balance || 0).toFixed(2)}</p></div>
      </div>
      <div className="card p-4">
        <p className="mb-2 text-sm font-semibold">Últimas recargas</p>
        {recent.length === 0 ? <p className="text-sm text-white/45">Todavía no hay recargas atribuidas.</p> : recent.map(o => (
          <div key={o.merchant_order_id} className="border-t border-white/5 py-2 text-xs text-white/60">
            <p className="font-semibold text-white/75">{o.product_name}</p>
            <p>#{o.merchant_order_id} · ${Number(o.sell_price || 0).toFixed(2)} · Estado {o.order_status}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminProductsScreen({ onEdit, onOpenCase, externalTab, onTabChange }) {
  const [localTab, setLocalTab] = useState('dashboard')
  const tab = externalTab || localTab
  const setTab = onTabChange || setLocalTab
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [sellerDashboard, setSellerDashboard] = useState(null)
  const [rechargeDashboard, setRechargeDashboard] = useState(null)
  const [orderFilters, setOrderFilters] = useState({ status: '', q: '', user_id: '', seller_id: '', limit: '100' })
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null)
  const [pricing, setPricing] = useState([])
  const [resellerMinDeposit, setResellerMinDeposit] = useState('50')
  const [sellerPayoutSettings, setSellerPayoutSettings] = useState({
    seller_default_commission_pct: '10',
    seller_min_platform_fee: '0.10',
    seller_hold_days_manual: '7',
    seller_hold_days_auto: '2',
    seller_new_days: '30',
    seller_new_hold_days: '14',
    seller_withdraw_fee_usdt: '0.25',
  })
  const [savingSellerPayoutSettings, setSavingSellerPayoutSettings] = useState(false)
  const [savingResellerSettings, setSavingResellerSettings] = useState(false)
  const [sellers, setSellers] = useState([])
  const [accountSellers, setAccountSellers] = useState([])
  const [accountStore, setAccountStore] = useState(null)
  const [accountSales, setAccountSales] = useState({ items: [], summary: {} })
  const [accountFinance, setAccountFinance] = useState(null)
  const [newAccountSellerId, setNewAccountSellerId] = useState('')
  const [newAccountSellerName, setNewAccountSellerName] = useState('')
  const [newAccountSellerMax, setNewAccountSellerMax] = useState('10')
  const [newAccountSellerCommission, setNewAccountSellerCommission] = useState('10')
  const [savingAccountSeller, setSavingAccountSeller] = useState(false)
  const [audit, setAudit] = useState([])
  const [reviews, setReviews] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [oxaBalance, setOxaBalance] = useState(null)
  const [isAdminRole, setIsAdminRole] = useState(false)
  const [newSellerId, setNewSellerId] = useState('')
  const [newSellerStoreName, setNewSellerStoreName] = useState('')
  const [newSellerMax, setNewSellerMax] = useState('10')
  const [newSellerCommission, setNewSellerCommission] = useState('0')
  const [newSellerCanRecharges, setNewSellerCanRecharges] = useState(false)
  const [newSellerRechargeCommission, setNewSellerRechargeCommission] = useState('50')
  const [sellerDetail, setSellerDetail] = useState(null)
  const [sellerDraft, setSellerDraft] = useState(null)
  const [loadingSellerDetail, setLoadingSellerDetail] = useState(null)
  const [savingSeller, setSavingSeller] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [completing, setCompleting] = useState(null) // order being completed
  const [deliveryData, setDeliveryData] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [deliveryFile, setDeliveryFile] = useState(null)
  const [managingDelivery, setManagingDelivery] = useState(null)
  const [changeDeliveryData, setChangeDeliveryData] = useState('')
  const [changeDeliveryNote, setChangeDeliveryNote] = useState('')
  const [deliveryEvents, setDeliveryEvents] = useState([])
  const [deliveryActionLoading, setDeliveryActionLoading] = useState(false)
  const [savingPricing, setSavingPricing] = useState(null)
  const [savingGameVisual, setSavingGameVisual] = useState(null)
  const [selectedPricingGame, setSelectedPricingGame] = useState(null)
  const [refreshingBuffpin, setRefreshingBuffpin] = useState(false)
  const [restoreProductId, setRestoreProductId] = useState('')
  const [restoringProduct, setRestoringProduct] = useState(false)
  const [productFilter, setProductFilter] = useState('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const me = await api.profile().catch(() => null)
      const adminRole = me?.role === 'admin'
      setIsAdminRole(adminRole)
      const [dash, rd, p, o, gp, rs, sp, sl, asl, asales, afinance, st, rv, wd, ob, al] = await Promise.all([
        api.sellerDashboard().catch(() => null),
        api.sellerRechargeDashboard().catch(() => null),
        fetch('/api/admin/manual-products', { headers: authHeadersObj() }).then(r => r.json()).catch(() => []),
        api.adminManualOrders(orderFilters).catch(() => []),
        adminRole ? api.adminGamePricing().catch(() => []) : Promise.resolve([]),
        adminRole ? api.resellerSettings().catch(() => null) : Promise.resolve(null),
        adminRole ? api.sellerPayoutSettings().catch(() => null) : Promise.resolve(null),
        adminRole ? api.adminSellers().catch(() => []) : Promise.resolve([]),
        adminRole ? api.adminAccountSellers().catch(() => []) : Promise.resolve([]),
        api.accountSellerSales({ limit: 100 }).catch(() => ({ items: [], summary: {} })),
        !adminRole ? api.accountSellerFinance().catch(() => null) : Promise.resolve(null),
        !adminRole ? api.sellerAccountStore().catch(() => null) : Promise.resolve(null),
        adminRole ? api.adminReviews(100).catch(() => null) : Promise.resolve(null),
        adminRole ? api.adminSellerWithdrawals().then(r => r.items || []).catch(() => []) : Promise.resolve([]),
        adminRole ? api.adminOxaPayBalance('USDT').catch(() => null) : Promise.resolve(null),
        adminRole ? api.adminAudit(50).catch(() => []) : Promise.resolve([]),
      ])
      setSellerDashboard(dash)
      setRechargeDashboard(rd)
      setProducts(Array.isArray(p) ? p : [])
      setOrders(Array.isArray(o) ? o : [])
      setPricing(Array.isArray(gp) ? gp : [])
      if (rs?.reseller_min_deposit !== undefined) setResellerMinDeposit(String(rs.reseller_min_deposit))
      if (sp) setSellerPayoutSettings({
        seller_default_commission_pct: String(sp.seller_default_commission_pct ?? 10),
        seller_min_platform_fee: String(sp.seller_min_platform_fee ?? 0.10),
        seller_hold_days_manual: String(sp.seller_hold_days_manual ?? 7),
        seller_hold_days_auto: String(sp.seller_hold_days_auto ?? 2),
        seller_new_days: String(sp.seller_new_days ?? 30),
        seller_new_hold_days: String(sp.seller_new_hold_days ?? 14),
        seller_withdraw_fee_usdt: String(sp.seller_withdraw_fee_usdt ?? 0.25),
      })
      setSellers(Array.isArray(sl) ? sl : [])
      setAccountSellers(Array.isArray(asl) ? asl : [])
      setAccountSales(asales && Array.isArray(asales.items) ? asales : { items: [], summary: {} })
      setAccountFinance(afinance)
      setAccountStore(st)
      setReviews(rv)
      setWithdrawals(Array.isArray(wd) ? wd : [])
      setOxaBalance(ob)
      setAudit(Array.isArray(al) ? al : [])
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  function authHeadersObj() {
    const h = { 'Content-Type': 'application/json' }
    if (tg?.initData) h['X-Telegram-Init-Data'] = tg.initData
    else { const t = localStorage.getItem('fs_token'); if (t) h['Authorization'] = `Bearer ${t}` }
    return h
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este producto?')) return
    setDeleting(id)
    try {
      await fetch(`/api/admin/manual-products/${id}`, { method: 'DELETE', headers: authHeadersObj() })
      setProducts(products.filter(p => p.id !== id))
    } catch (e) { alert(e.message) }
    setDeleting(null)
  }

  async function handleComplete(orderId) {
    if (!deliveryData.trim() && !deliveryFile) { alert('Escribe los datos de entrega o adjunta un archivo'); return }
    try {
      if (deliveryFile) await api.adminCompleteOrderWithFile(orderId, deliveryData, adminNote, deliveryFile)
      else await api.adminCompleteOrder(orderId, deliveryData, adminNote)
      setCompleting(null); setDeliveryData(''); setAdminNote(''); setDeliveryFile(null)
      loadData()
    } catch (e) { alert(e.message) }
  }

  async function applyOrderFilters() {
    await loadData()
  }

  async function exportOrdersCsv() {
    try {
      const blob = await api.exportManualOrdersCsv(orderFilters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'manual-orders.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) { alert(e.message) }
  }

  async function openOrderDetail(order) {
    try { setSelectedOrderDetail(await api.adminManualOrderDetail(order.id)) }
    catch (e) { alert(e.message) }
  }

  async function refundOrder(order) {
    const reason = prompt('Motivo del reembolso') || 'Reembolso desde panel'
    try { await api.refundManualOrder(order.id, reason); await loadData(); if (selectedOrderDetail?.id === order.id) await openOrderDetail(order) }
    catch (e) { alert(e.message) }
  }

  async function cancelOrder(order) {
    if (!confirm('¿Estás seguro de que deseas cancelar este pedido?')) return
    const reason = prompt('Escribe el motivo de la cancelación (obligatorio):')
    if (reason === null) return // User clicked Cancel in prompt
    const cleanReason = reason.trim()
    if (!cleanReason) {
      alert('Debes especificar un motivo para cancelar.')
      return
    }
    try { await api.cancelManualOrder(order.id, cleanReason); await loadData(); if (selectedOrderDetail?.id === order.id) await openOrderDetail(order) }
    catch (e) { alert(e.message) }
  }

  async function openDeliveryManager(order) {
    setManagingDelivery(order)
    setChangeDeliveryData(order.delivery_data || '')
    setChangeDeliveryNote(order.admin_note || '')
    setDeliveryEvents([])
    try { setDeliveryEvents(await api.adminDeliveryEvents(order.id)) }
    catch (e) { setDeliveryEvents([]) }
  }

  async function handleResendDelivery() {
    if (!managingDelivery) return
    setDeliveryActionLoading(true)
    try { await api.resendDelivery(managingDelivery.id); await openDeliveryManager(managingDelivery) }
    catch (e) { alert(e.message) }
    setDeliveryActionLoading(false)
  }

  async function handleChangeDelivery() {
    if (!managingDelivery) return
    if (!changeDeliveryData.trim()) { alert('Escribe la nueva entrega'); return }
    setDeliveryActionLoading(true)
    try { await api.changeDelivery(managingDelivery.id, changeDeliveryData, changeDeliveryNote); await loadData(); await openDeliveryManager({ ...managingDelivery, delivery_data: changeDeliveryData, admin_note: changeDeliveryNote }) }
    catch (e) { alert(e.message) }
    setDeliveryActionLoading(false)
  }

  async function handleRevokeDelivery() {
    if (!managingDelivery) return
    const reason = prompt('Motivo de revocación') || 'Entrega revocada'
    setDeliveryActionLoading(true)
    try { await api.revokeDelivery(managingDelivery.id, reason); setManagingDelivery(null); await loadData() }
    catch (e) { alert(e.message) }
    setDeliveryActionLoading(false)
  }

  function updatePricingField(gameName, field, value) {
    setPricing(items => items.map(item => item.game_name === gameName ? { ...item, [field]: value } : item))
  }

  async function saveResellerSettings() {
    const amount = Number(String(resellerMinDeposit).replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 50) { alert('El mínimo debe ser 50 USDT o más'); return }
    setSavingResellerSettings(true)
    try {
      const res = await api.updateResellerSettings(amount)
      setResellerMinDeposit(String(res.reseller_min_deposit ?? amount))
    } catch (e) { alert(e.message) }
    setSavingResellerSettings(false)
  }

  async function saveSellerPayoutSettings() {
    const clean = Object.fromEntries(Object.entries(sellerPayoutSettings).map(([k, v]) => [k, Number(String(v).replace(',', '.'))]))
    if (Object.values(clean).some(v => !Number.isFinite(v) || v < 0)) { alert('Todos los valores deben ser números positivos'); return }
    setSavingSellerPayoutSettings(true)
    try {
      const res = await api.updateSellerPayoutSettings(clean)
      setSellerPayoutSettings({
        seller_default_commission_pct: String(res.seller_default_commission_pct ?? clean.seller_default_commission_pct),
        seller_min_platform_fee: String(res.seller_min_platform_fee ?? clean.seller_min_platform_fee),
        seller_hold_days_manual: String(res.seller_hold_days_manual ?? clean.seller_hold_days_manual),
        seller_hold_days_auto: String(res.seller_hold_days_auto ?? clean.seller_hold_days_auto),
        seller_new_days: String(res.seller_new_days ?? clean.seller_new_days),
        seller_new_hold_days: String(res.seller_new_hold_days ?? clean.seller_new_hold_days),
        seller_withdraw_fee_usdt: String(res.seller_withdraw_fee_usdt ?? clean.seller_withdraw_fee_usdt),
      })
    } catch (e) { alert(e.message) }
    setSavingSellerPayoutSettings(false)
  }

  async function savePricing(item) {
    const cleanNumber = (value) => {
      if (value === '' || value === null || value === undefined) return null
      const n = Number(String(value).replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    setSavingPricing(item.game_name)
    try {
      await api.updateGamePricing({
        game_name: item.game_name,
        retail_markup: cleanNumber(item.retail_markup),
        reseller_markup: cleanNumber(item.reseller_markup),
      })
      await loadData()
    } catch (e) { alert(e.message) }
    setSavingPricing(null)
  }

  async function handleGameImageUpload(item, file) {
    if (!file) return
    if (!file.type?.startsWith('image/')) { alert('Selecciona una imagen válida'); return }
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede pasar de 5 MB'); return }
    setSavingGameVisual(item.game_name)
    try {
      const uploadFile = await compressImageForUpload(file)
      const res = await api.uploadIcon(uploadFile)
      updatePricingField(item.game_name, 'icon_url', res.url)
      await api.updateGameIcon({
        game_name: item.game_name,
        emoji: item.emoji || null,
        icon_url: res.url,
        display_name: item.display_name || '',
        sort_order: Number(item.sort_order || 100),
        is_hidden: !!item.is_hidden,
        description: item.description || "",
        instructions: item.instructions || "",
      })
      await loadData()
    } catch (e) { alert(e.message) }
    setSavingGameVisual(null)
  }

  async function saveGameVisual(item) {
    setSavingGameVisual(item.game_name)
    try {
      await api.updateGameIcon({
        game_name: item.game_name,
        emoji: item.emoji || null,
        icon_url: item.icon_url || null,
        display_name: item.display_name || '',
        sort_order: Number(item.sort_order || 100),
        is_hidden: !!item.is_hidden,
        description: item.description || "",
        instructions: item.instructions || "",
      })
      await loadData()
    } catch (e) { alert(e.message) }
    setSavingGameVisual(null)
  }

  async function refreshBuffpinCatalog() {
    if (!confirm('¿Actualizar productos desde BuffPin ahora?')) return
    setRefreshingBuffpin(true)
    try {
      const res = await api.refreshBuffpinProducts()
      alert('Catálogo actualizado: ' + String(res.count || 0) + ' productos')
      await loadData()
    } catch (e) { alert(e.message) }
    setRefreshingBuffpin(false)
  }

  async function restoreHiddenProduct() {
    const productId = Number(restoreProductId)
    if (!productId || !Number.isFinite(productId)) { alert('Escribe un ID de producto válido'); return }
    if (!confirm('¿Volver a poner en línea el producto ' + productId + '?')) return
    setRestoringProduct(true)
    try {
      await api.restoreProductOverride(productId)
      setRestoreProductId('')
      alert('Producto restaurado y visible de nuevo')
      await loadData()
    } catch (e) { alert(e.message) }
    setRestoringProduct(false)
  }

  async function handleAddSeller() {
    const id = Number(newSellerId)
    const max = Number(newSellerMax)
    const commission = Number(newSellerCommission || 0)
    const rechargeCommission = Number(newSellerRechargeCommission || 50)
    if (!id || !Number.isFinite(max)) { alert('ID y máximo válidos requeridos'); return }
    try {
      await api.addSeller(id, max, Number.isFinite(commission) ? commission : 0, '', newSellerCanRecharges, Number.isFinite(rechargeCommission) ? rechargeCommission : 50, newSellerStoreName.trim())
      setNewSellerId(''); setNewSellerStoreName(''); setNewSellerMax('10'); setNewSellerCommission('0'); setNewSellerCanRecharges(false); setNewSellerRechargeCommission('50')
      await loadData()
    } catch (e) { alert(e.message) }
  }

  async function openSellerDetail(id) {
    setLoadingSellerDetail(id)
    try {
      const detail = await api.adminSellerDetail(id)
      setSellerDetail(detail)
      setSellerDraft({
        max_products: String(detail.seller.max_products ?? 0),
        commission_pct: String(detail.seller.commission_pct ?? 0),
        recharge_commission_pct: String(detail.seller.recharge_commission_pct ?? 50),
        is_active: !!detail.seller.is_active,
        can_create_products: detail.seller.can_create_products !== false,
        can_sell_recharges: !!detail.seller.can_sell_recharges,
        notes: detail.seller.notes || '',
      })
    } catch (e) { alert(e.message) }
    setLoadingSellerDetail(null)
  }

  async function saveSellerDetail() {
    if (!sellerDetail || !sellerDraft) return
    setSavingSeller(true)
    try {
      await api.updateSeller(sellerDetail.seller.user_id, {
        max_products: Number(sellerDraft.max_products || 0),
        commission_pct: Number(sellerDraft.commission_pct || 0),
        recharge_commission_pct: Number(sellerDraft.recharge_commission_pct || 0),
        is_active: !!sellerDraft.is_active,
        can_create_products: !!sellerDraft.can_create_products,
        can_sell_recharges: !!sellerDraft.can_sell_recharges,
        notes: sellerDraft.notes || '',
      })
      await openSellerDetail(sellerDetail.seller.user_id)
      await loadData()
    } catch (e) { alert(e.message) }
    setSavingSeller(false)
  }

  async function handleRemoveSeller(id) {
    if (!confirm('¿Quitar permisos de vendedor? Sus productos existentes no se borran.')) return
    try { await api.removeSeller(id); await loadData() }
    catch (e) { alert(e.message) }
  }

  async function handleCreateAccountSeller() {
    const userId = Number(newAccountSellerId)
    if (!userId || !newAccountSellerName.trim()) { alert('ID de usuario y nombre de tienda son requeridos'); return }
    setSavingAccountSeller(true)
    try {
      await api.createAccountSeller({
        user_id: userId,
        store_name: newAccountSellerName.trim(),
        max_active_products: Number(newAccountSellerMax || 10),
        commission_percent: Number(newAccountSellerCommission || 10),
        status: 'active',
      })
      setNewAccountSellerId(''); setNewAccountSellerName(''); setNewAccountSellerMax('10'); setNewAccountSellerCommission('10')
      await loadData()
    } catch (e) { alert(e.message) }
    setSavingAccountSeller(false)
  }

  async function updateAccountSellerStatus(seller, status) {
    try {
      await api.updateAccountSeller(seller.user_id, { status })
      await loadData()
    } catch (e) { alert(e.message) }
  }

  async function editAccountSellerLimits(seller) {
    const max = prompt('Máximo de cuentas activas', seller.max_active_products ?? 10)
    if (max === null) return
    const commission = prompt('Comisión plataforma %', seller.commission_percent ?? 10)
    if (commission === null) return
    try {
      await api.updateAccountSeller(seller.user_id, { max_active_products: Number(max || 0), commission_percent: Number(commission || 0) })
      await loadData()
    } catch (e) { alert(e.message) }
  }

  async function saveMyAccountStore(patch) {
    try {
      await api.updateSellerAccountStore(patch)
      await loadData()
    } catch (e) { alert(e.message) }
  }

  async function approveWithdrawal(id) {
    const txid = prompt('TXID/hash del pago USDT BEP20')
    if (!txid) return
    const note = prompt('Nota interna opcional') || ''
    try { await api.approveSellerWithdrawal(id, txid, note); await loadData() }
    catch (e) { alert(e.message) }
  }

  async function rejectWithdrawal(id) {
    const note = prompt('Motivo de rechazo') || ''
    if (!confirm('¿Rechazar este retiro y devolver saldo disponible?')) return
    try { await api.rejectSellerWithdrawal(id, note); await loadData() }
    catch (e) { alert(e.message) }
  }

  async function payWithdrawalOxaPay(id) {
    if (!confirm('¿Enviar este retiro automáticamente por OxaPay USDT BEP20?')) return
    const note = prompt('Nota interna opcional') || ''
    try { await api.paySellerWithdrawalOxaPay(id, note); await loadData() }
    catch (e) { alert(e.message) }
  }

  async function syncWithdrawalOxaPay(id) {
    try { await api.syncSellerWithdrawalOxaPay(id); await loadData() }
    catch (e) { alert(e.message) }
  }

  if (loading) return <CoolLoading label="Cargando panel de administración..." />
  if (err) return <ErrorView msg={err} />

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const alertCount = Number(sellerDashboard?.stock_alerts?.length || 0) + Number(sellerDashboard?.pending_alerts?.length || 0)
  const tabOptions = [
    { id: 'dashboard', label: alertCount > 0 ? `Resumen (${alertCount})` : 'Resumen', icon: Home },
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'orders', label: pendingCount > 0 ? `Pedidos (${pendingCount})` : 'Pedidos', icon: ClipboardList },
    { id: 'recharges', label: 'Mis recargas', icon: Smartphone },
    ...(isAdminRole ? [
      { id: 'pricing', label: 'Ganancias', icon: DollarSign },
      { id: 'sellers', label: 'Vendedores', icon: BriefcaseBusiness },
      { id: 'withdrawals', label: 'Retiros', icon: WalletCards },
      { id: 'users', label: 'Clientes', icon: User },
      { id: 'reviews', label: 'Valoraciones', icon: BadgeCheck },
      { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
    ] : []),
  ]
  const activeTab = tabOptions.find(item => item.id === tab) || tabOptions[0]
  const selectedPricingItem = selectedPricingGame ? pricing.find(item => item.game_name === selectedPricingGame) : null
  const pendingAccountProductIds = new Set(orders.filter(o => o.category === 'game_account' && o.status === 'pending').map(o => Number(o.product_id)))
  const visibleProducts = products.filter(p => {
    if (productFilter === 'accounts') return p.category === 'game_account'
    if (productFilter === 'account_active') return p.category === 'game_account' && p.is_active && (p.account_status || 'active') === 'active'
    if (productFilter === 'account_sold') return p.category === 'game_account' && (p.account_status === 'sold' || !p.is_active && Number(p.stock || 0) === 0)
    if (productFilter === 'account_inactive') return p.category === 'game_account' && !p.is_active && p.account_status !== 'sold'
    if (productFilter === 'account_pending') return p.category === 'game_account' && pendingAccountProductIds.has(Number(p.id))
    return true
  })

  return (
    <div className={externalTab ? "w-full" : "px-2.5 py-4 md:p-6"}>
      {!externalTab && (
        <>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Crown className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                {isAdminRole ? 'Panel Admin' : 'Panel Vendedor'}
              </h2>
              <p className="mt-1 text-xs text-white/45">{activeTab.label}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tabOptions.map(item => {
              const Icon = item.icon
              const selected = item.id === tab
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`min-h-[58px] rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${selected ? 'border-accent bg-accent/15 text-white' : 'border-white/10 bg-card text-white/62 hover:border-white/20'}`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${selected ? 'text-accent' : 'text-white/45'}`} />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {isAdminRole && (
        <div className="mb-4 grid gap-3 rounded-xl border border-green-500/15 bg-green-500/5 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-300" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-200">Herramientas solo admin</p>
              <p className="mt-1 text-xs text-white/45">Restaurar aquí vuelve a mostrar un producto automático oculto por ID.</p>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={restoreProductId}
              onChange={e => setRestoreProductId(e.target.value)}
              inputMode="numeric"
              placeholder="ID de producto oculto"
              className="min-w-0 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={restoreHiddenProduct}
              disabled={restoringProduct}
              className="rounded-lg bg-green-500/20 px-3 py-2 text-sm font-bold text-green-300 disabled:opacity-60"
            >
              {restoringProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Restaurar'}
            </button>
          </div>
        </div>
      )}

      {/* TAB: Dashboard */}
      {tab === 'dashboard' && (
        <div className="space-y-3">
          {(accountStore?.is_account_seller || accountStore?.is_general_seller) && <AccountStorePanel accountStore={accountStore} onSave={saveMyAccountStore} />}
          {accountStore?.is_account_seller && <AccountSellerFinancePanel finance={accountFinance} onRefresh={loadData} />}
          {accountStore?.is_account_seller && <AccountSellerSalesPanel sales={accountSales} onOpenOrder={openOrderDetail} title="Mis ventas de cuentas" />}
          <SellerDashboardPanel dashboard={sellerDashboard} onGoProducts={() => setTab('products')} onGoOrders={() => setTab('orders')} onRefresh={loadData} />
        </div>
      )}

      {/* TAB: Productos */}
      {tab === 'products' && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            {[
              ['all', 'Todas'], ['account_active', 'Activas'], ['account_sold', 'Vendidas'], ['account_inactive', 'Inactivas'], ['account_pending', 'Pendientes de entrega'], ['accounts', 'Cuentas']
            ].map(([id, label]) => <button key={id} onClick={() => setProductFilter(id)} className={`rounded-lg border px-2 py-2 font-semibold ${productFilter === id ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 bg-card text-white/60'}`}>{label}</button>)}
          </div>
          <div className="flex justify-end mb-3">
            <button onClick={() => onEdit(null)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-accent2 text-sm font-bold active:scale-95">
              ＋ Crear
            </button>
          </div>
          {visibleProducts.length === 0 ? (
            <div className="card p-8 text-center">
              <PackageOpen className="mx-auto mb-3 h-10 w-10 text-white/35" />
              <p className="text-white/60">Sin productos manuales</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleProducts.map(p => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {p.icon_url ? (
                        <img src={p.icon_url} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center text-2xl">
                          <CategoryIcon category={p.category} className="h-6 w-6 text-white/60" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-white/50">{categoryLabel(p.category)} · {p.category === 'game_account' ? (p.account_status === 'sold' ? 'Vendida' : 'Manual') : deliveryTypeLabel(p.delivery_type, p.category)}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-accent">${p.price?.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className={p.is_active ? 'text-green-400' : 'text-red-400'}>
                      <span className="inline-flex items-center gap-1"><StatusIcon status={p.is_active ? 'active' : 'inactive'} className="h-3.5 w-3.5" />{p.is_active ? 'Activo' : 'Inactivo'}</span>
                    </span>
                    <span className="text-white/40">Stock: {p.stock < 0 ? '∞' : p.stock}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(p)}
                      className="flex-1 py-2 rounded-lg bg-accent/20 text-accent text-sm font-semibold active:scale-95">
                      <span className="inline-flex items-center justify-center gap-1"><Edit3 className="h-4 w-4" />Editar</span>
                    </button>
                    <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                      className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm active:scale-95">
                      {deleting === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: Pedidos */}
      {tab === 'orders' && (
        <>
          <div className="card mb-3 p-3 sm:p-4">
            <p className="mb-3 text-sm font-semibold text-white/80">Filtros de pedidos</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={orderFilters.q} onChange={e => setOrderFilters(f => ({ ...f, q: e.target.value }))} placeholder="Pedido, cliente, producto" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <select value={orderFilters.status} onChange={e => setOrderFilters(f => ({ ...f, status: e.target.value }))} className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent">
                <option value="">Todos</option><option value="pending">Pendientes</option><option value="completed">Completados</option><option value="revoked">Revocados</option><option value="refunded">Reembolsados</option><option value="canceled">Cancelados</option>
              </select>
              <input value={orderFilters.user_id} onChange={e => setOrderFilters(f => ({ ...f, user_id: e.target.value }))} inputMode="numeric" placeholder="ID cliente" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={orderFilters.seller_id} onChange={e => setOrderFilters(f => ({ ...f, seller_id: e.target.value }))} inputMode="numeric" placeholder="ID vendedor" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={applyOrderFilters} className="rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent">Aplicar</button>
              <button onClick={() => { setOrderFilters({ status: '', q: '', user_id: '', seller_id: '', limit: '100' }); setTimeout(loadData, 0) }} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/70">Limpiar</button>
              <button onClick={exportOrdersCsv} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/70">CSV</button>
            </div>
          </div>
          {orders.length === 0 ? (
            <div className="card p-8 text-center">
              <CircleCheck className="mx-auto mb-3 h-10 w-10 text-green-400" />
              <p className="text-white/60">Sin pedidos manuales</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(o => {
                const date = o.created_at ? new Date(o.created_at * 1000).toLocaleString('es-ES', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                }) : '—'
                const isCompleting = completing === o.id
                return (
                  <div key={o.id} className="card p-3 sm:p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{o.product_name}</p>
                        {o.option_name && <p className="text-xs font-semibold text-accent">{o.option_name}</p>}
                        {o.customer_data && Object.keys(o.customer_data).length > 0 && (
                          <div className="mt-2 rounded-lg bg-black/20 p-2 text-xs text-white/65">
                            {Object.entries(o.customer_data).map(([k, v]) => <p key={k}><span className="text-white/40">{k}:</span> {v}</p>)}
                          </div>
                        )}
                        <div className="mt-2 rounded-lg bg-black/20 p-2 text-xs text-white/55">
                          <p className="font-semibold text-white/70">Cliente: {o.customer_name || o.customer_username || `#${o.user_id}`}</p>
                          <p>ID: <code>{o.user_id}</code>{o.customer_username ? ` · @${o.customer_username}` : ''}</p>
                          {o.customer_email && <p>Email: {o.customer_email}</p>}
                          <p className="mt-1">Vendedor: {o.seller_store_name || o.seller_name || o.seller_username || `#${o.seller_id || o.product_owner_id || '-'}`}</p>
                          <p>Fecha: {date}</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-accent">${o.price?.toFixed(2)}</p>
                    </div>

                    {isCompleting ? (
                      <div className="mt-3 space-y-2">
                        <textarea value={deliveryData} onChange={e => setDeliveryData(e.target.value)}
                          placeholder={o.category === 'game_account' ? "Usuario/correo:\nContraseña temporal:\nMétodo de acceso:\nInstrucciones adicionales:" : "Datos de entrega (código, link de sesión, credenciales...)"}
                          rows={3}
                          className="w-full bg-bg border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
                        <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                          placeholder="Nota para el cliente (opcional)"
                          className="w-full bg-bg border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent" />
                        <div className="rounded-lg border border-white/10 bg-bg p-3">
                          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold active:scale-95">
                            <Package className="h-4 w-4" /> Adjuntar captura o archivo
                            <input
                              type="file"
                              accept="image/*,.pdf,.txt,.zip,.rar"
                              className="hidden"
                              onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)}
                            />
                          </label>
                          {deliveryFile && (
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-white/55">
                              <span className="truncate">{deliveryFile.name}</span>
                              <button onClick={() => setDeliveryFile(null)} className="text-red-300">Quitar</button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setCompleting(null); setDeliveryFile(null) }}
                            className="flex-1 py-2 rounded-lg border border-white/20 text-white/60 text-sm">
                            Cancelar
                          </button>
                          <button onClick={() => handleComplete(o.id)}
                            className="flex-1 py-2 rounded-lg bg-green-500 text-white text-sm font-bold active:scale-95">
                            <span className="inline-flex items-center justify-center gap-1"><Check className="h-4 w-4" />Completar y notificar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {o.status === 'pending' ? (
                          <button onClick={() => setCompleting(o.id)} className="rounded-lg bg-green-500/20 px-3 py-2 text-sm font-semibold text-green-400 active:scale-95"><span className="inline-flex items-center justify-center gap-1"><Send className="h-4 w-4" />Entregar</span></button>
                        ) : (
                          <span className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${o.status === 'completed' ? 'bg-green-500/15 text-green-300' : o.status === 'revoked' ? 'bg-red-500/15 text-red-300' : o.status === 'refunded' ? 'bg-yellow-500/15 text-yellow-300' : 'bg-white/10 text-white/60'}`}>{o.status}</span>
                        )}
                        <button onClick={() => openOrderDetail(o)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/75">Detalle</button>
                        <button onClick={() => openDeliveryManager(o)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/75">Entrega</button>
                        {o.status === 'pending' ? <button onClick={() => cancelOrder(o)} className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-bold text-red-300">Cancelar</button> : <button onClick={() => refundOrder(o)} disabled={['refunded','canceled'].includes(o.status)} className="rounded-lg bg-yellow-500/20 px-3 py-2 text-sm font-bold text-yellow-300 disabled:opacity-50">Reembolsar</button>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {selectedOrderDetail && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-bg p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">Pedido #{selectedOrderDetail.id}</p>
                <p className="text-xs text-white/45">{selectedOrderDetail.product_name} · Cliente {selectedOrderDetail.customer_name || selectedOrderDetail.customer_username || `#${selectedOrderDetail.user_id}`}</p>
              </div>
              <button onClick={() => setSelectedOrderDetail(null)} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Cerrar</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="card p-3"><p className="text-xs text-white/45">Estado</p><p className="font-bold">{selectedOrderDetail.status}</p></div>
              <div className="card p-3"><p className="text-xs text-white/45">Precio</p><p className="font-bold text-accent">${Number(selectedOrderDetail.price || 0).toFixed(2)}</p></div>
              <div className="card p-3"><p className="text-xs text-white/45">Opción</p><p className="font-bold">{selectedOrderDetail.option_name || '-'}</p></div>
              <div className="card p-3"><p className="text-xs text-white/45">Pedido</p><p className="font-bold">#{selectedOrderDetail.id}</p></div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <PersonInfoCard title="Comprador" data={selectedOrderDetail} kind="customer" />
              <PersonInfoCard title="Vendedor" data={selectedOrderDetail} kind="seller" />
            </div>
            {selectedOrderDetail.customer_data && Object.keys(selectedOrderDetail.customer_data).length > 0 && <div className="mt-3 card p-3"><p className="mb-2 text-sm font-semibold">Datos cliente</p>{Object.entries(selectedOrderDetail.customer_data).map(([k,v]) => <p key={k} className="text-xs text-white/60"><span className="text-white/35">{k}:</span> {String(v)}</p>)}</div>}
            {selectedOrderDetail.delivery_data && <div className="mt-3 card p-3"><p className="mb-2 text-sm font-semibold">Entrega</p><Linkify className="text-xs text-white/65">{selectedOrderDetail.delivery_data}</Linkify></div>}
            {selectedOrderDetail.case && (
              <div className="mt-3 border-t border-white/5 pt-3">
                <div className="flex items-center justify-between gap-3 text-xs bg-black/10 p-3 rounded-xl border border-white/5">
                  <div className="min-w-0">
                    <p className="font-bold flex items-center gap-1.5 text-white/90">
                      <MessageCircle className="h-4 w-4 text-accent animate-pulse" />
                      Seguimiento del caso #{selectedOrderDetail.case.id}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">Estado: {selectedOrderDetail.case.status}</p>
                  </div>
                  <button
                    onClick={() => onOpenCase(selectedOrderDetail.id, true)}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white active:scale-95 transition-all shadow-sm"
                  >
                    Abrir caso
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => refundOrder(selectedOrderDetail)} disabled={['refunded','canceled'].includes(selectedOrderDetail.status)} className="rounded-lg bg-yellow-500/20 px-3 py-2 text-sm font-bold text-yellow-300 disabled:opacity-50">Reembolsar</button>
              <button onClick={() => cancelOrder(selectedOrderDetail)} disabled={selectedOrderDetail.status !== 'pending'} className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-bold text-red-300 disabled:opacity-50">Cancelar</button>
            </div>
            {selectedOrderDetail.delivery_data && (
              <button
                onClick={async () => {
                  try {
                    await api.sendEmailNotification(selectedOrderDetail.id)
                    alert('Notificación por correo enviada con éxito')
                  } catch (e) {
                    alert('Error enviando notificación: ' + e.message)
                  }
                }}
                className="mt-2 w-full rounded-lg bg-blue-500/20 py-2 text-sm font-bold text-blue-300 active:scale-95 transition-all"
              >
                Notificar por Correo (Gmail)
              </button>
            )}
          </div>
        </div>
      )}

      {managingDelivery && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-bg p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">Gestionar entrega #{managingDelivery.id}</p>
                <p className="text-xs text-white/45">{managingDelivery.product_name} · Cliente {managingDelivery.customer_name || managingDelivery.customer_username || `#${managingDelivery.user_id}`}</p>
              </div>
              <button onClick={() => setManagingDelivery(null)} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Cerrar</button>
            </div>
            <div className="space-y-2">
              <textarea value={changeDeliveryData} onChange={e => setChangeDeliveryData(e.target.value)} rows={4} placeholder="Nueva entrega" className="w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
              <input value={changeDeliveryNote} onChange={e => setChangeDeliveryNote(e.target.value)} placeholder="Nota interna/cliente" className="w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <div className="grid grid-cols-3 gap-2">
                <button onClick={handleResendDelivery} disabled={deliveryActionLoading || !managingDelivery.delivery_data} className="rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent disabled:opacity-50">Reenviar</button>
                <button onClick={handleChangeDelivery} disabled={deliveryActionLoading} className="rounded-lg bg-green-500/20 px-3 py-2 text-sm font-bold text-green-300 disabled:opacity-50">Cambiar</button>
                <button onClick={handleRevokeDelivery} disabled={deliveryActionLoading} className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-bold text-red-300 disabled:opacity-50">Revocar</button>
              </div>
              {managingDelivery.delivery_data && (
                <button
                  onClick={async () => {
                    setDeliveryActionLoading(true)
                    try {
                      await api.sendEmailNotification(managingDelivery.id)
                      alert('Notificación por correo enviada con éxito')
                      await openDeliveryManager(managingDelivery)
                    } catch (e) {
                      alert('Error enviando notificación: ' + e.message)
                    }
                    setDeliveryActionLoading(false)
                  }}
                  disabled={deliveryActionLoading}
                  className="w-full rounded-lg bg-blue-500/20 py-2 text-sm font-bold text-blue-300 disabled:opacity-50 active:scale-95 transition-all"
                >
                  Enviar Notificación Gmail
                </button>
              )}
            </div>
            <div className="mt-4 card p-3">
              <p className="mb-2 text-sm font-semibold">Historial de entrega</p>
              {deliveryEvents.length === 0 ? <p className="text-xs text-white/40">Sin eventos registrados</p> : deliveryEvents.map(ev => (
                <div key={ev.id} className="border-t border-white/5 py-2 text-xs text-white/60">
                  <p><span className="font-semibold text-white/75">{ev.event_type}</span> · Actor #{ev.actor_id} · {ev.status}</p>
                  {ev.admin_note && <p className="text-white/45">{ev.admin_note}</p>}
                  {ev.error_message && <p className="text-red-300">{ev.error_message}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'withdrawals' && isAdminRole && (
        <div className="space-y-3">
          <div className="card p-4">
            <p className="text-sm font-semibold text-white/80">Retiros USDT BEP20 de vendedores</p>
            <p className="mt-1 text-xs text-white/45">Aprueba solo después de enviar el pago y guarda el TXID/hash. Si rechazas, el saldo vuelve a disponible.</p>
            <p className="mt-2 rounded-lg bg-black/20 p-2 text-xs text-white/60">Balance OxaPay USDT: {(() => { const b = oxaBalance?.balance; const v = typeof b === 'object' ? (b.USDT ?? b.usdt ?? b.balance ?? '-') : (b ?? '-'); return typeof v === 'number' ? `$${Number(v).toFixed(2)}` : String(v) })()}</p>
          </div>
          {withdrawals.length === 0 ? (
            <div className="card p-8 text-center text-white/50">Sin solicitudes de retiro.</div>
          ) : withdrawals.map(w => (
            <div key={w.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">Retiro #{w.id} · Vendedor #{w.seller_id}</p>
                  <p className="text-xs text-white/45">{w.first_name || w.email || w.username || 'Vendedor'} · {w.status} · {w.network}</p>
                  <p className="mt-2 break-all rounded-lg bg-black/20 p-2 text-xs text-white/60">{w.wallet_address}</p>
                  {w.provider_track_id && <p className="mt-2 break-all text-xs text-yellow-200">OxaPay: {w.provider_track_id} · {w.provider_status || 'processing'}</p>}
                  {w.txid && <p className="mt-2 break-all text-xs text-green-300">TXID: {w.txid}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-lg font-bold text-accent">${Number(w.amount || 0).toFixed(2)}</p>
                  <p className="text-xs text-white/45">Fee ${Number(w.fee_amount || 0).toFixed(2)} · Neto ${Number(w.net_amount || 0).toFixed(2)}</p>
                </div>
              </div>
              {w.status === 'pending' && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button onClick={() => payWithdrawalOxaPay(w.id)} className="rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent">Pagar OxaPay</button>
                  <button onClick={() => approveWithdrawal(w.id)} className="rounded-lg bg-green-500/15 px-3 py-2 text-sm font-bold text-green-300">Manual TXID</button>
                  <button onClick={() => rejectWithdrawal(w.id)} className="rounded-lg bg-red-500/15 px-3 py-2 text-sm font-bold text-red-300">Rechazar</button>
                </div>
              )}
              {w.status === 'processing' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => syncWithdrawalOxaPay(w.id)} className="rounded-lg bg-yellow-500/15 px-3 py-2 text-sm font-bold text-yellow-200">Sync OxaPay</button>
                  <button onClick={() => rejectWithdrawal(w.id)} className="rounded-lg bg-red-500/15 px-3 py-2 text-sm font-bold text-red-300">Cancelar/Rechazar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'recharges' && (
        <RechargeSellerPanel dashboard={rechargeDashboard} me={null} />
      )}

      {tab === 'sellers' && isAdminRole && (
        <div className="space-y-3">
          <div className="card border-green-500/20 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><Store className="h-4 w-4 text-green-300" />Vendedores de cuentas</p>
                <p className="mt-1 text-xs text-white/45">Solo pueden publicar productos tipo cuenta de juego. No pueden vender recargas ni gift cards.</p>
              </div>
              <span className="rounded-full bg-green-500/15 px-2 py-1 text-xs text-green-300">{accountSellers.filter(s => s.status === 'active').length}/{accountSellers.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={newAccountSellerId} onChange={e => setNewAccountSellerId(e.target.value)} inputMode="numeric" placeholder="ID usuario" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={newAccountSellerName} onChange={e => setNewAccountSellerName(e.target.value)} placeholder="Nombre de tienda" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={newAccountSellerMax} onChange={e => setNewAccountSellerMax(e.target.value)} inputMode="numeric" placeholder="Máx cuentas activas" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={newAccountSellerCommission} onChange={e => setNewAccountSellerCommission(e.target.value)} inputMode="decimal" placeholder="Comisión %" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <button onClick={handleCreateAccountSeller} disabled={savingAccountSeller} className="mt-3 w-full rounded-lg bg-green-500/20 px-3 py-2 text-sm font-bold text-green-300 disabled:opacity-60">{savingAccountSeller ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Convertir en vendedor de cuentas'}</button>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {accountSellers.map(seller => (
                <div key={seller.user_id} className="rounded-xl border border-white/10 bg-bg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{seller.store_name} <span className="text-xs text-white/35">#{seller.user_id}</span></p>
                      <p className="text-xs text-white/45">/{seller.store_slug} · {seller.active_products || 0}/{seller.max_active_products || 0} activas · Comisión {Number(seller.commission_percent || 0).toFixed(1)}%</p>
                    </div>
                    <span className={seller.status === 'active' ? 'text-xs text-green-300' : seller.status === 'suspended' ? 'text-xs text-yellow-300' : 'text-xs text-red-300'}>{seller.status}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <button onClick={() => window.open(`/seller/${seller.store_slug}`, '_blank')} className="rounded-lg bg-white/10 px-2 py-2 text-xs font-semibold text-white/70">Ver</button>
                    <button onClick={() => editAccountSellerLimits(seller)} className="rounded-lg bg-accent/15 px-2 py-2 text-xs font-semibold text-accent">Config</button>
                    <button onClick={() => updateAccountSellerStatus(seller, seller.status === 'active' ? 'suspended' : 'active')} className="rounded-lg bg-yellow-500/15 px-2 py-2 text-xs font-semibold text-yellow-200">{seller.status === 'active' ? 'Pausar' : 'Activar'}</button>
                    <button onClick={() => updateAccountSellerStatus(seller, 'disabled')} className="rounded-lg bg-red-500/15 px-2 py-2 text-xs font-semibold text-red-300">Desactivar</button>
                  </div>
                </div>
              ))}
              {accountSellers.length === 0 && <p className="rounded-lg bg-black/20 p-3 text-sm text-white/45">Todavía no hay vendedores de cuentas.</p>}
            </div>
          </div>

          <AccountSellerSalesPanel sales={accountSales} onOpenOrder={openOrderDetail} title="Ventas de cuentas" />

          <div className="grid grid-cols-3 gap-2">
            <div className="card p-3"><p className="text-xs text-white/45">Vendedores</p><p className="text-xl font-bold">{sellers.length}</p></div>
            <div className="card p-3"><p className="text-xs text-white/45">Activos</p><p className="text-xl font-bold text-green-300">{sellers.filter(s => s.is_active).length}</p></div>
            <div className="card p-3"><p className="text-xs text-white/45">Ingresos</p><p className="text-xl font-bold text-accent">${sellers.reduce((sum, s) => sum + Number(s.completed_revenue || 0), 0).toFixed(2)}</p></div>
            <div className="card p-3"><p className="text-xs text-white/45">Retenido</p><p className="text-xl font-bold text-yellow-300">${sellers.reduce((sum, s) => sum + Number(s.held_balance || 0), 0).toFixed(2)}</p></div>
            <div className="card p-3"><p className="text-xs text-white/45">Disponible</p><p className="text-xl font-bold text-green-300">${sellers.reduce((sum, s) => sum + Number(s.available_balance || 0), 0).toFixed(2)}</p></div>
          </div>
          <div className="card p-4">
            <p className="text-sm font-semibold text-white/80">Agregar vendedor interno</p>
            <p className="mt-1 text-xs text-white/45">Se muestra como venta del sistema. Puedes limitar productos, pausar creación y auditar sus entregas.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input value={newSellerId} onChange={e => setNewSellerId(e.target.value)} inputMode="numeric" placeholder="ID usuario" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={newSellerStoreName} onChange={e => setNewSellerStoreName(e.target.value)} placeholder="Nombre de tienda" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={newSellerMax} onChange={e => setNewSellerMax(e.target.value)} inputMode="numeric" placeholder="Máx productos" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={newSellerCommission} onChange={e => setNewSellerCommission(e.target.value)} inputMode="decimal" placeholder="Comisión manual %" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={newSellerRechargeCommission} onChange={e => setNewSellerRechargeCommission(e.target.value)} inputMode="decimal" placeholder="Comisión recargas %" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <label className="col-span-2 flex items-center gap-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white/75"><input type="checkbox" checked={newSellerCanRecharges} onChange={e => setNewSellerCanRecharges(e.target.checked)} /> Puede vender recargas automáticas</label>
            </div>
            <button onClick={handleAddSeller} className="mt-3 w-full rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent"><span className="inline-flex items-center justify-center gap-1"><Check className="h-4 w-4" />Autorizar vendedor</span></button>
          </div>
          {sellers.map(seller => (
            <div key={seller.user_id} className="card p-4">
              <button onClick={() => openSellerDetail(seller.user_id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{seller.store_name || seller.first_name || seller.email || seller.username || 'Usuario'} <span className="text-xs text-white/35">#{seller.user_id}</span></p>
                    {seller.store_slug && <p className="text-xs text-green-300">Tienda /{seller.store_slug} · {seller.seller_type === 'general' ? 'vendedor normal' : 'cuentas'}</p>}
                    <p className="text-xs text-white/45">Productos {seller.products_count}/{seller.max_products} · Activos {seller.active_products || 0} · Pendientes {seller.pending_orders || 0}</p>
                    <p className="text-xs text-white/45">Ventas {seller.completed_orders}/{seller.total_orders} · ${Number(seller.completed_revenue || 0).toFixed(2)} · Comisión {Number(seller.commission_pct || 0).toFixed(1)}%</p>
                    <p className="text-xs text-white/45">Recargas {seller.recharge_completed || 0}/{seller.recharge_orders || 0} · Ganado ${Number(seller.recharge_earned || 0).toFixed(2)} · {seller.can_sell_recharges ? 'Recargas activas' : 'Recargas off'}</p>
                    <p className="text-xs text-white/45">Wallet USDT BEP20 · Retenido ${Number(seller.held_balance || 0).toFixed(2)} · Disponible ${Number(seller.available_balance || 0).toFixed(2)}</p>
                  </div>
                  <span className={seller.is_active ? 'text-xs text-green-400' : 'text-xs text-red-400'}>{seller.is_active ? 'Activo' : 'Quitado'}</span>
                </div>
              </button>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={() => openSellerDetail(seller.user_id)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/75">{loadingSellerDetail === seller.user_id ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Detalle'}</button>
                {seller.store_slug && <button onClick={() => window.open(`/seller/${seller.store_slug}`, '_blank')} className="rounded-lg bg-green-500/15 px-3 py-2 text-sm font-bold text-green-300">Tienda</button>}
                {seller.is_active && <button onClick={() => handleRemoveSeller(seller.user_id)} className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-bold text-red-300"><span className="inline-flex items-center justify-center gap-1"><Trash2 className="h-4 w-4" />Quitar</span></button>}
              </div>
            </div>
          ))}
          {sellerDetail && sellerDraft && (
            <div className="fixed inset-0 z-40 flex items-end bg-black/70 p-3 sm:items-center">
              <div className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-bg p-4 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{sellerDetail.seller.first_name || sellerDetail.seller.email || sellerDetail.seller.username || 'Vendedor'}</p>
                    <p className="text-xs text-white/45">ID {sellerDetail.seller.user_id} · {sellerDetail.seller.email || 'sin email'}</p>
                    {sellerDetail.seller.store_slug && <button onClick={() => window.open(`/seller/${sellerDetail.seller.store_slug}`, '_blank')} className="mt-2 rounded-lg bg-green-500/15 px-3 py-2 text-xs font-bold text-green-300">Abrir tienda /{sellerDetail.seller.store_slug}</button>}
                  </div>
                  <button onClick={() => setSellerDetail(null)} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Cerrar</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="card p-3"><p className="text-xs text-white/45">Productos</p><p className="text-lg font-bold">{sellerDetail.seller.products_count}</p></div>
                  <div className="card p-3"><p className="text-xs text-white/45">Pendientes</p><p className="text-lg font-bold">{sellerDetail.seller.pending_orders}</p></div>
                  <div className="card p-3"><p className="text-xs text-white/45">Ventas</p><p className="text-lg font-bold">{sellerDetail.seller.completed_orders}</p></div>
                  <div className="card p-3"><p className="text-xs text-white/45">Ingreso</p><p className="text-lg font-bold text-accent">${Number(sellerDetail.seller.completed_revenue || 0).toFixed(2)}</p></div>
                  <div className="card p-3"><p className="text-xs text-white/45">Retenido</p><p className="text-lg font-bold text-yellow-300">${Number(sellerDetail.seller.held_balance || 0).toFixed(2)}</p></div>
                  <div className="card p-3"><p className="text-xs text-white/45">Disponible</p><p className="text-lg font-bold text-green-300">${Number(sellerDetail.seller.available_balance || 0).toFixed(2)}</p></div>
                  <div className="card p-3"><p className="text-xs text-white/45">Retirado</p><p className="text-lg font-bold text-white/80">${Number(sellerDetail.seller.withdrawn_balance || 0).toFixed(2)}</p></div>
                </div>
                <div className="mt-3 card p-4">
                  <p className="mb-3 text-sm font-semibold">Control</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={sellerDraft.max_products} onChange={e => setSellerDraft(d => ({ ...d, max_products: e.target.value }))} placeholder="Máx productos" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <input value={sellerDraft.commission_pct} onChange={e => setSellerDraft(d => ({ ...d, commission_pct: e.target.value }))} placeholder="Comisión manual %" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <input value={sellerDraft.recharge_commission_pct} onChange={e => setSellerDraft(d => ({ ...d, recharge_commission_pct: e.target.value }))} placeholder="Comisión recargas %" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm"><input type="checkbox" checked={sellerDraft.is_active} onChange={e => setSellerDraft(d => ({ ...d, is_active: e.target.checked }))} /> Activo</label>
                    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm"><input type="checkbox" checked={sellerDraft.can_create_products} onChange={e => setSellerDraft(d => ({ ...d, can_create_products: e.target.checked }))} /> Puede crear</label>
                    <label className="col-span-2 flex items-center gap-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm"><input type="checkbox" checked={sellerDraft.can_sell_recharges} onChange={e => setSellerDraft(d => ({ ...d, can_sell_recharges: e.target.checked }))} /> Puede vender recargas automáticas</label>
                  </div>
                  <textarea value={sellerDraft.notes} onChange={e => setSellerDraft(d => ({ ...d, notes: e.target.value }))} rows={3} placeholder="Notas internas del vendedor" className="mt-2 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
                  <button onClick={saveSellerDetail} disabled={savingSeller} className="mt-3 w-full rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent disabled:opacity-60">{savingSeller ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Guardar cambios'}</button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="card p-4"><p className="mb-2 text-sm font-semibold">Productos</p>{sellerDetail.products.slice(0, 8).map(p => <p key={p.id} className="border-t border-white/5 py-2 text-xs text-white/60">{p.name} · ${Number(p.price || 0).toFixed(2)} · {p.is_active ? 'Activo' : 'Inactivo'}</p>)}</div>
                  <div className="card p-4"><p className="mb-2 text-sm font-semibold">Ventas recientes</p>{sellerDetail.orders.slice(0, 8).map(o => <p key={o.id} className="border-t border-white/5 py-2 text-xs text-white/60">#{o.id} · {o.product_name} · ${Number(o.price || 0).toFixed(2)} · {o.status}</p>)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && isAdminRole && (
        <div className="space-y-3">
          {audit.length === 0 ? <div className="card p-8 text-center text-white/50">Sin eventos de auditoría</div> : audit.map(item => {
            const date = item.created_at ? new Date(item.created_at * 1000).toLocaleString('es-ES') : '—'
            return <div key={item.id} className="card p-4 text-sm">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold">{item.action}</p><span className="text-xs text-white/35">{date}</span></div>
              <p className="mt-1 text-xs text-white/45">Actor #{item.admin_id} · {item.target_type} #{item.target_id}</p>
              {item.details && <pre className="mt-2 overflow-x-auto rounded-lg bg-black/20 p-2 text-[11px] text-white/50">{item.details}</pre>}
            </div>
          })}
        </div>
      )}

      {tab === 'users' && isAdminRole && <AdminUsersPanel />}


      {tab === 'reviews' && isAdminRole && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3"><p className="text-xs text-white/45">Valoraciones</p><p className="text-xl font-bold">{reviews?.stats?.count || 0}</p></div>
            <div className="card p-3"><p className="text-xs text-white/45">Promedio</p><p className="text-xl font-bold text-yellow-300">{Number(reviews?.stats?.avg_rating || 0).toFixed(1)} ★</p></div>
          </div>
          {(reviews?.items || []).length === 0 ? (
            <div className="card p-8 text-center text-white/50">Todavía no hay valoraciones.</div>
          ) : (
            (reviews?.items || []).map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.first_name || r.email || r.username || 'Usuario'} <span className="text-xs text-white/35">#{r.user_id}</span></p>
                    <p className="text-xs text-white/45">{r.order_type} · Pedido {r.order_id}</p>
                  </div>
                  <p className="flex-shrink-0 text-yellow-300">{'★'.repeat(Number(r.rating || 0))}</p>
                </div>
                {r.comment && <p className="mt-3 rounded-lg bg-black/20 p-3 text-sm text-white/70">{r.comment}</p>}
                <p className="mt-2 text-xs text-white/35">{r.created_at ? new Date(r.created_at * 1000).toLocaleString('es-ES') : ''}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'pricing' && isAdminRole && (
        <div className="space-y-3">
          <div className="card p-4">
            <p className="text-sm font-semibold text-white/80">Regla para revendedores</p>
            <p className="mt-1 text-xs text-white/45">El usuario puede tener rol revendedor, pero solo recibe precios preferenciales cuando su total depositado pagado llega a este mínimo.</p>
            <div className="mt-3 flex gap-2">
              <input value={resellerMinDeposit} onChange={e => setResellerMinDeposit(e.target.value)} inputMode="decimal" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <button onClick={saveResellerSettings} disabled={savingResellerSettings} className="rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent disabled:opacity-60">{savingResellerSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}</button>
            </div>
            <p className="mt-2 text-xs text-white/40">Mínimo permitido: 50 USDT.</p>
          </div>

          <div className="card p-4">
            <p className="text-sm font-semibold text-white/80">Pagos a vendedores internos</p>
            <p className="mt-1 text-xs text-white/45">Las ventas quedan retenidas en USDT BEP20. Se descuenta comisión de plataforma y se libera a disponible cuando el pedido esté completado y pase el tiempo de seguridad.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs text-white/50">Comisión por defecto %
                <input value={sellerPayoutSettings.seller_default_commission_pct} onChange={e => setSellerPayoutSettings(v => ({ ...v, seller_default_commission_pct: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              </label>
              <label className="block text-xs text-white/50">Fee mínimo USDT
                <input value={sellerPayoutSettings.seller_min_platform_fee} onChange={e => setSellerPayoutSettings(v => ({ ...v, seller_min_platform_fee: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              </label>
              <label className="block text-xs text-white/50">Retención manual días
                <input value={sellerPayoutSettings.seller_hold_days_manual} onChange={e => setSellerPayoutSettings(v => ({ ...v, seller_hold_days_manual: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              </label>
              <label className="block text-xs text-white/50">Retención automática días
                <input value={sellerPayoutSettings.seller_hold_days_auto} onChange={e => setSellerPayoutSettings(v => ({ ...v, seller_hold_days_auto: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              </label>
              <label className="block text-xs text-white/50">Vendedor nuevo por días
                <input value={sellerPayoutSettings.seller_new_days} onChange={e => setSellerPayoutSettings(v => ({ ...v, seller_new_days: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              </label>
              <label className="block text-xs text-white/50">Retención vendedor nuevo
                <input value={sellerPayoutSettings.seller_new_hold_days} onChange={e => setSellerPayoutSettings(v => ({ ...v, seller_new_hold_days: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              </label>
              <label className="block text-xs text-white/50">Fee retiro USDT
                <input value={sellerPayoutSettings.seller_withdraw_fee_usdt} onChange={e => setSellerPayoutSettings(v => ({ ...v, seller_withdraw_fee_usdt: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              </label>
            </div>
            <button onClick={saveSellerPayoutSettings} disabled={savingSellerPayoutSettings} className="mt-3 w-full rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent disabled:opacity-60">{savingSellerPayoutSettings ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Guardar reglas de vendedores'}</button>
          </div>

          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white/80">Catálogo BuffPin</p>
                <p className="mt-1 text-xs text-white/45">Cambia imagen, nombre, orden, visibilidad y márgenes. También puedes traer productos nuevos desde BuffPin.</p>
              </div>
              <button onClick={refreshBuffpinCatalog} disabled={refreshingBuffpin} className="flex-shrink-0 rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent disabled:opacity-60">
                {refreshingBuffpin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
              </button>
            </div>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {pricing.map(item => (
              <button key={item.game_name} onClick={() => setSelectedPricingGame(item.game_name)} className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-bg text-left active:scale-95">
                <div className="relative aspect-square w-full overflow-hidden bg-white/5">
                  {item.icon_url ? <img src={(item.icon_url || '') + '?v=' + Math.floor(Date.now() / 3600000)} className="h-full w-full object-cover" alt={item.display_name || item.game_name} /> : <div className="flex h-full w-full items-center justify-center"><Gamepad2 className="h-8 w-8 text-white/30" /></div>}
                  <span className={(item.icon_url ? 'bg-green-500/80' : 'bg-red-500/80') + ' absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold text-white'}>
                    {item.icon_url ? 'Con imagen' : 'Sin imagen'}
                  </span>
                </div>
                <div className="p-2">
                  <p className="line-clamp-2 min-h-[28px] text-[11px] font-bold leading-tight text-white/80">{item.display_name || item.game_name}</p>
                </div>
              </button>
            ))}
          </div>

          {selectedPricingItem && (
            <div className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-sm">
              <div className="mx-auto flex h-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-bg shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{selectedPricingItem.display_name || selectedPricingItem.game_name}</p>
                    <p className="text-xs text-white/40">{selectedPricingItem.products_count} productos · BuffPin</p>
                  </div>
                  <button onClick={() => setSelectedPricingGame(null)} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 active:scale-95" aria-label="Cerrar">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-card">
                      {selectedPricingItem.icon_url ? <img src={(selectedPricingItem.icon_url || '') + '?v=' + Math.floor(Date.now() / 3600000)} className="h-full w-full object-cover" alt={selectedPricingItem.display_name || selectedPricingItem.game_name} /> : <div className="flex h-full w-full items-center justify-center"><Gamepad2 className="h-9 w-9 text-white/35" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/45">Producto</p>
                      <p className="truncate text-sm font-semibold text-white/85">{selectedPricingItem.game_name}</p>
                      <p className="mt-1 text-xs text-white/40">Costo {Number(selectedPricingItem.min_cost || 0).toFixed(2)}-{Number(selectedPricingItem.max_cost || 0).toFixed(2)} USDT</p>
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/75 active:scale-95">
                        <FileText className="h-3.5 w-3.5" /> Cambiar imagen
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleGameImageUpload(selectedPricingItem, e.target.files?.[0])} />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs text-white/50">Nombre visible
                      <input value={selectedPricingItem.display_name || ''} onChange={e => updatePricingField(selectedPricingItem.game_name, 'display_name', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
                    </label>
                    <label className="block text-xs text-white/50">Orden
                      <input value={selectedPricingItem.sort_order ?? 100} onChange={e => updatePricingField(selectedPricingItem.game_name, 'sort_order', e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
                    </label>
                    <label className="col-span-2 flex items-center gap-2 rounded-lg border border-white/10 bg-card px-3 py-2 text-sm text-white/70">
                      <input type="checkbox" checked={!!selectedPricingItem.is_hidden} onChange={e => updatePricingField(selectedPricingItem.game_name, 'is_hidden', e.target.checked)} /> Ocultar del catálogo
                    </label>
                    <div className="col-span-2 block text-xs text-white/50">
                      <span className="text-xs text-white/50 mb-1 block">Descripción pública</span>
                      <PremiumRichTextEditor value={selectedPricingItem.description || ''} onChange={(value) => updatePricingField(selectedPricingItem.game_name, 'description', value)} rows={5} placeholder="Texto que verá el cliente debajo de las denominaciones." className="mt-1 w-full" />
                      {isAdminRole && <PremiumStickerPicker value={selectedPricingItem.description || ''} onInsert={(code) => updatePricingField(selectedPricingItem.game_name, 'description', `${selectedPricingItem.description || ''}${selectedPricingItem.description && !String(selectedPricingItem.description).endsWith(' ') ? ' ' : ''}${code} `)} />}
                    </div>
                    <div className="col-span-2 block text-xs text-white/50">
                      <span className="text-xs text-white/50 mb-1 block">Cómo usar / instrucciones</span>
                      <PremiumRichTextEditor value={selectedPricingItem.instructions || ''} onChange={(value) => updatePricingField(selectedPricingItem.game_name, 'instructions', value)} rows={6} placeholder="Pasos o instrucciones para canjear, activar o usar el producto." className="mt-1 w-full" />
                      {isAdminRole && <PremiumStickerPicker value={selectedPricingItem.instructions || ''} onInsert={(code) => updatePricingField(selectedPricingItem.game_name, 'instructions', `${selectedPricingItem.instructions || ''}${selectedPricingItem.instructions && !String(selectedPricingItem.instructions).endsWith(' ') ? ' ' : ''}${code} `)} />}
                    </div>
                    <button onClick={() => saveGameVisual(selectedPricingItem)} disabled={savingGameVisual === selectedPricingItem.game_name} className="col-span-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white/75 disabled:opacity-60">
                      {savingGameVisual === selectedPricingItem.game_name ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Guardar imagen, datos y ayuda'}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-white/50">Cliente %</label>
                      <input
                        value={selectedPricingItem.retail_markup ?? ''}
                        onChange={(e) => updatePricingField(selectedPricingItem.game_name, 'retail_markup', e.target.value)}
                        placeholder={String(selectedPricingItem.effective_retail_markup)}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/50">Revendedor %</label>
                      <input
                        value={selectedPricingItem.reseller_markup ?? ''}
                        onChange={(e) => updatePricingField(selectedPricingItem.game_name, 'reseller_markup', e.target.value)}
                        placeholder={String(selectedPricingItem.effective_reseller_markup)}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => savePricing(selectedPricingItem)}
                    disabled={savingPricing === selectedPricingItem.game_name}
                    className="mt-4 w-full rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent disabled:opacity-60"
                  >
                    {savingPricing === selectedPricingItem.game_name ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <span className="inline-flex items-center justify-center gap-1"><Save className="h-4 w-4" />Guardar ganancia</span>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


async function compressImageForUpload(file) {
  if (file.size <= 850 * 1024) return file
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo procesar la imagen'))
    image.src = dataUrl
  })
  const maxSide = 1200
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const makeBlob = (quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  let quality = 0.82
  let blob = await makeBlob(quality)
  while (blob && blob.size > 850 * 1024 && quality > 0.45) {
    quality -= 0.1
    blob = await makeBlob(quality)
  }
  if (!blob) throw new Error('No se pudo comprimir la imagen')
  if (blob.size > 950 * 1024) throw new Error('La imagen es muy grande. Usa una más liviana')
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

function AdminUsersPanel() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [roleDraft, setRoleDraft] = useState('user')
  const [accountStoreName, setAccountStoreName] = useState('')
  const [accountMaxProducts, setAccountMaxProducts] = useState('10')
  const [accountCommission, setAccountCommission] = useState('10')
  const [banReason, setBanReason] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [riskTag, setRiskTag] = useState('')
  const [err, setErr] = useState(null)

  async function search() {
    if (!query.trim()) { setUsers([]); return }
    setLoading(true); setErr(null)
    try { setUsers(await api.adminUsers(query.trim())) }
    catch (e) { setErr(e.message) }
    setLoading(false)
  }

  async function loadUserDetail(userId) {
    setLoading(true); setErr(null)
    try {
      const data = await api.adminUserDetail(userId)
      setDetail(data)
      setSelected(data.user)
      setRoleDraft(data.user.role || 'user')
      const storeProfile = data.user.account_seller_profile || {}
      setAccountStoreName(storeProfile.store_name || data.user.first_name || data.user.username || data.user.email || `Tienda ${data.user.user_id}`)
      setAccountMaxProducts(String(storeProfile.max_active_products ?? 10))
      setAccountCommission(String(storeProfile.commission_percent ?? 10))
      setBanReason(data.user.ban_reason || '')
      setInternalNote(data.user.internal_note || '')
      setRiskTag(data.user.risk_tag || '')
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  async function adjustBalance(sign = 1) {
    if (!selected) return
    const value = Number(String(amount).replace(',', '.'))
    if (!value || value <= 0) { setErr('Monto inválido'); return }
    setLoading(true); setErr(null)
    try {
      const res = await api.adjustUserBalance(selected.user_id, sign * value, note.trim() || 'Ajuste manual')
      setAmount(''); setNote('')
      await loadUserDetail(res.user_id)
      setUsers(items => items.map(u => u.user_id === res.user_id ? { ...u, balance: res.balance } : u))
    } catch (e) { setErr(e.message); setLoading(false) }
  }

  async function saveRole() {
    if (!selected) return
    setLoading(true); setErr(null)
    const extra = roleDraft === 'account_seller' ? {
      store_name: accountStoreName.trim() || selected.first_name || selected.username || selected.email || `Tienda ${selected.user_id}`,
      max_active_products: Number(accountMaxProducts || 10),
      commission_percent: Number(accountCommission || 10),
    } : {}
    try { await api.updateUserRole(selected.user_id, roleDraft, extra); await loadUserDetail(selected.user_id); await search() }
    catch (e) { setErr(e.message); setLoading(false) }
  }

  async function toggleBan(next) {
    if (!selected) return
    setLoading(true); setErr(null)
    try { await api.updateUserBan(selected.user_id, next, banReason); await loadUserDetail(selected.user_id); await search() }
    catch (e) { setErr(e.message); setLoading(false) }
  }

  async function saveNote() {
    if (!selected) return
    setLoading(true); setErr(null)
    try { await api.updateUserNote(selected.user_id, internalNote, riskTag); await loadUserDetail(selected.user_id); await search() }
    catch (e) { setErr(e.message); setLoading(false) }
  }

  const fmtDate = (ts) => ts ? new Date(ts * 1000).toLocaleString('es-ES') : '--'

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <p className="text-sm font-semibold text-white/80">Buscar cliente</p>
        <div className="mt-3 flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="@usuario, correo, ID Telegram o ID web" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-bg px-3 py-3 text-sm outline-none focus:border-accent" />
          <button onClick={search} disabled={loading} className="rounded-lg bg-accent px-4 py-3 text-sm font-bold text-black disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}</button>
        </div>
      </div>

      {err && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

      {users.map(u => (
        <button key={u.user_id} onClick={() => loadUserDetail(u.user_id)} className={`w-full rounded-xl border p-4 text-left ${selected?.user_id === u.user_id ? 'border-accent bg-accent/10' : 'border-white/10 bg-card'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{u.name}</p>
              <p className="text-xs text-white/45">ID: {u.user_id}{u.username ? ` · @${u.username}` : ''}</p>
              {u.email && <p className="text-xs text-white/45">{u.email}</p>}
              <p className="mt-1 text-xs text-white/40">Rol: {u.role}{u.is_banned ? ' · Suspendido' : ''}</p>
            </div>
            <p className="text-lg font-bold text-accent">${Number(u.balance || 0).toFixed(2)}</p>
          </div>
        </button>
      ))}

      {detail && selected && (
        <div className="space-y-3">
          <div className="card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{selected.first_name || selected.email || selected.username || 'Usuario'}</p>
                <p className="text-xs text-white/45">ID {selected.user_id} · {selected.email || 'sin email'} · {selected.username ? '@' + selected.username : 'sin usuario'}</p>
                {selected.risk_tag && <p className="mt-1 text-xs font-semibold text-yellow-300">Marca: {selected.risk_tag}</p>}
              </div>
              <p className="font-bold text-accent">${Number(selected.balance || 0).toFixed(2)} USDT</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Auto</p><p className="font-bold">{detail.orders.length}</p></div>
              <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Manual</p><p className="font-bold">{detail.manual_orders.length}</p></div>
              <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Depósitos</p><p className="font-bold">{detail.deposits.length}</p></div>
            </div>
          </div>

          <div className="card p-4">
            <p className="mb-3 text-sm font-semibold">Acciones</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="Monto" className="rounded-lg border border-white/10 bg-bg px-3 py-3 text-sm outline-none focus:border-accent" />
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Motivo" className="rounded-lg border border-white/10 bg-bg px-3 py-3 text-sm outline-none focus:border-accent" />
              <button onClick={() => adjustBalance(1)} disabled={loading} className="rounded-lg bg-green-500/20 px-3 py-3 text-sm font-bold text-green-300 disabled:opacity-60">Agregar saldo</button>
              <button onClick={() => adjustBalance(-1)} disabled={loading} className="rounded-lg bg-red-500/20 px-3 py-3 text-sm font-bold text-red-300 disabled:opacity-60">Quitar saldo</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select value={roleDraft} onChange={e => setRoleDraft(e.target.value)} className="rounded-lg border border-white/10 bg-bg px-3 py-3 text-sm outline-none focus:border-accent">
                <option value="user">Cliente</option><option value="reseller">Revendedor</option><option value="account_seller">Vendedor de cuentas</option><option value="seller">Vendedor general</option><option value="admin">Admin</option>
              </select>
              <button onClick={saveRole} disabled={loading} className="rounded-lg bg-accent/20 px-3 py-3 text-sm font-bold text-accent disabled:opacity-60">Cambiar rol</button>
            </div>
            {roleDraft === 'account_seller' && (
              <div className="mt-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                <p className="mb-2 text-xs font-semibold text-green-300">Crear tienda de vendedor de cuentas</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={accountStoreName} onChange={e => setAccountStoreName(e.target.value)} placeholder="Nombre de tienda" className="col-span-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                  <input value={accountMaxProducts} onChange={e => setAccountMaxProducts(e.target.value)} inputMode="numeric" placeholder="Máx cuentas activas" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                  <input value={accountCommission} onChange={e => setAccountCommission(e.target.value)} inputMode="decimal" placeholder="Comisión %" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                </div>
                <p className="mt-2 text-[11px] text-white/50">Acepta usuarios con Telegram o login web. Se usa el ID interno mostrado arriba y se crea la tienda automáticamente.</p>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Motivo suspensión" className="rounded-lg border border-white/10 bg-bg px-3 py-3 text-sm outline-none focus:border-accent" />
              <button onClick={() => toggleBan(!selected.is_banned)} disabled={loading} className={`rounded-lg px-3 py-3 text-sm font-bold disabled:opacity-60 ${selected.is_banned ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selected.is_banned ? 'Quitar suspensión' : 'Suspender'}</button>
            </div>
          </div>

          <div className="card p-4">
            <p className="mb-3 text-sm font-semibold">Notas internas</p>
            <select value={riskTag} onChange={e => setRiskTag(e.target.value)} className="mb-2 w-full rounded-lg border border-white/10 bg-bg px-3 py-3 text-sm outline-none focus:border-accent">
              <option value="">Sin marca</option><option value="VIP">VIP</option><option value="RIESGO">Riesgo</option><option value="REVISAR">Revisar</option>
            </select>
            <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)} rows={3} placeholder="Nota privada visible solo para admin" className="w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
            <button onClick={saveNote} disabled={loading} className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white/75 disabled:opacity-60">Guardar nota</button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="card p-4"><p className="mb-2 text-sm font-semibold">Balance log</p>{detail.balance_log.slice(0, 8).map(x => <p key={x.id} className="border-t border-white/5 py-2 text-xs text-white/60">{fmtDate(x.created_at)} · {Number(x.amount || 0).toFixed(2)} · {x.type} · {x.note}</p>)}</div>
            <div className="card p-4"><p className="mb-2 text-sm font-semibold">Pedidos manuales</p>{detail.manual_orders.slice(0, 8).map(o => <p key={o.id} className="border-t border-white/5 py-2 text-xs text-white/60">#{o.id} · {o.product_name} · ${Number(o.price || 0).toFixed(2)} · {o.status}</p>)}</div>
          </div>
        </div>
      )}
    </div>
  )
}


function AdminEditProductScreen({ product, onSaved, onCancel, me }) {
  const isNew = !product
  const [name, setName] = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const isSeller = me?.role === 'seller'
  const [category, setCategory] = useState(() => {
    if (isSeller) return 'game_account'
    return product?.category || 'service'
  })
  const [price, setPrice] = useState(product?.price?.toString() || '')
  const [iconUrl, setIconUrl] = useState(product?.icon_url || '')
  const [deliveryType, setDeliveryType] = useState(product?.delivery_type || 'manual')
  const [instructions, setInstructions] = useState(product?.instructions || '')
  const [accountGame, setAccountGame] = useState(product?.account_game || '')
  const [accountPlatform, setAccountPlatform] = useState(product?.account_platform || '')
  const [accountRegion, setAccountRegion] = useState(product?.account_region || '')
  const [accountLevel, setAccountLevel] = useState(product?.account_level || '')
  const [accountRank, setAccountRank] = useState(product?.account_rank || '')
  const [accountItems, setAccountItems] = useState(product?.account_items || '')
  const [accountCurrency, setAccountCurrency] = useState(product?.account_currency || '')
  const [accountAccessMethod, setAccountAccessMethod] = useState(product?.account_access_method || '')
  const [accountStatus, setAccountStatus] = useState(product?.account_status || 'active')
  const [accountWarranty, setAccountWarranty] = useState(product?.account_warranty || '')
  const [accountTerms, setAccountTerms] = useState(product?.account_terms || '')
  const [accountImages, setAccountImages] = useState(Array.isArray(product?.account_images) ? product.account_images : [])
  const [accountImageUrl, setAccountImageUrl] = useState('')
  const [autoDeliveryText, setAutoDeliveryText] = useState(product?.auto_delivery_text || '')
  const [autoDeliveryFileUrl, setAutoDeliveryFileUrl] = useState(product?.auto_delivery_file_url || '')
  const [autoDeliveryFileName, setAutoDeliveryFileName] = useState(product?.auto_delivery_file_name || '')
  const [autoDeliveryFileMime, setAutoDeliveryFileMime] = useState(product?.auto_delivery_file_mime || '')
  const [digitalStock, setDigitalStock] = useState(null)
  const [digitalStockText, setDigitalStockText] = useState('')
  const [digitalStockType, setDigitalStockType] = useState('code')
  const [digitalStockOptionId, setDigitalStockOptionId] = useState('')
  const [loadingStock, setLoadingStock] = useState(false)
  const [isActive, setIsActive] = useState(product?.is_active !== false)
  const [stock, setStock] = useState(product?.stock?.toString() || '-1')
  const [options, setOptions] = useState((product?.options || []).map(o => ({ name: o.name || '', price: String(o.price ?? ''), stock: String(o.stock ?? -1), is_active: o.is_active !== false })))
  const [fields, setFields] = useState((product?.fields || []).map(f => ({ label: f.label || '', field_type: f.field_type || 'text', placeholder: f.placeholder || '', is_required: f.is_required !== false, is_active: f.is_active !== false })))
  const [saving, setSaving] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [uploadingDeliveryFile, setUploadingDeliveryFile] = useState(false)
  const [iconPreview, setIconPreview] = useState(product?.icon_url || '')
  const [err, setErr] = useState(null)
  const [canUsePremiumStickers, setCanUsePremiumStickers] = useState(false)

  useEffect(() => {
    api.profile().then((profile) => setCanUsePremiumStickers(profile?.role === 'admin')).catch(() => setCanUsePremiumStickers(false))
  }, [])

  function getHeaders() {
    const h = { 'Content-Type': 'application/json' }
    if (tg?.initData) h['X-Telegram-Init-Data'] = tg.initData
    else {
      const t = localStorage.getItem('fs_token')
      if (t) h['Authorization'] = `Bearer ${t}`
    }
    return h
  }

  useEffect(() => {
    if (!isNew && deliveryType === 'digital_stock') loadDigitalStock()
  }, [deliveryType])

  async function loadDigitalStock() {
    if (isNew || !product?.id) return
    setLoadingStock(true)
    try { setDigitalStock(await api.adminDigitalStock(product.id)) }
    catch (e) { setErr(e.message) }
    setLoadingStock(false)
  }

  async function importStockItems() {
    if (isNew) { setErr('Primero guarda el producto y luego carga el stock digital'); return }
    if (!digitalStockText.trim()) { setErr('Pega al menos una línea de stock'); return }
    setLoadingStock(true); setErr(null)
    try {
      await api.importDigitalStock(product.id, digitalStockType, digitalStockText, digitalStockOptionId ? Number(digitalStockOptionId) : null)
      setDigitalStockText('')
      await loadDigitalStock()
      setDeliveryType('digital_stock')
    } catch (e) { setErr(e.message) }
    setLoadingStock(false)
  }

  async function handleIconFile(file) {
    if (!file) return
    if (!file.type?.startsWith('image/')) { setErr('Selecciona una imagen válida'); return }
    if (file.size > 5 * 1024 * 1024) { setErr('La imagen no puede pasar de 5 MB'); return }
    const previewUrl = URL.createObjectURL(file)
    setIconPreview(previewUrl)
    setUploadingIcon(true); setErr(null)
    try {
      const uploadFile = await compressImageForUpload(file)
      const res = await api.uploadIcon(uploadFile)
      setIconUrl(res.url)
      setIconPreview(res.url)
    } catch (e) { setErr(e.message) }
    finally { setUploadingIcon(false) }
  }


  async function handleAccountImageFiles(files) {
    const selected = Array.from(files || [])
    if (selected.length === 0) return
    setUploadingIcon(true); setErr(null)
    try {
      const uploaded = []
      for (const file of selected) {
        if (!file.type?.startsWith('image/')) throw new Error('Selecciona solo imágenes válidas')
        if (file.size > 5 * 1024 * 1024) throw new Error('Cada imagen no puede pasar de 5 MB')
        const uploadFile = await compressImageForUpload(file)
        const res = await api.uploadIcon(uploadFile)
        uploaded.push(res.url)
      }
      setAccountImages(prev => [...new Set([...prev, ...uploaded])])
      if (!iconUrl && uploaded[0]) { setIconUrl(uploaded[0]); setIconPreview(uploaded[0]) }
    } catch (e) { setErr(e.message) }
    finally { setUploadingIcon(false) }
  }

  async function handleDeliveryFile(file) {
    if (!file) return
    const allowed = ['text/plain', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/vnd.rar']
    const okExt = /\.(txt|pdf|jpe?g|png|webp|gif|zip|rar)$/i.test(file.name || '')
    if (!allowed.includes(file.type) && !okExt) { setErr('Usa TXT, PDF, imagen, ZIP o RAR'); return }
    if (file.size > 25 * 1024 * 1024) { setErr('El archivo no puede pasar de 25 MB'); return }
    setUploadingDeliveryFile(true); setErr(null)
    try {
      const res = await api.uploadDeliveryFile(file)
      setAutoDeliveryFileUrl(res.url)
      setAutoDeliveryFileName(res.filename || file.name)
      setAutoDeliveryFileMime(res.content_type || file.type || 'application/octet-stream')
    } catch (e) { setErr(e.message) }
    finally { setUploadingDeliveryFile(false) }
  }

  async function handleSave() {
    if (!name.trim()) { setErr('Nombre requerido'); return }
    const validOptions = options.filter(o => o.name.trim())
    if (validOptions.length === 0 && (!price || isNaN(parseFloat(price)))) { setErr('Precio inválido'); return }
    if (validOptions.some(o => !o.price || isNaN(parseFloat(o.price)))) { setErr('Hay opciones con precio inválido'); return }
    if (category === 'game_account') {
      setDeliveryType('manual')
      if (!accountGame.trim()) { setErr('Juego requerido para cuenta'); return }
      if (!accountAccessMethod.trim()) { setErr('Método de acceso requerido'); return }
    }
    if (deliveryType === 'auto_text' && !autoDeliveryText.trim()) { setErr('Escribe el texto de entrega automática'); return }
    if (deliveryType === 'auto_file' && !autoDeliveryFileUrl) { setErr('Sube el archivo de entrega automática'); return }
    const validFields = fields.filter(f => f.label.trim())
    setSaving(true); setErr(null)

    const body = {
      name: name.trim(),
      description: description.trim(),
      category,
      price: validOptions.length > 0 ? Math.min(...validOptions.map(o => parseFloat(o.price))) : parseFloat(price),
      options: validOptions.map((o, idx) => ({
        name: o.name.trim(),
        price: parseFloat(o.price),
        stock: parseInt(o.stock) || -1,
        sort_order: idx + 1,
        is_active: o.is_active !== false,
      })),
      fields: validFields.map((f, idx) => ({
        label: f.label.trim(),
        field_type: f.field_type || 'text',
        placeholder: f.placeholder?.trim() || '',
        is_required: f.is_required !== false,
        sort_order: idx + 1,
        is_active: f.is_active !== false,
      })),
      icon_url: iconUrl.trim() || null,
      delivery_type: category === 'game_account' ? 'manual' : deliveryType,
      instructions: instructions.trim(),
      account_game: accountGame.trim(),
      account_platform: accountPlatform.trim(),
      account_region: accountRegion.trim(),
      account_level: accountLevel.trim(),
      account_rank: accountRank.trim(),
      account_items: accountItems.trim(),
      account_currency: accountCurrency.trim(),
      account_access_method: accountAccessMethod.trim(),
      account_status: category === 'game_account' ? accountStatus : '',
      account_warranty: accountWarranty.trim(),
      account_terms: accountTerms.trim(),
      account_images: accountImages,
      auto_delivery_type: deliveryType === 'auto_file' ? 'file' : deliveryType === 'auto_text' ? 'text' : deliveryType === 'digital_stock' ? 'stock' : null,
      auto_delivery_text: deliveryType === 'auto_text' ? autoDeliveryText.trim() : '',
      auto_delivery_file_url: deliveryType === 'auto_file' ? autoDeliveryFileUrl : '',
      auto_delivery_file_name: deliveryType === 'auto_file' ? autoDeliveryFileName : '',
      auto_delivery_file_mime: deliveryType === 'auto_file' ? autoDeliveryFileMime : '',
      is_active: isActive,
      stock: category === 'game_account' ? (accountStatus === 'sold' ? 0 : 1) : (parseInt(stock) || -1),
    }

    try {
      const url = isNew
        ? '/api/admin/manual-products'
        : `/api/admin/manual-products/${product.id}`
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      onSaved()
    } catch (e) { setErr(e.message); setSaving(false) }
  }

  return (
    <div className="px-2.5 py-4 md:p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">{isNew ? <><Package className="h-5 w-5" aria-hidden="true" />Crear producto</> : <><Edit3 className="h-5 w-5" aria-hidden="true" />Editar producto</>}</h2>

      {err && <p className="text-red-400 text-sm mb-3 card p-2 text-center">{err}</p>}

      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: ChatGPT Plus - 1 mes"
            className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-accent" />
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1 block">Descripción</label>
          <PremiumRichTextEditor value={description} onChange={setDescription} rows={3}
            placeholder="Describe el producto, qué recibe el cliente..."
            className="w-full" />
          {canUsePremiumStickers && <PremiumStickerPicker value={description} onInsert={(code) => appendPremiumStickerText(setDescription, code)} />}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Precio USDT *</label>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01"
              placeholder="15.00"
              className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Stock (-1 = ∞)</label>
            <input value={stock} onChange={e => setStock(e.target.value)} type="number"
              className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-accent" />
          </div>
        </div>

        <div className="card p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Opciones de compra</p>
              <p className="text-xs text-white/45">Úsalo para productos como saldo móvil: Q100, Q300, Q500.</p>
            </div>
            <button
              onClick={() => setOptions([...options, { name: '', price: '', stock: '-1', is_active: true }])}
              className="rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent"
            >
              + Opción
            </button>
          </div>
          {options.length === 0 ? (
            <p className="text-xs text-white/40">Sin opciones. Se usará el precio único del producto.</p>
          ) : (
            <div className="space-y-3">
              {options.map((opt, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/50">Opción {idx + 1}</span>
                    <button
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      className="rounded-lg bg-red-500/15 px-2 py-1 text-xs text-red-300"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={opt.name}
                      onChange={e => setOptions(options.map((o, i) => i === idx ? { ...o, name: e.target.value } : o))}
                      placeholder="Q100 saldo"
                      className="col-span-2 rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <input
                      value={opt.price}
                      onChange={e => setOptions(options.map((o, i) => i === idx ? { ...o, price: e.target.value } : o))}
                      type="number"
                      step="0.01"
                      placeholder="1500"
                      className="rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <input
                      value={opt.stock}
                      onChange={e => setOptions(options.map((o, i) => i === idx ? { ...o, stock: e.target.value } : o))}
                      type="number"
                      placeholder="Stock"
                      className="rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Datos que debe llenar el cliente</p>
              <p className="text-xs text-white/45">Ej: número de teléfono, ID de jugador, @usuario de Telegram.</p>
            </div>
            <button
              onClick={() => setFields([...fields, { label: '', field_type: 'text', placeholder: '', is_required: true, is_active: true }])}
              className="rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent"
            >
              + Campo
            </button>
          </div>
          {fields.length === 0 ? (
            <p className="text-xs text-white/40">Sin campos. El cliente solo seleccionará y comprará.</p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/50">Campo {idx + 1}</span>
                    <button
                      onClick={() => setFields(fields.filter((_, i) => i !== idx))}
                      className="rounded-lg bg-red-500/15 px-2 py-1 text-xs text-red-300"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={field.label}
                      onChange={e => setFields(fields.map((f, i) => i === idx ? { ...f, label: e.target.value } : f))}
                      placeholder="Número de teléfono"
                      className="col-span-2 rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <select
                      value={field.field_type}
                      onChange={e => setFields(fields.map((f, i) => i === idx ? { ...f, field_type: e.target.value } : f))}
                      className="rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                    >
                      <option value="text">Texto</option>
                      <option value="phone">Teléfono</option>
                      <option value="number">Número</option>
                      <option value="telegram">Telegram</option>
                    </select>
                    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-card px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={e => setFields(fields.map((f, i) => i === idx ? { ...f, is_required: e.target.checked } : f))}
                      />
                      Requerido
                    </label>
                    <input
                      value={field.placeholder}
                      onChange={e => setFields(fields.map((f, i) => i === idx ? { ...f, placeholder: e.target.value } : f))}
                      placeholder="Ej: 5355555555"
                      className="col-span-2 rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Categoría</label>
            {isSeller ? (
              <div className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-accent">
                Cuenta de juego
              </div>
            ) : (
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-accent">
                <option value="service">Servicio</option>
                <option value="account">Cuenta</option>
                <option value="game_account">Cuenta de juego</option>
                <option value="code">Código</option>
                <option value="subscription">Suscripción</option>
                <option value="other">Otro</option>
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Tipo entrega</label>
            <select value={deliveryType} onChange={e => setDeliveryType(e.target.value)}
              className="w-full bg-card border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-accent">
              <option value="manual">Manual</option>
              <option value="code">Código</option>
              <option value="account">Cuenta</option>
              <option value="game_account">Cuenta de juego</option>
              <option value="auto_text">Automática: texto</option>
              <option value="auto_file">Automática: archivo</option>
              <option value="digital_stock">Stock digital único</option>
            </select>
          </div>
        </div>


        {category === 'game_account' && (
          <div className="card p-3">
            <p className="mb-3 text-sm font-semibold">Datos de la cuenta de juego</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={accountGame} onChange={e => setAccountGame(e.target.value)} placeholder="Juego *" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={accountPlatform} onChange={e => setAccountPlatform(e.target.value)} placeholder="Plataforma" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={accountRegion} onChange={e => setAccountRegion(e.target.value)} placeholder="Región" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={accountLevel} onChange={e => setAccountLevel(e.target.value)} placeholder="Nivel" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={accountRank} onChange={e => setAccountRank(e.target.value)} placeholder="Rango" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={accountCurrency} onChange={e => setAccountCurrency(e.target.value)} placeholder="Moneda disponible" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={accountAccessMethod} onChange={e => setAccountAccessMethod(e.target.value)} placeholder="Método de acceso *" className="col-span-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={accountWarranty} onChange={e => setAccountWarranty(e.target.value)} placeholder="Garantía" className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
              <select value={accountStatus} onChange={e => { setAccountStatus(e.target.value); setIsActive(e.target.value === 'active') }} className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent">
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
                <option value="sold">Vendida</option>
              </select>
              <textarea value={accountItems} onChange={e => setAccountItems(e.target.value)} rows={3} placeholder="Skins o artículos importantes" className="col-span-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
              <textarea value={accountTerms} onChange={e => setAccountTerms(e.target.value)} rows={5} placeholder="Términos del producto" className="col-span-2 rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-bg p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Imágenes de la cuenta</p>
                  <p className="text-xs text-white/45">Puedes subir varias capturas. La primera será la principal de la galería.</p>
                </div>
                <label className="cursor-pointer rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent active:scale-95">
                  {uploadingIcon ? 'Subiendo...' : '+ Imágenes'}
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploadingIcon} onChange={(e) => { handleAccountImageFiles(e.target.files); e.target.value = '' }} />
                </label>
              </div>
              {accountImages.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {accountImages.map((url, idx) => (
                    <div key={url + idx} className="overflow-hidden rounded-lg border border-white/10 bg-card">
                      <div className="aspect-square"><img src={url} className="h-full w-full object-cover" /></div>
                      <div className="grid grid-cols-3 gap-1 p-1 text-[10px]">
                        <button onClick={() => idx > 0 && setAccountImages(items => items.map((x, i) => i === idx - 1 ? items[idx] : i === idx ? items[idx - 1] : x))} className="rounded bg-white/10 py-1">↑</button>
                        <button onClick={() => { setIconUrl(url); setIconPreview(url) }} className="rounded bg-white/10 py-1">P</button>
                        <button onClick={() => setAccountImages(items => items.filter((_, i) => i !== idx))} className="rounded bg-red-500/20 py-1 text-red-300">X</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input value={accountImageUrl} onChange={e => setAccountImageUrl(e.target.value)} placeholder="Pegar URL de imagen" className="min-w-0 rounded-lg border border-white/10 bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <button onClick={() => { const u = accountImageUrl.trim(); if (u) { setAccountImages(prev => [...new Set([...prev, u])]); if (!iconUrl) { setIconUrl(u); setIconPreview(u) } setAccountImageUrl('') } }} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">Agregar</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-white/45">Las cuentas se venden con entrega manual. Al venderse se marcarán como vendidas y se ocultarán automáticamente.</p>
          </div>
        )}

        {deliveryType === 'auto_text' && (
          <div className="card p-3">
            <label className="text-xs text-white/50 mb-1 block">Texto de entrega automática *</label>
            <textarea
              value={autoDeliveryText}
              onChange={e => setAutoDeliveryText(e.target.value)}
              rows={5}
              placeholder="Contenido que recibirá el cliente al pagar: link del curso, instrucciones, licencia, etc."
              className="w-full rounded-xl border border-white/20 bg-bg px-4 py-3 text-sm outline-none focus:border-accent resize-none"
            />
          </div>
        )}

        {deliveryType === 'auto_file' && (
          <div className="card p-3">
            <label className="text-xs text-white/50 mb-2 block">Archivo de entrega automática *</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm font-semibold active:scale-95">
              {uploadingDeliveryFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {uploadingDeliveryFile ? 'Subiendo...' : 'Subir TXT, PDF, imagen, ZIP o RAR'}
              <input
                type="file"
                accept=".txt,.pdf,image/*,.zip,.rar"
                className="hidden"
                disabled={uploadingDeliveryFile}
                onChange={(e) => handleDeliveryFile(e.target.files?.[0])}
              />
            </label>
            {autoDeliveryFileUrl && (
              <div className="mt-3 rounded-lg bg-black/20 p-3 text-xs text-white/60">
                <p className="truncate"><span className="text-white/35">Archivo:</span> {autoDeliveryFileName || autoDeliveryFileUrl}</p>
                <button onClick={() => { setAutoDeliveryFileUrl(''); setAutoDeliveryFileName(''); setAutoDeliveryFileMime('') }} className="mt-2 text-red-300">Quitar archivo</button>
              </div>
            )}
          </div>
        )}

        {deliveryType === 'digital_stock' && (
          <div className="card p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Stock digital único</p>
                <p className="text-xs text-white/45">Cada línea se entrega una sola vez. Formato opcional: etiqueta | contenido.</p>
              </div>
              {!isNew && <button onClick={loadDigitalStock} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70">Actualizar</button>}
            </div>
            {isNew ? (
              <p className="rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-200">Guarda el producto primero para poder cargar códigos, cuentas o licencias.</p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Disponible</p><p className="font-bold text-green-300">{digitalStock?.counts?.available || 0}</p></div>
                  <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Usado</p><p className="font-bold">{digitalStock?.counts?.used || 0}</p></div>
                  <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Total</p><p className="font-bold">{digitalStock?.counts?.total || 0}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={digitalStockType} onChange={e => setDigitalStockType(e.target.value)} className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent">
                    <option value="code">Código/licencia</option>
                    <option value="account">Cuenta</option>
              <option value="game_account">Cuenta de juego</option>
                    <option value="link">Link privado</option>
                    <option value="text">Texto</option>
                  </select>
                  <select value={digitalStockOptionId} onChange={e => setDigitalStockOptionId(e.target.value)} className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent">
                    <option value="">Todas las opciones</option>
                    {(product?.options || []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <textarea value={digitalStockText} onChange={e => setDigitalStockText(e.target.value)} rows={5} placeholder={"ABC-123-XYZ\nusuario:clave\nPack 1 | link privado"} className="mt-2 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
                <button onClick={importStockItems} disabled={loadingStock} className="mt-3 w-full rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent disabled:opacity-60">{loadingStock ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Importar stock'}</button>
              </>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-white/50 mb-1 block">Imagen del producto</label>
          <div className="card p-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-xl bg-bg flex items-center justify-center border border-white/10">
                {iconPreview ? <img src={iconPreview} className="h-full w-full object-cover" /> : <Package className="h-7 w-7 text-white/35" />}
              </div>
              <div className="min-w-0 flex-1">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent/20 px-3 py-2 text-sm font-bold text-accent active:scale-95">
                  {uploadingIcon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  {uploadingIcon ? 'Preparando...' : 'Seleccionar imagen'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingIcon}
                    onChange={(e) => { handleIconFile(e.target.files?.[0]); e.target.value = '' }}
                  />
                </label>
                {iconUrl && <p className="mt-2 text-xs text-green-400">Imagen cargada</p>}
              </div>
            </div>
            <input value={iconUrl} onChange={e => { setIconUrl(e.target.value); setIconPreview(e.target.value) }}
              placeholder="También puedes pegar una URL manualmente"
              className="mt-3 w-full bg-bg border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent" />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1 block">Instrucciones para el cliente</label>
          <PremiumRichTextEditor value={instructions} onChange={setInstructions} rows={2}
            placeholder="Ej: Envíame tu email de sesión por Telegram..."
            className="w-full" />
          {canUsePremiumStickers && <PremiumStickerPicker value={instructions} onInsert={(code) => appendPremiumStickerText(setInstructions, code)} />}
        </div>

        <div className="flex items-center gap-3 card p-3">
          <button onClick={() => setIsActive(!isActive)}
            className={`w-12 h-7 rounded-full flex items-center transition-colors ${isActive ? 'bg-green-500' : 'bg-white/20'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform mx-1 ${isActive ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm inline-flex items-center gap-1"><StatusIcon status={isActive ? 'active' : 'inactive'} className="h-4 w-4" />{isActive ? 'Activo (visible en catálogo)' : 'Inactivo (oculto)'}</span>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-white/20 text-white/60 font-semibold active:scale-95">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-accent to-accent2 font-bold active:scale-95 disabled:opacity-50">
          {saving ? (
            <span key="saving" className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Guardando...</span>
            </span>
          ) : isNew ? (
            <span key="new" className="inline-flex items-center justify-center gap-2">
              <Check className="h-4 w-4" />
              <span>Crear</span>
            </span>
          ) : (
            <span key="save" className="inline-flex items-center justify-center gap-2">
              <Save className="h-4 w-4" />
              <span>Guardar</span>
            </span>
          )}
        </button>
      </div>
    </div>
  )
}


function Section({ title, children }) {
  return (
    <div className="card p-4 mb-3">
      <h3 className="font-bold text-sm mb-2">{title}</h3>
      <div className="text-sm text-white/70 space-y-1">
        {children}
      </div>
    </div>
  )
}

function Linkify({ children, className }) {
  const [viewerImage, setViewerImage] = useState(null)
  if (typeof children !== 'string') return <span className={className}>{children}</span>
  const text = String(children || '')
  const parts = text.split(/((?:https?:\/\/|\/api\/delivery-files\/)[^\s<]+)/g)
  const isDeliveryFile = (url) => String(url || '').startsWith('/api/delivery-files/') || String(url || '').includes('/api/delivery-files/')
  const cleanUrl = (url) => String(url || '').replace(/[),.;]+$/g, '')
  const isImageUrl = (url) => /\.(png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(cleanUrl(url))
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!/^(https?:\/\/|\/api\/delivery-files\/)/.test(part)) return <span key={i}>{renderStickerTextSegment(part, `p${i}`)}</span>
        const cleanPart = cleanUrl(part)
        const href = storeAssetUrl(cleanPart)
        const fileName = decodeURIComponent(String(cleanPart).split('/').pop() || 'archivo')
        if (isDeliveryFile(cleanPart) && isImageUrl(cleanPart)) {
          return (
            <span key={i} className="my-2 block overflow-hidden rounded-xl border border-green-500/20 bg-black/20">
              <button type="button" onClick={(e) => { e.stopPropagation(); setViewerImage(href) }} className="block w-full bg-black/30 text-left active:scale-[0.995]">
                <OptimizedImage src={href} alt="Imagen de entrega" className="max-h-80 w-full object-contain" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setViewerImage(href) }} className="block w-full border-t border-white/10 px-3 py-2 text-left text-xs font-bold text-green-300">
                Ver imagen completa
              </button>
            </span>
          )
        }
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer"
             className="inline-flex max-w-full items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-blue-300 underline break-all"
             onClick={(e) => e.stopPropagation()}>
            {isDeliveryFile(cleanPart) ? `Descargar ${fileName}` : cleanPart}
          </a>
        )
      })}
      {viewerImage && (
        <span className="fixed inset-0 z-[100] flex flex-col bg-black/95 p-3" onClick={(e) => e.stopPropagation()}>
          <span className="mb-3 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-bold text-white">Imagen de entrega</span>
            <button type="button" onClick={() => setViewerImage(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>
          </span>
          <span className="flex min-h-0 flex-1 items-center justify-center">
            <OptimizedImage src={viewerImage} className="max-h-full max-w-full object-contain" alt="Imagen de entrega" eager />
          </span>
        </span>
      )}
    </span>
  )
}

function ProfileScreen({ onOrders, onHome, onAdmin, onPartnerHelp }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [linkCode, setLinkCode] = useState(null)
  const [changePwd, setChangePwd] = useState(false)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdMsg, setPwdMsg] = useState(null)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showTopUp, setShowTopUp] = useState(false)
  const [sellerStoreSlug, setSellerStoreSlug] = useState('')
  const [guideSlug, setGuideSlug] = useState('')

  useEffect(() => {
    api.profile()
      .then(p => { setProfile(p); setLoading(false) })
      .catch(e => { setErr(e.message); setLoading(false) })
  }, [])

  if (loading) return <CoolLoading label="Cargando tu perfil..." />
  if (err) return <ErrorView msg={err} />
  if (!profile) return null

  const memberDate = profile.member_since
    ? new Date(profile.member_since * 1000).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
    : '—'

  const isTg = api.isTelegram()
  const hasEmail = !!profile.email
  const hasTelegram = profile.telegram_id > 0

  async function handleLinkTelegram() {
    try {
      const data = await api.linkTelegram()
      if (data.already_linked) {
        setLinkCode({ code: null, msg: `Ya vinculado con Telegram ID: ${data.telegram_id}` })
      } else {
        setLinkCode({ code: data.code, msg: data.message })
      }
    } catch (e) { setLinkCode({ code: null, msg: e.message }) }
  }

  async function handleChangePwd() {
    if (pwdNew.length < 8) { setPwdMsg('Mínimo 8 caracteres'); return }
    setPwdLoading(true); setPwdMsg(null)
    try {
      await api.changePassword(pwdCurrent || null, pwdNew)
      setPwdMsg('Contraseña actualizada')
      setChangePwd(false); setPwdCurrent(''); setPwdNew('')
    } catch (e) { setPwdMsg(e.message) }
    setPwdLoading(false)
  }

  return (
    <div className="px-2.5 py-4 md:p-6">
      {/* Avatar y nombre */}
      <div className="card bg-gradient-to-br from-accent/20 to-accent2/20 p-6 mb-4 text-center border-accent/20">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center mx-auto mb-3 text-3xl font-bold">
          {(profile.name || '?')[0]?.toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{profile.name}</h2>
        {profile.username && <p className="text-sm text-white/50">@{profile.username}</p>}
        <p className="text-xs text-white/40 mt-1">{profile.role_label}</p>
        <p className="text-xs text-white/30 mt-2">Miembro desde {memberDate}</p>
      </div>

      {/* Saldo */}
      <div className="card p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/50 mb-1">Saldo disponible</p>
            <p className="text-3xl font-bold text-accent">${profile.balance.toFixed(2)} <span className="text-sm text-white/40">USDT</span></p>
          </div>
          <button onClick={() => setShowTopUp(true)}
            className="rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent active:scale-95">
            <span className="inline-flex items-center justify-center gap-1"><Send className="h-3.5 w-3.5" aria-hidden="true" />Recargar</span>
          </button>
        </div>
        <p className="mt-3 text-xs text-white/45">Puedes recargar desde la web con OxaPay. La página de pago permite elegir red y moneda disponible.</p>
      </div>

      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} onPaid={(balance) => { setProfile(prev => ({ ...prev, balance })); setShowTopUp(false) }} />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-3">
          <p className="text-xs text-white/50">Pedidos</p>
          <p className="text-xl font-bold">{profile.stats.total_orders}</p>
          <p className="text-[10px] text-green-400 mt-1">{profile.stats.completed_orders} completados</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-white/50">Gastado</p>
          <p className="text-xl font-bold">${profile.stats.total_spent.toFixed(2)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-white/50">Depósitos</p>
          <p className="text-xl font-bold">${profile.stats.total_deposited.toFixed(2)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-white/50">Fallidas</p>
          <p className="text-xl font-bold">{profile.stats.failed_orders}</p>
        </div>
      </div>

      {/* Pedidos */}
      <button onClick={onOrders} className="card p-4 w-full flex items-center justify-between mb-3 active:scale-95">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-accent" />
          <div className="text-left">
            <p className="font-semibold">Mis pedidos</p>
            <p className="text-xs text-white/50">Ver historial</p>
          </div>
        </div>
        <span className="text-white/30">›</span>
      </button>

      {['reseller', 'seller', 'admin'].includes(profile.role) && (
        <button onClick={onPartnerHelp} className="card p-4 w-full flex items-center justify-between mb-3 active:scale-95 border-accent/20">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-accent" />
            <div className="text-left">
              <p className="font-semibold text-accent">Ayuda para vender</p>
              <p className="text-xs text-white/50">Funciones, entregas y reglas de revendedor</p>
            </div>
          </div>
          <span className="text-white/30">›</span>
        </button>
      )}

      {profile.role === 'reseller' && !profile.reseller_discount_active && (
        <div className="card mb-4 border-yellow-500/20 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-yellow-300"><AlertTriangle className="h-4 w-4" />Precios preferenciales pendientes</p>
          <p className="mt-2 text-xs text-white/60">Debes llegar a ${Number(profile.reseller_min_deposit || 50).toFixed(2)} USDT depositados. Faltan ${Number(profile.reseller_deposit_remaining || 0).toFixed(2)} USDT.</p>
          <button onClick={() => setShowTopUp(true)} className="mt-3 rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent">Depositar</button>
        </div>
      )}

      {/* Panel Privado — visible para admins, vendedores y revendedores */}
      {['admin', 'seller', 'reseller'].includes(profile.role) && (
        <button onClick={onAdmin} className="card p-4 w-full flex items-center justify-between mb-4 active:scale-95 border-yellow-500/30">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-yellow-400" />
            <div className="text-left">
              <p className="font-semibold text-yellow-400">Panel Privado</p>
              <p className="text-xs text-white/50">Administración y herramientas comerciales</p>
            </div>
          </div>
          <span className="text-white/30">›</span>
        </button>
      )}


      <div className="card p-4 mb-4 border-green-500/20">
        <p className="flex items-center gap-2 text-sm font-semibold text-green-300"><Gift className="h-4 w-4" />Referidos</p>
        <p className="mt-2 text-xs text-white/60">Comparte tu enlace. Cuando alguien entra con tu referencia, queda registrado para auditoría y futuras promociones.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Referidos</p><p className="font-bold">{profile.referral_stats?.count || 0}</p></div>
          <div className="rounded-lg bg-black/20 p-2"><p className="text-xs text-white/40">Compras</p><p className="font-bold">${Number(profile.referral_stats?.total_referred_spent || 0).toFixed(2)}</p></div>
        </div>
        <button onClick={() => copyText(`${window.location.origin}${window.location.pathname}?ref=${profile.referral_code || profile.user_id}`)} className="mt-3 w-full rounded-lg bg-green-500/15 px-3 py-2 text-sm font-bold text-green-300"><span className="inline-flex items-center justify-center gap-1"><LinkIcon className="h-4 w-4" />Copiar enlace de referido</span></button>
      </div>

      {/* ═══ SECCIÓN: CUENTAS VINCULADAS ═══ */}
      <h3 className="text-sm font-bold uppercase text-white/60 mb-3 mt-6 flex items-center gap-2"><LinkIcon className="h-4 w-4" />Cuentas vinculadas</h3>

      {/* Telegram */}
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-6 w-6 text-accent" />
            <div>
              <p className="font-semibold text-sm">Telegram</p>
              {hasTelegram ? (
                <p className="text-xs text-green-400"><span className="inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" />Vinculado · ID: {profile.telegram_id}</span></p>
              ) : (
                <p className="text-xs text-yellow-400"><span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />No vinculado</span></p>
              )}
            </div>
          </div>
        </div>
        {!hasTelegram && !linkCode && (
          <button onClick={handleLinkTelegram}
            className="mt-3 w-full py-2 rounded-lg bg-accent/20 text-accent text-sm font-semibold active:scale-95">
            <span className="inline-flex items-center justify-center gap-1"><LinkIcon className="h-4 w-4" />Vincular con Telegram</span>
          </button>
        )}
        {linkCode && (
          <div className="mt-3 p-3 bg-black/30 rounded-lg text-center">
            {linkCode.code ? (
              <>
                <p className="text-xs text-white/60 mb-2">Envía <code>/vincular</code> al bot y luego este código:</p>
                <p className="text-3xl font-mono font-bold text-accent tracking-widest">{linkCode.code}</p>
                <p className="text-[10px] text-white/40 mt-2">Caduca en 10 minutos</p>
              </>
            ) : (
              <p className="text-sm text-white/70">{linkCode.msg}</p>
            )}
          </div>
        )}
      </div>

      {/* Email */}
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-accent" />
            <div>
              <p className="font-semibold text-sm">Email</p>
              {hasEmail ? (
                <>
                  <p className="text-xs text-green-400"><span className="inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" />{profile.email}</span></p>
                  {profile.email_verified === false && (
                    <p className="text-[10px] text-yellow-400"><span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />No verificado</span></p>
                  )}
                </>
              ) : (
                <p className="text-xs text-yellow-400"><span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />No configurado</span></p>
              )}
            </div>
          </div>
        </div>
        {!hasEmail && isTg && (
          <p className="text-xs text-white/40 mt-3">
            Envía <code>/email</code> al bot para vincular tu email y poder acceder desde la web.
          </p>
        )}
      </div>

      {/* ═══ SECCIÓN: SEGURIDAD ═══ */}
      <h3 className="text-sm font-bold uppercase text-white/60 mb-3 mt-6 flex items-center gap-2"><Shield className="h-4 w-4" />Seguridad</h3>

      {/* Cambiar contraseña */}
      <div className="card p-4 mb-3">
        <button onClick={() => setChangePwd(!changePwd)}
          className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6 text-accent" />
            <div className="text-left">
              <p className="font-semibold text-sm">Contraseña web</p>
              <p className="text-xs text-white/50">
                {profile.has_password ? 'Configurada' : 'Sin configurar'}
              </p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${changePwd ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {changePwd && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
            {profile.has_password && (
              <PasswordInput placeholder="Contraseña actual" value={pwdCurrent}
                onChange={e => setPwdCurrent(e.target.value)} />
            )}
            <PasswordInput placeholder="Nueva contraseña (mín. 8)" value={pwdNew}
              onChange={e => setPwdNew(e.target.value)} />
            <button onClick={handleChangePwd} disabled={pwdLoading || !pwdNew}
              className="w-full py-2 rounded-lg bg-accent/20 text-accent text-sm font-semibold disabled:opacity-50">
              <>{pwdLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <span className="inline-flex items-center justify-center gap-1"><KeyRound className="h-4 w-4" />Guardar contraseña</span>}</>
            </button>
            {pwdMsg && <p className="text-xs text-center text-white/60">{pwdMsg}</p>}
          </div>
        )}
      </div>

      {/* Sesión */}
      <div className="card p-3 text-center">
        <p className="text-xs text-white/40">
          <span className="inline-flex items-center justify-center gap-1"><LockKeyhole className="h-3.5 w-3.5" />Sesión vía</span> <b className="text-white/60">{isTg ? 'Telegram' : 'Email'}</b>
        </p>
        {!isTg && (
          <button onClick={async () => { await api.logout(); location.reload() }}
            className="mt-3 text-xs text-red-400 underline">
            <span className="inline-flex items-center justify-center gap-1"><LogOut className="h-4 w-4" />Cerrar sesión</span>
          </button>
        )}
      </div>
    </div>
  )
}




// ─── WhatsApp-style receipt icon ──────────────────────────────────────────────
// ✓ enviado  |  ✓✓ gris entregado  |  ✓✓ azul leído
function ReceiptIcon({ receipt, isMine }) {
  if (!isMine) return null

  if (receipt === 'sent') {
    return (
      <svg viewBox="0 0 13 11" width="13" height="11" className="inline-block ml-1 flex-shrink-0 align-middle" fill="none">
        <path d="M1.5 5.5L5 9L11.5 1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  const clr = receipt === 'read' ? '#53bdeb' : 'rgba(255,255,255,0.4)'
  // Dos checks paralelos sin cruzarse: el primero se corta a la mitad de su ala derecha (x=7.5) para que no cruce el segundo que empieza en x=7.5
  return (
    <svg viewBox="0 0 19 11" width="19" height="11" className="inline-block ml-1 flex-shrink-0 align-middle" fill="none">
      {/* primer check (ala derecha recortada) */}
      <path d="M1.5 5.5L5 9L7.5 6.1" stroke={clr} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      {/* segundo check (completo, desplazado 6px a la derecha) */}
      <path d="M7.5 5.5L11 9L17.5 1.5" stroke={clr} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

let sharedAudioCtx = null;
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContext();
    }
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) {}
}

function OrderCaseChatScreen({ orderId, admin = false, me, onBack }) {
  const [caseData, setCaseData] = useState(null)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [message, setMessage] = useState('')
  const [internal, setInternal] = useState(false)
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastMsgCount = useRef(0)
  const [notifPermission, setNotifPermission] = useState('Notification' in window ? Notification.permission : 'denied')

  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        }
      } catch (e) {
        console.warn("Audio unlock failed:", e);
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const statusLabels = {
    open: 'Abierto',
    review: 'En revisión',
    waiting_customer: 'Esperando cliente',
    waiting_seller: 'Esperando vendedor',
    delivered: 'Entregado',
    closed: 'Cerrado',
    dispute: 'En disputa',
  }

  const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'

  const fmtLastSeen = (ts) => {
    if (!ts) return null
    const diff = Math.floor(Date.now() / 1000) - ts
    if (diff < 60) return 'hace un momento'
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
    return new Date(ts * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  async function refreshData() {
    try {
      const data = admin ? await api.adminManualOrderCase(orderId) : await api.manualOrderCase(orderId)
      const newCount = data.messages?.length || 0
      if (newCount > lastMsgCount.current) {
        const lastMsg = data.messages[newCount - 1]
        const isFromOther = admin
          ? lastMsg.sender_role === 'customer'
          : ['seller', 'admin'].includes(lastMsg.sender_role)
        
        if (isFromOther) {
          playNotificationSound()
          if (document.hidden || !document.hasFocus()) {
            if ('Notification' in window && Notification.permission === 'granted') {
              const senderName = lastMsg.sender_role === 'customer' ? 'Cliente' : 'Soporte'
              const bodyText = lastMsg.message.startsWith('[Archivo adjunto:')
                ? 'Te envió un archivo'
                : lastMsg.message
              try {
                new Notification(`Mensaje de ${senderName} (Pedido #${orderId})`, {
                  body: bodyText,
                  tag: `order-${orderId}`,
                  renotify: true
                })
              } catch (errNotif) {
                console.warn("Desktop Notification constructor failed, fallback to ServiceWorker:", errNotif)
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(`Mensaje de ${senderName} (Pedido #${orderId})`, {
                      body: bodyText,
                      tag: `order-${orderId}`,
                      renotify: true
                    }).catch(e => console.error("SW notification failed:", e))
                  })
                }
              }
            }
          }
        }
      }
      lastMsgCount.current = newCount
      setCaseData(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev
        return data
      })
      setStatus(data.status || '')
    } catch (e) {
      console.warn("Silent chat refresh failed:", e)
    }
  }

  const refreshDataRef = useRef(refreshData)
  useEffect(() => {
    refreshDataRef.current = refreshData
  })

  useEffect(() => {
    if (!orderId) return
    const timer = setInterval(() => {
      refreshDataRef.current()
    }, 4000)
    return () => clearInterval(timer)
  }, [orderId])

  async function loadData() {
    setLoading(true)
    setErr(null)
    try {
      const data = admin ? await api.adminManualOrderCase(orderId) : await api.manualOrderCase(orderId)
      setCaseData(data)
      lastMsgCount.current = data.messages?.length || 0
      setStatus(data.status || '')
      let orderDetail = null
      if (admin) {
        orderDetail = await api.adminManualOrderDetail(orderId)
      } else {
        const list = await api.myManualOrders()
        orderDetail = (list || []).find(o => o.id === orderId)
      }
      setOrder(orderDetail)
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [orderId, admin])
  useEffect(() => { scrollToBottom() }, [caseData?.messages?.length])

  // Marcar como leído cuando el chat está visible y hay mensajes nuevos
  useEffect(() => {
    if (!caseData || !orderId) return
    const markRead = async () => {
      try {
        if (admin) {
          await api.markAdminCaseRead(orderId)
        } else {
          await api.markCaseRead(orderId)
        }
      } catch (_) { /* silencioso */ }
    }
    markRead()
  }, [caseData?.messages?.length, orderId, admin])

  async function handleSendMessage() {
    const text = message.trim()
    if (!text || submitting) return
    setMessage('')
    setSubmitting(true)
    setErr(null)
    try {
      const data = admin
        ? await api.sendAdminManualCaseMessage(orderId, text, internal)
        : await api.sendManualCaseMessage(orderId, text)
      setCaseData(data)
      lastMsgCount.current = data.messages?.length || 0
      setStatus(data.status || '')
      setInternal(false)
    } catch (e) {
      setErr(e.message)
      setMessage(text)
    }
    setSubmitting(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErr(null)
    try {
      const data = admin
        ? await api.uploadAdminCaseFile(orderId, file)
        : await api.uploadCaseFile(orderId, file)
      setCaseData(data)
      lastMsgCount.current = data.messages?.length || 0
      setStatus(data.status || '')
    } catch (ex) {
      setErr(ex.message || 'Error al subir el archivo')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function changeStatus(nextStatus) {
    if (!admin || !nextStatus || submitting) return
    setSubmitting(true)
    setErr(null)
    try {
      const data = await api.updateAdminManualCaseStatus(orderId, nextStatus)
      setCaseData(data)
      setStatus(data.status || nextStatus)
    } catch (e) {
      setErr(e.message)
    }
    setSubmitting(false)
  }

  const messages = caseData?.messages || []
  const badge = statusLabels[caseData?.status || status] || caseData?.status || 'Pendiente'
  const sellerName = caseData?.seller_store_name || caseData?.seller_name || order?.seller_store_name || order?.seller_name || 'Francho Shop'
  const sellerOnline = caseData?.seller_online || false
  const sellerLastSeen = caseData?.seller_last_seen || 0
  // Read receipts: el campo 'receipt' ya viene calculado desde el backend por mensaje

  if (loading && !caseData) {
    return (
      <div className="fixed inset-0 z-50 bg-bg flex flex-col">
        <div className="border-b border-white/10 bg-card p-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1 text-white/75 active:scale-95">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h2 className="text-base font-bold">Seguimiento de tu pedido</h2>
            <p className="text-xs text-white/40">Pedido #{orderId}</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CoolLoading label="Cargando chat de seguimiento..." />
        </div>
      </div>
    )
  }

  if (me?.is_guest) {
    return (
      <div className="fixed inset-0 z-50 bg-bg flex flex-col text-white">
        <header className="border-b border-white/10 bg-card p-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1 text-white/75 active:scale-95">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-base font-bold">Acceso Denegado</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <LockKeyhole className="h-16 w-16 text-red-400 mb-4 animate-bounce" />
          <p className="text-lg font-bold mb-2">Inicia sesión requerida</p>
          <p className="text-sm text-white/50 mb-4">Debes iniciar sesión para poder ver el chat de seguimiento de este pedido.</p>
          <button onClick={onBack} className="rounded-xl bg-accent px-6 py-3 font-bold active:scale-95 transition-all">
            Volver a la tienda
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col text-white animate-fade-in">
      {/* ── Header ── */}
      <header className="border-b border-white/10 bg-card px-4 py-3 flex items-start justify-between gap-3 shadow-md">
        <div className="flex items-start gap-3 min-w-0">
          <button onClick={onBack} className="p-1 text-white/75 active:scale-95 self-center">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/40">PEDIDO #{orderId}</span>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[9px] font-bold text-accent">{badge}</span>
            </div>
            <h1 className="text-sm font-black truncate mt-0.5">{order?.product || caseData?.product_name || 'Cargando...'}</h1>
            {(order?.option_name || caseData?.option_name) && (
              <p className="text-[10px] text-accent truncate leading-none mt-0.5">{order?.option_name || caseData?.option_name}</p>
            )}
            {/* Estado en línea */}
            <div className="flex items-center gap-1.5 mt-1">
              {admin ? (
                <>
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${caseData?.customer_online ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                  <span className={`text-[10px] font-semibold ${caseData?.customer_online ? 'text-green-400' : 'text-white/35'}`}>
                    Cliente: {caseData?.customer_online ? 'En línea' : fmtLastSeen(caseData?.customer_last_seen) ? `visto ${fmtLastSeen(caseData?.customer_last_seen)}` : 'Sin actividad'}
                  </span>
                </>
              ) : (
                <>
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${sellerOnline ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                  <span className={`text-[10px] font-semibold ${sellerOnline ? 'text-green-400' : 'text-white/35'}`}>
                    {sellerOnline ? 'En línea' : fmtLastSeen(sellerLastSeen) ? `Visto ${fmtLastSeen(sellerLastSeen)}` : sellerName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button onClick={loadData} disabled={loading} className="rounded-lg bg-white/10 p-2 text-white/70 active:scale-95 self-center">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Banner de activar notificaciones */}
      {notifPermission === 'default' && (
        <div className="bg-accent/15 border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-accent text-sm flex-shrink-0 animate-bounce">🔔</span>
            <p className="text-white/80 font-medium truncate">Activa notificaciones web para recibir alertas de nuevos mensajes.</p>
          </div>
          <button
            onClick={async () => {
              try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                  const ctx = new AudioContext();
                  await ctx.resume();
                }
              } catch (err) {
                console.warn("Audio unlock failed:", err);
              }
              if ('Notification' in window) {
                try {
                  const permission = await Notification.requestPermission();
                  setNotifPermission(permission);
                  if (permission === 'granted') {
                    playNotificationSound();
                  }
                } catch (e) {
                  console.error("Error requesting permission:", e);
                }
              }
            }}
            className="rounded-lg bg-accent px-3 py-1.5 font-bold text-bg hover:bg-accent/90 active:scale-95 transition-all flex-shrink-0"
          >
            Activar
          </button>
        </div>
      )}

      {notifPermission === 'denied' && 'Notification' in window && Notification.permission === 'denied' && (
        <div className="bg-red-500/10 border-b border-white/10 px-4 py-2.5 flex items-center gap-2 text-xs text-red-300 animate-fade-in">
          <span className="flex-shrink-0">⚠️</span>
          <p className="font-semibold">Notificaciones bloqueadas en tu navegador. Haz clic en el candado de la barra de direcciones para permitirlas.</p>
        </div>
      )}

      {/* ── Admin Panel ── */}
      {admin && (
        <div className="bg-card/50 border-b border-white/5 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/45 font-semibold">Estado del caso:</span>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); changeStatus(e.target.value) }}
              disabled={submitting}
              className="rounded-lg border border-white/10 bg-bg px-2.5 py-1.5 outline-none focus:border-accent"
            >
              {Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => changeStatus('delivered')} disabled={submitting}
              className="rounded-lg bg-green-500/25 px-2.5 py-1.5 font-bold text-green-400 border border-green-500/30 active:scale-95">
              Marcar Entregado
            </button>
            <button onClick={() => changeStatus('closed')} disabled={submitting}
              className="rounded-lg bg-red-500/25 px-2.5 py-1.5 font-bold text-red-400 border border-red-500/30 active:scale-95">
              Cerrar caso
            </button>
          </div>
        </div>
      )}

      {/* ── Área de mensajes ── */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {err && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{err}</p>}

        {/* Datos de entrega si existen */}
        {order?.delivery_data && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold text-green-400 mb-2">
              <Truck className="h-4 w-4" />
              DATOS DE ENTREGA DEL PRODUCTO
            </p>
            <div className="whitespace-pre-line break-words text-xs leading-relaxed text-green-100/90 font-mono bg-black/35 p-3 rounded-lg border border-white/5">
              <Linkify>{order.delivery_data}</Linkify>
            </div>
            {order.admin_note && (
              <p className="mt-3 text-[11px] text-white/55 flex items-start gap-1.5">
                <Info className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" />
                <span>Nota del vendedor: {order.admin_note}</span>
              </p>
            )}
          </div>
        )}

        {/* Info del pedido */}
        <div className="rounded-xl border border-white/5 bg-card/30 p-3 text-xs text-white/50 space-y-1">
          <p><span className="text-white/30">ID Pedido:</span> <code className="text-white/70">{orderId}</code></p>
          {order?.created_at && (
            <p><span className="text-white/30">Fecha de compra:</span> <span className="text-white/70">{new Date(order.created_at * 1000).toLocaleString('es-ES')}</span></p>
          )}
          {order?.customer_data && Object.keys(order.customer_data).length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
              {Object.entries(order.customer_data).map(([k, v]) => (
                <p key={k}><span className="text-white/30">{k}:</span> <span className="text-white/70 font-semibold">{v}</span></p>
              ))}
            </div>
          )}
        </div>

        {/* ── MENSAJES ── */}
        <div className="space-y-2 mt-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-white/35 text-xs">
              <MessageCircle className="mx-auto mb-3 h-8 w-8 text-white/20" />
              <p>No hay mensajes en este seguimiento todavía.</p>
              <p className="mt-1">Escribe tu primera duda o comentario abajo.</p>
            </div>
          ) : (
            messages.map((m, idx) => {
              // admin ve: admin/seller = derecha (azul), customer = izquierda (gris)
              // cliente ve: customer = derecha (azul), admin/seller = izquierda (verde)
              const isRight = admin
                ? ['seller', 'admin'].includes(m.sender_role)
                : m.sender_role === 'customer'

              const isSystem = m.sender_role === 'system'

              // receipt viene del backend: 'sent' | 'delivered' | 'read'

              if (isSystem) {
                return (
                  <div key={m.id} className="flex justify-center">
                    <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] text-white/35 italic">{m.message}</span>
                  </div>
                )
              }

              if (m.is_internal_note) {
                return (
                  <div key={m.id} className={`flex flex-col max-w-[80%] ${isRight ? 'ml-auto items-end' : 'items-start'}`}>
                    <div className="rounded-2xl px-4 py-2.5 text-xs border border-yellow-500/20 bg-yellow-500/10 text-yellow-100">
                      <div className="mb-1 text-[9px] text-yellow-400/70 font-bold">🔒 Nota interna · {fmt(m.created_at)}</div>
                      <div className="whitespace-pre-line break-words leading-relaxed"><Linkify>{m.message}</Linkify></div>
                    </div>
                  </div>
                )
              }

              const senderLabel = m.sender_role === 'customer' ? 'Cliente'
                : m.sender_role === 'seller' ? 'Vendedor'
                : m.sender_role === 'admin' ? 'Admin'
                : 'Sistema'

              // Colores:
              // derecha (propio) → azul acento
              // izquierda cliente → gris oscuro bg-card
              // izquierda vendedor/admin → verde oscuro
              const bubbleClass = isRight
                ? 'bg-accent text-white rounded-br-none'
                : m.sender_role === 'customer'
                  ? 'bg-[#1e2235] text-white/90 border border-white/5 rounded-bl-none'
                  : 'bg-[#1a2e22] text-green-100 border border-green-900/40 rounded-bl-none'

              return (
                <div key={m.id} className={`flex flex-col max-w-[82%] ${isRight ? 'ml-auto items-end' : 'items-start'}`}>
                  {/* Nombre del remitente solo si no es el mismo rol anterior */}
                  {(idx === 0 || messages[idx - 1]?.sender_role !== m.sender_role) && !isRight && (
                    <span className={`text-[10px] font-bold mb-0.5 px-1 ${m.sender_role === 'customer' ? 'text-white/40' : 'text-green-400/70'}`}>
                      {senderLabel}
                    </span>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-xs shadow-sm ${bubbleClass}`}>
                    <div className="whitespace-pre-line break-words leading-relaxed">
                      <Linkify>{m.message}</Linkify>
                    </div>
                    <div className={`mt-1 text-right text-[9px] ${isRight ? 'text-white/50' : 'text-white/30'}`}>
                      {fmt(m.created_at)}
                    </div>
                  </div>
                  {/* WhatsApp-style receipt — solo en mensajes propios */}
                  {isRight && (
                    <div className="mt-0.5 flex items-center justify-end px-1">
                      <ReceiptIcon receipt={m.receipt} isMine={true} />
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 bg-card p-3 safe-bottom">
        {uploading && (
          <div className="mb-2 flex items-center gap-2 text-xs text-white/50 px-1">
            <div className="h-3 w-3 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
            Subiendo archivo...
          </div>
        )}
        {admin && (
          <label className="flex items-center gap-2 text-xs text-white/55 mb-2 px-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={internal}
              onChange={e => setInternal(e.target.checked)}
              className="rounded border-white/20 bg-bg text-accent focus:ring-0"
            />
            Nota interna (solo admin/vendedor)
          </label>
        )}
        <div className="flex items-end gap-2">
          {/* Input oculto para archivo */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.zip,.rar"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || submitting}
            title="Adjuntar imagen o archivo"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70 active:scale-95 transition-all disabled:opacity-40 hover:bg-white/15"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
            rows={1}
            maxLength={3000}
            placeholder={admin ? 'Responder al cliente...' : 'Escribe un mensaje...'}
            className="flex-1 max-h-24 resize-none rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-xs outline-none focus:border-accent"
          />

          <button
            onClick={handleSendMessage}
            disabled={submitting || !message.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50 active:scale-95 transition-all"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  )
}

function OrderReviewBox({ order, onReviewed }) {
  const [rating, setRating] = useState(order.review?.rating || 0)
  const [comment, setComment] = useState(order.review?.comment || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(!!order.review)
  if (order.status !== 'completed') return null

  async function submitReview() {
    if (!rating) return
    setSaving(true)
    try {
      if (order.type === 'manual') await api.reviewManualOrder(order.id, rating, comment)
      else await api.reviewOrder(order.id, rating, comment)
      setDone(true)
      onReviewed?.(order, { rating, comment })
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="mb-2 text-xs font-semibold text-white/55">Valoración de la compra</p>
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => { setRating(n); setDone(false) }} className={`text-xl ${n <= rating ? 'text-yellow-300' : 'text-white/20'}`}>★</button>
        ))}
      </div>
      {!done && (
        <>
          <input value={comment} onChange={e => setComment(e.target.value)} maxLength={250} placeholder="Comentario opcional" className="mb-2 w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-xs outline-none focus:border-accent" />
          <button onClick={submitReview} disabled={!rating || saving} className="rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent disabled:opacity-50">{saving ? 'Guardando...' : 'Enviar valoración'}</button>
        </>
      )}
      {done && <p className="text-xs text-green-300"><span className="inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" />Gracias por valorar esta compra.</span></p>}
    </div>
  )
}

function OrdersScreen({ onOpenCase }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  function markReviewed(order, review) {
    setOrders(items => items.map(item => item.type === order.type && item.id === order.id ? { ...item, review } : item))
  }

  useEffect(() => {
    Promise.all([
      api.myOrders().catch(() => []),
      api.myManualOrders().catch(() => []),
    ]).then(([regular, manual]) => {
      // Marcar tipo y unificar
      const r = (regular || []).map(o => ({ ...o, type: 'auto' }))
      const m = (manual || []).map(o => ({ ...o, type: 'manual' }))
      // Ordenar por fecha (más recientes primero)
      const all = [...r, ...m].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      setOrders(all)
      setLoading(false)
    }).catch(e => { setErr(e.message); setLoading(false) })
  }, [])

  if (loading) return <CoolLoading label="Cargando historial de pedidos..." />
  if (err) return <ErrorView msg={err} />

  const STATUS_INFO = {
    completed: { status: 'completed', label: 'Completado', color: 'text-green-400' },
    processing: { status: 'processing', label: 'Procesando', color: 'text-blue-400' },
    pending: { status: 'pending', label: 'Pendiente', color: 'text-yellow-400' },
    failed: { status: 'failed', label: 'Fallido', color: 'text-red-400' },
    partial: { status: 'partial', label: 'Parcial', color: 'text-orange-400' },
  }

  return (
    <div className="px-2.5 py-4 md:p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ClipboardList className="h-5 w-5" aria-hidden="true" />Mis pedidos</h2>
      {orders.length === 0 ? (
        <p className="text-center text-white/50 py-8">Aún no tienes pedidos</p>
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const info = STATUS_INFO[o.status] || { status: 'pending', label: o.status, color: 'text-white' }
            const date = o.created_at ? new Date(o.created_at * 1000).toLocaleString('es-ES', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            }) : '—'
            const rechargeDetails = formatRechargeDetails(o.recharge_details)
            const productImage = storeAssetUrl(o.icon_url || o.image_url || o.product_image || '')
            const sellerName = o.seller_store_name || o.seller_name || o.seller_username || (o.seller_id ? `Vendedor #${o.seller_id}` : 'Francho Shop')
            const sellerImage = storeAssetUrl(o.seller_store_image || '')
            return (
              <div key={`${o.type}-${o.id}`} className="card overflow-hidden p-0">
                <div className="border-b border-white/10 bg-gradient-to-r from-accent/15 to-accent2/10 p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-bg/70">
                      {productImage ? <OptimizedImage src={productImage} alt={o.product || 'Producto'} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center">{o.type === 'manual' ? <Wrench className="h-6 w-6 text-accent" /> : <ShoppingCart className="h-6 w-6 text-accent" />}</div>}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/65">{o.type === 'manual' ? 'Manual' : 'Recarga automática'}</span>
                        <span className={info.color + ' inline-flex items-center gap-1 text-[11px] font-bold'}><StatusIcon status={info.status} className="h-3.5 w-3.5" />{info.label}</span>
                      </div>
                      <p className="text-sm font-black leading-tight">{o.product || 'Producto'}</p>
                      {o.option_name && <p className="mt-1 text-xs font-semibold text-accent">{o.option_name}</p>}
                      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-white/50">
                        {sellerImage && <OptimizedImage src={sellerImage} alt={sellerName} className="h-5 w-5 rounded-full object-cover" />}
                        <span className="min-w-0 truncate">Vendido por: <span className="font-semibold text-white/75">{sellerName}</span></span>
                        {o.seller_store_slug && <button onClick={() => { window.location.href = `/seller/${encodeURIComponent(o.seller_store_slug)}` }} className="rounded-md bg-white/10 px-2 py-1 font-bold text-white/70">Ver tienda</button>}
                      </div>
                    </div>
                    <p className="ml-1 flex-shrink-0 text-lg font-black text-accent">${Number(o.price || 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  <div className="mb-3 grid gap-1 rounded-lg bg-black/20 p-2 text-xs text-white/65">
                    <p><span className="text-white/35">Orden:</span> <code>{o.id}</code></p>
                    <p><span className="text-white/35">Creada:</span> {date}</p>
                    {rechargeDetails.map((item, index) => <p key={index}><span className="text-white/35">{item.label}:</span> {item.value}</p>)}
                  </div>
                  {o.customer_data && Object.keys(o.customer_data).length > 0 && (
                    <div className="mb-3 rounded-lg bg-black/20 p-2 text-xs text-white/65">
                      {Object.entries(o.customer_data).map(([k, v]) => <p key={k}><span className="text-white/40">{k}:</span> {v}</p>)}
                    </div>
                  )}
                {/* Datos de entrega (pedidos manuales completados) */}
                {o.type === 'manual' && o.delivery_data && (
                  <div className="mt-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-xs">
                    <p className="text-green-400 font-semibold mb-1 inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" />Datos de entrega:</p>
                    <div className="whitespace-pre-line break-words text-sm leading-relaxed text-green-100/90">
                      <Linkify>{o.delivery_data}</Linkify>
                    </div>
                    {o.admin_note && <p className="text-white/50 mt-1"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{o.admin_note}</span></p>}
                  </div>
                )}
                {/* Códigos (pedidos automáticos) */}
                {o.cards?.length > 0 && (
                  <div className="mt-2 p-2 rounded bg-black/20 text-xs">
                    {o.cards.map((c, i) => (
                      <p key={i} className="font-mono text-green-400">
                        <span className="inline-flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" />{c.cardPass || c.cardNumber || JSON.stringify(c)}</span>
                      </p>
                    ))}
                  </div>
                )}
                {o.error && <p className="mt-2 text-xs text-red-400"><span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{o.error}</span></p>}
                {o.type === 'manual' && o.case_id && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between gap-3 text-xs bg-black/10 p-3 rounded-xl border border-white/5">
                      <div className="min-w-0">
                        <p className="font-bold flex items-center gap-1.5 text-white/90">
                          <MessageCircle className="h-4 w-4 text-accent animate-pulse" />
                          Seguimiento de tu pedido
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">Caso #{o.case_id} activo</p>
                      </div>
                      <button
                        onClick={() => onOpenCase(o.id, false)}
                        className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white active:scale-95 transition-all shadow-sm"
                      >
                        Abrir seguimiento
                      </button>
                    </div>
                  </div>
                )}
                <OrderReviewBox order={o} onReviewed={markReviewed} />
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════
//  PANEL PRIVADO (FASE 1 & FASE 2)
// ══════════════════════════════════════

function PanelScreen({ me, onLogout, onHome, onOpenCase, onEditProduct }) {
  const [activeRole, setActiveRole] = useState(null)
  const [activeTab, setActiveTab] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  
  // Estados de tienda (Vendedor)
  const [sellerStore, setSellerStore] = useState(null)
  const [savingStore, setSavingStore] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [storeImage, setStoreImage] = useState('')
  const [socialUrl1, setSocialUrl1] = useState('')
  const [socialUrl2, setSocialUrl2] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [savingStoreSuccess, setSavingStoreSuccess] = useState(false)
  
  // Estados de finanzas (Vendedor)
  const [sellerDashboard, setSellerDashboard] = useState(null)
  const [accountFinance, setAccountFinance] = useState(null)
  const [loadingFinance, setLoadingFinance] = useState(false)

  // Determinar roles disponibles
  const availableRoles = useMemo(() => {
    const roles = []
    if (me?.role === 'admin') {
      roles.push({ id: 'admin', label: 'Panel Admin' })
      roles.push({ id: 'seller', label: 'Panel Vendedor' })
      roles.push({ id: 'reseller', label: 'Panel Revendedor' })
    } else {
      if (me?.role === 'seller') roles.push({ id: 'seller', label: 'Panel Vendedor' })
      if (me?.role === 'reseller') roles.push({ id: 'reseller', label: 'Panel Revendedor' })
    }
    return roles
  }, [me?.role])

  // Inicializar rol activo
  useEffect(() => {
    if (availableRoles.length > 0 && !activeRole) {
      setActiveRole(availableRoles[0].id)
    }
  }, [availableRoles, activeRole])

  // Inicializar pestaña activa
  useEffect(() => {
    if (activeRole === 'admin') setActiveTab('dashboard')
    else if (activeRole === 'seller') setActiveTab('store')
    else if (activeRole === 'reseller') setActiveTab('catalog')
  }, [activeRole])

  // Configurar las pestañas según rol activo
  const tabs = useMemo(() => {
    if (activeRole === 'admin') {
      return [
        { id: 'dashboard', label: 'Resumen', icon: Home },
        { id: 'products', label: 'Productos', icon: Package },
        { id: 'orders', label: 'Pedidos', icon: ClipboardList },
        { id: 'recharges', label: 'Mis recargas', icon: Smartphone },
        { id: 'pricing', label: 'Ganancias', icon: DollarSign },
        { id: 'sellers', label: 'Vendedores', icon: BriefcaseBusiness },
        { id: 'withdrawals', label: 'Retiros', icon: WalletCards },
        { id: 'users', label: 'Clientes', icon: User },
        { id: 'reviews', label: 'Valoraciones', icon: BadgeCheck },
        { id: 'audit', label: 'Auditoría', icon: ShieldCheck },
      ]
    } else if (activeRole === 'seller') {
      return [
        { id: 'store', label: 'Mi tienda', icon: Store },
        { id: 'products', label: 'Mis productos', icon: Package },
        { id: 'orders', label: 'Pedidos recibidos', icon: ClipboardList },
        { id: 'cases', label: 'Casos post-compra', icon: Headphones },
        { id: 'sales', label: 'Ventas y Ganancias', icon: DollarSign },
      ]
    } else if (activeRole === 'reseller') {
      return [
        { id: 'catalog', label: 'Catálogo para revender', icon: Store },
        { id: 'sales', label: 'Mis compras', icon: ClipboardList },
        { id: 'pricing', label: 'Precios preferenciales', icon: DollarSign },
        { id: 'balance', label: 'Mi saldo', icon: WalletCards },
      ]
    }
    return []
  }, [activeRole])

  // Cargar datos de la tienda para vendedor
  useEffect(() => {
    if (activeRole === 'seller' && activeTab === 'store') {
      setSavingStoreSuccess(false)
      api.sellerAccountStore()
        .then(res => {
          const s = res.seller || {}
          setSellerStore(s)
          setStoreName(s.store_name || '')
          setStoreDescription(s.store_description || '')
          setStoreImage(s.store_image || '')
          setSocialUrl1(s.social_url_1 || '')
          setSocialUrl2(s.social_url_2 || '')
          setWhatsappUrl(s.whatsapp_url || '')
        })
        .catch(e => console.error("Failed to load store:", e))
    }
  }, [activeRole, activeTab])

  // Cargar finanzas/ventas para vendedor
  async function loadFinanceData() {
    setLoadingFinance(true)
    try {
      const [dash, fin] = await Promise.all([
        api.sellerDashboard().catch(() => null),
        api.accountSellerFinance().catch(() => null)
      ])
      setSellerDashboard(dash)
      setAccountFinance(fin)
    } catch (e) {
      console.error(e)
    }
    setLoadingFinance(false)
  }

  useEffect(() => {
    if (activeRole === 'seller' && activeTab === 'sales') {
      loadFinanceData()
    }
  }, [activeRole, activeTab])

  const handleStoreSave = async (data) => {
    setSavingStore(true)
    setSavingStoreSuccess(false)
    try {
      await api.updateSellerAccountStore(data)
      setSavingStoreSuccess(true)
    } catch (e) {
      alert("Error al guardar: " + e.message)
    }
    setSavingStore(false)
  }

  if (!activeRole || !activeTab) {
    return <div className="p-8 text-center text-white/50 animate-pulse">Cargando panel...</div>
  }

  return (
    <div className="flex h-screen bg-bg text-white overflow-hidden select-none">
      {/* Sidebar - Desktop & Mobile overlay */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-card transition-transform duration-300 md:static md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Header de Sidebar */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent animate-pulse" />
            <span className="font-black text-sm tracking-wider bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">PANEL PRIVADO</span>
          </div>
          <button className="md:hidden p-1 text-white/50 hover:text-white" onClick={() => setMenuOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selector de rol */}
        {availableRoles.length > 1 && (
          <div className="p-3 border-b border-white/10 bg-black/15 flex-shrink-0">
            <label className="block text-[9px] uppercase font-bold text-white/40 mb-1.5 tracking-wider">Selector de Vista</label>
            <div className="relative">
              <select
                value={activeRole}
                onChange={e => setActiveRole(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/15 bg-bg px-3 py-2 text-xs font-bold outline-none focus:border-accent cursor-pointer"
              >
                {availableRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white/40">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        )}

        {/* Listado de pestañas */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {tabs.map(item => {
            const Icon = item.icon
            const selected = item.id === activeTab
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setMenuOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
                  selected
                    ? 'bg-accent/15 text-white border-l-2 border-accent'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${selected ? 'text-accent' : 'text-white/40'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer Sidebar / Volver a la tienda */}
        <div className="p-3 border-t border-white/10 bg-black/20 flex-shrink-0">
          <button
            onClick={onHome}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-bold text-bg hover:bg-accent/90 active:scale-95 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </button>
          <div className="mt-3 flex items-center justify-between text-[10px] text-white/35 font-bold">
            <span className="truncate max-w-[125px]">{me.name}</span>
            <button onClick={onLogout} className="hover:text-red-400 font-bold active:scale-95 transition">Cerrar sesión</button>
          </div>
        </div>
      </aside>

      {/* Mobile background overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Main viewport */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-white/10 bg-card px-4 md:px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 active:scale-95" onClick={() => setMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-black tracking-wide uppercase md:text-base">{tabs.find(t => t.id === activeTab)?.label || 'Panel'}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-white/40 block leading-none mb-0.5">Saldo USDT</span>
              <span className="text-sm font-black text-green-300">${me.balance.toFixed(2)}</span>
            </div>
            <div className="hidden sm:block rounded-xl bg-white/5 border border-white/5 px-2.5 py-1 text-[10px] font-black text-white/50 uppercase tracking-wider">
              {activeRole === 'admin' ? '👑 Admin' : activeRole === 'seller' ? '🏷️ Vendedor' : '💼 Revendedor'}
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="flex-1 overflow-y-auto px-2.5 py-3 md:px-6 md:py-6">
          {activeRole === 'admin' && (
            <AdminProductsScreen
              externalTab={activeTab}
              onTabChange={setActiveTab}
              onEdit={onEditProduct}
              onOpenCase={onOpenCase}
            />
          )}

          {activeRole === 'seller' && activeTab === 'store' && sellerStore && (
            <SellerStoreConfigForm
              store={sellerStore}
              onSave={handleStoreSave}
              saving={savingStore}
              success={savingStoreSuccess}
            />
          )}

          {activeRole === 'seller' && activeTab === 'products' && (
            <AdminProductsScreen
              externalTab="products"
              onEdit={onEditProduct}
              onOpenCase={onOpenCase}
            />
          )}

          {activeRole === 'seller' && activeTab === 'orders' && (
            <AdminProductsScreen
              externalTab="orders"
              onOpenCase={onOpenCase}
            />
          )}

          {activeRole === 'seller' && activeTab === 'cases' && (
            <SellerCasesPanel onOpenCase={onOpenCase} />
          )}

          {activeRole === 'seller' && activeTab === 'sales' && (
            <div className="space-y-6">
              {loadingFinance ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
              ) : (
                <>
                  <SellerDashboardPanel dashboard={sellerDashboard} onGoProducts={() => setActiveTab('products')} onGoOrders={() => setActiveTab('orders')} onRefresh={loadFinanceData} />
                  <AccountSellerFinancePanel finance={accountFinance} onRefresh={loadFinanceData} />
                </>
              )}
            </div>
          )}

          {activeRole === 'reseller' && activeTab === 'catalog' && (
            <ResellerCatalog
              me={me}
              onBought={() => api.me().then(setMe).catch(()=>{})}
            />
          )}
          {activeRole === 'reseller' && activeTab === 'sales' && (
            <ResellerSales
              me={me}
              onOpenCase={onOpenCase}
            />
          )}
          {activeRole === 'reseller' && activeTab === 'pricing' && (
            <ResellerPricing
              me={me}
            />
          )}
          {activeRole === 'reseller' && activeTab === 'balance' && (
            <ResellerBalance
              me={me}
              onRefresh={() => api.me().then(setMe).catch(()=>{})}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function SellerStoreConfigForm({ store, onSave, saving, success }) {
  const [name, setName] = useState(store?.store_name || '')
  const [desc, setDesc] = useState(store?.store_description || '')
  const [img, setImg] = useState(store?.store_image || '')
  const [wa, setWa] = useState(store?.whatsapp_url || '')
  const [soc1, setSoc1] = useState(store?.social_url_1 || '')
  const [soc2, setSoc2] = useState(store?.social_url_2 || '')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(store?.store_image || '')

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImageForUpload(file)
      const res = await api.uploadIcon(compressed)
      setImg(res.url)
      setPreview(res.url)
    } catch (err) {
      alert("Error al subir imagen: " + err.message)
    }
    setUploading(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      store_name: name,
      store_description: desc,
      store_image: img,
      whatsapp_url: wa,
      social_url_1: soc1,
      social_url_2: soc2
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-3 sm:p-5 w-full max-w-4xl space-y-4 border-accent/10">
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg p-3 text-xs font-semibold">
          ✓ Tienda actualizada con éxito.
        </div>
      )}
      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Nombre de la tienda</label>
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Mi Tienda Gamer" className="w-full bg-bg border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent" />
      </div>
      
      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Descripción de la tienda</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Describe tus productos o servicios..." className="w-full bg-bg border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent" />
      </div>
      
      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Logo o Imagen de Portada</label>
        <div className="flex items-center gap-3">
          {preview ? (
            <img src={storeAssetUrl(preview)} className="w-14 h-14 rounded-xl border border-white/10 object-cover flex-shrink-0" alt="Logo" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-black/30 border border-dashed border-white/10 flex items-center justify-center text-[10px] text-white/40 flex-shrink-0">Sin logo</div>
          )}
          <div className="flex-1 min-w-0">
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" id="logo-upload" />
            <label htmlFor="logo-upload" className="inline-block rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/5 active:scale-95 transition cursor-pointer">
              {uploading ? 'Subiendo...' : 'Subir imagen'}
            </label>
            <input value={img} onChange={e => { setImg(e.target.value); setPreview(e.target.value) }} placeholder="O pega url de imagen" className="mt-2 w-full bg-bg border border-white/15 rounded-xl px-3 py-2 text-xs outline-none focus:border-accent" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Enlace de Whatsapp</label>
        <input value={wa} onChange={e => setWa(e.target.value)} placeholder="Ej: https://wa.me/535..." className="w-full bg-bg border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Enlace Social 1</label>
          <input value={soc1} onChange={e => setSoc1(e.target.value)} placeholder="Ej: Canal de Telegram" className="w-full bg-bg border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Enlace Social 2</label>
          <input value={soc2} onChange={e => setSoc2(e.target.value)} placeholder="Ej: Grupo Facebook" className="w-full bg-bg border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent" />
        </div>
      </div>

      <button type="submit" disabled={saving || uploading} className="w-full bg-accent text-bg font-bold py-3.5 rounded-xl active:scale-95 hover:bg-accent/90 transition text-sm disabled:opacity-50">
        {saving ? 'Guardando...' : 'Guardar tienda'}
      </button>
    </form>
  )
}

function SellerCasesPanel({ onOpenCase }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    api.adminManualOrderCases()
      .then(res => {
        setCases(res.items || [])
        setLoading(false)
      })
      .catch(e => {
        console.error(e)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  
  return (
    <div className="space-y-3 w-full max-w-4xl">
      {cases.length === 0 ? (
        <div className="card p-6 text-center text-white/50">No hay casos activos.</div>
      ) : (
        cases.map(c => (
          <div key={c.order_id} className="card p-3 sm:p-4 flex items-center justify-between gap-3 border-yellow-500/10">
            <div>
              <p className="font-bold text-sm">Pedido #{c.order_id}</p>
              <p className="text-xs text-white/50 mt-1">Cliente: {c.customer_name || 'Desconocido'}</p>
              <p className="text-xs text-white/50">Estado del caso: <span className="font-semibold text-yellow-300">{c.status}</span></p>
            </div>
            <button
              onClick={() => onOpenCase(c.order_id, true)}
              className="rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30 active:scale-95 transition"
            >
              Abrir Chat
            </button>
          </div>
        ))
      )}
    </div>
  )
}



// ══════════════════════════════════════
//  PANEL REVENDEDOR (FASE 3)
// ══════════════════════════════════════

function ResellerCatalog({ me, onBought }) {
  const [games, setGames] = useState([])
  const [manualProducts, setManualProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('auto') // 'auto' | 'manual'
  const [searchQuery, setSearchQuery] = useState('')

  // Selección de juego
  const [selectedGame, setSelectedGame] = useState(null)
  const [regions, setRegions] = useState([])
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Modales
  const [buyingProduct, setBuyingProduct] = useState(null)
  const [productDetail, setProductDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [formFields, setFormFields] = useState({})
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderResult, setOrderResult] = useState(null)

  // Modal Manual
  const [buyingManualProduct, setBuyingManualProduct] = useState(null)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [manualFormFields, setManualFormFields] = useState({})

  useEffect(() => {
    Promise.all([
      api.games().catch(() => []),
      api.manualProducts().catch(() => [])
    ]).then(([g, mp]) => {
      setGames(g || [])
      setManualProducts(mp || [])
      setLoading(false)
    }).catch(e => {
      console.error(e)
      setLoading(false)
    })
  }, [])

  const selectGame = async (game) => {
    setSelectedGame(game)
    setSelectedRegion(null)
    setProducts([])
    setLoadingProducts(true)
    try {
      const regs = await api.regions(game.name)
      setRegions(regs || [])
      if (!regs || regs.length === 0) {
        setSelectedRegion('__standard__')
        loadGameProducts(game.name, '__standard__')
      } else if (regs.length === 1) {
        setSelectedRegion(regs[0].serverName)
        loadGameProducts(game.name, regs[0].serverName)
      } else {
        setLoadingProducts(false)
      }
    } catch (e) {
      console.error(e)
      setLoadingProducts(false)
    }
  }

  const selectRegion = (regionName) => {
    setSelectedRegion(regionName)
    loadGameProducts(selectedGame.name, regionName)
  }

  const loadGameProducts = async (gameName, regionName) => {
    setLoadingProducts(true)
    try {
      const p = await api.products(gameName, regionName)
      setProducts(p || [])
    } catch (e) {
      console.error(e)
    }
    setLoadingProducts(false)
  }

  const openBuyModal = async (product) => {
    setBuyingProduct(product)
    setProductDetail(null)
    setFormFields({})
    setOrderResult(null)
    setLoadingDetail(true)
    try {
      const detail = await api.productDetail(product.id, selectedRegion)
      setProductDetail(detail)
      const initFields = {}
      if (detail && detail.fields) {
        detail.fields.forEach(f => {
          initFields[f.field_name || f.name] = ''
        })
      }
      setFormFields(initFields)
    } catch (e) {
      console.error(e)
    }
    setLoadingDetail(false)
  }

  const handleBuyAutomated = async () => {
    if (productDetail && productDetail.fields) {
      for (const f of productDetail.fields) {
        const k = f.field_name || f.name
        if (f.is_required && (!formFields[k] || !String(formFields[k]).trim())) {
          alert(`El campo ${f.label || k} es obligatorio.`);
          return
        }
      }
    }

    setSubmittingOrder(true)
    try {
      const orderData = {
        product_id: buyingProduct.id,
        fields: formFields,
        region: selectedRegion === '__standard__' ? null : selectedRegion
      }
      const res = await api.createOrder(orderData)
      setOrderResult(res)
      onBought()
    } catch (e) {
      alert("Error al crear pedido: " + e.message)
    }
    setSubmittingOrder(false)
  }

  const openManualBuyModal = (product) => {
    setBuyingManualProduct(product)
    const options = product.options || []
    setSelectedOptionId(options.length > 0 ? options[0].id : '')
    const initFields = {}
    if (product.fields) {
      product.fields.forEach(f => {
        initFields[f.id] = ''
      })
    }
    setManualFormFields(initFields)
    setOrderResult(null)
  }

  const handleBuyManual = async () => {
    if (buyingManualProduct.fields) {
      for (const f of buyingManualProduct.fields) {
        if (f.is_required && (!manualFormFields[f.id] || !String(manualFormFields[f.id]).trim())) {
          alert(`El campo ${f.label} es obligatorio.`);
          return
        }
      }
    }

    setSubmittingOrder(true)
    try {
      const res = await api.buyManualProduct(
        buyingManualProduct.id,
        selectedOptionId ? Number(selectedOptionId) : null,
        manualFormFields
      )
      setOrderResult({ ok: true, order_id: res.order_id, type: 'manual' })
      onBought()
    } catch (e) {
      alert("Error al comprar: " + e.message)
    }
    setSubmittingOrder(false)
  }

  const retailMarkup = me?.retail_markup ?? 20.0
  const resellerMarkup = me?.reseller_markup ?? 8.0
  const factor = (1 + retailMarkup / 100) / (1 + resellerMarkup / 100)

  const q = searchQuery.toLowerCase().trim()
  const filteredGames = games.filter(g => g.title.toLowerCase().includes(q) || g.name.toLowerCase().includes(q))
  const filteredManual = manualProducts.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)))

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-card border border-white/10 p-1 flex-shrink-0 self-start">
          <button
            onClick={() => { setActiveCategory('auto'); setSelectedGame(null); }}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${activeCategory === 'auto' ? 'bg-accent text-bg' : 'text-white/60 hover:text-white'}`}
          >
            🔌 Recargas Automáticas
          </button>
          <button
            onClick={() => { setActiveCategory('manual'); setSelectedGame(null); }}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${activeCategory === 'manual' ? 'bg-accent text-bg' : 'text-white/60 hover:text-white'}`}
          >
            📦 Cuentas y Servicios (Manual)
          </button>
        </div>

        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Buscar en el catálogo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-accent text-white"
          />
        </div>
      </div>

      {activeCategory === 'auto' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Selecciona un juego</h3>
            {filteredGames.length === 0 ? (
              <div className="text-center p-6 border border-white/5 rounded-xl text-white/40 text-xs">No se encontraron juegos</div>
            ) : (
              filteredGames.map(g => (
                <button
                  key={g.name}
                  onClick={() => selectGame(g)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 border text-left transition active:scale-[0.98] ${selectedGame?.name === g.name ? 'border-accent bg-accent/10' : 'border-white/10 bg-card hover:border-white/20'}`}
                >
                  {g.icon_url ? (
                    <img src={g.icon_url} className="h-10 w-10 rounded-lg object-cover" alt={g.title} />
                  ) : (
                    <div className="h-10 w-10 bg-black/40 rounded-lg flex items-center justify-center text-lg">{g.emoji || '🎮'}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{g.title}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">{g.count} productos</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selectedGame ? (
              <div className="card p-3.5 sm:p-5 border-accent/15 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  {selectedGame.icon_url ? (
                    <img src={selectedGame.icon_url} className="h-12 w-12 rounded-xl object-cover" alt={selectedGame.title} />
                  ) : (
                    <div className="h-12 w-12 bg-black/40 rounded-xl flex items-center justify-center text-2xl">{selectedGame.emoji || '🎮'}</div>
                  )}
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide">{selectedGame.title}</h2>
                    <p className="text-xs text-white/40">Recarga directa para clientes</p>
                  </div>
                </div>

                {regions.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {regions.map(r => (
                      <button
                        key={r.serverName}
                        onClick={() => selectRegion(r.serverName)}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${selectedRegion === r.serverName ? 'bg-accent text-bg' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}
                      >
                        🌐 {r.serverName}
                      </button>
                    ))}
                  </div>
                )}

                {loadingProducts ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
                ) : products.length === 0 ? (
                  <div className="text-center p-8 text-white/40 text-xs border border-dashed border-white/10 rounded-xl">Selecciona una región para ver los productos</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] font-bold">
                          <th className="py-2.5">Producto</th>
                          <th className="py-2.5 text-right">Precio Revendedor</th>
                          <th className="py-2.5 text-right">P. Público (Aprox)</th>
                          <th className="py-2.5 text-right">Tu Ahorro</th>
                          <th className="py-2.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {products.map(p => {
                          const pubPrice = p.price * factor
                          const saving = pubPrice - p.price
                          return (
                            <tr key={p.id} className="hover:bg-white/5 transition">
                              <td className="py-3 font-semibold">{p.name}</td>
                              <td className="py-3 text-right font-black text-green-300">${p.price.toFixed(2)}</td>
                              <td className="py-3 text-right text-white/50">${pubPrice.toFixed(2)}</td>
                              <td className="py-3 text-right text-accent font-bold">+${saving.toFixed(2)} ({((saving / pubPrice) * 100).toFixed(0)}%)</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => openBuyModal(p)}
                                  className="rounded-lg bg-accent px-3 py-1.5 text-[10px] font-black text-bg hover:bg-accent/90 active:scale-95 transition"
                                >
                                  Comprar
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-12 text-center text-white/35 border-dashed flex flex-col items-center justify-center min-h-[300px]">
                <Store className="h-12 w-12 text-white/15 mb-3" />
                <p className="text-xs font-semibold">Selecciona un juego de la lista de la izquierda para comenzar.</p>
                <p className="text-[10px] text-white/30 mt-1">Los precios automáticos se cargan en tiempo real con descuento de revendedor.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeCategory === 'manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredManual.length === 0 ? (
            <div className="col-span-full card p-12 text-center text-white/40 border-dashed">No se encontraron productos manuales</div>
          ) : (
            filteredManual.map(p => (
              <div key={p.id} className="card p-4 flex flex-col justify-between border-white/10 hover:border-white/20 transition">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {p.icon_url ? (
                      <img src={p.icon_url} className="w-12 h-12 rounded-xl object-cover border border-white/10" alt={p.name} />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg">🎮</div>
                    )}
                    <span className="rounded-lg bg-white/5 border border-white/5 px-2 py-0.5 text-[9px] font-bold text-accent uppercase tracking-wider">
                      {p.category === 'game_account' ? 'Cuenta' : p.category === 'service' ? 'Servicio' : 'Manual'}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs mb-1.5 leading-snug line-clamp-1">{p.name}</h4>
                  <p className="text-[10px] text-white/50 mb-4 line-clamp-2 min-h-[30px]">{p.description || 'Sin descripción'}</p>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto">
                  <div>
                    <span className="text-[9px] text-white/40 block">Precio Neto</span>
                    <span className="font-black text-sm text-green-300">${p.price.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => openManualBuyModal(p)}
                    className="rounded-lg bg-accent px-3.5 py-2 text-xs font-black text-bg hover:bg-accent/90 active:scale-95 transition"
                  >
                    Comprar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {buyingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-card border border-white/15 p-5 animate-scale-up space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-black uppercase text-accent">Comprar Recarga</h3>
                <h4 className="font-bold text-xs text-white/60 mt-0.5">{buyingProduct.name}</h4>
              </div>
              <button onClick={() => setBuyingProduct(null)} className="rounded-lg bg-white/5 p-1 hover:bg-white/10"><X className="h-4.5 w-4.5" /></button>
            </div>

            {loadingDetail ? (
              <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : orderResult ? (
              <div className="text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">✓</div>
                <h3 className="font-bold text-sm">¡Pedido enviado con éxito!</h3>
                <p className="text-xs text-white/50">El pedido #{orderResult.order_id || orderResult.id} está siendo procesado automáticamente.</p>
                <button onClick={() => setBuyingProduct(null)} className="mt-4 w-full bg-accent text-bg py-2 rounded-xl text-xs font-bold">Cerrar</button>
              </div>
            ) : (
              <div className="space-y-4">
                {productDetail?.fields && productDetail.fields.length > 0 ? (
                  productDetail.fields.map(f => {
                    const key = f.field_name || f.name
                    return (
                      <div key={key}>
                        <label className="text-[10px] text-white/50 mb-1.5 block font-bold uppercase tracking-wider">
                          {f.label} {f.is_required && <span className="text-red-400">*</span>}
                        </label>
                        <input
                          type={f.field_type === 'number' ? 'number' : 'text'}
                          placeholder={f.placeholder || `Ingresa ${f.label}`}
                          value={formFields[key] || ''}
                          onChange={e => setFormFields(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent text-white"
                          required={f.is_required}
                        />
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-white/55">No se requieren datos adicionales para este pedido.</p>
                )}

                <div className="bg-black/25 rounded-xl p-3 space-y-1.5 text-xs border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-white/45">Precio de Compra:</span>
                    <span className="font-black text-green-300">${buyingProduct.price.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Saldo USDT disponible:</span>
                    <span className="font-bold text-white">${me.balance.toFixed(2)}</span>
                  </div>
                </div>

                {me.balance < buyingProduct.price && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg p-2.5 text-[10px] font-bold leading-normal">
                    ⚠ Saldo insuficiente en tu cuenta de revendedor. Necesitas recargar saldo para completar esta compra.
                  </div>
                )}

                <button
                  onClick={handleBuyAutomated}
                  disabled={submittingOrder || me.balance < buyingProduct.price}
                  className="w-full bg-accent text-bg font-black py-3 rounded-xl hover:bg-accent/90 active:scale-95 transition text-xs uppercase disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submittingOrder ? 'Procesando...' : 'Confirmar compra'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {buyingManualProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-card border border-white/15 p-5 animate-scale-up space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-black uppercase text-accent">Comprar Producto</h3>
                <h4 className="font-bold text-xs text-white/60 mt-0.5">{buyingManualProduct.name}</h4>
              </div>
              <button onClick={() => setBuyingManualProduct(null)} className="rounded-lg bg-white/5 p-1 hover:bg-white/10"><X className="h-4.5 w-4.5" /></button>
            </div>

            {orderResult ? (
              <div className="text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">✓</div>
                <h3 className="font-bold text-sm">¡Pedido enviado con éxito!</h3>
                <p className="text-xs text-white/50">El pedido #{orderResult.order_id} fue recibido. El administrador lo entregará pronto.</p>
                <button onClick={() => setBuyingManualProduct(null)} className="mt-4 w-full bg-accent text-bg py-2 rounded-xl text-xs font-bold">Cerrar</button>
              </div>
            ) : (
              <div className="space-y-4">
                {buyingManualProduct.options && buyingManualProduct.options.length > 0 && (
                  <div>
                    <label className="text-[10px] text-white/50 mb-1.5 block font-bold uppercase tracking-wider">Selecciona Opción</label>
                    <select
                      value={selectedOptionId}
                      onChange={e => setSelectedOptionId(e.target.value)}
                      className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent text-white"
                    >
                      {buyingManualProduct.options.map(o => (
                        <option key={o.id} value={o.id}>{o.name} - ${o.price.toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {buyingManualProduct.fields && buyingManualProduct.fields.length > 0 && (
                  buyingManualProduct.fields.map(f => (
                    <div key={f.id}>
                      <label className="text-[10px] text-white/50 mb-1.5 block font-bold uppercase tracking-wider">
                        {f.label} {f.is_required && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        type={f.field_type === 'number' ? 'number' : 'text'}
                        placeholder={f.placeholder || `Ingresa ${f.label}`}
                        value={manualFormFields[f.id] || ''}
                        onChange={e => setManualFormFields(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent text-white"
                        required={f.is_required}
                      />
                    </div>
                  ))
                )}

                <div className="bg-black/25 rounded-xl p-3 space-y-1.5 text-xs border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-white/45">Precio de Compra:</span>
                    <span className="font-black text-green-300">
                      ${(buyingManualProduct.options?.find(o => String(o.id) === String(selectedOptionId))?.price || buyingManualProduct.price).toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Saldo USDT disponible:</span>
                    <span className="font-bold text-white">${me.balance.toFixed(2)}</span>
                  </div>
                </div>

                {me.balance < (buyingManualProduct.options?.find(o => String(o.id) === String(selectedOptionId))?.price || buyingManualProduct.price) && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg p-2.5 text-[10px] font-bold leading-normal">
                    ⚠ Saldo insuficiente en tu cuenta de revendedor. Necesitas recargar saldo para completar esta compra.
                  </div>
                )}

                <button
                  onClick={handleBuyManual}
                  disabled={submittingOrder || me.balance < (buyingManualProduct.options?.find(o => String(o.id) === String(selectedOptionId))?.price || buyingManualProduct.price)}
                  className="w-full bg-accent text-bg font-black py-3 rounded-xl hover:bg-accent/90 active:scale-95 transition text-xs uppercase disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submittingOrder ? 'Procesando...' : 'Confirmar compra'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResellerSales({ me, onOpenCase }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const loadOrders = async () => {
    setLoading(true)
    try {
      const [autoList, manualList] = await Promise.all([
        api.myOrders().catch(() => []),
        api.myManualOrders().catch(() => [])
      ])
      
      const enrichedAuto = (autoList || []).map(o => ({
        ...o,
        _type: 'auto',
        id_display: `AUT-${o.id || o.order_id}`,
        raw_id: o.id || o.order_id,
        date_display: o.created_at ? new Date(o.created_at * 1000).toLocaleString() : 'N/A',
        product_name: o.product_name || 'Recarga Automática',
        price_display: `$${Number(o.price || 0).toFixed(2)}`,
        status_display: o.status || 'Completado'
      }))

      const enrichedManual = (manualList || []).map(o => ({
        ...o,
        _type: 'manual',
        id_display: `MAN-${o.id || o.order_id}`,
        raw_id: o.id || o.order_id,
        date_display: o.created_at ? new Date(o.created_at * 1000).toLocaleString() : 'N/A',
        product_name: o.product_name || 'Producto Manual',
        price_display: `$${Number(o.price || 0).toFixed(2)}`,
        status_display: o.status || 'Pendiente'
      }))

      const all = [...enrichedAuto, ...enrichedManual].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      setOrders(all)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>

  return (
    <div className="card p-3.5 sm:p-5 border-white/10 space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide">Mis Compras y Ventas</h2>
          <p className="text-xs text-white/40">Listado histórico de pedidos gestionados por tu cuenta de revendedor.</p>
        </div>
        <button onClick={loadOrders} className="rounded-lg bg-white/5 p-2 hover:bg-white/10 active:scale-95 transition">
          <RefreshCcw className="h-4.5 w-4.5 text-white/60" />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center p-12 text-white/35">No has realizado ninguna compra en el panel.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] font-bold">
                <th className="py-2.5">ID Pedido</th>
                <th className="py-2.5">Fecha</th>
                <th className="py-2.5">Producto</th>
                <th className="py-2.5 text-right">Precio Neto</th>
                <th className="py-2.5 text-center">Estado</th>
                <th className="py-2.5 text-right">Soporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map(o => (
                <tr key={o.id_display} className="hover:bg-white/5 transition">
                  <td className="py-3 font-mono font-bold text-accent">{o.id_display}</td>
                  <td className="py-3 text-white/60">{o.date_display}</td>
                  <td className="py-3 font-semibold">{o.product_name}</td>
                  <td className="py-3 text-right font-black text-green-300">{o.price_display}</td>
                  <td className="py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      o.status_display === 'Completado' || o.status_display === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : o.status_display === 'Pendiente' || o.status_display === 'pending'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {o.status_display}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {o._type === 'manual' ? (
                      <button
                        onClick={() => onOpenCase(o.raw_id, false)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/25 px-2.5 py-1 text-[10px] font-bold text-accent hover:bg-accent/20 transition active:scale-95"
                      >
                        <Headphones className="h-3.5 w-3.5" />
                        Chat Soporte
                      </button>
                    ) : (
                      <span className="text-[10px] text-white/30 italic">Autocarga</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ResellerPricing({ me }) {
  const [popularProducts, setPopularProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const retailMarkup = me?.retail_markup ?? 20.0
  const resellerMarkup = me?.reseller_markup ?? 8.0
  const factor = (1 + retailMarkup / 100) / (1 + resellerMarkup / 100)

  useEffect(() => {
    const loadSampleData = async () => {
      setLoading(true)
      try {
        const gamesList = await api.games()
        if (gamesList && gamesList.length > 0) {
          const samples = []
          for (let i = 0; i < Math.min(3, gamesList.length); i++) {
            const g = gamesList[i]
            const regs = await api.regions(g.name).catch(() => [])
            const region = regs && regs.length > 0 ? regs[0].serverName : '__standard__'
            const prods = await api.products(g.name, region).catch(() => [])
            if (prods && prods.length > 0) {
              prods.slice(0, 3).forEach(p => {
                samples.push({
                  game_title: g.title,
                  product_name: p.name,
                  reseller_price: p.price,
                })
              })
            }
          }
          setPopularProducts(samples)
        }
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    loadSampleData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-3 sm:p-4 border-white/10 bg-card/45">
          <span className="text-[10px] text-white/40 block uppercase font-bold tracking-wider">Tasa General Cliente</span>
          <span className="text-xl font-black mt-1 block">+{retailMarkup.toFixed(1)}%</span>
          <p className="text-[10px] text-white/50 mt-1">Margen aplicado a compras directas de usuarios.</p>
        </div>
        <div className="card p-3 sm:p-4 border-accent/25 bg-accent/5">
          <span className="text-[10px] text-accent block uppercase font-bold tracking-wider">Tasa Preferencial Revendedor</span>
          <span className="text-xl font-black mt-1 block text-accent">+{resellerMarkup.toFixed(1)}%</span>
          <p className="text-[10px] text-white/50 mt-1">Margen reducido que pagas en todas tus recargas.</p>
        </div>
        <div className="card p-3 sm:p-4 border-emerald-500/25 bg-emerald-500/5">
          <span className="text-[10px] text-emerald-400 block uppercase font-bold tracking-wider">Tu Beneficio / Descuento</span>
          <span className="text-xl font-black mt-1 block text-emerald-400">{(retailMarkup - resellerMarkup).toFixed(1)}% directo</span>
          <p className="text-[10px] text-white/50 mt-1">Tu ganancia neta estimada al revender a precio público.</p>
        </div>
      </div>

      <div className="card p-3.5 sm:p-5 border-white/10 space-y-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide">Muestra Comparativa de Precios</h2>
          <p className="text-xs text-white/40">Comparación en tiempo real de precios de venta finales para el catálogo actual.</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : popularProducts.length === 0 ? (
          <div className="text-center p-8 text-white/40 text-xs">No hay productos suficientes en el catálogo para comparar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] font-bold">
                  <th className="py-2.5">Juego</th>
                  <th className="py-2.5">Producto</th>
                  <th className="py-2.5 text-right">Precio Revendedor</th>
                  <th className="py-2.5 text-right">Precio Público (Aprox)</th>
                  <th className="py-2.5 text-right">Tu Ahorro Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {popularProducts.map((p, idx) => {
                  const pubPrice = p.reseller_price * factor
                  const saving = pubPrice - p.reseller_price
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition">
                      <td className="py-3 text-white/60">{p.game_title}</td>
                      <td className="py-3 font-semibold">{p.product_name}</td>
                      <td className="py-3 text-right font-black text-green-300">${p.reseller_price.toFixed(2)}</td>
                      <td className="py-3 text-right text-white/50">${pubPrice.toFixed(2)}</td>
                      <td className="py-3 text-right text-emerald-400 font-bold">+${saving.toFixed(2)} ({((saving / pubPrice) * 100).toFixed(0)}%)</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ResellerBalance({ me, onRefresh }) {
  const [amount, setAmount] = useState('50')
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState(null)
  const [err, setErr] = useState(null)

  const handleCreateInvoice = async (val) => {
    const numeric = Number(String(val).replace(',', '.'))
    if (!numeric || numeric <= 0) {
      setErr('Monto inválido')
      return
    }
    setLoading(true)
    setErr(null)
    setStatus(null)
    try {
      const inv = await api.createDeposit(numeric)
      setInvoice(inv)
      try { tg?.openLink?.(inv.pay_link) } catch {}
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }

  const handleCheckPayment = async () => {
    if (!invoice?.track_id) return
    setChecking(true)
    setErr(null)
    try {
      const res = await api.checkDeposit(invoice.track_id)
      setStatus(res.status)
      if (res.status === 'paid') {
        onRefresh()
      }
    } catch (e) {
      setErr(e.message)
    }
    setChecking(false)
  }

  const presets = [50, 100, 250, 500]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <div className="card p-3.5 sm:p-5 border-accent/20 bg-card/60 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-accent/15 text-accent rounded-xl">
              <Crown className="h-6 w-6 animate-pulse" />
            </span>
            <div>
              <h3 className="font-black text-sm uppercase">Nivel Revendedor</h3>
              <p className="text-[10px] text-white/40">Descuentos comerciales activos</p>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-3">
            <div>
              <span className="text-[10px] text-white/45 block uppercase font-bold tracking-wider">Saldo USDT actual:</span>
              <span className="text-2xl font-black text-green-300">${me.balance.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-white/45 block uppercase font-bold tracking-wider">Depósito Mínimo Exigido:</span>
              <span className="text-xs font-bold text-white/70">${me.reseller_min_deposit.toFixed(2)} USDT</span>
            </div>
          </div>

          {me.reseller_deposit_remaining > 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-lg p-3 text-[10px] font-bold leading-relaxed">
              ⚠ Faltan ${me.reseller_deposit_remaining.toFixed(2)} USDT de depósito acumulado para activar tus descuentos de revendedor.
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-[10px] font-bold flex items-center gap-2">
              <span className="text-xs">✓</span> Descuento comercial activo y desbloqueado.
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-2 card p-3.5 sm:p-5 border-white/10 space-y-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide">Recargar Saldo (USDT)</h2>
          <p className="text-xs text-white/40">Carga fondos al instante usando criptomonedas (TRC20, BEP20, etc.) vía OxaPay.</p>
        </div>

        {err && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg p-3 text-xs font-semibold">
            ⚠ {err}
          </div>
        )}

        {invoice ? (
          <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-4 text-center">
            <h3 className="font-bold text-xs uppercase tracking-wider text-accent">Factura Generada</h3>
            <p className="text-xs text-white/60">Se creó una solicitud de pago por <span className="font-black text-white">${Number(amount).toFixed(2)} USDT</span>.</p>
            
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <a
                href={invoice.pay_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-xs font-black text-bg hover:bg-accent/90 active:scale-95 transition"
              >
                Pagar Factura
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <button
                onClick={handleCheckPayment}
                disabled={checking}
                className="rounded-xl border border-white/15 bg-white/5 py-3 text-xs font-bold hover:bg-white/10 active:scale-95 transition disabled:opacity-50"
              >
                {checking ? 'Verificando...' : 'Verificar Pago'}
              </button>

              <button
                onClick={() => setInvoice(null)}
                className="text-[10px] text-white/40 hover:text-white underline mt-2"
              >
                Crear otra factura
              </button>
            </div>

            {status === 'paid' ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg p-3 text-xs font-bold text-center">
                ✓ ¡El pago fue acreditado! Tu saldo ha sido actualizado.
              </div>
            ) : status === 'expired' ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg p-3 text-xs font-bold text-center">
                Factura expirada. Genera una nueva.
              </div>
            ) : status && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-lg p-3 text-xs font-bold text-center">
                Estado del pago: {status.toUpperCase()}...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {presets.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className={`rounded-lg py-2.5 text-xs font-bold border transition ${amount === String(val) ? 'border-accent bg-accent/15 text-white' : 'border-white/10 bg-black/15 text-white/60 hover:border-white/20'}`}
                >
                  ${val}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  placeholder="Monto personalizado"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-bg border border-white/10 rounded-xl py-3 px-4 text-xs outline-none focus:border-accent text-white"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/40">USDT</span>
              </div>
              
              <button
                onClick={() => handleCreateInvoice(amount)}
                disabled={loading}
                className="rounded-xl bg-accent px-6 py-3 text-xs font-black text-bg hover:bg-accent/90 active:scale-95 transition disabled:opacity-50 flex-shrink-0"
              >
                {loading ? 'Generando...' : 'Recargar'}
              </button>
            </div>
            
            <p className="text-[10px] text-white/40 leading-relaxed">
              * Nota: Los depósitos se acreditan de forma totalmente automática tras la primera confirmación en la red. Asegúrate de transferir el monto exacto indicado en la factura para evitar demoras.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
