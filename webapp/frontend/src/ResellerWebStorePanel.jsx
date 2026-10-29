import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Store, Globe, Sparkles, Check, Copy, ExternalLink, RefreshCw,
  Zap, ShieldCheck, Palette, MessageCircle, Send, ArrowRight,
  AlertCircle, CheckCircle2, ChevronRight, Crown, Sliders, Smartphone,
  CreditCard, Mail, DollarSign, Gamepad2, Settings, HelpCircle,
  ReceiptText, Search, Clock, User, Users, Phone, Tag, Lock,
  Upload, Image as ImageIcon, Trash2, X, ChevronLeft, ChevronDown,
  CheckCheck, Loader2, Filter, RotateCcw, Plus, Layers, Bot, Wallet, Flame,
  Eye, EyeOff, Key, Info, ArrowLeft, CheckCircle
} from 'lucide-react'
import api from './api/client'

const BILLING_CYCLES = [
  { key: '1_month', label: '1 Mes', discountText: null, months: 1 },
  { key: '3_months', label: '3 Meses', discountText: '5% OFF', months: 3 },
  { key: '6_months', label: '6 Meses', discountText: '10% OFF', months: 6 },
  { key: '12_months', label: '12 Meses', discountText: '2 Meses Gratis 🔥', months: 12 },
]

const getCyclePrice = (planData, cycle) => {
  if (!planData) return 0
  if (planData.cycles && planData.cycles[cycle]) {
    return planData.cycles[cycle].price
  }
  const baseMonthly = planData.price_monthly || 0
  if (cycle === '12_months' || cycle === 'yearly') return planData.price_yearly || Number((baseMonthly * 10).toFixed(2))
  if (cycle === '6_months') return Number((baseMonthly * 6 * 0.90).toFixed(2))
  if (cycle === '3_months') return Number((baseMonthly * 3 * 0.95).toFixed(2))
  return baseMonthly
}

function ImageUploadField({ label, value, onChange, placeholder, previewType = 'square', hint }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await api.uploadWebStoreImage(file)
      if (res?.ok && res.url) {
        onChange(res.url)
      } else {
        alert('Error al subir la imagen')
      }
    } catch (err) {
      console.error('Error uploading image:', err)
      alert(err.message || 'Error al subir imagen. Usa JPG, PNG, WEBP o GIF menor a 10MB.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black text-white">{label}</label>
        {hint && <span className="text-[10px] text-white/40">{hint}</span>}
      </div>

      <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition">
        <div className={`rounded-xl bg-black/60 border border-white/15 flex items-center justify-center shrink-0 overflow-hidden relative shadow-md ${previewType === 'banner' ? 'w-24 h-12' : 'w-14 h-14'}`}>
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <ImageIcon className="w-6 h-6 text-white/30" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Subiendo imagen...' : '📁 Subir imagen'}</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                Quitar
              </button>
            )}
          </div>

          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'O ingresa enlace directo...'}
            className="w-full rounded-xl bg-black/50 border border-white/10 px-2.5 py-1 text-[11px] font-mono text-white/80 placeholder:text-white/20 outline-none focus:border-emerald-400"
          />
        </div>
      </div>
    </div>
  )
}

