import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Award, ShieldCheck, ShieldAlert, Lock, CheckCircle2, ChevronRight,
  Bell, MessageCircle, ExternalLink, Sparkles, Send, TrendingUp,
  AlertTriangle, Info, Clock, Star, Store, Package, Zap, Radio,
  RefreshCcw, ArrowRight, Check, HelpCircle, Layers, FileText,
  User, CheckSquare, X, ChevronDown, Headphones, ClipboardList,
  DollarSign, WalletCards, Smartphone, Bot, ThumbsUp, PlusCircle
} from 'lucide-react'
import { api } from './api/client'

// ════════════════════════════════════════════════════════════════
//   CONFIGURACIÓN DE NIVELES Y CATEGORÍAS DE VENDEDORES (GAMSGO)
// ════════════════════════════════════════════════════════════════

export const SELLER_TIERS = [
  {
    level: 1,
    id: 'rookie',
    name: 'Vendedor Inicial',
    badge: 'Nivel 1 · Básico',
    color: 'from-blue-500/20 to-cyan-500/10 border-cyan-500/30 text-cyan-400',
    iconColor: 'bg-cyan-500/20 text-cyan-300',
    maxActiveProducts: 3,
    requirements: 'Nivel inicial al abrir tu tienda',
    minOrders: 0,
    minRating: 0,
    unlockedCategories: [
      { id: 'recargas', name: 'Recargas por UID (Free Fire, Mobile Legends, Roblox)', icon: '🎮', allowed: true },
      { id: 'monedas', name: 'Monedas de Juego Estándar', icon: '🪙', allowed: true },
      { id: 'giftcards', name: 'Tarjetas de Regalo de Bajo Valor (< $10)', icon: '🎁', allowed: true },
    ],
    lockedCategories: [
      { id: 'svod', name: 'Suscripciones de Streaming (Netflix, Disney+, Max)', icon: '📺', reason: 'Requiere Nivel 2 o Aprobación de Seller Manager' },
      { id: 'ai', name: 'Cuentas de IA (ChatGPT Plus, Gemini, Claude)', icon: '🤖', reason: 'Requiere Nivel 2 o Aprobación de Seller Manager' },
      { id: 'software', name: 'Software Keys & Licencias (Windows, Office)', icon: '💻', reason: 'Requiere Nivel 3 o Aprobación de Seller Manager' },
      { id: 'cuentas', name: 'Cuentas Full Access con Correo Original', icon: '🔑', reason: 'Requiere Nivel 3 o Aprobación de Seller Manager' },
    ],
    perks: [
      'Publicación de hasta 3 productos activos',
      'Cobros automáticos en USDT a tu balance',
      'Protección de fondos con FranchoShield'
    ]
  },
  {
    level: 2,
    id: 'verified',
    name: 'Vendedor Verificado',
    badge: 'Nivel 2 · Silver',
    color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    iconColor: 'bg-emerald-500/20 text-emerald-300',
    maxActiveProducts: 15,
    requirements: 'Completar 5 ventas exitosas con calificación ≥ 4.5★ o aprobación de Ben',
    minOrders: 5,
    minRating: 4.5,
    unlockedCategories: [
      { id: 'recargas', name: 'Recargas por UID y Pases de Batalla', icon: '🎮', allowed: true },
      { id: 'svod', name: 'Streaming (Netflix, Disney+, Max, Spotify)', icon: '📺', allowed: true },
      { id: 'ai', name: 'Herramientas de IA (ChatGPT Plus, Gemini, Claude)', icon: '🤖', allowed: true },
      { id: 'giftcards', name: 'Tarjetas de Regalo Globales', icon: '🎁', allowed: true },
    ],
    lockedCategories: [
      { id: 'software', name: 'Software Keys & Licencias Digitales', icon: '💻', reason: 'Requiere Nivel 3 o Permiso Especial' },
      { id: 'cuentas', name: 'Cuentas Full Access de Alto Valor', icon: '🔑', reason: 'Requiere Nivel 3 o Permiso Especial' },
    ],
    perks: [
      'Hasta 15 productos activos simultáneos',
      'Desbloqueo de Streaming y Cuentas de Inteligencia Artificial',
      'Insignia de "Vendedor Verificado" en tus productos',
      'Acceso al comparador multi-tienda con prioridad estándar'
    ]
  },
  {
    level: 3,
    id: 'top_seller',
    name: 'Vendedor Top / Avanzado',
    badge: 'Nivel 3 · Gold',
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-400',
    iconColor: 'bg-amber-500/20 text-amber-300',
    maxActiveProducts: 50,
    requirements: 'Completar 25 ventas exitosas con calificación ≥ 4.8★',
    minOrders: 25,
    minRating: 4.8,
    unlockedCategories: [
      { id: 'recargas', name: 'Recargas por UID y Monedas Masivas', icon: '🎮', allowed: true },
      { id: 'svod', name: 'Streaming y Cuentas Privadas Completas', icon: '📺', allowed: true },
      { id: 'ai', name: 'Herramientas de IA (ChatGPT, Claude, Midjourney)', icon: '🤖', allowed: true },
      { id: 'software', name: 'Software Keys & Licencias (Windows, Office, Steam)', icon: '💻', allowed: true },
      { id: 'cuentas', name: 'Cuentas Full Access y Personajes de Juegos', icon: '🔑', allowed: true },
    ],
    lockedCategories: [],
    perks: [
      'Hasta 50 productos activos en catálogo',
      'Acceso total a todas las categorías del Catálogo Maestro',
      'Insignia dorada de "Top Seller" con máxima visibilidad',
      'Comisión de plataforma reducida (-2%)',
      'Retiros prioritarios procesados en menos de 4 horas'
    ]
  },
  {
    level: 4,
    id: 'partner',
    name: 'Tienda Partner Oficial',
    badge: 'Nivel 4 · Diamond Partner',
    color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-300',
    iconColor: 'bg-purple-500/20 text-purple-200',
    maxActiveProducts: 999,
    requirements: 'Verificación KYC directa o Depósito en Garantía FranchoShield (50 USDT)',
    minOrders: 50,
    minRating: 4.9,
    unlockedCategories: [
      { id: 'all', name: 'Acceso Total Ilimitado a Todo el Catálogo y APIs', icon: '👑', allowed: true }
    ],
    lockedCategories: [],
    perks: [
      'Productos ilimitados en catálogo',
      'Acceso completo a la API B2B de carga y sincronización masiva',
      'Insignia de "Tienda Oficial Francho Shop Partner"',
      'Canal VIP privado 1 a 1 con el equipo técnico',
      'Comisión mínima preferencial de marketplace'
    ]
  }
]

