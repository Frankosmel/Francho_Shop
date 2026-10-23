import { useState } from 'react'
import {
  Store, ArrowLeftRight, Zap, ShieldCheck, WalletCards, Package,
  Terminal, Headphones, User, X, Crown, ChevronRight, Plus,
  CreditCard, ExternalLink, Sparkles, Gamepad2, Smartphone, Globe2,
  KeyRound, Gift, Phone, LogOut, CheckCircle2, MessageCircle, Send, Tv
} from 'lucide-react'

export function AppSidebar({
  isOpen = false,
  onClose,
  screen,
  onNav,
  me,
  onTopUp,
  onLoginRequired,
  catalogFilters = [],
  activeFilter = 'all',
  onFilterChange,
  isDesktop = false,
  unreadNotifsCount = 0,
  showCryptoFeatures = true,
  onToggleCryptoView = null,
  isActualAdmin = false,
}) {
  const [storeExpanded, setStoreExpanded] = useState(true)

  const isGuest = !me || me.is_guest

  const handleNav = (target, filterId = null) => {
    if (target === 'streaming') {
      if (onNav) onNav('home')
      if (onFilterChange) onFilterChange('streaming')
      if (onClose) onClose()
      return
    }
    if (onNav) onNav(target)
    if (filterId && onFilterChange) onFilterChange(filterId)
    if (onClose) onClose()
  }

  // Menú de Servicios del Ecosistema
  const ecosystemItems = [
    {
      id: 'home',
      label: 'Tienda Digital',
      icon: Store,
      badge: 'Catálogo',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      sublabel: 'Juegos, Gift Cards, Telegram, SMS'
    },
    {
      id: 'streaming',
      label: 'Streaming & Cuentas',
      icon: Tv,
      badge: 'AUTO',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      sublabel: 'Netflix, Disney+, Spotify, HBO'
    },
    {
      id: 'swap',
      label: 'Cripto Swap',
      icon: ArrowLeftRight,
      badge: 'UnSwap DEX',
      badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      sublabel: 'Uniswap Multi-Chain & Bridge'
    },
    {
      id: 'energy',
      label: 'Energía TRON',
      icon: Zap,
      badge: '0 Gas',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      sublabel: 'Ahorra en USDT TRC20'
    },
    {
      id: 'p2p',
      label: 'Mercado P2P',
      icon: ShieldCheck,
      badge: 'Escrow',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      sublabel: 'FRC ⇄ CUP / MLC Cuba'
    },
    {
      id: 'wallet',
      label: 'Billetera FRC',
      icon: WalletCards,
      badge: '1:1 USDT',
      badgeColor: 'bg-accent/20 text-accent border-accent/30',
      sublabel: 'Depósitos, transferencias y balance'
    }
  ]

  // Menú de Cuenta & Herramientas
  const accountItems = [
    {
      id: 'orders',
      label: 'Mis Pedidos',
      icon: Package,
      badge: 'Compras',
      badgeColor: 'bg-white/10 text-white/80 border-white/15',
      sublabel: 'Historial y estado de compras'
    },
    {
      id: 'api-docs',
      label: 'API Revendedores',
      icon: Terminal,
      badge: 'B2B',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      sublabel: 'Integración automática'
    },
    {
      id: 'support',
      label: 'Soporte 24/7',
      icon: Headphones,
      badge: 'Online',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      sublabel: 'Chat de ayuda y reclamos'
    },
    {
      id: 'vip',
      label: 'Club VIP Francho',
      icon: Crown,
      badge: me?.is_vip ? 'ACTIVO' : '0% FEE',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      sublabel: 'Retiros sin comisión y beneficios'
    },
    {
      id: 'kyc',
      label: 'Verificación KYC',
      icon: ShieldCheck,
      badge: me?.kyc_status === 'approved' ? 'VERIFICADO' : (me?.kyc_status === 'pending' ? 'EN REVISIÓN' : 'SEGURIDAD'),
      badgeColor: me?.kyc_status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : (me?.kyc_status === 'pending' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'),
      sublabel: 'Validación de identidad y límites'
    },
    {
      id: 'profile',
      label: 'Mi Perfil',
      icon: User,
      badge: 'Ajustes',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      sublabel: 'Ajustes y referidos'
    }
  ]

  // Menú exclusivo y tradicional para Clientes normales (solo tienda, pedidos, soporte y perfil)
  const clientItems = [
    {
      id: 'home',
      label: 'Tienda Digital',
      icon: Store,
      badge: 'Catálogo',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      sublabel: 'Juegos, Gift Cards, Telegram, SMS'
    },
    {
      id: 'streaming',
      label: 'Streaming & Cuentas',
      icon: Tv,
      badge: 'AUTO',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      sublabel: 'Netflix, Disney+, Spotify, HBO'
    },
    {
      id: 'orders',
      label: 'Mis Pedidos',
      icon: Package,
      badge: 'Compras',
      badgeColor: 'bg-white/10 text-white/80 border-white/15',
      sublabel: 'Historial y estado de compras'
    },
    {
      id: 'support',
      label: 'Soporte 24/7',
      icon: Headphones,
      badge: 'Online',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      sublabel: 'Chat de ayuda y reclamos'
    },
    {
      id: 'profile',
      label: 'Mi Perfil',
      icon: User,
      badge: 'Ajustes',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      sublabel: 'Ajustes y referidos'
    }
  ]
  if (me?.role === 'reseller' || me?.role === 'admin') {
    clientItems.push({
      id: 'api-docs',
      label: 'API Revendedores',
      icon: Terminal,
      badge: 'B2B',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      sublabel: 'Integración automática'
    })
  }

  const content = (
    <div className="flex h-full flex-col justify-between overflow-hidden bg-[#0c101c] text-white">
      {/* 1. Header con Logo de Francho Shop */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 bg-[#0e1322]">
        <button
          type="button"
          onClick={() => handleNav('home', 'all')}
          className="flex items-center gap-2.5 text-left group active:scale-95 transition"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-accent/40 bg-card shadow-lg shadow-accent/15 group-hover:border-accent transition">
            <img
              src="/api/icons/franchoshop.jpg"
              alt="Francho Shop"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <span className="font-black text-sm text-accent">FS</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-wide text-white group-hover:text-accent transition">
                FRANCHO SHOP
              </span>
              <span className="rounded-md bg-accent/20 px-1.5 py-0.2 text-[9px] font-black text-accent border border-accent/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-white/50 font-medium">Super-App & Ecosistema</p>
          </div>
        </button>

        {!isDesktop && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition active:scale-95"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selector de modo para Administrador (Alternar entre Vista Cliente y Vista Admin/Cripto) */}
      {isActualAdmin && onToggleCryptoView && (
        <div className="px-3 py-2 border-b border-white/10 bg-[#0e1424] flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`h-2 w-2 rounded-full ${showCryptoFeatures ? 'bg-accent animate-pulse' : 'bg-white/40'}`} />
            <span className="text-[10px] font-bold text-white/70 truncate">
              {showCryptoFeatures ? 'Modo Cripto (Admin)' : 'Vista Cliente'}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleCryptoView}
            className={`px-2 py-1 rounded-lg text-[9px] font-black transition active:scale-95 uppercase tracking-wide border ${
              showCryptoFeatures
                ? 'bg-accent/20 text-accent border-accent/40 hover:bg-accent/30'
                : 'bg-white/10 text-white/80 border-white/20 hover:text-white'
            }`}
          >
            {showCryptoFeatures ? 'Ver Cliente' : 'Ver Cripto'}
          </button>
        </div>
      )}

      {/* 2. Tarjeta de Saldo / Wallet Rápido */}
      <div className="p-3 border-b border-white/10 bg-gradient-to-b from-[#131a2e] to-[#0c101c]">
        {isGuest ? (
          <div className="rounded-2xl border border-accent/30 bg-accent/10 p-3 text-left">
            <p className="text-xs font-bold text-accent">Bienvenido a Francho Shop</p>
            <p className="text-[11px] text-white/60 mt-0.5 leading-snug">
              {showCryptoFeatures
                ? 'Inicia sesión para tener tu Billetera FranchoCoin y operar en el ecosistema.'
                : 'Inicia sesión para realizar tus compras y acceder a tu saldo.'}
            </p>
            <button
              type="button"
              onClick={() => {
                if (onLoginRequired) onLoginRequired()
                if (onClose) onClose()
              }}
              className="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-accent text-bg font-extrabold text-xs hover:bg-accent/90 active:scale-95 transition text-center shadow-md shadow-accent/20"
            >
              Iniciar Sesión / Entrar
            </button>
          </div>
        ) : showCryptoFeatures ? (
          <div className="rounded-2xl border border-white/10 bg-[#121829] p-3 text-left shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Billetera FRC
              </span>
              <div className="flex items-center gap-1">
                {me?.is_vip && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 shadow-sm">
                    <Crown className="h-2.5 w-2.5" /> VIP
                  </span>
                )}
                {me?.kyc_status === 'approved' && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ✓ KYC
                  </span>
                )}
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-white/10 text-white/70">
                  1:1 USDT
                </span>
              </div>
            </div>

            <div className="mt-1.5 flex items-baseline justify-between">
              <div>
                <span className="text-lg font-black text-white">
                  ${Number(me?.balance || 0).toFixed(2)}
                </span>
                <span className="ml-1 text-xs font-bold text-accent">FRC</span>
              </div>
              <span className="text-[11px] font-medium text-white/40">
                ≈ ${(Number(me?.balance || 0)).toFixed(2)} USDT
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (onTopUp) onTopUp()
                  if (onClose) onClose()
                }}
                className="flex items-center justify-center gap-1 rounded-xl bg-accent/20 border border-accent/40 py-1.5 text-[11px] font-bold text-accent hover:bg-accent/30 active:scale-95 transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Depositar</span>
              </button>
              <button
                type="button"
                onClick={() => handleNav('wallet')}
                className="flex items-center justify-center gap-1 rounded-xl bg-white/5 border border-white/10 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/10 active:scale-95 transition"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-white/60" />
                <span>Billetera</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#121829] p-3 text-left shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Saldo Disponible
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-white/10 text-white/70">
                USD
              </span>
            </div>

            <div className="mt-1.5 flex items-baseline justify-between">
              <div>
                <span className="text-lg font-black text-white">
                  ${Number(me?.balance || 0).toFixed(2)}
                </span>
                <span className="ml-1 text-xs font-bold text-accent">USD</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onTopUp) onTopUp()
                if (onClose) onClose()
              }}
              className="mt-2.5 w-full flex items-center justify-center gap-1 rounded-xl bg-accent/20 border border-accent/40 py-1.5 text-[11px] font-bold text-accent hover:bg-accent/30 active:scale-95 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Recargar Saldo</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Navegación Principal con Scroll */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 scrollbar-thin">
        {!showCryptoFeatures ? (
          <div>
            <p className="px-2.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-white/40">
              Menú Principal
            </p>
            <div className="space-y-1">
              {clientItems.map((item) => {
                const Icon = item.icon
                const isSelected = item.id === 'streaming'
                  ? (screen === 'home' && activeFilter === 'streaming')
                  : (screen === item.id || (item.id === 'home' && activeFilter !== 'streaming' && ['regions', 'products', 'detail', 'confirm', 'result', 'fzr-catalog', 'home'].includes(screen)))
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] ${
                      isSelected
                        ? 'bg-accent/15 border-l-[3px] border-accent text-white shadow-sm'
                        : 'border-l-[3px] border-transparent text-white/70 hover:bg-white/5 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                        isSelected ? 'bg-accent text-bg font-black shadow-sm shadow-accent/25' : 'bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className={`block truncate text-xs font-bold ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                          {item.label}
                        </span>
                        <span className="block truncate text-[10px] text-white/40">
                          {item.sublabel}
                        </span>
                      </div>
                    </div>

                    {item.badge && (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border shrink-0 ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Sección: Servicios del Ecosistema */}
            <div>
              <p className="px-2.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-white/40">
                Ecosistema
              </p>
              <div className="space-y-1">
                {ecosystemItems.map((item) => {
                  const Icon = item.icon
                  const isSelected = item.id === 'streaming'
                    ? (screen === 'home' && activeFilter === 'streaming')
                    : (screen === item.id || (item.id === 'home' && activeFilter !== 'streaming' && ['regions', 'products', 'detail', 'confirm', 'result', 'fzr-catalog', 'home'].includes(screen)))
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] ${
                        isSelected
                          ? 'bg-accent/15 border-l-[3px] border-accent text-white shadow-sm'
                          : 'border-l-[3px] border-transparent text-white/70 hover:bg-white/5 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                          isSelected ? 'bg-accent text-bg font-black shadow-sm shadow-accent/25' : 'bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className={`block truncate text-xs font-bold ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                            {item.label}
                          </span>
                          <span className="block truncate text-[10px] text-white/40">
                            {item.sublabel}
                          </span>
                        </div>
                      </div>

                      {item.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border shrink-0 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sección: Cuenta y Herramientas */}
            <div>
              <p className="px-2.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-white/40">
                Tu Cuenta
              </p>
              <div className="space-y-1">
                {accountItems.map((item) => {
                  const Icon = item.icon
                  const isSelected = screen === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] ${
                        isSelected
                          ? 'bg-accent/15 border-l-[3px] border-accent text-white shadow-sm'
                          : 'border-l-[3px] border-transparent text-white/70 hover:bg-white/5 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                          isSelected ? 'bg-accent text-bg font-black shadow-sm shadow-accent/25' : 'bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className={`block truncate text-xs font-bold ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                            {item.label}
                          </span>
                          <span className="block truncate text-[10px] text-white/40">
                            {item.sublabel}
                          </span>
                        </div>
                      </div>

                      {item.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border shrink-0 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Acceso para Vendedores o Administradores */}
        {(me?.role === 'admin' || me?.role === 'seller' || me?.role === 'reseller') && (
          <div>
            <p className="px-2.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400/70">
              Administración
            </p>
            <button
              type="button"
              onClick={() => handleNav('panel')}
              className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] ${
                screen === 'panel'
                  ? 'bg-amber-500/20 border-l-[3px] border-amber-400 text-white shadow-sm'
                  : 'border-l-[3px] border-transparent text-amber-300/80 hover:bg-white/5 hover:border-amber-400/30 hover:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                  <Crown className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-bold text-amber-300">
                    Panel Privado
                  </span>
                  <span className="block truncate text-[10px] text-white/40">
                    Gestión comercial y órdenes
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                {me.role}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Botón de Descarga App Android (visible solo en navegador web) */}
      {!window.Capacitor?.isNativePlatform?.() && (
        <div className="p-3 border-t border-white/5 bg-[#0e1424]/60">
          <a
            href="/downloads/FranchoShop.apk"
            download="FranchoShop.apk"
            className="flex items-center justify-between gap-2 w-full p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 hover:border-emerald-400 text-white transition group active:scale-98 shadow-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/30 text-emerald-300 group-hover:scale-110 transition">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <span className="block text-xs font-black text-white group-hover:text-emerald-300 transition truncate">
                  Descargar App Android
                </span>
                <span className="block text-[9px] text-white/50 truncate">
                  v2.3 Oficial · APK Directo
                </span>
              </div>
            </div>
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500 text-black uppercase tracking-wider">
              APK
            </span>
          </a>
        </div>
      )}

      {/* 4. Footer del Sidebar */}
      <div className="border-t border-white/10 p-3 bg-[#0a0e19]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-accent/20 border border-accent/30 text-accent font-black text-xs flex items-center justify-center shrink-0">
              {isGuest ? '?' : (me?.name || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">
                {isGuest ? 'Modo Invitado' : me?.name}
              </p>
              <p className="text-[10px] text-white/40 truncate">
                {isGuest ? 'Sin cuenta vinculada' : `@${me?.username || me?.telegram_id || 'usuario'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <a
              href="https://t.me/franchoshop"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition"
              title="Canal de Telegram"
            >
              <Send className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://wa.me/5363785631"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-white/40 hover:text-emerald-400 rounded-lg hover:bg-white/5 transition"
              title="WhatsApp Soporte"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )

  // Render para Desktop (Sidebar fijo en pantalla)
  if (isDesktop) {
    return (
      <aside className="hidden md:flex flex-col w-64 lg:w-72 h-screen sticky top-0 border-r border-white/10 bg-[#0c101c] shrink-0 select-none z-30">
        {content}
      </aside>
    )
  }

  // Render para Móvil (Drawer off-canvas con fondo oscuro)
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-[85%] max-w-xs h-full bg-[#0c101c] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
        {content}
      </div>
    </div>
  )
}

export default AppSidebar