export default function ResellerWebStorePanel({ onOpenDeposit }) {
  const [activeTab, setActiveTab] = useState('hub') // 'hub', 'plans', 'domain', 'telegram', 'email', 'orders', 'customers'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [storeData, setStoreData] = useState(null)
  const [plans, setPlans] = useState({})
  const [userBalance, setUserBalance] = useState(0)
  const [billingCycle, setBillingCycle] = useState('1_month')
  const [copiedLink, setCopiedLink] = useState(false)
  const [toast, setToast] = useState(null)

  // Creation Wizard Form State (para usuarios sin tienda previa)
  const [wizardStoreName, setWizardStoreName] = useState('')
  const [wizardSlug, setWizardSlug] = useState('')
  const [wizardPlan, setWizardPlan] = useState('plata')
  const [creatingStore, setCreatingStore] = useState(false)

  // Pedidos de la tienda
  const [ordersList, setOrdersList] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersSearch, setOrdersSearch] = useState('')

  // Clientes de la tienda
  const [customersList, setCustomersList] = useState([])
  const [customersStats, setCustomersStats] = useState({ total_customers: 0, total_revenue_usdt: 0, total_profit_usdt: 0, registered_count: 0 })
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customersSearch, setCustomersSearch] = useState('')

  // Estado para gestión de Bot de Telegram y Mini App
  const [telegramConnecting, setTelegramConnecting] = useState(false)
  const [telegramDisconnecting, setTelegramDisconnecting] = useState(false)
  const [botTokenInput, setBotTokenInput] = useState('')
  const [showAppPassword, setShowAppPassword] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testRecipient, setTestRecipient] = useState('')
  const [showSmtpGuide, setShowSmtpGuide] = useState(false)

  // Formulario principal
  const [form, setForm] = useState({
    slug: '',
    store_name: '',
    tagline: '',
    logo_url: '',
    banner_url: '',
    primary_color: '#00C26F',
    secondary_color: '#3B82F6',
    bg_style: 'midnight',
    markup_percent: 10.0,
    whatsapp_number: '',
    telegram_username: '',
    instagram_url: '',
    custom_domain: '',
    contact_email: '',
    telegram_bot_token: '',
    telegram_bot_username: '',
    telegram_bot_active: false,
    store_mode: 'both',
    notification_prefs: {
      notify_telegram: true,
      notify_email: true
    },
    sms_config: {
      enabled: true,
      markup_percent: 15.0,
      featured_services: ['whatsapp', 'telegram', 'google', 'openai', 'tiktok']
    },
    theme_config: {
      hero_title: '',
      hero_subtitle: '',
      announcement_bar: '',
      hero_badge: 'Recargas 100% Automáticas 24/7'
    },
    game_markups: {},
    payment_methods: {
      oxapay: {
        enabled: true,
        merchant_key: ''
      },
      whatsapp_checkout: {
        enabled: true
      }
    },
    email_config: {
      enabled: true,
      smtp_user: '',
      smtp_app_password: '',
      sender_name: '',
      notify_on_order: true,
      notify_client_receipt: true,
      notify_client_delivery: true,
    }
  })

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const loadStore = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await api.getMyWebStore()
      if (res?.ok) {
        setPlans(res.plans || {})
        setUserBalance(res.user_balance || 0)
        if (res.store) {
          const s = res.store
          setStoreData(s)
          setForm({
            slug: s.slug || '',
            store_name: s.store_name || '',
            tagline: s.tagline || '',
            logo_url: s.logo_url || '',
            banner_url: s.banner_url || '',
            primary_color: s.primary_color || '#00C26F',
            secondary_color: s.secondary_color || '#3B82F6',
            bg_style: s.bg_style || 'midnight',
            markup_percent: Number(s.markup_percent || 10.0),
            whatsapp_number: s.whatsapp_number || '',
            telegram_username: s.telegram_username || '',
            instagram_url: s.instagram_url || '',
            custom_domain: s.custom_domain || '',
            contact_email: s.contact_email || '',
            sms_config: s.sms_config || s.theme_config?.sms_config || {
              enabled: true,
              markup_percent: 15.0,
              featured_services: ['whatsapp', 'telegram', 'google', 'openai', 'tiktok']
            },
            theme_config: {
              hero_title: s.theme_config?.hero_title || '',
              hero_subtitle: s.theme_config?.hero_subtitle || '',
              announcement_bar: s.theme_config?.announcement_bar || '',
              hero_badge: s.theme_config?.hero_badge || 'Recargas 100% Automáticas 24/7'
            },
            game_markups: s.game_markups || {},
            payment_methods: {
              oxapay: {
                enabled: true,
                merchant_key: ''
              },
              whatsapp_checkout: {
                enabled: Boolean(s.payment_methods?.whatsapp_checkout?.enabled ?? true)
              }
            },
            email_config: {
              enabled: Boolean(s.email_config?.enabled ?? true),
              smtp_user: s.email_config?.smtp_user || s.contact_email || '',
              smtp_app_password: s.email_config?.smtp_app_password || '',
              sender_name: s.email_config?.sender_name || s.store_name || '',
              notify_on_order: Boolean(s.email_config?.notify_on_order ?? true),
              notify_client_receipt: Boolean(s.email_config?.notify_client_receipt ?? true),
              notify_client_delivery: Boolean(s.email_config?.notify_client_delivery ?? true),
            },
            telegram_bot_token: s.telegram_bot_token || '',
            telegram_bot_username: s.telegram_bot_username || '',
            telegram_bot_active: Boolean(s.telegram_bot_active),
            store_mode: s.store_mode || 'both',
            notification_prefs: s.notification_prefs || {
              notify_telegram: true,
              notify_email: true
            }
          })
          if (s.telegram_bot_token) {
            setBotTokenInput(s.telegram_bot_token)
          }
        } else {
          setStoreData(null)
        }
      }
    } catch (err) {
      showToast('error', err.message || 'Error al cargar datos de tu tienda')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStore()
  }, [])

  const loadOrders = async (query = '') => {
    const slug = form.slug || storeData?.slug
    if (!slug) return
    setOrdersLoading(true)
    try {
      const res = await api.getWebStoreOrders(slug, query)
      if (res?.ok && res.orders) {
        setOrdersList(res.orders)
      } else {
        setOrdersList([])
      }
    } catch (e) {
      console.warn('Error loading store orders:', e)
      setOrdersList([])
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders(ordersSearch)
    }
  }, [activeTab])

  const loadCustomers = async () => {
    setCustomersLoading(true)
    try {
      const res = await api.getMyWebStoreCustomers()
      if (res?.ok && res.customers) {
        setCustomersList(res.customers)
        if (res.stats) setCustomersStats(res.stats)
      } else {
        setCustomersList([])
      }
    } catch (e) {
      console.warn('Error loading customers:', e)
      setCustomersList([])
    } finally {
      setCustomersLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'customers') {
      loadCustomers()
    }
  }, [activeTab])

  const handleCopyLink = (url, type = true) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(false), 2500)
    showToast('success', '¡Enlace copiado al portapapeles!')
  }

  const handleTestSmtp = async () => {
    const userEmail = form.email_config?.smtp_user || form.contact_email
    const pass = form.email_config?.smtp_app_password
    if (!userEmail || !userEmail.includes('@')) {
      return showToast('error', 'Por favor ingresa tu correo Gmail antes de probar.')
    }
    if (!pass || pass.replace(/\s+/g, '').length < 14) {
      return showToast('error', 'Por favor ingresa tu contraseña de aplicación de 16 caracteres de Google.')
    }
    setTestingSmtp(true)
    try {
      const res = await api.testWebStoreSmtp({
        smtp_user: userEmail.trim(),
        smtp_app_password: pass.trim(),
        sender_name: form.email_config?.sender_name?.trim() || form.store_name?.trim() || 'Mi Tienda',
        test_recipient: testRecipient.trim() || userEmail.trim()
      })
      if (res && res.ok) {
        showToast('success', res.message || '¡Prueba exitosa! Correo enviado.')
      } else {
        showToast('error', res?.message || 'Fallo en la prueba de correo.')
      }
    } catch (err) {
      showToast('error', err?.message || 'Error al conectar con los servidores de Google.')
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!form.slug || form.slug.length < 3) {
      return showToast('error', 'El subdominio debe tener al menos 3 letras o números.')
    }
    if (!form.store_name.trim()) {
      return showToast('error', 'El nombre de la tienda es obligatorio.')
    }

    try {
      setSaving(true)
      const res = await api.saveMyWebStore(form)
      if (res?.ok) {
        setStoreData(res.store)
        showToast('success', '¡Configuración de tu tienda guardada con éxito!')
      } else {
        showToast('error', res?.message || 'Error al guardar cambios')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al guardar cambios')
    } finally {
      setSaving(false)
    }
  }

  const handleConnectTelegram = async (e) => {
    e?.preventDefault()
    const token = botTokenInput.trim()
    if (!token) {
      return showToast('error', 'Ingresa el Token de tu Bot de Telegram entregado por @BotFather.')
    }
    setTelegramConnecting(true)
    try {
      const res = await api.setupWebStoreTelegramBot({
        bot_token: token,
        store_mode: form.store_mode || 'both',
        notification_prefs: form.notification_prefs
      })
      if (res?.ok) {
        showToast('success', res.message || '¡Bot de Telegram vinculado y configurado con éxito!')
        setForm(prev => ({
          ...prev,
          telegram_bot_token: token,
          telegram_bot_username: res.bot_username || prev.telegram_bot_username,
          telegram_bot_active: true
        }))
        await loadStore(true)
      } else {
        showToast('error', res?.detail || res?.message || 'Error al vincular el bot con Telegram')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al conectar con Telegram')
    } finally {
      setTelegramConnecting(false)
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!confirm('¿Seguro que deseas desconectar tu Bot de Telegram de tu tienda? El botón de menú y webhook se desactivarán.')) return
    setTelegramDisconnecting(true)
    try {
      const res = await api.disconnectWebStoreTelegramBot()
      if (res?.ok) {
        showToast('info', 'Bot de Telegram desconectado correctamente')
        setBotTokenInput('')
        setForm(prev => ({
          ...prev,
          telegram_bot_token: '',
          telegram_bot_username: '',
          telegram_bot_active: false
        }))
        await loadStore(true)
      } else {
        showToast('error', res?.detail || 'No se pudo desconectar el bot')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al desconectar bot')
    } finally {
      setTelegramDisconnecting(false)
    }
  }

  const handleSubscribe = async (planKey, extra = {}) => {
    const selectedPlan = plans[planKey]
    if (!selectedPlan) return

    const price = getCyclePrice(selectedPlan, billingCycle)
    if (userBalance < price) {
      showToast('error', `Saldo insuficiente ($${userBalance.toFixed(2)} USDT). Necesitas $${price.toFixed(2)} USDT para el ${selectedPlan.name}.`)
      if (onOpenDeposit) onOpenDeposit()
      return
    }

    setSubscribing(true)
    try {
      const res = await api.subscribeMyWebStore(planKey, billingCycle, extra)
      if (res?.ok) {
        showToast('success', res.message || '¡Suscripción activada exitosamente!')
        await loadStore(true)
        setActiveTab('hub')
      } else {
        showToast('error', res?.detail || 'No se pudo procesar la suscripción')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al procesar suscripción')
    } finally {
      setSubscribing(false)
    }
  }

  // Creación de tienda en 1 paso para usuarios nuevos
  const handleWizardCreate = async (e) => {
    e?.preventDefault()
    const cleanName = wizardStoreName.trim()
    const cleanSlug = wizardSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').trim()

    if (!cleanName || cleanName.length < 2) {
      return showToast('error', 'Ingresa el nombre de tu tienda (mínimo 2 caracteres).')
    }
    if (!cleanSlug || cleanSlug.length < 3) {
      return showToast('error', 'El subdominio debe tener al menos 3 letras o números.')
    }

    const selectedPlan = plans[wizardPlan] || plans['plata']
    const price = getCyclePrice(selectedPlan, billingCycle)

    if (userBalance < price) {
      showToast('error', `Saldo insuficiente ($${userBalance.toFixed(2)} USDT). Necesitas $${price.toFixed(2)} USDT para activar el ${selectedPlan.name}.`)
      if (onOpenDeposit) onOpenDeposit()
      return
    }

    setCreatingStore(true)
    try {
      const res = await api.subscribeMyWebStore(wizardPlan, billingCycle, {
        store_name: cleanName,
        slug: cleanSlug
      })
      if (res?.ok) {
        showToast('success', '¡Tu tienda ha sido creada y activada con éxito!')
        await loadStore(true)
        setActiveTab('hub')
      } else {
        showToast('error', res?.detail || res?.message || 'Error al crear la tienda')
      }
    } catch (err) {
      showToast('error', err.message || 'Error al crear la tienda')
    } finally {
      setCreatingStore(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="w-8 h-8 text-accent animate-spin" />
        <p className="text-sm font-bold text-white/50">Cargando el centro de control de tu tienda web...</p>
      </div>
    )
  }

  // Filtrar planes principales (evitar duplicados de compatibilidad)
  const availablePlans = ['bronce', 'plata', 'oro']
    .map(key => ({ key, data: plans[key] }))
    .filter(item => Boolean(item.data))

  const isStoreActive = Boolean(storeData && storeData.is_active && !storeData.is_expired)
  const isOro = Boolean(storeData?.plan === 'oro' || storeData?.plan === 'pro')

  // ════════════════════════════════════════════════════════════════════════════
  //  CASO 1: USUARIO SIN TIENDA CREADA -> WIZARD DE CREACIÓN EN 1 PASO
  // ════════════════════════════════════════════════════════════════════════════
  if (!storeData || !storeData.slug) {
    const selectedPlanData = plans[wizardPlan] || plans['plata'] || {
      name: 'Plan Plata',
      price_monthly: 3.49,
      price_yearly: 34.99,
      tier_markup: 10.0
    }
    const currentPrice = getCyclePrice(selectedPlanData, billingCycle)
    const hasEnoughBalance = userBalance >= currentPrice

    return (
      <div className="max-w-4xl mx-auto space-y-8 py-4 px-2 sm:px-4 animate-in fade-in">
        {/* Toast Alert */}
        {toast && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-xl ${
            toast.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
            <span className="text-xs sm:text-sm font-bold">{toast.message}</span>
          </div>
        )}

        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Crea Tu Propio Negocio Digital</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Abre tu Tienda Web & Mini App en Telegram
          </h1>
          <p className="text-xs sm:text-sm text-white/60 max-w-2xl mx-auto leading-relaxed">
            Vende recargas de Free Fire, Mobile Legends, números virtuales SMS y streaming con entregas automáticas 24/7 y cobro en USDT bajo tu propia marca.
          </p>
        </div>

        {/* Formulario Wizard */}
        <form onSubmit={handleWizardCreate} className="space-y-6 bg-card/60 border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Paso 1: Identidad Básica */}
          <div className="space-y-4">
            <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-accent text-bg text-xs font-black flex items-center justify-center shrink-0">1</span>
              <span>Identidad de tu Tienda</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80">Nombre de tu Tienda o Marca:</label>
                <input
                  type="text"
                  required
                  value={wizardStoreName}
                  onChange={(e) => {
                    setWizardStoreName(e.target.value)
                    if (!wizardSlug) {
                      setWizardSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20))
                    }
                  }}
                  placeholder="Ej: Gamers Zone Cuba"
                  className="w-full px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-white text-sm font-bold placeholder:text-white/30 focus:border-accent outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80">Subdominio web gratuito:</label>
                <div className="flex items-center rounded-2xl bg-black/50 border border-white/10 overflow-hidden focus-within:border-accent transition">
                  <input
                    type="text"
                    required
                    value={wizardSlug}
                    onChange={(e) => setWizardSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="tunegocio"
                    className="flex-1 px-4 py-2.5 bg-transparent text-emerald-300 font-mono text-sm font-bold placeholder:text-white/30 outline-none"
                  />
                  <span className="px-3 py-2.5 text-xs font-mono text-white/40 border-l border-white/10 bg-white/5 shrink-0">
                    {wizardPlan === 'oro' ? '.topupsh.com' : '.franchoshop.com'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Paso 2: Selector de Ciclo y Planes */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent text-bg text-xs font-black flex items-center justify-center shrink-0">2</span>
                <span>Selecciona el Periodo y Plan</span>
              </h2>

              {/* Selector de 4 Ciclos con Descuentos */}
              <div className="inline-flex p-1 rounded-2xl bg-black/60 border border-white/10 flex-wrap gap-1">
                {BILLING_CYCLES.map(c => {
                  const isSel = billingCycle === c.key
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setBillingCycle(c.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                        isSel ? 'bg-accent text-bg shadow-sm' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <span>{c.label}</span>
                      {c.discountText && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                          isSel ? 'bg-black/30 text-white' : 'bg-accent/20 text-accent'
                        }`}>
                          {c.discountText}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Grid de los 3 Planes con precios y markups oficiales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans.map(({ key, data }) => {
                const isSelected = wizardPlan === key
                const isPopular = key === 'plata'
                const isVip = key === 'oro'
                const price = getCyclePrice(data, billingCycle)

                return (
                  <div
                    key={key}
                    onClick={() => setWizardPlan(key)}
                    className={`relative rounded-3xl p-5 flex flex-col justify-between border-2 transition-all cursor-pointer ${
                      isSelected
                        ? isVip
                          ? 'bg-gradient-to-b from-amber-950/40 via-card to-card border-amber-400 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/30'
                          : isPopular
                          ? 'bg-gradient-to-b from-[#162032] via-[#0f1725] to-[#0a0f19] border-accent shadow-xl shadow-accent/15 ring-2 ring-accent/30'
                          : 'bg-gradient-to-b from-emerald-950/30 via-card to-card border-emerald-400 shadow-xl'
                        : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent text-bg text-[10px] font-black uppercase tracking-wider shadow-md">
                        {data.badge || 'Más Popular'}
                      </div>
                    )}
                    {isVip && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-bg text-[10px] font-black uppercase tracking-wider shadow-md">
                        {data.badge || 'Máxima Ganancia'}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-white">{data.name}</h3>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-accent bg-accent text-bg' : 'border-white/20'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      {/* Costo Mayorista francho */}
                      <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Margen Mayorista:</span>
                        <div className="text-xs font-black text-emerald-400 flex items-center gap-1">
                          <span>Costo Proveedor +{data.tier_markup}%</span>
                          {key === 'oro' && <span className="text-[10px] text-amber-300 font-bold">(VIP Mínimo)</span>}
                          {key === 'plata' && <span className="text-[10px] text-cyan-300 font-bold">(Ahorras 4%)</span>}
                        </div>
                      </div>

                      <div className="flex items-baseline gap-1 pt-1">
                        <span className="text-2xl sm:text-3xl font-black text-white font-mono">${price.toFixed(2)}</span>
                        <span className="text-xs text-white/50 font-bold">
                          USDT / {billingCycle === '1_month' ? 'mes' : billingCycle === '3_months' ? '3 meses' : billingCycle === '6_months' ? '6 meses' : 'año'}
                        </span>
                      </div>

                      <ul className="space-y-2 pt-2 border-t border-white/10 text-xs">
                        {(data.features || []).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-white/80">
                            <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                            <span className="leading-tight">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Paso 3: Resumen y Activación */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs text-white/50 block">Tu saldo actual en Francho Shop:</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-accent font-mono">${userBalance.toFixed(2)} USDT</span>
                {!hasEnoughBalance && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Saldo Insuficiente
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!hasEnoughBalance && (
                <button
                  type="button"
                  onClick={onOpenDeposit}
                  className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs transition active:scale-95 cursor-pointer"
                >
                  Recargar Saldo USDT
                </button>
              )}

              <button
                type="submit"
                disabled={creatingStore || !hasEnoughBalance}
                className="px-6 py-3 rounded-2xl bg-accent hover:bg-accent-hover text-bg font-black text-sm flex items-center gap-2 shadow-xl shadow-accent/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {creatingStore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Activando tu tienda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Crear y Activar Mi Tienda (${currentPrice.toFixed(2)} USDT)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  CASO 2: USUARIO CON TIENDA ACTIVA -> CENTRO DE GESTIÓN Y HUB
  // ════════════════════════════════════════════════════════════════════════════
  const universalUrl = `https://franchoshop.com/?web_store=${form.slug}`
  const standardSubdomainUrl = `https://${form.slug}.franchoshop.com`
  const vipSubdomainUrl = `https://${form.slug}.topupsh.com`

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Toast Alert */}
      {toast && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
          toast.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span className="text-xs sm:text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Banner Principal de la Tienda */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-card to-card/60 p-5 sm:p-6 shadow-2xl space-y-4">
        <div
          className="absolute -right-16 -top-16 w-52 h-52 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: form.primary_color }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl border border-white/20 bg-black/60 flex items-center justify-center font-black text-xl shadow-lg shrink-0 overflow-hidden"
              style={{ color: form.primary_color }}
            >
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (form.store_name || "FS").slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">
                  {form.store_name || "Mi Tienda Web"}
                </h1>
                {storeData?.plan && (
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    isOro ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-accent/20 text-accent border-accent/40'
                  }`}>
                    Plan {storeData.plan}
                  </span>
                )}
                {storeData?.days_left !== undefined && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    storeData.days_left <= 3 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-white/10 text-white/70'
                  }`}>
                    {storeData.days_left} días restantes
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50 font-mono">
                {isOro ? vipSubdomainUrl : standardSubdomainUrl}
              </p>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="text-xs text-white/60 bg-black/40 px-3 py-2 rounded-xl border border-white/10">
              Saldo: <strong className="text-accent font-mono font-black">${userBalance.toFixed(2)} USDT</strong>
            </div>

            {form.slug && (
              <a
                href={universalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-4 rounded-xl text-xs font-black text-bg bg-accent hover:bg-accent-hover flex items-center gap-2 transition active:scale-95 shadow-lg shadow-accent/20 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Abrir Tienda (Modo Dueño) ↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Enlaces de Acceso a la Tienda */}
        {form.slug && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10 relative z-10">
            {/* 1. Enlace VIP topupsh.com (Si tiene Plan Oro VIP) */}
            {isOro && (
              <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/40 flex flex-col justify-between gap-2.5 col-span-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black text-amber-300">Enlace Marca Blanca VIP Neutral (topupsh.com)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Cero Francho Shop 🔥
                  </span>
                </div>
                <p className="text-[11px] text-white/50">
                  Subdominio neutral exclusivo de tu Plan Oro VIP. Tus clientes compran bajo tu propia marca y no ven a Francho Shop.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={vipSubdomainUrl}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-amber-300 truncate select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(vipSubdomainUrl, 'vip_subdomain')}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-bg font-bold text-xs flex items-center gap-1 transition active:scale-95 shrink-0 cursor-pointer"
                  >
                    {copiedLink === 'vip_subdomain' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink === 'vip_subdomain' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                  <a
                    href={vipSubdomainUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0"
                    title="Abrir enlace VIP"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* 2. Enlace Universal Anti-bloqueo */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-black text-emerald-300">Enlace Universal (Recomendado Cuba)</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Sin Bloqueos ⚡
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={universalUrl}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-emerald-300 truncate select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(universalUrl, 'universal')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shrink-0 cursor-pointer"
                >
                  {copiedLink === 'universal' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink === 'universal' ? 'Copiado' : 'Copiar'}</span>
                </button>
                <a
                  href={universalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0"
                  title="Abrir tienda"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* 3. Subdominio Directo */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white/80">Subdominio Estándar</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  SSL Automático 🔒
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={standardSubdomainUrl}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white/70 truncate select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(standardSubdomainUrl, 'subdomain')}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shrink-0 cursor-pointer"
                >
                  {copiedLink === 'subdomain' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink === 'subdomain' ? 'Copiado' : 'Copiar'}</span>
                </button>
                <a
                  href={standardSubdomainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0"
                  title="Abrir subdominio"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navegación por Tabs del Panel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('hub')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'hub' ? 'bg-white/15 text-white shadow-md' : 'text-white/50 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4 text-accent" />
          <span>Panel General (Hub)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'plans' ? 'bg-white/15 text-white shadow-md' : 'text-white/50 hover:text-white'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-400" />
          <span>Planes & Suscripción</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('domain')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'domain' ? 'bg-white/15 text-white shadow-md' : 'text-white/50 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>Dominio Propio & VIP</span>
          {isOro && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('telegram')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'telegram'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-lg'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <Bot className="w-4 h-4 text-sky-400" />
          <span>Bot Telegram & Mini App</span>
          {form.telegram_bot_active && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'email' ? 'bg-white/15 text-white shadow-md' : 'text-white/50 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4 text-sky-400" />
          <span>Gmail SMTP</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'orders' ? 'bg-white/15 text-white shadow-md' : 'text-white/50 hover:text-white'
          }`}
        >
          <ReceiptText className="w-4 h-4 text-purple-400" />
          <span>Mis Pedidos Web</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'customers' ? 'bg-white/15 text-white shadow-md' : 'text-white/50 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Mis Clientes</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TAB 1: PANEL GENERAL (HUB)                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'hub' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Card Destacada: Modo Dueño */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-card to-card border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Sparkles className="w-7 h-7 text-emerald-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">Edición Visual en Vivo (Modo Dueño)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                    100% Interactivo
                  </span>
                </div>
                <p className="text-xs text-white/60 max-w-xl leading-relaxed">
                  Colores, fondos, banners y márgenes de ganancia individual para más de 600 juegos se editan directamente sobre tu tienda web en tiempo real sin formularios ciegos.
                </p>
              </div>
            </div>

            <a
              href={universalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-2xl bg-accent hover:bg-accent-hover text-bg font-black text-xs flex items-center gap-2 shadow-xl shadow-accent/20 transition active:scale-95 shrink-0 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Personalizar en Vivo en Mi Tienda ↗</span>
            </a>
          </div>

          {/* Grid de Configuración Modular */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Módulo 1: Identidad y Margen Global */}
            <div className="p-5 rounded-3xl bg-card border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Identidad y Margen de Ganancia</h3>
                    <p className="text-[11px] text-white/50">Nombre de la tienda y ganancia por defecto.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Nombre de tu Tienda:</label>
                  <input
                    type="text"
                    value={form.store_name}
                    onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold focus:border-accent outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white/70">Margen Global de Ganancia (%):</label>
                    <span className="text-xs font-mono font-black text-emerald-400">+{form.markup_percent}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={form.markup_percent}
                    onChange={(e) => setForm({ ...form, markup_percent: parseFloat(e.target.value) || 10 })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[10px] text-white/40">
                    Se aplica automáticamente a todos los juegos que no tengan un margen personalizado en Modo Dueño.
                  </p>
                </div>

                <ImageUploadField
                  label="Logo Oficial de la Tienda:"
                  value={form.logo_url}
                  onChange={(url) => setForm({ ...form, logo_url: url })}
                  placeholder="URL o sube una imagen..."
                />

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{saving ? 'Guardando...' : 'Guardar Identidad'}</span>
                </button>
              </div>
            </div>

            {/* Módulo 2: Tu Plan y Descuento Mayorista Francho Shop */}
            <div className="p-5 rounded-3xl bg-card border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">Tu Plan & Costo Mayorista</h3>
                      <p className="text-[11px] text-white/50">Tu tarifa de costo base en Francho Shop.</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase ${
                    isOro ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-accent/20 text-accent border border-accent/30'
                  }`}>
                    {storeData?.plan || 'Bronce'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Nivel de Costo Mayorista:</span>
                    <strong className="text-emerald-400 font-mono font-black">
                      {isOro ? 'Costo Base +7% (VIP Mínimo)' : storeData?.plan === 'plata' ? 'Costo Base +10%' : 'Costo Base +14%'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Vigencia de Tienda:</span>
                    <span className="text-white font-bold">{storeData?.days_left || 0} días restantes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Vence el:</span>
                    <span className="text-white/70 font-mono">{storeData?.expires_at_formatted || 'N/A'}</span>
                  </div>
                </div>

                <p className="text-[11px] text-white/50 leading-snug">
                  Los planes Oro y Plata acceden a menores costos mayoristas en todo el catálogo, permitiéndote mayor margen neto de ganancia o precios más competitivos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Cambiar de Plan o Renovar</span>
              </button>
            </div>

            {/* Módulo 3: Canales de Atención y Ventas */}
            <div className="p-5 rounded-3xl bg-card border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Canales de Contacto Directo</h3>
                  <p className="text-[11px] text-white/50">WhatsApp de checkout y Telegram para tus clientes.</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">WhatsApp de Ventas (Con código de país):</label>
                  <input
                    type="text"
                    value={form.whatsapp_number}
                    onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                    placeholder="Ej: +5351234567"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold focus:border-accent outline-none"
                  />
                  <p className="text-[10px] text-white/40">Los clientes podrán enviar pedidos y comprobantes directamente a este número.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Usuario de Telegram (Sin @):</label>
                  <input
                    type="text"
                    value={form.telegram_username}
                    onChange={(e) => setForm({ ...form, telegram_username: e.target.value.replace('@', '') })}
                    placeholder="Ej: FrankDelRio"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold focus:border-accent outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{saving ? 'Guardando...' : 'Guardar Contacto'}</span>
                </button>
              </div>
            </div>

            {/* Módulo 4: Accesos Directos a Bot y Dominio Propio */}
            <div className="p-5 rounded-3xl bg-card border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Dominio Propio & Bot de Telegram</h3>
                    <p className="text-[11px] text-white/50">Expande tu marca con dominio neutral VIP y bot interactivo.</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">Subdominio Neutral VIP:</span>
                      <span className="text-[11px] text-amber-300 font-mono">
                        {isOro ? `${form.slug}.topupsh.com` : 'Incluido en Plan Oro VIP'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('domain')}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 font-bold text-[11px] hover:bg-cyan-500/30 transition cursor-pointer"
                    >
                      Configurar
                    </button>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">Bot de Telegram:</span>
                      <span className="text-[11px] text-white/50 font-mono">
                        {form.telegram_bot_username ? `@${form.telegram_bot_username}` : 'Sin conectar (Plata u Oro)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('telegram')}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 font-bold text-[11px] hover:bg-sky-500/30 transition cursor-pointer"
                    >
                      {form.telegram_bot_active ? 'Gestionar' : 'Conectar'}
                    </button>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">Notificaciones Gmail:</span>
                      <span className="text-[11px] text-white/50 font-mono">
                        {form.email_config?.smtp_user || 'Sin configurar'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('email')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-[11px] hover:bg-emerald-500/30 transition cursor-pointer"
                    >
                      Configurar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TAB 2: PLANES Y FACTURACIÓN (CON 4 PERIODOS DE DESCUENTO)             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>Tu Plan y Facturación con Descuentos</span>
              </h3>
              <p className="text-xs text-white/50">Paga por más meses para recibir hasta un 15% de descuento (¡2 meses gratis!).</p>
            </div>

            {/* Selector de 4 Ciclos */}
            <div className="inline-flex p-1 rounded-2xl bg-black/60 border border-white/10 flex-wrap gap-1">
              {BILLING_CYCLES.map(c => {
                const isSel = billingCycle === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setBillingCycle(c.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                      isSel ? 'bg-accent text-bg shadow-sm' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <span>{c.label}</span>
                    {c.discountText && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                        isSel ? 'bg-black/30 text-white' : 'bg-accent/20 text-accent'
                      }`}>
                        {c.discountText}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grid de Planes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availablePlans.map(({ key, data }) => {
              const isCurrentPlan = storeData?.plan === key && isStoreActive
              const price = getCyclePrice(data, billingCycle)
              const isFeatured = key === 'plata'
              const isVip = key === 'oro'

              return (
                <div
                  key={key}
                  className={`relative rounded-3xl p-5 flex flex-col justify-between border transition-all ${
                    isCurrentPlan
                      ? 'border-emerald-500 bg-emerald-950/20 shadow-xl'
                      : isFeatured
                      ? 'bg-gradient-to-b from-[#162032] via-[#0f1725] to-[#0a0f19] border-accent/40 shadow-xl ring-1 ring-accent/30'
                      : isVip
                      ? 'bg-gradient-to-b from-amber-950/20 via-[#0f1725] to-[#0a0f19] border-amber-500/40 shadow-xl'
                      : 'bg-[#0b0f17] border-white/10 hover:border-white/20'
                  }`}
                >
                  {isFeatured && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent text-bg text-[10px] font-black uppercase tracking-wider shadow-md">
                      {data.badge || 'Más Popular'}
                    </div>
                  )}
                  {isVip && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-bg text-[10px] font-black uppercase tracking-wider shadow-md">
                      {data.badge || 'Máxima Ganancia'}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-black text-white">{data.name}</h4>
                        <p className="text-[11px] text-white/50">
                          Periodo: {BILLING_CYCLES.find(c => c.key === billingCycle)?.label}
                        </p>
                      </div>
                      {isCurrentPlan && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                          Tu Plan Actual
                        </span>
                      )}
                    </div>

                    {/* Costo Mayorista */}
                    <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Margen Mayorista Francho Shop:</span>
                      <div className="text-xs font-black text-emerald-400">
                        Costo Proveedor +{data.tier_markup}%
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white font-mono">${price.toFixed(2)}</span>
                      <span className="text-xs text-white/50 font-bold">
                        USDT / {billingCycle === '1_month' ? 'mes' : billingCycle === '3_months' ? '3 meses' : billingCycle === '6_months' ? '6 meses' : 'año'}
                      </span>
                    </div>

                    <ul className="space-y-2 pt-2 border-t border-white/10 text-xs">
                      {(data.features || []).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-white/80">
                          <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-5 mt-4 border-t border-white/10">
                    <button
                      type="button"
                      disabled={subscribing}
                      onClick={() => handleSubscribe(key)}
                      className={`w-full py-2.5 rounded-2xl font-black text-xs transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                        isCurrentPlan
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          : isFeatured
                          ? 'bg-accent text-bg hover:bg-accent-hover shadow-lg shadow-accent/20'
                          : isVip
                          ? 'bg-amber-400 hover:bg-amber-300 text-bg shadow-lg shadow-amber-400/20'
                          : 'bg-white/15 hover:bg-white/25 text-white'
                      }`}
                    >
                      {subscribing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isCurrentPlan ? (
                        <>Renovar / Extender (+{billingCycle === '1_month' ? '30 días' : billingCycle === '3_months' ? '90 días' : billingCycle === '6_months' ? '180 días' : '1 año'})</>
                      ) : (
                        <>Cambiar a {data.name}</>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TAB 3: DOMINIO PROPIO & SUBDOMINIO VIP (topupsh.com)                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'domain' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-card border border-white/10 space-y-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Globe className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Dominio Propio & Marca Blanca VIP</h3>
                  <p className="text-xs text-white/50">Tu tienda sin ninguna mención a Francho Shop para una presencia 100% independiente.</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                isOro ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/10 text-white/60'
              }`}>
                {isOro ? 'Plan Oro VIP Activo' : 'Exclusivo Plan Oro VIP'}
              </span>
            </div>

            {!isOro ? (
              <div className="p-6 rounded-2xl bg-black/40 border border-amber-500/30 space-y-4 text-center">
                <Crown className="w-10 h-10 text-amber-400 mx-auto" />
                <h4 className="text-base font-black text-white">Marca Blanca VIP y Dominio Propio</h4>
                <p className="text-xs text-white/60 max-w-md mx-auto">
                  El subdominio neutral VIP <strong>topupsh.com</strong> (sin mención de Francho Shop) y la conexión de tu propio dominio <strong>.com</strong> son beneficios exclusivos del <strong>Plan Oro VIP ($7.99/mes)</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-bg font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-amber-400/20"
                >
                  Actualizar a Plan Oro VIP ↗
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Subdominio VIP Incluido topupsh.com */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-card to-card border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <h4 className="font-black text-white text-sm">1. Tu Enlace Neutral VIP Incluido (topupsh.com)</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Activo & Listo ⚡
                    </span>
                  </div>
                  <p className="text-xs text-white/60">
                    No necesitas pagar ni configurar nada. Ya tienes asignado tu enlace de marca blanca neutral:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={vipSubdomainUrl}
                      className="flex-1 px-4 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-amber-300 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(vipSubdomainUrl, 'vip_dom')}
                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-bg font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                    >
                      {copiedLink === 'vip_dom' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink === 'vip_dom' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                    <a
                      href={vipSubdomainUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0"
                      title="Visitar"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* 2. Opcional: Conectar Dominio Propio */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="space-y-1">
                    <h4 className="font-black text-white text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span>2. Opcional: Conecta tu propio Dominio Personalizado (.com, .shop, etc.)</span>
                    </h4>
                    <p className="text-xs text-white/50">Si compraste tu propio dominio en Namecheap, GoDaddy o Cloudflare, puedes conectarlo aquí.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs">
                    <span className="font-bold text-white block">Instrucciones DNS:</span>
                    <p className="text-white/70">
                      En la zona DNS de tu registrador agrega un <strong>Registro A</strong> apuntando a la IP:{' '}
                      <code className="px-2 py-0.5 rounded bg-black/80 text-cyan-300 font-mono font-bold select-all">62.171.159.0</code>{' '}
                      (o CNAME apuntando a <code className="px-2 py-0.5 rounded bg-black/80 text-cyan-300 font-mono font-bold">franchoshop.com</code>).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/80">Nombre de tu Dominio:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={form.custom_domain}
                        onChange={(e) => setForm({ ...form, custom_domain: e.target.value.toLowerCase().trim() })}
                        placeholder="ej: mitienda.com o recargas.tumarca.com"
                        className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:border-cyan-400 outline-none"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-bg font-black text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20"
                      >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>{saving ? 'Guardando...' : 'Guardar y Activar SSL'}</span>
                      </button>
                    </div>
                  </div>

                  {form.custom_domain && (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <div>
                          <span className="text-xs font-bold text-white">Dominio Asignado: https://{form.custom_domain}</span>
                          <p className="text-[10px] text-white/50">Let's Encrypt SSL HTTPS activo.</p>
                        </div>
                      </div>
                      <a
                        href={`https://${form.custom_domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Visitar</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TAB 4: BOT TELEGRAM & MINI APP                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'telegram' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-card border border-white/10 space-y-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Bot de Telegram & Mini App</h3>
                  <p className="text-xs text-white/50">Tus clientes abren tu tienda directamente dentro de Telegram con 1-Click (URL invisible).</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                form.telegram_bot_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-white/60'
              }`}>
                {form.telegram_bot_active ? 'Conectado' : 'Sin Vincular'}
              </span>
            </div>

            {/* Formulario de Token de BotFather */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  ¿Cómo crear tu Bot en Telegram?
                </span>
                <ol className="list-decimal list-inside space-y-1 text-white/70">
                  <li>Abre Telegram y busca <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-300 underline font-bold">@BotFather</a>.</li>
                  <li>Envía el comando <code className="px-1.5 py-0.5 rounded bg-black/60 text-sky-300 font-mono">/newbot</code> y sigue las instrucciones para ponerle nombre.</li>
                  <li>Copia el <strong>HTTP API Token</strong> que te entrega y pégalo a continuación:</li>
                </ol>
              </div>

              <form onSubmit={handleConnectTelegram} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/80">Token del Bot (HTTP API):</label>
                  <input
                    type="text"
                    required
                    value={botTokenInput}
                    onChange={(e) => setBotTokenInput(e.target.value)}
                    placeholder="Ej: 7123456789:AAHkL..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:border-sky-400 outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={telegramConnecting}
                    className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-bg font-black text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {telegramConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    <span>{telegramConnecting ? 'Conectando con Telegram...' : 'Vincular y Configurar Bot en 1-Click'}</span>
                  </button>

                  {form.telegram_bot_active && (
                    <button
                      type="button"
                      disabled={telegramDisconnecting}
                      onClick={handleDisconnectTelegram}
                      className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 font-bold text-xs transition active:scale-95 cursor-pointer"
                    >
                      Desconectar Bot
                    </button>
                  )}
                </div>
              </form>

              {form.telegram_bot_active && form.telegram_bot_username && (
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">Bot Activo: @{form.telegram_bot_username}</span>
                    <p className="text-[10px] text-white/50">Botón de menú y bienvenida configurados con éxito.</p>
                  </div>
                  <a
                    href={`https://t.me/${form.telegram_bot_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-sky-500 text-bg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en Telegram</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TAB 5: GMAIL SMTP                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'email' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-card border border-white/10 space-y-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Notificaciones por Correo Gmail (SMTP Propio)</h3>
                  <p className="text-xs text-white/50">Envía comprobantes de compra y notificaciones a tus clientes desde tu propia dirección Gmail.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSmtpGuide(!showSmtpGuide)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>{showSmtpGuide ? 'Ocultar Guía' : 'Ver Guía Google'}</span>
              </button>
            </div>

            {/* Guía Paso a Paso de Google App Password */}
            {showSmtpGuide && (
              <div className="p-5 rounded-2xl bg-black/60 border border-sky-500/30 space-y-3 text-xs animate-in fade-in">
                <h4 className="font-black text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-sky-400" />
                  <span>¿Cómo obtener tu Contraseña de Aplicación de 16 caracteres de Google?</span>
                </h4>
                <ol className="space-y-1.5 list-decimal list-inside text-white/70">
                  <li>Inicia sesión en tu cuenta de Google y ve a <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-sky-300 underline font-bold">Seguridad de la cuenta</a>.</li>
                  <li>Asegúrate de tener activa la <strong>Verificación en dos pasos</strong>.</li>
                  <li>En el buscador superior de tu cuenta de Google escribe: <strong>Contraseñas de aplicaciones</strong> (o ve a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-sky-300 underline font-bold">myaccount.google.com/apppasswords</a>).</li>
                  <li>Escribe un nombre (ej: <em>Mi Tienda Francho</em>) y haz clic en <strong>Crear</strong>.</li>
                  <li>Google te mostrará una contraseña amarilla de <strong>16 caracteres</strong>. Cópiala y pégala aquí abajo.</li>
                </ol>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/80">Tu Correo Gmail:</label>
                  <input
                    type="email"
                    value={form.email_config?.smtp_user || ''}
                    onChange={(e) => setForm({
                      ...form,
                      email_config: { ...form.email_config, smtp_user: e.target.value.trim() }
                    })}
                    placeholder="tunegocio@gmail.com"
                    className="w-full px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-bold focus:border-sky-400 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/80">Nombre del Remitente:</label>
                  <input
                    type="text"
                    value={form.email_config?.sender_name || ''}
                    onChange={(e) => setForm({
                      ...form,
                      email_config: { ...form.email_config, sender_name: e.target.value }
                    })}
                    placeholder="Ej: Tienda Gamer Cuba"
                    className="w-full px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-bold focus:border-sky-400 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80">Contraseña de Aplicación de 16 caracteres de Google:</label>
                <div className="relative">
                  <input
                    type={showAppPassword ? 'text' : 'password'}
                    value={form.email_config?.smtp_app_password || ''}
                    onChange={(e) => setForm({
                      ...form,
                      email_config: { ...form.email_config, smtp_app_password: e.target.value.replace(/\s+/g, '') }
                    })}
                    placeholder="abcd efgh ijkl mnop (16 caracteres sin espacios)"
                    className="w-full px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:border-sky-400 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAppPassword(!showAppPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showAppPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Prueba de Envío en Vivo */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex-1 w-full sm:w-auto">
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value.trim())}
                    placeholder="Correo de prueba (opcional, por defecto el tuyo)..."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder:text-white/30 outline-none focus:border-sky-400"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={testingSmtp}
                    onClick={handleTestSmtp}
                    className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {testingSmtp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{testingSmtp ? 'Probando conexión...' : 'Probar Envío'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-bg text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Guardando...' : 'Guardar Credenciales'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TAB 6: MIS PEDIDOS WEB                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-purple-400" />
              <span>Pedidos Recibidos en tu Tienda Web</span>
            </h3>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ordersSearch}
                  onChange={(e) => setOrdersSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadOrders(ordersSearch)}
                  placeholder="Buscar por ID, juego o cliente..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none focus:border-purple-400"
                />
              </div>
              <button
                type="button"
                onClick={() => loadOrders(ordersSearch)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {ordersLoading ? (
            <div className="p-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="text-xs text-white/50">Cargando pedidos de tu tienda...</p>
            </div>
          ) : ordersList.length === 0 ? (
            <div className="p-12 rounded-3xl bg-card border border-white/10 text-center space-y-2">
              <ReceiptText className="w-10 h-10 text-white/20 mx-auto" />
              <h4 className="text-sm font-bold text-white">Aún no hay pedidos registrados</h4>
              <p className="text-xs text-white/50">Cuando tus clientes compren en tu tienda web o mini app, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="rounded-3xl bg-card border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-white/10 text-white/50 uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">ID / Fecha</th>
                      <th className="p-3.5">Producto</th>
                      <th className="p-3.5">Cliente / Datos</th>
                      <th className="p-3.5">Total Venta</th>
                      <th className="p-3.5">Tu Ganancia</th>
                      <th className="p-3.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ordersList.map((ord) => (
                      <tr key={ord.id} className="hover:bg-white/5 transition">
                        <td className="p-3.5 font-mono text-[11px]">
                          <span className="text-white font-bold block">{ord.merchant_order_id || `#${ord.id}`}</span>
                          <span className="text-white/40">{ord.created_at ? new Date(ord.created_at * 1000).toLocaleString() : ''}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="text-white font-bold block">{ord.product_name}</span>
                          <span className="text-white/40 text-[10px] uppercase">{ord.provider_code}</span>
                        </td>
                        <td className="p-3.5 text-[11px]">
                          <span className="text-white/80 block">{ord.client_name || ord.client_contact || 'Cliente'}</span>
                          {ord.player_id && <span className="text-white/40 font-mono">ID: {ord.player_id}</span>}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">
                          ${Number(ord.sell_price || 0).toFixed(2)} USDT
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-400">
                          +${Number(ord.profit || Math.max(0, (ord.sell_price || 0) - (ord.cost_price || 0))).toFixed(2)} USDT
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ord.order_status === 2 || ord.payment_status === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : ord.order_status === 3
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {ord.order_status === 2 || ord.payment_status === 'paid' ? 'Completado' : ord.order_status === 3 ? 'Cancelado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TAB 7: MIS CLIENTES                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Clientes de tu Tienda Web</span>
            </h3>
            <button
              type="button"
              onClick={loadCustomers}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${customersLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-white/10">
              <span className="text-[10px] uppercase font-bold text-white/40 block">Total Clientes:</span>
              <span className="text-xl font-black text-white font-mono">{customersStats.total_customers}</span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-white/10">
              <span className="text-[10px] uppercase font-bold text-white/40 block">Ventas Totales:</span>
              <span className="text-xl font-black text-accent font-mono">${customersStats.total_revenue_usdt?.toFixed(2)}</span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-white/10">
              <span className="text-[10px] uppercase font-bold text-white/40 block">Tu Ganancia Neta:</span>
              <span className="text-xl font-black text-emerald-400 font-mono">+${customersStats.total_profit_usdt?.toFixed(2)}</span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-white/10">
              <span className="text-[10px] uppercase font-bold text-white/40 block">Registrados:</span>
              <span className="text-xl font-black text-sky-400 font-mono">{customersStats.registered_count}</span>
            </div>
          </div>

          {customersLoading ? (
            <div className="p-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="text-xs text-white/50">Cargando lista de clientes...</p>
            </div>
          ) : customersList.length === 0 ? (
            <div className="p-12 rounded-3xl bg-card border border-white/10 text-center space-y-2">
              <Users className="w-10 h-10 text-white/20 mx-auto" />
              <h4 className="text-sm font-bold text-white">Sin clientes registrados aún</h4>
              <p className="text-xs text-white/50">Comparte el enlace de tu tienda para comenzar a recibir compradores.</p>
            </div>
          ) : (
            <div className="rounded-3xl bg-card border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-white/10 text-white/50 uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Cliente / Contacto</th>
                      <th className="p-3.5">Pedidos Realizados</th>
                      <th className="p-3.5">Total Comprado</th>
                      <th className="p-3.5">Tu Ganancia Generada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {customersList.map((c, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition">
                        <td className="p-3.5">
                          <span className="text-white font-bold block">{c.name || c.email || 'Cliente Anónimo'}</span>
                          <span className="text-white/40 text-[10px] font-mono">{c.email || c.contact || ''}</span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">{c.orders_count || 1} pedidos</td>
                        <td className="p-3.5 font-mono font-bold text-accent">${Number(c.total_spent || 0).toFixed(2)} USDT</td>
                        <td className="p-3.5 font-mono font-bold text-emerald-400">+${Number(c.total_profit || 0).toFixed(2)} USDT</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