export function calculateSellerTier(ordersCount = 0, avgRating = 5.0, isOfficial = false) {
  if (isOfficial) return SELLER_TIERS[3]
  if (ordersCount >= 25 && avgRating >= 4.7) return SELLER_TIERS[2]
  if (ordersCount >= 5 && avgRating >= 4.4) return SELLER_TIERS[1]
  return SELLER_TIERS[0]
}

// ════════════════════════════════════════════════════════════════
//   LISTA DE CATEGORÍAS MAESTRAS GAMSGO PARA SOLICITUD DE PERMISOS
// ════════════════════════════════════════════════════════════════

export const GAMSGO_PERMISSIONS_CATALOG = [
  { id: 'recargas', name: 'Juego / Recargas Directas (UID)', emoji: '⚡', desc: 'Free Fire, PUBG, Roblox, Genshin, MLBB' },
  { id: 'svod', name: 'Suscripción / SVOD Streaming', emoji: '🎬', desc: 'Netflix, Disney+, Crunchyroll, DAZN, F1 TV' },
  { id: 'ai', name: 'Suscripción / AI (Inteligencia Artificial)', emoji: '🤖', desc: 'ChatGPT Plus, Gemini, Claude, Midjourney, Cursor' },
  { id: 'software', name: 'Software & Productividad', emoji: '💻', desc: 'Canva, Adobe, Windows 11/10, Office, Notion' },
  { id: 'giftcards', name: 'Tarjetas Regalo (Gift Cards)', emoji: '🎁', desc: 'Apple, PlayStation, Xbox, Nintendo, Razer, Google Play' },
  { id: 'cuentas', name: 'Juego / Cuentas Verificadas', emoji: '🎮', desc: 'Fortnite, GTA 5, Steam, League of Legends, Roblox' },
  { id: 'monedas', name: 'Monedas en Juegos', emoji: '🪙', desc: 'Roblox Robux, FC Coins, PoE 2, Diablo IV, Delta Force' },
  { id: 'objetos', name: 'Juego / Objetos & Pases', emoji: '🛡️', desc: 'Skins, pases de batalla y recursos transferibles' },
  { id: 'musica', name: 'Suscripción / Música', emoji: '🎵', desc: 'Spotify, Deezer, Tidal, Qobuz' },
  { id: 'marketplace', name: 'Marketplace / Cuentas & Servicios Especiales', emoji: '🌐', desc: 'VPNs, TradingView, Discord, Telegram, Telegram Stars' }
]

// ════════════════════════════════════════════════════════════════
//   CANALES OFICIALES DE VENDEDORES (TELEGRAM & WHATSAPP)
// ════════════════════════════════════════════════════════════════

export const OFFICIAL_CHANNELS = [
  {
    id: 'tg_sellers',
    name: 'Canal Oficial de Vendedores (Telegram)',
    tag: 'Exclusivo Vendedores',
    url: 'https://t.me/Francho_Support',
    icon: Send,
    color: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    desc: 'Publicaciones urgentes de demanda de stock, cambios de comisiones, mantenimientos de APIs y normativas para tiendas.'
  },
  {
    id: 'tg_news',
    name: 'Canal Principal de Francho Shop',
    tag: 'Público Oficial',
    url: 'https://t.me/Francho_Support',
    icon: Bell,
    color: 'bg-accent/15 border-accent/30 text-accent',
    desc: 'Noticias generales para clientes, promociones semanales, lanzamientos de juegos y sorteos.'
  },
  {
    id: 'vip_support',
    name: 'Mesa de Ayuda & Mediación de Disputas',
    tag: 'Soporte 24/7',
    url: 'https://t.me/Francho_Support',
    icon: MessageCircle,
    color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    desc: 'Atención directa para resolución rápida de garantías, desbloqueo de límites de nivel y consultas de retiros USDT.'
  }
]

export const SELLER_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    category: 'catalog',
    badge: 'Novedad Catálogo',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    date: 'Hace 2 horas',
    title: 'Plantillas Oficiales del Catálogo Maestro activas para Streaming e IA',
    summary: 'Ya puedes publicar productos estandarizados de ChatGPT, Disney+, Gemini y Netflix con 1 solo clic. El catálogo maestro unifica precios y activa la comparativa de tiendas para que compitas con entrega inmediata.',
    actionText: 'Ver Catálogo Maestro',
    important: true
  },
  {
    id: 'ann-2',
    category: 'demand',
    badge: 'Demanda Urgente',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    date: 'Hoy',
    title: 'Se buscan proveedores de Free Fire (Diamantes UID) y ChatGPT Plus',
    summary: 'El volumen de búsqueda de recargas de Free Fire y cuentas de ChatGPT Plus aumentó un 45%. Los vendedores con stock listo y entrega automática instantánea están capturando el 80% de las ventas en el comparador.',
    actionText: 'Publicar Stock',
    important: false
  },
  {
    id: 'ann-3',
    category: 'rules',
    badge: 'Seguridad FranchoShield',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    date: '2026-09-08',
    title: 'Regla de Posventa: Respuesta obligatoria en menos de 24 horas',
    summary: 'Para proteger tu reputación y evitar reembolsos automáticos, responde a los casos de reclamo de compradores dentro de las 24 horas. Recuerda que no está permitido solicitar contactos externos (WhatsApp o Telegram privado).',
    actionText: 'Ver Casos Pendientes',
    important: false
  },
  {
    id: 'ann-4',
    category: 'finance',
    badge: 'Pagos & Retiros',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    date: '2026-09-05',
    title: 'Retiros automáticos en USDT (TRC20 / TON / BEP20) sin comisiones ocultas',
    summary: 'Tus ganancias liberadas se pueden retirar directamente a cualquier billetera externa de USDT. El sistema procesa los pagos entre 2 y 12 horas hábiles.',
    actionText: 'Ir a Saldo y Retiros',
    important: false
  }
]

// ════════════════════════════════════════════════════════════════
//   COMPONENTE: CHAT CON SELLER MANAGER (BEN) & SOLICITUD DE PERMISOS
// ════════════════════════════════════════════════════════════════

export function SellerManagerChatPanel({ onGoOffers, onGoHelp }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [inputMsg, setInputMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)

  // Formulario de Solicitud de Permisos
  const [selectedCats, setSelectedCats] = useState(['recargas', 'giftcards'])
  const [mainGames, setMainGames] = useState('Free Fire, PUBG Mobile, Roblox, Mobile Legends, COD Mobile, Genshin Impact')
  const [deliveryMethod, setDeliveryMethod] = useState('Direct Player ID / UID Top-up (Fast manual fulfillment)')
  const [deliveryTime, setDeliveryTime] = useState('Within 5–15 minutes after order placement')
  const [availability, setAvailability] = useState('Daily active support and consistent stock to guarantee on-time delivery according to platform rules')
  const [submittingReq, setSubmittingReq] = useState(false)

  const messagesEndRef = useRef(null)

  const loadMessages = async () => {
    try {
      const res = await api.sellerManagerMessages()
      setMessages(res?.messages || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!inputMsg.trim() || sending) return
    setSending(true)
    try {
      await api.sendSellerManagerMessage({ message: inputMsg.trim() })
      setInputMsg('')
      await loadMessages()
    } catch (e) {
      alert("Error al enviar mensaje: " + e.message)
    } finally {
      setSending(false)
    }
  }

  const handleToggleCat = (id) => {
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const handleSubmitRequest = async () => {
    if (selectedCats.length === 0) {
      alert("Por favor selecciona al menos una categoría.")
      return
    }
    setSubmittingReq(true)
    try {
      await api.requestSellerCategoryPermission({
        categories: selectedCats,
        main_games: mainGames,
        delivery_method: deliveryMethod,
        delivery_time: deliveryTime,
        availability: availability,
        message: ""
      })
      setShowRequestModal(false)
      await loadMessages()
      alert("¡Solicitud enviada a Ben con éxito! Nuestro equipo revisará los datos y activará tus categorías.")
    } catch (e) {
      alert("Error: " + e.message)
    } finally {
      setSubmittingReq(false)
    }
  }

  return (
    <div className="space-y-4 text-left max-w-4xl mx-auto flex flex-col h-[calc(100vh-120px)] sm:h-[720px]">
      {/* Header del Chat con Ben */}
      <div className="p-4 sm:p-5 rounded-3xl bg-card border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-accent to-purple-500 text-black font-black flex items-center justify-center text-xl shadow-lg shadow-accent/20">
              👨‍💼
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-card" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm sm:text-base text-white">Seller Manager - Ben</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold uppercase tracking-wider flex-shrink-0">
                Oficial GG
              </span>
            </div>
            <p className="text-xs text-white/50 truncate sm:whitespace-normal">
              En línea · Gestor oficial de cuenta y activación de permisos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRequestModal(true)}
          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-black text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-accent/20 active:scale-95 whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Solicitar Permisos de Categoría</span>
        </button>
      </div>

      {/* Caja de Conversación */}
      <div className="flex-1 overflow-y-auto p-4 rounded-3xl bg-card/60 border border-white/10 space-y-3.5">
        {loading ? (
          <div className="h-full flex items-center justify-center text-white/40 text-xs">
            Cargando mensajes con tu Seller Manager...
          </div>
        ) : (
          messages.map((m, idx) => {
            const isBen = m.sender === 'manager'
            return (
              <div
                key={m.id || idx}
                className={`flex gap-3 max-w-[88%] sm:max-w-[78%] ${
                  isBen ? 'self-start' : 'self-end ml-auto flex-row-reverse'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs flex-shrink-0 font-bold ${
                  isBen ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/10 text-white'
                }`}>
                  {isBen ? 'Ben' : 'Tú'}
                </div>

                <div className={`p-4 rounded-2xl text-xs leading-relaxed space-y-1.5 shadow-md ${
                  isBen
                    ? 'bg-card border border-white/10 text-white/90'
                    : 'bg-accent text-black font-medium'
                }`}>
                  <div className="flex items-center justify-between gap-3 text-[10px] opacity-60">
                    <span className="font-bold">{isBen ? 'Seller Manager - Ben' : 'Tú'}</span>
                    <span>{m.created_at ? new Date(m.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>

                  <div className="whitespace-pre-line break-words text-[11.5px]">
                    {m.message}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Envío */}
      <form onSubmit={handleSendMessage} className="flex gap-2 flex-shrink-0">
        <input
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          placeholder="Escribe a Ben sobre tus permisos, dudas operativas o catálogo..."
          className="flex-1 bg-card border border-white/15 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder:text-white/40 outline-none focus:border-accent transition shadow-inner"
        />
        <button
          type="submit"
          disabled={sending || !inputMsg.trim()}
          className="px-5 py-3 rounded-2xl bg-accent hover:bg-accent/90 disabled:opacity-40 text-black text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-accent/20 active:scale-95"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>

      {/* Modal de Solicitud de Permisos de Categoría */}
      {showRequestModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-bg border border-white/15 shadow-2xl overflow-hidden animate-slide-up text-left">
            <div className="p-4 sm:p-5 border-b border-white/10 bg-card/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent/20 text-accent font-black">
                  🤝
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">
                    Solicitar Permisos de Venta a Ben
                  </h3>
                  <p className="text-xs text-white/50">
                    Selecciona las categorías que deseas activar en tu cuenta de vendedor
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="p-1.5 rounded-full bg-white/10 text-white/60 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
              {/* Selector de Categorías */}
              <div className="space-y-2">
                <label className="font-bold text-white block">
                  1. Categorías que solicitas activar:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {GAMSGO_PERMISSIONS_CATALOG.map(cat => {
                    const isChecked = selectedCats.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggleCat(cat.id)}
                        className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-accent/15 border-accent text-white shadow-sm'
                            : 'bg-card border-white/10 text-white/60 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-xl mt-0.5">{cat.emoji}</span>
                        <div className="min-w-0">
                          <p className={`font-black text-xs truncate ${isChecked ? 'text-accent' : 'text-white'}`}>
                            {cat.name}
                          </p>
                          <p className="text-[10px] text-white/40 line-clamp-1">
                            {cat.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Formulario con los 4 puntos oficiales */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="font-bold text-white block mb-1">
                    2. Servicios o Juegos Principales (Main Games/Services):
                  </label>
                  <input
                    value={mainGames}
                    onChange={e => setMainGames(e.target.value)}
                    placeholder="Ej: Free Fire, PUBG Mobile, Roblox, Disney+, ChatGPT"
                    className="w-full bg-card border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="font-bold text-white block mb-1">
                    3. Método de Entrega (Delivery Method):
                  </label>
                  <input
                    value={deliveryMethod}
                    onChange={e => setDeliveryMethod(e.target.value)}
                    placeholder="Ej: Direct Player ID / UID Top-up, Stock Inmediato, Credenciales"
                    className="w-full bg-card border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="font-bold text-white block mb-1">
                    4. Tiempo Estimado de Entrega (Estimated Delivery Time):
                  </label>
                  <input
                    value={deliveryTime}
                    onChange={e => setDeliveryTime(e.target.value)}
                    placeholder="Ej: Dentro de 5–15 minutos después de confirmar orden"
                    className="w-full bg-card border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="font-bold text-white block mb-1">
                    5. Disponibilidad y Stock (Availability):
                  </label>
                  <input
                    value={availability}
                    onChange={e => setAvailability(e.target.value)}
                    placeholder="Ej: Soporte diario activo y stock garantizado según reglas"
                    className="w-full bg-card border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-card/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitRequest}
                disabled={submittingReq || selectedCats.length === 0}
                className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 text-black text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-accent/20 active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{submittingReq ? 'Enviando...' : 'Enviar Solicitud a Ben'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//   COMPONENTE: GESTIÓN DE PERMISOS PARA ADMIN (PANEL ADMIN)
// ════════════════════════════════════════════════════════════════

export function AdminSellerPermissionsManagementPanel() {
  const [data, setData] = useState({ sellers: [], requests: [], all_categories: [] })
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  const loadData = async () => {
    try {
      const res = await api.adminSellerPermissions()
      setData(res || { sellers: [], requests: [], all_categories: [] })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggle = async (sellerId, categorySlug, currentApproved) => {
    const newStatus = currentApproved ? 'revoked' : 'approved'
    setToggling(`${sellerId}-${categorySlug}`)
    try {
      await api.adminToggleSellerPermission({
        seller_id: sellerId,
        category_slug: categorySlug,
        status: newStatus
      })
      await loadData()
    } catch (e) {
      alert("Error: " + e.message)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-card border border-white/10 shadow-xl flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-black">
            <Award className="h-4 w-4" />
            <span>Control Oficial de Permisos GG</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Permisos de Venta y Solicitudes de Categoría
          </h1>
          <p className="text-xs text-white/60">
            Aprueba o revoca permisos de publicación a vendedores según cumplimiento y acuerdos con el Seller Manager (Ben).
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition active:scale-95"
        >
          <RefreshCcw className="h-4 w-4 text-accent" />
        </button>
      </div>

      {/* Solicitudes Pendientes */}
      <div className="space-y-3">
        <h2 className="text-xs font-black text-white/70 uppercase tracking-wider px-1 flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <span>Solicitudes Pendientes Recibidas ({data.requests?.length || 0})</span>
        </h2>

        {data.requests?.length === 0 ? (
          <div className="card p-6 text-center text-xs text-white/40 rounded-2xl border border-white/10">
            No hay solicitudes pendientes de activación en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.requests.map(req => {
              let cats = []
              try { cats = JSON.parse(req.categories_requested) } catch { cats = [req.categories_requested] }

              return (
                <div key={req.id} className="p-4 rounded-2xl bg-card border border-accent/30 shadow-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-sm text-white">{req.store_name || req.first_name || `Vendedor #${req.seller_id}`}</span>
                      <span className="text-[10px] text-white/40 block">ID: {req.seller_id} · {new Date(req.created_at * 1000).toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black">
                      Pendiente
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1 text-xs">
                    <p className="text-white/75 font-semibold">Categorías solicitadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {cats.map(c => (
                        <span key={c} className="px-2 py-0.5 rounded-lg bg-accent/20 text-accent text-[10px] font-bold">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-white/60 line-clamp-2">
                    {req.service_details}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                    {cats.map(c => (
                      <button
                        key={c}
                        onClick={() => handleToggle(req.seller_id, c, false)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-black transition active:scale-95 flex items-center gap-1 shadow"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Aprobar {c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Matriz de Vendedores y sus Permisos Actuales */}
      <div className="space-y-3">
        <h2 className="text-xs font-black text-white/70 uppercase tracking-wider px-1 flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <span>Matriz de Permisos por Vendedor ({data.sellers?.length || 0})</span>
        </h2>

        <div className="space-y-3">
          {data.sellers.map(s => {
            const approved = s.approved_categories || []

            return (
              <div key={s.user_id} className="p-4 sm:p-5 rounded-2xl bg-card border border-white/10 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs text-accent">
                      #{s.user_id}
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">{s.store_name || s.first_name || 'Sin nombre de tienda'}</h4>
                      <span className="text-[10px] text-white/40">@{s.username || 'sin_username'} · {s.total_orders || 0} órdenes</span>
                    </div>
                  </div>
                  <span className="text-xs text-white/50">
                    {approved.length} categorías autorizadas
                  </span>
                </div>

                {/* Toggles de Categorías */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {GAMSGO_PERMISSIONS_CATALOG.map(cat => {
                    const isOk = approved.includes(cat.id)
                    const isBusy = toggling === `${s.user_id}-${cat.id}`

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggle(s.user_id, cat.id, isOk)}
                        disabled={isBusy}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 text-xs ${
                          isOk
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>{cat.emoji}</span>
                          <span className="truncate text-[11px] font-bold">{cat.name.split('/')[0].trim()}</span>
                        </div>
                        {isOk ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//   PANEL DE CATEGORÍAS Y PROGRESIÓN DE NIVELES (TIERS)
// ════════════════════════════════════════════════════════════════

export function SellerTiersProgressionPanel({ dashboard, store, onGoProducts }) {
  const completedOrders = Number(dashboard?.summary?.all?.orders || dashboard?.stats?.completed_orders || 0)
  const avgRating = Number(dashboard?.satisfaction?.avg_rating || 5.0)
  const isOfficial = Boolean(store?.is_official || store?.verified_partner)

  const currentTier = useMemo(() => {
    return calculateSellerTier(completedOrders, avgRating, isOfficial)
  }, [completedOrders, avgRating, isOfficial])

  const nextTier = useMemo(() => {
    const nextLvl = currentTier.level + 1
    return SELLER_TIERS.find(t => t.level === nextLvl) || null
  }, [currentTier])

  const progressPercent = useMemo(() => {
    if (!nextTier) return 100
    const needed = nextTier.minOrders
    if (needed === 0) return 100
    return Math.min(100, Math.round((completedOrders / needed) * 100))
  }, [completedOrders, nextTier])

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      {/* Cabecera del Nivel Actual */}
      <div className={`p-6 sm:p-7 rounded-3xl bg-gradient-to-br ${currentTier.color} bg-card border shadow-xl relative overflow-hidden`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${currentTier.iconColor} shadow-inner`}>
                <Award className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-white">
                  {currentTier.badge}
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  {currentTier.name}
                </h1>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/70 max-w-xl leading-relaxed">
              Tu nivel determina qué categorías del catálogo maestro puedes publicar, tu límite de stock simultáneo y tus beneficios de comisión.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 p-3 rounded-2xl bg-black/40 border border-white/10 w-full sm:w-auto">
            <div className="text-[11px] text-white/50 font-bold">Límite de Productos Activos:</div>
            <div className="text-lg font-black text-white">
              {currentTier.maxActiveProducts === 999 ? 'Ilimitados 🚀' : `Hasta ${currentTier.maxActiveProducts} productos`}
            </div>
            <div className="text-[10px] text-white/40">
              {completedOrders} ventas completadas · ⭐ {avgRating.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Barra de Progreso hacia el siguiente nivel */}
        {nextTier && (
          <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70 font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span>Progreso hacia {nextTier.name}:</span>
              </span>
              <span className="text-accent font-black">
                {completedOrders} / {nextTier.minOrders} ventas ({progressPercent}%)
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-[11px] text-white/50">
              💡 Completa <strong>{Math.max(0, nextTier.minOrders - completedOrders)} ventas más</strong> con buena calificación para desbloquear {nextTier.name} y acceder a más categorías automáticamente.
            </p>
          </div>
        )}
      </div>

      {/* Matriz de Categorías: Desbloqueadas vs Bloqueadas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-white/70 uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            <span>Permisos de Publicación por Categoría</span>
          </h2>
          <span className="text-xs text-white/40">Basado en tu nivel de vendedor</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-5 rounded-3xl bg-card border border-emerald-500/20 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Categorías Habilitadas ({currentTier.unlockedCategories.length})</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">
                Autorizado
              </span>
            </div>

            <div className="space-y-2">
              {currentTier.unlockedCategories.map((cat, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{cat.icon}</span>
                    <span className="font-bold text-white/90">{cat.name}</span>
                  </div>
                  <span className="text-emerald-400 text-xs font-black flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>Listo</span>
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onGoProducts}
              className="w-full mt-2 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-black text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-accent/20 active:scale-95"
            >
              <Package className="h-4 w-4" />
              <span>Publicar en estas categorías</span>
            </button>
          </div>

          <div className="p-5 rounded-3xl bg-card border border-white/10 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/60 font-black text-sm">
                <Lock className="h-4 w-4 text-amber-400" />
                <span>Categorías por Desbloquear ({currentTier.lockedCategories.length})</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold">
                Requiere Nivel Superior
              </span>
            </div>

            {currentTier.lockedCategories.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40 space-y-1">
                <div className="text-2xl">🎉</div>
                <p className="font-bold text-white/80">¡Felicidades! Tienes acceso total</p>
                <p>No tienes ninguna categoría bloqueada en el catálogo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentTier.lockedCategories.map((cat, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 text-xs opacity-75">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{cat.icon}</span>
                      <div>
                        <span className="font-bold text-white/80 block">{cat.name}</span>
                        <span className="text-[10px] text-amber-300/80">{cat.reason}</span>
                      </div>
                    </div>
                    <Lock className="h-4 w-4 text-white/30 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] text-white/50 leading-relaxed">
              💡 <strong>¿Por qué se bloquean ciertas categorías?</strong> Para proteger a los compradores y garantizar que solo vendedores con historial comprobado ofrezcan cuentas de streaming y software sensible.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//   PANEL DE CANALES OFICIALES & NOVEDADES
// ════════════════════════════════════════════════════════════════

export function SellerOfficialChannelsPanel({ onGoTiers, onGoHelp }) {
  const [filter, setFilter] = useState('all')

  const filteredAnnouncements = useMemo(() => {
    if (filter === 'all') return SELLER_ANNOUNCEMENTS
    return SELLER_ANNOUNCEMENTS.filter(a => a.category === filter)
  }, [filter])

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-accent/15 via-purple-500/10 to-card border border-accent/30 shadow-xl relative overflow-hidden">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent text-xs font-extrabold">
            <Radio className="h-4 w-4" />
            <span>Canales Oficiales & Comunicados para Vendedores</span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-white">
            Tablón de Actualizaciones y Canales Oficiales
          </h1>

          <p className="text-xs sm:text-sm text-white/65 max-w-2xl leading-relaxed">
            Mantente conectado con las publicaciones oficiales del equipo de Francho Shop, demandas urgentes de stock de clientes y novedades técnicas de la plataforma.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-white/70 uppercase tracking-wider flex items-center gap-2">
            <Send className="h-4 w-4 text-accent" />
            <span>Canales de Comunicación Directa</span>
          </h2>
          <span className="text-xs text-white/40">Enlaces verificados</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {OFFICIAL_CHANNELS.map(ch => {
            const Icon = ch.icon

            return (
              <div
                key={ch.id}
                className="p-5 rounded-3xl bg-card border border-white/10 hover:border-accent/40 text-left transition flex flex-col justify-between shadow-lg space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${ch.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/5 text-white/70">
                      {ch.tag}
                    </span>
                  </div>

                  <h3 className="font-black text-sm sm:text-base text-white">
                    {ch.name}
                  </h3>

                  <p className="text-xs text-white/50 leading-relaxed">
                    {ch.desc}
                  </p>
                </div>

                <a
                  href={ch.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 shadow"
                >
                  <span>Unirme al Canal</span>
                  <ExternalLink className="h-3.5 w-3.5 text-accent" />
                </a>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <h2 className="text-xs font-black text-white/70 uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent" />
            <span>Publicaciones y Alertas para Vendedores ({filteredAnnouncements.length})</span>
          </h2>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full min-w-0 [scrollbar-width:none]">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'catalog', label: 'Catálogo' },
              { id: 'demand', label: 'Demanda de Stock' },
              { id: 'rules', label: 'Normativas' },
              { id: 'finance', label: 'Pagos' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  filter === f.id
                    ? 'bg-accent text-black font-black'
                    : 'bg-white/5 hover:bg-white/10 text-white/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredAnnouncements.map(ann => (
            <div
              key={ann.id}
              className={`p-5 rounded-2xl bg-card border text-left transition shadow-md space-y-2.5 ${
                ann.important ? 'border-accent/40 bg-accent/5' : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${ann.badgeColor}`}>
                  {ann.badge}
                </span>
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ann.date}
                </span>
              </div>

              <h3 className="font-extrabold text-sm sm:text-base text-white">
                {ann.title}
              </h3>

              <p className="text-xs text-white/60 leading-relaxed">
                {ann.summary}
              </p>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-[10px] text-white/35">Publicado por el Equipo Francho Shop</span>
                {onGoTiers && ann.category === 'catalog' && (
                  <button
                    type="button"
                    onClick={onGoTiers}
                    className="text-accent font-bold hover:underline flex items-center gap-1 text-xs"
                  >
                    <span>Consultar categorías</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {onGoHelp && ann.category === 'rules' && (
                  <button
                    type="button"
                    onClick={onGoHelp}
                    className="text-accent font-bold hover:underline flex items-center gap-1 text-xs"
                  >
                    <span>Ver reglas en Centro de Ayuda</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
