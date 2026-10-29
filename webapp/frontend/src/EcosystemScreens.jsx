import { useState, useMemo, useEffect } from 'react'
import api from './api/client'
import { UserIdentityBadges } from './UserIdentityBadges'
import { FranchoFMark } from './FranchoFMark'
import {
  ArrowLeftRight, Zap, ShieldCheck, WalletCards, ArrowLeft, ArrowRight,
  Check, Copy, Plus, Send, ExternalLink, RefreshCw, AlertCircle,
  CheckCircle2, Flame, Sparkles, Filter, ChevronDown, ChevronRight,
  Clock, DollarSign, Store, Lock, KeyRound, Smartphone, CreditCard,
  Building2, Banknote, UserCheck, CheckCheck, X, Crown, Award,
  FileText, Camera, UploadCloud, Info, AlertTriangle, ShieldAlert,
  Search, QrCode
} from 'lucide-react'

// ==========================================
// COMPONENTE: HEADER REUTILIZABLE RESPONSIVE
// ==========================================
function EcosystemHeader({ title, badge, badgeColor, subtitle, onBack, rightAction }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/10">
      <div className="flex items-start gap-2.5 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white active:scale-95 transition shrink-0 mt-0.5"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-black text-lg sm:text-xl text-white tracking-tight truncate">
              {title}
            </h1>
            {badge && (
              <span className={`inline-flex items-center text-[10px] sm:text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap shadow-sm ${badgeColor || 'bg-accent/20 text-accent border-accent/30'}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-white/60 mt-0.5 leading-snug truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {rightAction && (
        <div className="shrink-0 flex items-center self-end sm:self-auto">
          {rightAction}
        </div>
      )}
    </div>
  )
}

// ==========================================
// 1. CRIPTO SWAP SCREEN (ChangeNOW & Uniswap Cross-Chain DEX)
// ==========================================

const DEFAULT_SWAP_ASSETS = [
  {
    id: 'usdt-tron',
    symbol: 'USDT',
    name: 'Tether USD (TRC-20)',
    networkId: 'tron',
    networkName: 'Tron Network',
    standard: 'TRC-20',
    category: 'stable',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png',
    minAmount: 15,
    maxAmount: 60000,
    help: 'Empieza con T...',
    regex: /^T[a-zA-Z0-9]{33}$/
  },
  {
    id: 'usdt-bsc',
    symbol: 'USDT',
    name: 'Tether USD (BEP-20)',
    networkId: 'bsc',
    networkName: 'BNB Smart Chain',
    standard: 'BEP-20',
    category: 'stable',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
    minAmount: 15,
    maxAmount: 60000,
    help: 'Empieza con 0x...',
    regex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'usdt-solana',
    symbol: 'USDT',
    name: 'Tether USD (Solana SPL)',
    networkId: 'solana',
    networkName: 'Solana Network',
    standard: 'SPL',
    category: 'stable',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    minAmount: 15,
    maxAmount: 60000,
    help: 'Dirección Base58 de Solana',
    regex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  },
  {
    id: 'usdt-ton',
    symbol: 'USDT',
    name: 'Tether USD (TON)',
    networkId: 'ton',
    networkName: 'TON Network',
    standard: 'TON Jetton',
    category: 'stable',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ton/info/logo.png',
    minAmount: 15,
    maxAmount: 60000,
    help: 'Empieza con EQ, UQ o kQ...',
    regex: /^(EQ|UQ|kQ|0:)[a-zA-Z0-9_-]{46,48}$/
  },
  {
    id: 'usdt-polygon',
    symbol: 'USDT',
    name: 'Tether USD (Polygon)',
    networkId: 'polygon',
    networkName: 'Polygon PoS',
    standard: 'Polygon',
    category: 'stable',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    minAmount: 15,
    maxAmount: 60000,
    help: 'Empieza con 0x...',
    regex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'usdt-arbitrum',
    symbol: 'USDT',
    name: 'Tether USD (Arbitrum)',
    networkId: 'arbitrum',
    networkName: 'Arbitrum One',
    standard: 'Arbitrum',
    category: 'stable',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    minAmount: 15,
    maxAmount: 60000,
    help: 'Empieza con 0x...',
    regex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'usdt-ethereum',
    symbol: 'USDT',
    name: 'Tether USD (ERC-20)',
    networkId: 'ethereum',
    networkName: 'Ethereum Mainnet',
    standard: 'ERC-20',
    category: 'stable',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    minAmount: 40,
    maxAmount: 100000,
    help: 'Empieza con 0x...',
    regex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'btc-bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin (BTC)',
    networkId: 'bitcoin',
    networkName: 'Bitcoin Network',
    standard: 'Native SegWit',
    category: 'major',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
    minAmount: 0.00035,
    maxAmount: 2.0,
    help: 'Empieza con bc1, 1 o 3',
    regex: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/
  },
  {
    id: 'eth-ethereum',
    symbol: 'ETH',
    name: 'Ethereum (ETH)',
    networkId: 'ethereum',
    networkName: 'Ethereum Mainnet',
    standard: 'ERC-20',
    category: 'major',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    minAmount: 0.01,
    maxAmount: 25.0,
    help: 'Empieza con 0x...',
    regex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'sol-solana',
    symbol: 'SOL',
    name: 'Solana (SOL)',
    networkId: 'solana',
    networkName: 'Solana Network',
    standard: 'SPL',
    category: 'major',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    minAmount: 0.1,
    maxAmount: 300.0,
    help: 'Dirección Base58 de Solana',
    regex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  },
  {
    id: 'ton-ton',
    symbol: 'TON',
    name: 'Toncoin (TON)',
    networkId: 'ton',
    networkName: 'TON Network',
    standard: 'TON',
    category: 'major',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ton/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ton/info/logo.png',
    minAmount: 3.0,
    maxAmount: 10000.0,
    help: 'Empieza con EQ, UQ o kQ...',
    regex: /^(EQ|UQ|kQ|0:)[a-zA-Z0-9_-]{46,48}$/
  },
  {
    id: 'bnb-bsc',
    symbol: 'BNB',
    name: 'BNB Native (BSC)',
    networkId: 'bsc',
    networkName: 'BNB Smart Chain',
    standard: 'BEP-20',
    category: 'major',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
    minAmount: 0.05,
    maxAmount: 100.0,
    help: 'Empieza con 0x...',
    regex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'trx-tron',
    symbol: 'TRX',
    name: 'Tron (TRX)',
    networkId: 'tron',
    networkName: 'Tron Network',
    standard: 'TRC-20',
    category: 'altcoin',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png',
    minAmount: 100.0,
    maxAmount: 100000.0,
    help: 'Empieza con T...',
    regex: /^T[a-zA-Z0-9]{33}$/
  },
  {
    id: 'pol-polygon',
    symbol: 'POL',
    name: 'Polygon (POL)',
    networkId: 'polygon',
    networkName: 'Polygon PoS',
    standard: 'Polygon',
    category: 'altcoin',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    minAmount: 10.0,
    maxAmount: 50000.0,
    help: 'Empieza con 0x...',
    regex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'doge-doge',
    symbol: 'DOGE',
    name: 'Dogecoin (DOGE)',
    networkId: 'doge',
    networkName: 'Dogecoin Mainnet',
    standard: 'Doge Mainnet',
    category: 'altcoin',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png',
    minAmount: 300.0,
    maxAmount: 300000.0,
    help: 'Empieza con D...',
    regex: /^[DA9][1-9A-HJ-NP-Za-km-z]{33}$/
  },
  {
    id: 'ltc-litecoin',
    symbol: 'LTC',
    name: 'Litecoin (LTC)',
    networkId: 'litecoin',
    networkName: 'Litecoin Network',
    standard: 'LTC Mainnet',
    category: 'altcoin',
    coinLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/litecoin/info/logo.png',
    networkLogo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/litecoin/info/logo.png',
    minAmount: 0.05,
    maxAmount: 400.0,
    help: 'Empieza con L, M o ltc1...',
    regex: /^([LM3][a-km-zA-HJ-NP-Z1-9]{26,33}|ltc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{39,59})$/
  }
]

export function SwapScreen({ me, onBack, onLoginRequired, onNav }) {
  const [activeTab, setActiveTab] = useState('swap') // 'swap' | 'history'
  const [assets, setAssets] = useState(DEFAULT_SWAP_ASSETS)
  const [fromAsset, setFromAsset] = useState(DEFAULT_SWAP_ASSETS[1]) // USDT (BEP-20)
  const [toAsset, setToAsset] = useState(DEFAULT_SWAP_ASSETS[0])     // USDT (TRC-20)
  const [amountIn, setAmountIn] = useState('50')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [estimate, setEstimate] = useState(null)
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false)
  const [estimateError, setEstimateError] = useState(null)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [historyOrders, setHistoryOrders] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Asset Selector Modal State
  const [selectorTarget, setSelectorTarget] = useState(null) // 'from' | 'to' | null
  const [selectorSearch, setSelectorSearch] = useState('')
  const [selectorCategory, setSelectorCategory] = useState('all')

  // Copied indicator
  const [copiedField, setCopiedField] = useState(null)

  const isVip = !!(me?.is_vip || me?.vip_badge)
  const userBalance = Number(me?.balance || 0)

  // Fetch available assets from backend
  useEffect(() => {
    let isMounted = true
    api.getSwapAssets()
      .then(res => {
        if (isMounted && res?.ok && Array.isArray(res.assets) && res.assets.length > 0) {
          const mapped = res.assets.map(a => {
            const net = res.networks?.[a.networkId] || {}
            return {
              ...a,
              networkName: net.name || a.networkId.toUpperCase(),
              standard: net.standard || a.networkId.toUpperCase(),
              help: net.help || 'Verifica la dirección',
              regex: net.regex ? new RegExp(net.regex) : /.+/
            }
          })
          setAssets(mapped)
        }
      })
      .catch(() => {})
    return () => { isMounted = false }
  }, [])

  // Check localStorage for saved active order
  useEffect(() => {
    try {
      const saved = localStorage.getItem('active_crypto_swap_order')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.id && parsed.status !== 'COMPLETED' && parsed.status !== 'EXPIRED') {
          setActiveOrder(parsed)
        }
      }
    } catch {}
  }, [])

  // Address validation for target asset
  const addressValidation = useMemo(() => {
    const clean = recipientAddress.trim()
    if (!clean) return { valid: false, message: '' }
    if (toAsset.regex && !toAsset.regex.test(clean)) {
      return { valid: false, message: `Inválida para ${toAsset.networkName}. ${toAsset.help || ''}` }
    }
    return { valid: true, message: 'Dirección verificada' }
  }, [recipientAddress, toAsset])

  // Live Debounced Estimate
  useEffect(() => {
    const num = parseFloat(amountIn)
    if (isNaN(num) || num <= 0) {
      setEstimate(null)
      setEstimateError(null)
      return
    }

    let isSubscribed = true
    setIsLoadingEstimate(true)
    setEstimateError(null)

    const timer = setTimeout(async () => {
      try {
        const res = await api.getSwapEstimate({
          fromNetwork: fromAsset.networkId,
          fromToken: fromAsset.symbol,
          toNetwork: toAsset.networkId,
          toToken: toAsset.symbol,
          amountIn: num
        })
        if (isSubscribed && res?.ok && res.estimate) {
          setEstimate(res.estimate)
          setEstimateError(null)
        } else if (isSubscribed && res?.detail) {
          setEstimateError(res.detail)
        }
      } catch (err) {
        if (isSubscribed) {
          setEstimateError(err?.message || 'Error al cotizar par de intercambio')
        }
      } finally {
        if (isSubscribed) setIsLoadingEstimate(false)
      }
    }, 380)

    return () => {
      isSubscribed = false
      clearTimeout(timer)
    }
  }, [fromAsset, toAsset, amountIn])

  // Real-time Polling for Active Order
  useEffect(() => {
    if (!activeOrder || activeOrder.status === 'COMPLETED' || activeOrder.status === 'EXPIRED') return

    const interval = setInterval(async () => {
      try {
        const res = await api.getSwapOrder(activeOrder.id)
        if (res?.ok && res.order) {
          const updated = res.order
          if (updated.status !== activeOrder.status || updated.tx_hash_out !== activeOrder.tx_hash_out) {
            setActiveOrder(updated)
            localStorage.setItem('active_crypto_swap_order', JSON.stringify(updated))
          }
        }
      } catch (e) {
        console.warn('Error polling swap order:', e)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [activeOrder])

  // Fetch Swap History
  const fetchHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const res = await api.getSwapHistory(25)
      if (res?.ok && Array.isArray(res.orders)) {
        setHistoryOrders(res.orders)
      }
    } catch {}
    setIsLoadingHistory(false)
  }

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab])

  // Handle Switch
  const handleSwitchAssets = () => {
    const temp = fromAsset
    setFromAsset(toAsset)
    setToAsset(temp)
    setRecipientAddress('')
    setEstimate(null)
  }

  // Handle Copy
  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Handle Paste from Clipboard
  const handlePasteAddress = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setRecipientAddress(text.trim())
    } catch {
      alert('Por favor pega la dirección manualmente en el campo.')
    }
  }

  // Create Real Order
  const handleCreateOrder = async () => {
    const num = parseFloat(amountIn)
    if (isNaN(num) || num <= 0) return

    if (!recipientAddress.trim() || !addressValidation.valid) {
      alert('Ingresa una dirección de destino válida para recibir tus fondos.')
      return
    }

    if (estimate && num < estimate.minAmount) {
      alert(`El monto mínimo permitido es de ${estimate.minAmount} ${fromAsset.symbol}.`)
      return
    }

    setIsCreatingOrder(true)
    try {
      const res = await api.createSwapOrder({
        fromNetwork: fromAsset.networkId,
        fromToken: fromAsset.symbol,
        toNetwork: toAsset.networkId,
        toToken: toAsset.symbol,
        amountIn: num,
        recipientAddress: recipientAddress.trim()
      })

      if (res?.ok && res.order) {
        setActiveOrder(res.order)
        localStorage.setItem('active_crypto_swap_order', JSON.stringify(res.order))
      } else {
        alert(res?.detail || 'No se pudo crear la orden de intercambio.')
      }
    } catch (err) {
      alert(err?.message || 'Error al conectar con la red de liquidez.')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  // Filtered Assets for Selector Modal
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch =
        a.symbol.toLowerCase().includes(selectorSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(selectorSearch.toLowerCase()) ||
        a.networkName.toLowerCase().includes(selectorSearch.toLowerCase()) ||
        a.standard.toLowerCase().includes(selectorSearch.toLowerCase())

      if (!matchesSearch) return false

      if (selectorCategory === 'usdt') return a.symbol === 'USDT'
      if (selectorCategory === 'stable') return a.symbol === 'USDT' || a.symbol === 'USDC'
      if (selectorCategory === 'major') return a.category === 'major'
      if (selectorCategory === 'altcoin') return a.category === 'altcoin'
      return true
    })
  }, [assets, selectorSearch, selectorCategory])

  const selectAsset = (asset) => {
    if (selectorTarget === 'from') {
      if (asset.id === toAsset.id) {
        setToAsset(fromAsset)
      }
      setFromAsset(asset)
    } else if (selectorTarget === 'to') {
      if (asset.id === fromAsset.id) {
        setFromAsset(toAsset)
      }
      setToAsset(asset)
      setRecipientAddress('')
    }
    setSelectorTarget(null)
    setSelectorSearch('')
  }

  return (
    <div className="w-full max-w-md md:max-w-lg mx-auto h-full max-h-[calc(100dvh-75px)] md:max-h-screen flex flex-col justify-start overflow-hidden px-3 py-2 sm:py-3 sm:px-4 text-white">
      <div className="w-full flex-1 flex flex-col justify-between overflow-hidden space-y-2">
        {/* Header Compacto */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition shrink-0 active:scale-95"
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="font-black text-sm sm:text-base md:text-lg text-white tracking-tight truncate">Cripto Swap</h1>
              <span className="text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 shrink-0">
                <span className="hidden sm:inline">ChangeNOW & Uniswap</span>
                <span className="inline sm:hidden">DEX</span>
              </span>
              {isVip && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  <Crown className="h-2.5 w-2.5" /> VIP 0% Fee
                </span>
              )}
            </div>
          </div>

          {/* Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#121829] border border-white/10 rounded-xl p-0.5 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('swap')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                activeTab === 'swap'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Swap
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
                activeTab === 'history'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span>Historial</span>
              {activeOrder && activeOrder.status !== 'COMPLETED' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Micro-banner de Orden Activa si existe */}
        {activeOrder && activeOrder.status !== 'COMPLETED' && activeOrder.status !== 'EXPIRED' && activeTab === 'swap' && (
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className="w-full px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-left shrink-0 active:scale-[0.99] transition hover:bg-amber-500/20"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span className="text-xs font-bold text-amber-200 truncate">
                Swap #{activeOrder.id}: {activeOrder.amount_in} {activeOrder.from_token} → {activeOrder.amount_out_expected} {activeOrder.to_token}
              </span>
            </div>
            <span className="text-[10px] font-black text-amber-400 underline shrink-0 ml-2">
              Ver Estado →
            </span>
          </button>
        )}

        {/* TAB 1: FORMULARIO PRINCIPAL DE SWAP (COMPACTO Y ULTRA-ELEGANTE) */}
        {activeTab === 'swap' && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden space-y-2 py-0.5">
            {/* Tarjeta Principal */}
            <div className="rounded-2xl border border-white/10 bg-[#121829] p-2.5 sm:p-3.5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-[10px] px-0.5">
                <span className="font-extrabold uppercase tracking-wider text-white/50 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-pink-400" />
                  Intercambio Instantáneo
                </span>
                {isVip ? (
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <Crown className="h-3 w-3 text-amber-400" /> 0% Fee Plataforma
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNav && onNav('vip')}
                    className="text-white/40 hover:text-amber-300 transition"
                  >
                    Sin registro • <strong className="text-amber-400/90 hover:underline">VIP</strong>
                  </button>
                )}
              </div>

              {/* BLOQUE: TÚ PAGAS */}
              <div className="rounded-xl border border-white/10 bg-[#0d121f] p-2.5 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50 font-semibold uppercase tracking-wider">Tú pagas</span>
                  {fromAsset.symbol === 'USDT' && userBalance > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-white/40">Saldo:</span>
                      <span className="font-bold text-accent">${userBalance.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => setAmountIn(String(userBalance))}
                        className="text-[9px] font-black text-pink-400 bg-pink-500/10 px-1 py-0.2 rounded hover:bg-pink-500/20"
                      >
                        MAX
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={amountIn}
                    onChange={(e) => setAmountIn(e.target.value)}
                    className="w-full bg-transparent text-xl sm:text-2xl font-black text-white outline-none tracking-tight"
                    placeholder="0.0"
                  />
                  <button
                    type="button"
                    onClick={() => { setSelectorTarget('from'); setSelectorSearch('') }}
                    className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-2.5 py-1.5 shrink-0 border border-white/10 active:scale-95 transition"
                  >
                    <div className="relative">
                      <img src={fromAsset.coinLogo} alt={fromAsset.symbol} className="w-5 h-5 rounded-full" />
                      <img src={fromAsset.networkLogo} alt={fromAsset.networkName} className="w-3 h-3 rounded-full absolute -bottom-1 -right-1 border border-[#0d121f]" />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-xs text-white leading-tight">{fromAsset.symbol}</div>
                      <div className="text-[9px] text-white/50 leading-none">{fromAsset.standard}</div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-white/40 ml-0.5" />
                  </button>
                </div>

                <div className="flex justify-between items-center text-[10px] text-white/40 pt-0.5">
                  <span className="truncate">Red: <strong className="text-white/70">{fromAsset.networkName}</strong></span>
                  {estimate?.minAmount && (
                    <span className="shrink-0">Mín: {estimate.minAmount} {fromAsset.symbol}</span>
                  )}
                </div>
              </div>

              {/* SWITCHER BUTTON */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={handleSwitchAssets}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1b233a] border border-white/15 text-white hover:bg-pink-500 hover:text-white active:scale-90 transition shadow-md"
                  title="Invertir dirección"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* BLOQUE: TÚ RECIBES */}
              <div className="rounded-xl border border-white/10 bg-[#0d121f] p-2.5 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50 font-semibold uppercase tracking-wider truncate">Tú recibes (estimado)</span>
                  <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    {estimate?.provider || 'Liquidez Óptima'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="w-full text-xl sm:text-2xl font-black text-emerald-400 tracking-tight truncate flex items-center gap-2">
                    {isLoadingEstimate ? (
                      <span className="inline-block w-24 h-6 bg-white/10 animate-pulse rounded-md"></span>
                    ) : estimate?.amountOut ? (
                      estimate.amountOut
                    ) : (
                      '0.00'
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectorTarget('to'); setSelectorSearch('') }}
                    className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-2.5 py-1.5 shrink-0 border border-white/10 active:scale-95 transition"
                  >
                    <div className="relative">
                      <img src={toAsset.coinLogo} alt={toAsset.symbol} className="w-5 h-5 rounded-full" />
                      <img src={toAsset.networkLogo} alt={toAsset.networkName} className="w-3 h-3 rounded-full absolute -bottom-1 -right-1 border border-[#0d121f]" />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-xs text-white leading-tight">{toAsset.symbol}</div>
                      <div className="text-[9px] text-white/50 leading-none">{toAsset.standard}</div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-white/40 ml-0.5" />
                  </button>
                </div>

                <div className="flex justify-between items-center text-[10px] text-white/40 pt-0.5">
                  <span className="truncate">Red: <strong className="text-emerald-400/90">{toAsset.networkName}</strong></span>
                  {estimate?.rate && (
                    <span className="shrink-0 truncate">1 {fromAsset.symbol} ≈ {estimate.rate} {toAsset.symbol}</span>
                  )}
                </div>
              </div>

              {/* BLOQUE: DIRECCIÓN DE DESTINO */}
              <div className="rounded-xl border border-white/10 bg-[#0d121f] p-2.5 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <label className="text-white/60 font-medium truncate">
                    Billetera destino ({toAsset.symbol} {toAsset.standard})
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteAddress}
                    className="text-[10px] font-bold text-pink-400 hover:text-pink-300 transition shrink-0 ml-2"
                  >
                    Pegar
                  </button>
                </div>

                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value.trim())}
                  placeholder={toAsset.help || `Dirección de recepción ${toAsset.networkName}`}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-pink-500/40 transition"
                />

                {recipientAddress.trim() && (
                  <div className={`text-[10px] flex items-center gap-1 font-medium ${addressValidation.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {addressValidation.valid ? (
                      <>
                        <Check className="h-3 w-3 shrink-0" />
                        <span className="truncate">Dirección válida para {toAsset.networkName}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span className="truncate">{addressValidation.message}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* MICRO DESGLOSE */}
              <div className="px-1 flex items-center justify-between text-[10px] text-white/50 pt-0.5 gap-1">
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3 text-pink-400" />
                  {estimate?.estimatedMinutes || '~2-5 min'}
                </span>
                <span className="truncate">Red: <strong className="text-white/80">{estimate?.networkFee ? `${estimate.networkFee} ${toAsset.symbol}` : 'Incluida'}</strong></span>
                <span className="shrink-0">Plat: <strong className="text-emerald-400">{isVip ? '0.0% VIP' : `${estimate?.serviceFeePercent || 0.4}%`}</strong></span>
              </div>

              {/* MENSAJE DE ERROR SI APLICA */}
              {estimateError && (
                <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
                  <span>{estimateError}</span>
                </div>
              )}

              {/* BOTÓN DE ACCIÓN */}
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={
                  isCreatingOrder ||
                  isLoadingEstimate ||
                  !recipientAddress.trim() ||
                  !addressValidation.valid ||
                  parseFloat(amountIn) <= 0 ||
                  (estimate?.minAmount && parseFloat(amountIn) < estimate.minAmount)
                }
                className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-md active:scale-[0.98] transition hover:opacity-95 disabled:opacity-50"
              >
                {isCreatingOrder ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Generando depósito en blockchain...
                  </span>
                ) : !recipientAddress.trim() ? (
                  `Ingresa tu dirección de ${toAsset.symbol}`
                ) : !addressValidation.valid ? (
                  'Verifica la dirección de destino'
                ) : estimate?.minAmount && parseFloat(amountIn) < estimate.minAmount ? (
                  `Monto mínimo: ${estimate.minAmount} ${fromAsset.symbol}`
                ) : (
                  `Intercambiar ${fromAsset.symbol} por ${toAsset.symbol}`
                )}
              </button>
            </div>

            {/* Micro Link al Bot de Telegram */}
            <div className="text-center text-[10px] text-white/40 pt-1 pb-1 shrink-0 px-14 sm:px-0 leading-tight">
              ¿Operar en Telegram?{' '}
              <a
                href="https://t.me/unswapbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-400 font-bold hover:underline"
              >
                Abrir @unswapbot →
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: HISTORIAL DE SWAPS Y ORDEN ACTIVA */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 scrollbar-thin">
            {/* Si hay una orden activa seleccionada o en curso */}
            {activeOrder && (
              <div className="rounded-2xl border border-pink-500/30 bg-[#121829] p-3 sm:p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div>
                    <span className="text-[9px] text-pink-400 font-extrabold uppercase tracking-wider">
                      Orden en Tiempo Real
                    </span>
                    <h3 className="text-sm font-black text-white font-mono">
                      #{activeOrder.id}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeOrder.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : activeOrder.status === 'EXPIRED'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                  }`}>
                    {activeOrder.status === 'WAITING_DEPOSIT' && 'Esperando Depósito'}
                    {activeOrder.status === 'CONFIRMING' && 'Confirmando'}
                    {activeOrder.status === 'EXCHANGING' && 'Intercambiando'}
                    {activeOrder.status === 'SENDING' && 'Enviando'}
                    {activeOrder.status === 'COMPLETED' && '¡Completado! ✓'}
                    {activeOrder.status === 'EXPIRED' && 'Expirado'}
                  </span>
                </div>

                {/* Progress Stepper Compacto */}
                <div className="grid grid-cols-4 gap-1 text-center py-1 text-[9px]">
                  <div className={`p-1.5 rounded-lg flex flex-col items-center gap-0.5 ${
                    activeOrder.status !== 'WAITING_DEPOSIT' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30'
                  }`}>
                    <span>1. Depósito</span>
                    {activeOrder.status === 'WAITING_DEPOSIT' ? <Clock className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </div>
                  <div className={`p-1.5 rounded-lg flex flex-col items-center gap-0.5 ${
                    activeOrder.status === 'CONFIRMING' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : (activeOrder.status === 'EXCHANGING' || activeOrder.status === 'SENDING' || activeOrder.status === 'COMPLETED') ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-white/40'
                  }`}>
                    <span>2. Confirmación</span>
                    {activeOrder.status === 'CONFIRMING' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </div>
                  <div className={`p-1.5 rounded-lg flex flex-col items-center gap-0.5 ${
                    activeOrder.status === 'EXCHANGING' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : (activeOrder.status === 'SENDING' || activeOrder.status === 'COMPLETED') ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-white/40'
                  }`}>
                    <span>3. Conversión</span>
                    {activeOrder.status === 'EXCHANGING' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </div>
                  <div className={`p-1.5 rounded-lg flex flex-col items-center gap-0.5 ${
                    activeOrder.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : activeOrder.status === 'SENDING' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'bg-white/5 text-white/40'
                  }`}>
                    <span>4. Envío</span>
                    {activeOrder.status === 'COMPLETED' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Clock className="h-3 w-3" />}
                  </div>
                </div>

                {/* Si está esperando depósito: Mostrar QR y dirección de depósito */}
                {activeOrder.status === 'WAITING_DEPOSIT' && (
                  <div className="rounded-xl border border-white/10 bg-[#0d121f] p-3 text-center space-y-2">
                    <div className="text-[11px] text-white/70">
                      Envía exactamente <strong className="text-pink-400 font-black">{activeOrder.amount_in} {activeOrder.from_token}</strong> por <strong className="text-white font-bold">{activeOrder.from_network.toUpperCase()}</strong>:
                    </div>

                    <div className="flex justify-center py-1">
                      <div className="p-2 rounded-xl bg-[#121829] border border-white/15 shadow-lg inline-block">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(activeOrder.deposit_address)}&bgcolor=18-24-41&color=255-255-255&margin=3`}
                          alt="QR Depósito"
                          className="w-28 h-28 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Dirección con 1-click copy */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-white/5 border border-white/10">
                        <span className="font-mono text-[11px] text-white select-all break-all text-left">
                          {activeOrder.deposit_address}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeOrder.deposit_address, 'deposit')}
                          className="px-2 py-1 rounded-md bg-pink-500 hover:bg-pink-600 text-white shrink-0 active:scale-90 transition text-[10px] font-bold flex items-center gap-1"
                        >
                          {copiedField === 'deposit' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedField === 'deposit' ? '¡Listo!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200/90 leading-tight">
                      ⚠️ Se procesa automáticamente con 1 confirmación de la red.
                    </div>
                  </div>
                )}

                {/* Resumen de orden */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-white/60">
                    <span>Recibirás:</span>
                    <strong className="text-emerald-400 font-bold">
                      ~{activeOrder.amount_out_expected} {activeOrder.to_token}
                    </strong>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Destino:</span>
                    <span className="font-mono text-white/90 truncate max-w-[190px]">
                      {activeOrder.recipient_address}
                    </span>
                  </div>
                  {activeOrder.tx_hash_out && (
                    <div className="flex justify-between text-white/60">
                      <span>Hash Tx:</span>
                      <span className="font-mono text-pink-400 truncate max-w-[190px]">
                        {activeOrder.tx_hash_out}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOrder(null)
                      localStorage.removeItem('active_crypto_swap_order')
                      setActiveTab('swap')
                    }}
                    className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
                  >
                    Nuevo Swap
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      api.getSwapOrder(activeOrder.id).then(r => r?.order && setActiveOrder(r.order))
                    }}
                    className="px-3.5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Actualizar</span>
                  </button>
                </div>
              </div>
            )}

            {/* Listado de Historial General */}
            <div className="rounded-2xl border border-white/10 bg-[#121829] p-3 sm:p-4 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-white/10">
                <span className="font-extrabold uppercase text-white/50 text-[10px]">
                  Tus Intercambios Recientes
                </span>
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="text-pink-400 font-bold hover:underline flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refrescar</span>
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-6 text-center text-white/40 text-xs">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1.5 text-pink-400" />
                  Cargando órdenes...
                </div>
              ) : historyOrders.length === 0 ? (
                <div className="py-6 text-center text-white/40 text-xs space-y-1.5">
                  <WalletCards className="h-7 w-7 mx-auto text-white/20" />
                  <p>No tienes intercambios previos.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('swap')}
                    className="text-pink-400 font-bold hover:underline text-xs"
                  >
                    Realizar un swap →
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {historyOrders.map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => setActiveOrder(ord)}
                      className="p-2.5 rounded-xl bg-[#0d121f] hover:bg-white/5 border border-white/5 transition cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white flex items-center gap-1 text-[11px]">
                          <span>{ord.amount_in} {ord.from_token}</span>
                          <span className="text-white/40">→</span>
                          <span className="text-emerald-400">{ord.amount_out_expected} {ord.to_token}</span>
                        </div>
                        <div className="text-[9px] text-white/40 font-mono truncate">
                          #{ord.id} • {new Date(ord.created_at * 1000).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-1">
                        <span className={`inline-block px-2 py-0.2 rounded-full text-[9px] font-extrabold ${
                          ord.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : ord.status === 'EXPIRED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {ord.status}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL SELECTOR DE ACTIVOS (TOKEN & RED) */}
        {selectorTarget && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-[#121829] border border-white/10 rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl max-h-[85vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-black text-sm text-white">
                  Seleccionar {selectorTarget === 'from' ? 'Cripto a Enviar' : 'Cripto a Recibir'}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectorTarget(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Barra de Búsqueda */}
              <div className="py-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0d121f] border border-white/10">
                  <Search className="h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    value={selectorSearch}
                    onChange={(e) => setSelectorSearch(e.target.value)}
                    placeholder="Buscar por nombre, símbolo o red..."
                    className="w-full bg-transparent text-xs text-white outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Categorías */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'usdt', label: 'USDT Multi-Red' },
                  { id: 'stable', label: 'Stables' },
                  { id: 'major', label: 'Criptos Top' },
                  { id: 'altcoin', label: 'Altcoins' }
                ].map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectorCategory(c.id)}
                    className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap text-xs transition ${
                      selectorCategory === c.id
                        ? 'bg-pink-500 text-white'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Lista de Activos */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1">
                {filteredAssets.length === 0 ? (
                  <div className="py-8 text-center text-white/40 text-xs">
                    No se encontraron activos para esa búsqueda.
                  </div>
                ) : (
                  filteredAssets.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectAsset(item)}
                      className="w-full p-2.5 rounded-2xl bg-[#0d121f] hover:bg-white/10 border border-white/5 hover:border-pink-500/30 transition flex items-center justify-between text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={item.coinLogo} alt={item.symbol} className="w-8 h-8 rounded-full" />
                          <img
                            src={item.networkLogo}
                            alt={item.networkName}
                            className="w-4 h-4 rounded-full absolute -bottom-1 -right-1 border border-[#0d121f]"
                          />
                        </div>
                        <div>
                          <div className="font-black text-xs text-white group-hover:text-pink-300 transition">
                            {item.symbol}
                          </div>
                          <div className="text-[11px] text-white/50 leading-tight">
                            {item.name}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-white/5 text-[10px] font-bold text-white/70">
                          {item.standard}
                        </span>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          {item.networkName}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ==========================================
// 2. ENERGÍA TRON SCREEN (0 Gas USDT TRC20)
// ==========================================
export function TronEnergyScreen({ me, onBack, onTopUp, onNav }) {
  const [selectedPackage, setSelectedPackage] = useState('pack-1')
  const [tronAddress, setTronAddress] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)

  const isGuest = !me || me.is_guest
  const userBalance = Number(me?.balance || 0)

  const packages = [
    {
      id: 'pack-1',
      title: '1 Transferencia USDT',
      energy: '32,000 Energía',
      duration: '1 Hora de validez',
      priceFRC: 0.40,
      savings: 'Ahorras ~$1.80 USDT (80%)',
      popular: false
    },
    {
      id: 'pack-2',
      title: '2 Transferencias USDT',
      energy: '65,000 Energía',
      duration: '1 Hora de validez',
      priceFRC: 0.75,
      savings: 'Ahorras ~$3.65 USDT (83%)',
      popular: true
    },
    {
      id: 'pack-3',
      title: 'Pase Comerciante Diario',
      energy: '65,000 Energía',
      duration: '24 Horas de validez',
      priceFRC: 0.95,
      savings: 'Ideal para mover saldo todo el día',
      popular: false
    },
    {
      id: 'pack-4',
      title: 'Pack Mayorista',
      energy: '320,000 Energía (10 tx)',
      duration: '24 Horas de validez',
      priceFRC: 3.80,
      savings: 'Máximo ahorro para casas de cambio',
      popular: false
    }
  ]

  const chosenPkg = packages.find(p => p.id === selectedPackage) || packages[0]

  const handleRentEnergy = () => {
    if (!tronAddress || tronAddress.trim().length < 30 || !tronAddress.trim().startsWith('T')) {
      alert('Por favor ingresa una dirección TRON válida que empiece con "T".')
      return
    }

    if (isGuest) {
      if (onTopUp) onTopUp()
      return
    }

    if (userBalance < chosenPkg.priceFRC) {
      alert(`Saldo insuficiente. El paquete cuesta $${chosenPkg.priceFRC.toFixed(2)} FRC y tu saldo es $${userBalance.toFixed(2)} FRC. Por favor deposita primero.`)
      return
    }

    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setSuccessMsg(`¡Energía TRON delegada con éxito a ${tronAddress.slice(0, 6)}...${tronAddress.slice(-4)}! Tienes ${chosenPkg.energy} asignada por ${chosenPkg.duration}. Al transferir USDT tu consumo de TRX será $0.`)
    }, 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto px-3.5 py-4 sm:p-6 pb-36 text-white">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <EcosystemHeader
          title="Energía TRON"
          badge="⚡ 0 Gas"
          badgeColor="bg-amber-500/20 text-amber-300 border-amber-500/30"
          subtitle="Transfiere USDT TRC20 sin gastar TRX en comisiones de red"
          onBack={onBack}
        />

        {/* Banner Comparativo de Ahorro */}
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-[#181a29] to-[#121829] p-4 sm:p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                Comparativa de Comisiones TRON
              </span>
              <h3 className="text-sm sm:text-base font-black text-white mt-1">
                ¿Por qué pagar $2.20 USDT si puedes pagar solo $0.40?
              </h3>
            </div>
            <span className="text-2xl sm:text-3xl shrink-0">⚡</span>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
              <span className="font-bold text-red-300 block text-[11px]">❌ Sin Energía</span>
              <span className="text-sm sm:text-base font-black text-white block mt-0.5">13.5 TRX</span>
              <span className="text-[10px] text-white/50">≈ $2.20 USDT quemados</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
              <span className="font-bold text-emerald-300 block text-[11px]">✓ Con Francho Energía</span>
              <span className="text-sm sm:text-base font-black text-accent block mt-0.5">0.40 FRC</span>
              <span className="text-[10px] text-emerald-300 font-bold">0 TRX de gas (Ahorras 80%)</span>
            </div>
          </div>
        </div>

        {/* Selector de Paquetes */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
            Selecciona el paquete de energía:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {packages.map((pkg) => {
              const isSelected = selectedPackage === pkg.id
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => {
                    setSelectedPackage(pkg.id)
                    setSuccessMsg(null)
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] relative ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/30'
                      : 'border-white/10 bg-[#121829] hover:border-white/20'
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-2 right-3 bg-amber-400 text-bg text-[9px] font-black px-2 py-0.2 rounded-full uppercase tracking-wider shadow">
                      Popular
                    </span>
                  )}
                  <div className="font-extrabold text-xs text-white flex items-center justify-between">
                    <span>{pkg.title}</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 font-bold mt-0.5">{pkg.energy}</p>
                  <p className="text-[10px] text-white/40">{pkg.duration}</p>
                  <div className="mt-2.5 pt-2 border-t border-white/5 flex items-baseline justify-between">
                    <span className="text-sm font-black text-white">
                      ${pkg.priceFRC.toFixed(2)} <span className="text-[10px] text-accent">FRC</span>
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400">
                      {pkg.savings}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Input de Dirección TRON */}
        <div className="rounded-3xl border border-white/10 bg-[#121829] p-4 sm:p-5 space-y-3 shadow-xl">
          <label className="block text-xs font-bold text-white/80">
            Dirección TRON (TRC20) que recibirá la energía:
          </label>
          <div className="relative">
            <input
              type="text"
              value={tronAddress}
              onChange={(e) => {
                setTronAddress(e.target.value)
                setSuccessMsg(null)
              }}
              placeholder="Ej: TLa2f6VPqDgREiF7744385..."
              className="w-full rounded-2xl border border-white/10 bg-[#0d121f] px-3.5 py-3 text-xs text-white placeholder-white/30 outline-none focus:border-amber-400 transition pr-20"
            />
            {navigator.clipboard && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText()
                    if (text) setTronAddress(text.trim())
                  } catch {}
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-white/10 text-white/70 hover:text-white text-[10px] font-bold transition"
              >
                Pegar
              </button>
            )}
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">
            La energía se delegará automáticamente en la blockchain en menos de 1 minuto. Al transferir tu USDT, el consumo de TRX será $0.
          </p>

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRentEnergy}
            disabled={isProcessing}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-bg font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 active:scale-[0.98] transition hover:opacity-95 disabled:opacity-50"
          >
            {isProcessing ? 'Delegando energía en blockchain...' : `Alquilar Energía por $${chosenPkg.priceFRC.toFixed(2)} FRC`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 3. MERCADO P2P SCREEN (FRC ⇄ CUP / MLC Cuba)
// ==========================================
export function P2PMarketScreen({ me, onBack, onLoginRequired, onNav }) {
  const [tab, setTab] = useState('buy') // 'buy' | 'sell'
  const [methodFilter, setMethodFilter] = useState('all')
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [p2pModalOpen, setP2pModalOpen] = useState(false)
  const [fiatAmount, setFiatAmount] = useState('3450')
  const [p2pSuccess, setP2pSuccess] = useState(null)

  const isGuest = !me || me.is_guest

  const methods = [
    { id: 'all', label: 'Todos' },
    { id: 'transfermovil', label: '💳 Transfermóvil' },
    { id: 'enzona', label: '📱 EnZona' },
    { id: 'mlc', label: '🏦 Tarjeta MLC' },
    { id: 'cash', label: '💵 Efectivo Habana' },
  ]

  const sampleOffers = [
    {
      id: 'p2p-1',
      merchant: 'Frank_Crypto',
      rating: 4.98,
      orders: 420,
      completionRate: 100,
      avgTime: '2 min',
      price: tab === 'buy' ? 345.00 : 340.00,
      currency: 'CUP',
      availableFRC: 150.0,
      minLimit: 10.0,
      maxLimit: 150.0,
      methods: ['Transfermóvil', 'EnZona'],
      badge: 'PRO'
    },
    {
      id: 'p2p-2',
      merchant: 'Habana_Exchange',
      rating: 4.95,
      orders: 1150,
      completionRate: 99.8,
      avgTime: '3 min',
      price: tab === 'buy' ? 346.00 : 339.00,
      currency: 'CUP',
      availableFRC: 380.0,
      minLimit: 25.0,
      maxLimit: 380.0,
      methods: ['Transfermóvil', 'Efectivo Habana'],
      badge: 'TOP'
    },
    {
      id: 'p2p-3',
      merchant: 'CubaRemesas_VIP',
      rating: 4.92,
      orders: 780,
      completionRate: 99.5,
      avgTime: '4 min',
      price: tab === 'buy' ? 1.15 : 1.12,
      currency: 'MLC',
      availableFRC: 220.0,
      minLimit: 20.0,
      maxLimit: 220.0,
      methods: ['Tarjeta MLC'],
      badge: 'VERIFICADO'
    },
    {
      id: 'p2p-4',
      merchant: 'Santiago_P2P',
      rating: 4.88,
      orders: 310,
      completionRate: 98.9,
      avgTime: '5 min',
      price: tab === 'buy' ? 344.00 : 338.00,
      currency: 'CUP',
      availableFRC: 90.0,
      minLimit: 5.0,
      maxLimit: 90.0,
      methods: ['Transfermóvil', 'EnZona'],
      badge: null
    }
  ]

  const filteredOffers = sampleOffers.filter(o => {
    if (methodFilter === 'transfermovil' && !o.methods.includes('Transfermóvil')) return false
    if (methodFilter === 'enzona' && !o.methods.includes('EnZona')) return false
    if (methodFilter === 'mlc' && !o.methods.includes('Tarjeta MLC')) return false
    if (methodFilter === 'cash' && !o.methods.includes('Efectivo Habana')) return false
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto px-3.5 py-4 sm:p-6 pb-36 text-white">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <EcosystemHeader
          title="Mercado P2P"
          badge="🛡️ Custodia Escrow"
          badgeColor="bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
          subtitle="Compra y vende saldo FRC con CUP, MLC y efectivo sin comisiones"
          onBack={onBack}
          rightAction={
            <button
              type="button"
              onClick={() => alert('Para registrarte como comerciante verificado P2P y publicar ofertas, escribe a nuestro soporte.')}
              className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition active:scale-95"
            >
              + Publicar
            </button>
          }
        />

        {/* Pestañas Comprar / Vender */}
        <div className="grid grid-cols-2 gap-2 bg-[#121829] p-1.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setTab('buy')}
            className={`py-2 rounded-xl text-xs font-black transition ${
              tab === 'buy'
                ? 'bg-emerald-500 text-bg shadow-md shadow-emerald-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Quiero Comprar FRC
          </button>
          <button
            type="button"
            onClick={() => setTab('sell')}
            className={`py-2 rounded-xl text-xs font-black transition ${
              tab === 'sell'
                ? 'bg-cyan-500 text-bg shadow-md shadow-cyan-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Quiero Vender FRC
          </button>
        </div>

        {/* Filtros de Métodos de Pago */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethodFilter(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition whitespace-nowrap ${
                methodFilter === m.id
                  ? 'bg-accent/20 border border-accent/40 text-accent'
                  : 'bg-white/5 border border-white/5 text-white/60 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Garantía Escrow Info */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-[#121829] to-[#121829] border border-cyan-500/25 flex items-start gap-3 text-xs shadow-md">
          <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-black text-cyan-300 block">Custodia Automática Escrow</span>
            <p className="text-white/70 text-[11px] leading-relaxed mt-0.5">
              Los FRC del comerciante quedan bloqueados por la plataforma. Nadie puede retirar los fondos hasta que ambas partes confirmen la recepción del pago en Cuba.
            </p>
          </div>
        </div>

        {/* Lista de Ofertas P2P */}
        <div className="space-y-3">
          {filteredOffers.map((offer) => (
            <div
              key={offer.id}
              className="p-4 rounded-2xl border border-white/10 bg-[#121829] hover:border-white/20 transition space-y-3 shadow-lg"
            >
              {/* Fila 1: Comerciante y Tasa */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-accent/20 text-accent font-black text-xs flex items-center justify-center shrink-0 border border-accent/30">
                    {offer.merchant.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-xs text-white truncate">{offer.merchant}</span>
                      <UserIdentityBadges profile={offer} />
                      {offer.badge && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          {offer.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/50 block truncate">
                      {offer.orders} órdenes ({offer.completionRate}%) • {offer.avgTime}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-white/40 block">Tasa por 1 FRC</span>
                  <span className="text-sm sm:text-base font-black text-white">
                    {offer.price.toFixed(2)} <span className="text-xs font-bold text-accent">{offer.currency}</span>
                  </span>
                </div>
              </div>

              {/* Fila 2: Límites y Métodos de Pago */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-white/5 pt-2.5">
                <div>
                  <span className="text-[11px] text-white/60 block">
                    Disponible: <strong className="text-white font-bold">{offer.availableFRC.toFixed(2)} FRC</strong>
                  </span>
                  <span className="text-[10px] text-white/40 block">
                    Límites: ${offer.minLimit} - ${offer.maxLimit} FRC
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {offer.methods.map((m) => (
                    <span key={m} className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/5 whitespace-nowrap">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Fila 3: Botón de Acción (Full width en móvil para evitar desbordes) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOffer(offer)
                    setFiatAmount(String(Math.round(offer.price * 10)))
                    setP2pModalOpen(true)
                    setP2pSuccess(null)
                  }}
                  className={`w-full py-2.5 rounded-xl font-black text-xs transition active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5 ${
                    tab === 'buy'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-bg shadow-emerald-500/20'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-bg shadow-cyan-500/20'
                  }`}
                >
                  <span>{tab === 'buy' ? 'Comprar FRC' : 'Vender FRC'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal de Operación P2P */}
        {p2pModalOpen && selectedOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121829] p-5 space-y-4 shadow-2xl relative text-white animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <span>{tab === 'buy' ? 'Comprar FranchoCoin' : 'Vender FranchoCoin'}</span>
                    <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30 font-bold">
                      Escrow
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/50">Comerciante: {selectedOffer.merchant}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setP2pModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">
                    Cantidad a pagar ({selectedOffer.currency}):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={fiatAmount}
                      onChange={(e) => setFiatAmount(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#0d121f] px-3.5 py-2.5 text-base font-black text-white outline-none focus:border-accent"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-white/40">
                      {selectedOffer.currency}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-white/60">
                    <span>Tasa de cambio:</span>
                    <span className="font-bold text-white">1 FRC = {selectedOffer.price.toFixed(2)} {selectedOffer.currency}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Recibirás en billetera:</span>
                    <span className="font-black text-accent text-sm">
                      {((parseFloat(fiatAmount) || 0) / selectedOffer.price).toFixed(2)} FRC
                    </span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Métodos aceptados:</span>
                    <span className="font-bold text-white">{selectedOffer.methods.join(', ')}</span>
                  </div>
                </div>

                {p2pSuccess ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{p2pSuccess}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isGuest) {
                        if (onLoginRequired) onLoginRequired()
                        return
                      }
                      setP2pSuccess(`¡Orden P2P iniciada con éxito! Los fondos están bajo custodia Escrow. Procede al chat seguro para efectuar la transferencia.`)
                    }}
                    className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-bg font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition"
                  >
                    Confirmar e Iniciar Operación Escrow
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// 4. BILLETERA FRANCHOCOIN (Wallet & Ledger)
// ==========================================
function walletProfileText(value, fallback = '') {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const candidate = value.display_name || value.name || value.username || value.text || value.value
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate)
  }
  return fallback
}

export function WalletScreen({ me, onBack, onTopUp, onNav }) {
  const [walletTab, setWalletTab] = useState('transfer') // 'transfer' | 'withdraw' | 'movements'
  // Transfer state
  const [recipient, setRecipient] = useState('')
  const [recipientProfile, setRecipientProfile] = useState(null)
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false)
  const [recipientLookupError, setRecipientLookupError] = useState('')
  const [amount, setAmount] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [transferSuccess, setTransferSuccess] = useState(null)
  const [realMovements, setRealMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawNetwork, setWithdrawNetwork] = useState('BEP20')
  const [withdrawNote, setWithdrawNote] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(null)
  const [realWithdrawals, setRealWithdrawals] = useState([])
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false)

  const isGuest = !me || me.is_guest
  const balance = Number(me?.balance || 0)
  const isVip = !!me?.is_vip
  const withdrawFee = isVip ? 0.0 : 1.00
  const reqAmt = parseFloat(withdrawAmount) || 0
  const netWithdraw = Math.max(0, reqAmt - withdrawFee)
  const walletPanelClass = 'rounded-2xl border border-white/10 bg-[#101820] p-4 shadow-[0_12px_28px_rgba(0,0,0,.18)]'
  const walletTabClass = (active, tone = 'accent') => {
    const toneClass = tone === 'amber'
      ? 'fs-wallet-button-amber'
      : tone === 'neutral'
        ? 'fs-wallet-button-slate'
        : 'fs-wallet-button-primary'
    return active ? toneClass : `${toneClass} opacity-65 hover:opacity-100`
  }

  useEffect(() => {
    if (!isGuest) {
      setLoadingMovements(true)
      api.getWalletMovements(30)
        .then((res) => {
          if (res?.movements) setRealMovements(res.movements)
        })
        .catch(() => {})
        .finally(() => setLoadingMovements(false))

      setLoadingWithdrawals(true)
      api.getWalletWithdrawals(30)
        .then((res) => {
          if (res?.items) setRealWithdrawals(res.items)
        })
        .catch(() => {})
        .finally(() => setLoadingWithdrawals(false))
    }
  }, [isGuest])

  const handleRecipientLookup = async () => {
    const query = recipient.trim()
    if (!query) {
      setRecipientLookupError('Escribe un @usuario, correo o ID para buscar la cuenta.')
      return
    }
    setRecipientLookupLoading(true)
    setRecipientLookupError('')
    setRecipientProfile(null)
    try {
      const resolved = await api.resolveWalletRecipient(query)
      setRecipientProfile(resolved)
    } catch (error) {
      setRecipientLookupError(error.message || 'No se pudo encontrar esa cuenta.')
    } finally {
      setRecipientLookupLoading(false)
    }
  }

  const handleInternalTransfer = async () => {
    const amt = parseFloat(amount)
    if (!recipient.trim()) {
      alert('Por favor ingresa el usuario (@usuario) o ID de destino.')
      return
    }
    if (!recipientProfile) {
      setRecipientLookupError('Busca y confirma la cuenta destinataria antes de enviar FC.')
      return
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0.')
      return
    }
    if (amt > balance) {
      alert(`Saldo insuficiente para enviar ${amt.toFixed(2)} FC. Tienes ${balance.toFixed(2)} FC disponibles en tu billetera.`)
      return
    }

    setIsSending(true)
    setTransferSuccess(null)
    try {
      const res = await api.transferWalletBalance({ recipient: recipient.trim(), amount: amt })
      setIsSending(false)
      setTransferSuccess(`¡Transferencia de $${amt.toFixed(2)} FRC enviada con éxito a ${res.recipient}! Comisión: 0%`)
      setRecipient('')
      setRecipientProfile(null)
      setAmount('')
      try { window.dispatchEvent(new CustomEvent('franchoshop:refresh-me')) } catch {}
      api.getWalletMovements(30).then(r => { if (r?.movements) setRealMovements(r.movements) }).catch(() => {})
    } catch (e) {
      setIsSending(false)
      alert(e.message || 'Error al procesar la transferencia')
    }
  }

  const handleCryptoWithdrawal = async () => {
    const amt = parseFloat(withdrawAmount)
    const addr = withdrawAddress.trim()
    if (isNaN(amt) || amt <= 0) {
      alert('Por favor ingresa un monto válido a retirar.')
      return
    }
    if (amt > balance) {
      alert('Saldo insuficiente en tu Billetera FranchoCoin.')
      return
    }
    if (!isVip && amt <= 1.0) {
      alert('El monto mínimo para retiro estándar es de $2.00 USDT para cubrir la tarifa de red. ¡Con Membresía VIP tu comisión es $0.00!')
      return
    }
    if (!addr) {
      alert('Por favor ingresa la dirección de billetera de destino.')
      return
    }
    if (withdrawNetwork === 'BEP20' && !addr.startsWith('0x')) {
      alert('La dirección BEP20 debe comenzar con 0x.')
      return
    }
    if (withdrawNetwork === 'TRC20' && !addr.startsWith('T')) {
      alert('La dirección TRC20 debe comenzar con T.')
      return
    }

    setIsWithdrawing(true)
    setWithdrawSuccess(null)
    try {
      const res = await api.requestWalletWithdrawal({
        amount: amt,
        wallet_address: addr,
        network: withdrawNetwork,
        note: withdrawNote.trim()
      })
      setIsWithdrawing(false)
      setWithdrawSuccess(`¡Solicitud de retiro de $${amt.toFixed(2)} USDT procesada! Recibirás neto: $${res.withdrawal.net_amount.toFixed(2)} USDT. Comisión: ${res.withdrawal.is_vip ? '0% VIP' : '$1.00 USDT'}`)
      setWithdrawAmount('')
      setWithdrawAddress('')
      setWithdrawNote('')
      try { window.dispatchEvent(new CustomEvent('franchoshop:refresh-me')) } catch {}
      api.getWalletWithdrawals(30).then(r => { if (r?.items) setRealWithdrawals(r.items) }).catch(() => {})
      api.getWalletMovements(30).then(r => { if (r?.movements) setRealMovements(r.movements) }).catch(() => {})
    } catch (e) {
      setIsWithdrawing(false)
      alert(e.message || 'Error al solicitar el retiro')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-3.5 py-4 sm:p-6 pb-36 text-white">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <EcosystemHeader
          title="Mi saldo"
          subtitle="Gestiona tus FC y movimientos"
          onBack={onBack}
        />

        {/* Tarjeta de Saldo Principal */}
        <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-[#15251f] via-[#101a1a] to-[#0d1218] p-4 shadow-xl">
          <div className="pointer-events-none absolute -right-9 -top-10 h-28 w-28 rounded-full bg-accent/15 blur-3xl" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">Saldo disponible</span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white">
                  ${balance.toFixed(2)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-accent">
                  <FranchoFMark className="h-3.5 w-3.5" title="FranchoCoin" />
                  FC
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/40">1 FC equivale a 1 USDT</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/15 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
              <WalletCards className="h-5 w-5" strokeWidth={3.35} />
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onTopUp}
              className="fs-wallet-button-primary flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition active:translate-y-[2px]"
            >
              <Plus className="h-4 w-4" strokeWidth={3.4} />
              <span>Depositar</span>
            </button>
            <button
              type="button"
              onClick={() => setWalletTab('transfer')}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white/85 transition hover:bg-white/10 active:scale-95"
            >
              <Send className="h-4 w-4 text-accent" strokeWidth={3.35} />
              <span>Enviar FC</span>
            </button>
          </div>
        </div>

        {/* Acciones secundarias. Enviar FC ya está disponible arriba junto al saldo. */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setWalletTab('withdraw')}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-1 py-2 transition active:translate-y-[2px] ${walletTabClass(walletTab === 'withdraw', 'amber')}`}
          >
            <Banknote className="h-3.5 w-3.5" strokeWidth={3.35} />
            <span>Retirar USDT</span>
          </button>
          <button
            type="button"
            onClick={() => setWalletTab('movements')}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-1 py-2 transition active:translate-y-[2px] ${walletTabClass(walletTab === 'movements', 'neutral')}`}
          >
            <Clock className="h-3.5 w-3.5" strokeWidth={3.35} />
            <span>Historial</span>
          </button>
        </div>

        {/* 1. VISTA: TRANSFERENCIA INTERNA */}
        {walletTab === 'transfer' && (
          <div className={`${walletPanelClass} space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-accent" strokeWidth={3.35} />
                <h3 className="font-black text-sm text-white">Enviar FC</h3>
              </div>
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                0% Comisión
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">
                  Destinatario
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => {
                      setRecipient(e.target.value)
                      setRecipientProfile(null)
                      setRecipientLookupError('')
                      setTransferSuccess(null)
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRecipientLookup() }}
                    placeholder="@usuario, correo o ID"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-accent transition"
                  />
                  <button
                    type="button"
                    onClick={handleRecipientLookup}
                    disabled={recipientLookupLoading || !recipient.trim()}
                    className="fs-wallet-button-primary inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-black transition active:translate-y-[2px] disabled:opacity-40"
                  >
                    {recipientLookupLoading ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={3.35} /> : <Search className="h-4 w-4" strokeWidth={3.35} />}
                    Buscar
                  </button>
                </div>
                {recipientLookupError && <p className="mt-1.5 text-[11px] font-medium text-red-300">{recipientLookupError}</p>}
                {recipientProfile && (
                  <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-300/35 bg-emerald-500/20 text-xs font-black text-emerald-100">
                      {recipientProfile.photo_url ? <img src={recipientProfile.photo_url} alt="" className="h-full w-full object-cover" /> : (recipientProfile.display_name || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-xs font-black text-white">{walletProfileText(recipientProfile.display_name, 'Cuenta Francho Shop')}</p>
                        <UserIdentityBadges profile={recipientProfile} />
                      </div>
                      <p className="truncate text-[10px] text-white/55">{walletProfileText(recipientProfile.username) ? `@${walletProfileText(recipientProfile.username)}` : `ID ${walletProfileText(recipientProfile.user_id, '---')}`}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] font-black text-emerald-200">
                      <UserCheck className="h-3 w-3" strokeWidth={3.35} /> Cuenta encontrada
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-white/60">
                    Monto en FC:
                  </label>
                  {balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(balance))}
                      className="text-[10px] font-bold text-accent hover:underline"
                    >
                      Disponible: ${balance.toFixed(2)} MAX
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      setTransferSuccess(null)
                    }}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-accent transition pr-14"
                  />
                  <span className="absolute right-3.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 font-extrabold text-xs text-accent">
                    <FranchoFMark className="h-3.5 w-3.5" title="FranchoCoin" />
                    FC
                  </span>
                </div>
              </div>

              {transferSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" strokeWidth={3.35} />
                  <span>{transferSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleInternalTransfer}
                disabled={isSending || !recipientProfile}
                className="fs-wallet-button-primary w-full rounded-xl py-3 text-xs font-black transition active:translate-y-[3px] disabled:opacity-50"
              >
                {isSending ? 'Procesando transferencia...' : recipientProfile ? 'Enviar FC al instante' : 'Busca una cuenta para continuar'}
              </button>
            </div>
          </div>
        )}

        {/* 2. VISTA: RETIRO A CRIPTO (USDT) */}
        {walletTab === 'withdraw' && (
          <div className={`${walletPanelClass} space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-amber-400" strokeWidth={3.35} />
                <h3 className="font-black text-sm text-white">Retirar USDT</h3>
              </div>
              {isVip ? (
                <span className="text-[10px] font-black text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 whitespace-nowrap flex items-center gap-1">
                  <Crown className="h-3 w-3" /> 0% Fee VIP
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNav('vip')}
                  className="text-[10px] font-extrabold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition flex items-center gap-1"
                >
                  <Crown className="h-3 w-3 text-amber-400" /> Obtén VIP (0% Fee)
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              {/* Selector de Red */}
              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">
                  Red
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawNetwork('BEP20')}
                    className={`py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      withdrawNetwork === 'BEP20'
                        ? 'fs-wallet-button-amber'
                        : 'bg-white/[.06] border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <span>BEP20 (BNB Chain)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawNetwork('TRC20')}
                    className={`py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      withdrawNetwork === 'TRC20'
                        ? 'fs-wallet-button-slate'
                        : 'bg-white/[.06] border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <span>TRC20 (Tron)</span>
                  </button>
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">
                  Dirección {withdrawNetwork}
                </label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => {
                    setWithdrawAddress(e.target.value)
                    setWithdrawSuccess(null)
                  }}
                  placeholder={withdrawNetwork === 'BEP20' ? '0x...' : 'T...'}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-amber-400 font-mono transition"
                />
              </div>

              {/* Monto */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-white/60">
                    Monto a retirar
                  </label>
                  {balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(String(balance))}
                      className="text-[10px] font-bold text-accent hover:underline"
                    >
                      Disponible: ${balance.toFixed(2)} MAX
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value)
                      setWithdrawSuccess(null)
                    }}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-amber-400 transition pr-16"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-extrabold text-xs text-amber-400">
                    USDT
                  </span>
                </div>
              </div>

              {/* Resumen de Comisión */}
              <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-3 text-[11px]">
                <div className="flex justify-between text-white/60">
                  <span>Monto solicitado:</span>
                  <span className="font-bold text-white">${reqAmt.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Comisión por retiro:</span>
                  {isVip ? (
                    <span className="font-black text-amber-400 flex items-center gap-1">
                      <Crown className="h-3 w-3" /> $0.00 (0% Club VIP)
                    </span>
                  ) : (
                    <span className="font-bold text-white/80">$1.00 USDT</span>
                  )}
                </div>
                <div className="border-t border-white/5 pt-1.5 flex justify-between font-black text-xs">
                  <span className="text-white">Recibirás en tu billetera:</span>
                  <span className="text-emerald-400">${netWithdraw.toFixed(2)} USDT</span>
                </div>
              </div>

              {withdrawSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" strokeWidth={3.35} />
                  <span>{withdrawSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCryptoWithdrawal}
                disabled={isWithdrawing || reqAmt <= 0}
                className="fs-wallet-button-amber w-full rounded-xl py-3 text-xs font-black transition active:translate-y-[3px] disabled:opacity-50"
              >
                {isWithdrawing ? 'Enviando solicitud...' : `Confirmar Retiro (${netWithdraw.toFixed(2)} USDT)`}
              </button>
            </div>
          </div>
        )}

        {/* 3. VISTA: HISTORIAL DE COBROS Y TRANSFERENCIAS FC */}
        {walletTab === 'movements' && <div className={`${walletPanelClass} space-y-3`}>
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xs sm:text-sm text-white">Cobros y transferencias</h3>
            <span className="text-[10px] text-white/40">Sin compras</span>
          </div>

          {isGuest ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center text-xs text-white/50 space-y-1">
              <p>Inicia sesión para ver tus transferencias de FC.</p>
            </div>
          ) : loadingMovements ? (
            <div className="p-4 text-center text-xs text-white/40">Cargando movimientos...</div>
          ) : realMovements.length > 0 ? (
            <div className="space-y-2">
              {realMovements.map((tx) => {
                const amt = Number(tx.amount || 0)
                const isPositive = amt > 0
                const dateStr = tx.created_at ? new Date(tx.created_at * 1000).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Reciente'
                const typeLabel = ['transfer_out', 'transfer_sent'].includes(tx.type)
                  ? 'FC enviado'
                  : tx.type === 'payment_received' ? 'Pago recibido' : 'FC recibido'
                return (
                  <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[.04] p-3 text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-white block truncate">{tx.note || typeLabel}</span>
                      <span className="text-[10px] text-white/40">{dateStr} • {typeLabel}</span>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 font-black ${isPositive ? 'text-emerald-400' : 'text-white'}`}>
                      <FranchoFMark className="h-3.5 w-3.5" title="FranchoCoin" />
                      {isPositive ? '+' : ''}{amt.toFixed(2)} FC
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-white/[.04] p-4 text-center text-xs text-white/50">
              Aún no tienes cobros ni transferencias de FC. Las compras no aparecen en este historial.
            </div>
          )}
        </div>}
      </div>
    </div>
  )
}

// ==========================================
// 5. MEMBRESÍA & CLUB VIP (0% Retiros & Perks)
// ==========================================
export function VipScreen({ me, onBack, onTopUp, onLoginRequired, onNav }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlanId, setSelectedPlanId] = useState('vip_monthly')
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const isGuest = !me || me.is_guest
  const balance = Number(me?.balance || 0)
  const isVip = !!me?.is_vip

  useEffect(() => {
    api.getVipPlans()
      .then((res) => {
        if (res?.plans && res.plans.length > 0) {
          setPlans(res.plans)
          setSelectedPlanId(res.plans[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0] || {
    id: 'vip_monthly',
    title: 'VIP Club Francho (Mensual)',
    price: 4.99,
    duration_days: 30,
    badge: 'VIP GOLD',
    features: [
      '0% comisión en todos tus retiros (USDT / FRC)',
      'Badge VIP Oro exclusivo en tu perfil y P2P',
      'Límite diario de retiros y operaciones ampliado a $2,500 FRC',
      'Prioridad máxima en órdenes de soporte y reclamos',
      'Acceso anticipado a promociones y ofertas relámpago'
    ]
  }

  const handleSubscribe = async () => {
    if (isGuest) {
      if (onLoginRequired) onLoginRequired()
      return
    }
    if (balance < selectedPlan.price) {
      if (onTopUp) onTopUp()
      return
    }

    setIsSubscribing(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await api.subscribeVip(selectedPlan.id)
      setIsSubscribing(false)
      setSuccessMsg(`¡Felicidades! Tu membresía ${res.plan_title} ha sido activada con éxito hasta el ${new Date(res.expires_at * 1000).toLocaleDateString()}.`)
      try { window.dispatchEvent(new CustomEvent('franchoshop:refresh-me')) } catch {}
    } catch (e) {
      setIsSubscribing(false)
      setErrorMsg(e.message || 'Error al procesar la suscripción')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-3.5 py-4 sm:p-6 pb-36 text-white">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <EcosystemHeader
          title="Club VIP Francho"
          badge="0% Comisión en Retiros"
          badgeColor="bg-amber-500/20 text-amber-300 border-amber-500/30"
          subtitle="Beneficios exclusivos, retiros sin costo y atención preferencial"
          onBack={onBack}
        />

        {/* Tarjeta de Estado VIP */}
        {isVip ? (
          <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-b from-amber-500/20 via-[#1a1508] to-[#0d121f] p-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/20">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-white">
                      {me?.vip_plan ? me.vip_plan.toUpperCase() : 'MEMBRESÍA VIP ACTIVA'}
                    </h2>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-bg">
                      {me?.vip_badge || 'VIP GOLD'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/70 mt-0.5">
                    Te quedan <b className="text-amber-300">{me?.vip_days_remaining || 0} días</b> de beneficios activos
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-amber-500/20 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
                <span>0% Comisión en Retiros</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Badge VIP en Perfil & P2P</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Límites Diarios Ampliados</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Soporte Prioritario 24/7</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-[#131722] to-[#0d121f] p-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white">
                  Desbloquea el Potencial Máximo de tu Cuenta
                </h2>
                <p className="text-xs text-white/60 mt-1 leading-snug">
                  Los miembros del Club VIP disfrutan de <b>0% de comisión en todos sus retiros de fondos</b>, insignia de prestigio en el mercado P2P y límites operativos extendidos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Planes Disponibles */}
        <div className="space-y-3">
          <h3 className="font-black text-xs sm:text-sm text-white px-1">Selecciona tu Plan de Membresía</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {plans.map((p) => {
              const isSelected = selectedPlanId === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`rounded-2xl p-4 border cursor-pointer transition relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10'
                      : 'border-white/10 bg-[#121829] hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5 mb-2">
                      <h4 className="font-black text-xs sm:text-sm text-white leading-snug">{p.title}</h4>
                      {p.badge && (
                        <span className="shrink-0 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-white">${p.price}</span>
                      <span className="text-xs font-bold text-amber-400">FRC</span>
                      <span className="text-[10px] text-white/40 ml-1">/ {p.duration_days} días</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-white/60">0% Comisión Retiro</span>
                    <span className="font-bold text-emerald-400">Incluido ✓</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detalle del Plan Seleccionado */}
        {selectedPlan && (
          <div className="rounded-3xl border border-white/10 bg-[#121829] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div>
                <h3 className="font-black text-sm text-white">{selectedPlan.title}</h3>
                <p className="text-[11px] text-white/50">Beneficios garantizados durante la suscripción</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-white">${selectedPlan.price}</span>
                <span className="text-xs font-bold text-amber-400 ml-1">FRC</span>
              </div>
            </div>

            <div className="space-y-2">
              {(selectedPlan.features || []).map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-white/80">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* Saldo y CTA */}
            <div className="pt-2 border-t border-white/5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/60">Tu saldo en FranchoCoin:</span>
                <span className="font-black text-white">${balance.toFixed(2)} FRC</span>
              </div>

              {successMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {isGuest ? (
                <button
                  type="button"
                  onClick={onLoginRequired}
                  className="w-full py-3.5 rounded-2xl bg-accent text-bg font-black text-xs hover:bg-accent/90 active:scale-[0.98] transition shadow-lg shadow-accent/20"
                >
                  Iniciar Sesión para Unirte al Club VIP
                </button>
              ) : balance < selectedPlan.price ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-300/80 text-center">
                    Te faltan ${(selectedPlan.price - balance).toFixed(2)} FRC para activar este plan.
                  </p>
                  <button
                    type="button"
                    onClick={onTopUp}
                    className="w-full py-3.5 rounded-2xl bg-accent text-bg font-black text-xs hover:bg-accent/90 active:scale-[0.98] transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Recargar Saldo FranchoCoin</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-bg font-black text-xs hover:opacity-95 active:scale-[0.98] transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Crown className="h-4 w-4 text-bg" />
                  <span>{isSubscribing ? 'Activando Membresía...' : `Activar ${selectedPlan.title} ($${selectedPlan.price} FRC)`}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// 6. VERIFICACIÓN DE IDENTIDAD (KYC)
// ==========================================
export function KycScreen({ me, onBack, onLoginRequired, onNav }) {
  const [kyc, setKyc] = useState(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [fullName, setFullName] = useState('')
  const [docType, setDocType] = useState('dni')
  const [docNumber, setDocNumber] = useState('')
  const [country, setCountry] = useState('Cuba')
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [selfieImage, setSelfieImage] = useState(null)

  const [frontPreview, setFrontPreview] = useState(null)
  const [backPreview, setBackPreview] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)

  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const isGuest = !me || me.is_guest

  const loadKyc = () => {
    if (!isGuest) {
      setLoading(true)
      api.getKycStatus()
        .then((res) => {
          if (res?.kyc) {
            setKyc(res.kyc)
            if (res.kyc.full_name) setFullName(res.kyc.full_name)
            if (res.kyc.document_type) setDocType(res.kyc.document_type)
            if (res.kyc.document_number) setDocNumber(res.kyc.document_number)
            if (res.kyc.country) setCountry(res.kyc.country)
            if (res.kyc.front_image_url) setFrontPreview(res.kyc.front_image_url)
            if (res.kyc.back_image_url) setBackPreview(res.kyc.back_image_url)
            if (res.kyc.selfie_image_url) setSelfiePreview(res.kyc.selfie_image_url)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKyc()
  }, [isGuest])

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (type === 'front') setUploadingFront(true)
    if (type === 'back') setUploadingBack(true)
    if (type === 'selfie') setUploadingSelfie(true)
    setErrorMsg(null)

    try {
      const res = await api.uploadKycImage(file, type)
      if (type === 'front') {
        setFrontImage(res.url)
        setFrontPreview(res.url)
      } else if (type === 'back') {
        setBackImage(res.url)
        setBackPreview(res.url)
      } else if (type === 'selfie') {
        setSelfieImage(res.url)
        setSelfiePreview(res.url)
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al subir la imagen')
    } finally {
      if (type === 'front') setUploadingFront(false)
      if (type === 'back') setUploadingBack(false)
      if (type === 'selfie') setUploadingSelfie(false)
    }
  }

  const handleSubmitKyc = async () => {
    if (isGuest) {
      if (onLoginRequired) onLoginRequired()
      return
    }
    if (!fullName.trim()) {
      alert('Por favor ingresa tu nombre y apellidos completos.')
      return
    }
    if (!docNumber.trim()) {
      alert('Por favor ingresa tu número de documento de identidad.')
      return
    }
    const finalFront = frontImage || frontPreview
    const finalBack = backImage || backPreview
    const finalSelfie = selfieImage || selfiePreview

    if (!finalFront) {
      alert('Por favor sube la foto frontal de tu documento.')
      return
    }
    if (docType !== 'passport' && !finalBack) {
      alert('Por favor sube la foto trasera de tu documento.')
      return
    }
    if (!finalSelfie) {
      alert('Por favor sube una selfie con tu documento.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    setSubmitSuccess(null)

    try {
      await api.submitKyc({
        full_name: fullName.trim(),
        document_type: docType,
        document_number: docNumber.trim(),
        country: country.trim(),
        front_image_url: finalFront,
        back_image_url: finalBack || '',
        selfie_image_url: finalSelfie
      })
      setIsSubmitting(false)
      setSubmitSuccess('¡Documentos enviados con éxito! Nuestro equipo de cumplimiento los revisará en breve.')
      loadKyc()
      try { window.dispatchEvent(new CustomEvent('franchoshop:refresh-me')) } catch {}
    } catch (err) {
      setIsSubmitting(false)
      setErrorMsg(err.message || 'Error al enviar la solicitud de verificación')
    }
  }

  const status = kyc?.status || 'unverified'

  return (
    <div className="flex-1 overflow-y-auto px-3.5 py-4 sm:p-6 pb-36 text-white">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <EcosystemHeader
          title="Verificación KYC"
          badge={status === 'approved' ? 'Nivel 2 Verificado ✓' : 'Identidad & Seguridad'}
          badgeColor={status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'}
          subtitle="Valida tu documento oficial para desbloquear retiros y operar en P2P"
          onBack={onBack}
        />

        {/* 1. ESTADO: APROBADO */}
        {status === 'approved' && (
          <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/20 via-[#0a1b14] to-[#0d121f] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  Identidad Verificada (Nivel 2)
                </h2>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  Titular: <b>{kyc?.full_name}</b> • País: {kyc?.country}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Retiros de fondos habilitados hasta $5,000 FRC / día</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Insignia de Comerciante Confiable en el Mercado P2P</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Protección completa de cuenta y resolución prioritaria</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. ESTADO: EN REVISIÓN */}
        {status === 'pending' && (
          <div className="rounded-3xl border border-blue-500/40 bg-gradient-to-b from-blue-500/20 via-[#0a1525] to-[#0d121f] p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/20">
                <Clock className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  Documentos en Auditoría
                </h2>
                <p className="text-xs text-blue-300/80 mt-0.5">
                  Tiempo estimado de revisión: <b>Menos de 2 horas</b>
                </p>
              </div>
            </div>

            <p className="text-xs text-white/60 leading-snug">
              Hemos recibido tus imágenes y datos correctamente. Un oficial de cumplimiento de Francho Shop verificará la autenticidad y nitidez de tus documentos.
            </p>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-xs text-white/70 space-y-1">
              <div><b>Documento:</b> {kyc?.document_type?.toUpperCase()} - {kyc?.document_number}</div>
              <div><b>Titular:</b> {kyc?.full_name} ({kyc?.country})</div>
            </div>
          </div>
        )}

        {/* 3. ESTADO: RECHAZADO */}
        {status === 'rejected' && (
          <div className="rounded-3xl border border-red-500/40 bg-gradient-to-b from-red-500/20 via-[#1f0a0d] to-[#0d121f] p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  Verificación Rechazada
                </h2>
                <p className="text-xs text-red-300/80 mt-0.5">
                  Revisa el motivo y vuelve a enviar tus fotos legibles
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <b>Motivo del rechazo:</b> {kyc?.rejection_reason || 'Foto borrosa o documento no legible. Asegúrate de capturar fotos claras sin brillos ni reflejos.'}
            </div>
          </div>
        )}

        {/* FORMULARIO DE ENVÍO (Si está unverified o rejected) */}
        {(status === 'unverified' || status === 'rejected') && (
          <div className="rounded-3xl border border-white/10 bg-[#121829] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="border-b border-white/10 pb-3">
              <h3 className="font-black text-xs sm:text-sm text-white">Formulario de Identificación Oficial</h3>
              <p className="text-[11px] text-white/50">Tus datos están protegidos y encriptados</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">
                  Nombre y Apellidos Legales:
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Frank Del Río Martínez"
                  className="w-full rounded-2xl border border-white/10 bg-[#0d121f] px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-cyan-400 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">
                    Tipo de Documento:
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#0d121f] px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400 transition"
                  >
                    <option value="dni">Cédula / DNI / Carné</option>
                    <option value="passport">Pasaporte Oficial</option>
                    <option value="license">Licencia de Conducir</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">
                    País de Residencia:
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Ej: Cuba"
                    className="w-full rounded-2xl border border-white/10 bg-[#0d121f] px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">
                  Número de Documento:
                </label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="Ej: 98051212345"
                  className="w-full rounded-2xl border border-white/10 bg-[#0d121f] px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-cyan-400 font-mono transition"
                />
              </div>

              {/* Subida de Fotos */}
              <div className="pt-2 space-y-3">
                <h4 className="font-bold text-xs text-white">Fotos del Documento & Selfie</h4>

                {/* 1. Frontal */}
                <div className="p-3 rounded-2xl border border-white/10 bg-[#0d121f] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-white">Parte Frontal del Documento</p>
                      <p className="text-[10px] text-white/40 truncate">Debe ser nítido y legible</p>
                    </div>
                  </div>
                  <div>
                    {frontPreview ? (
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        Subido ✓
                      </span>
                    ) : (
                      <label className="cursor-pointer py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition inline-block">
                        {uploadingFront ? 'Subiendo...' : 'Adjuntar'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'front')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 2. Reverso */}
                {docType !== 'passport' && (
                  <div className="p-3 rounded-2xl border border-white/10 bg-[#0d121f] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-white">Parte Posterior (Reverso)</p>
                        <p className="text-[10px] text-white/40 truncate">Reverso del carné o licencia</p>
                      </div>
                    </div>
                    <div>
                      {backPreview ? (
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                          Subido ✓
                        </span>
                      ) : (
                        <label className="cursor-pointer py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition inline-block">
                          {uploadingBack ? 'Subiendo...' : 'Adjuntar'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'back')}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Selfie */}
                <div className="p-3 rounded-2xl border border-white/10 bg-[#0d121f] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-pink-400 shrink-0">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-white">Selfie con Documento en Mano</p>
                      <p className="text-[10px] text-white/40 truncate">Tu rostro y documento visibles</p>
                    </div>
                  </div>
                  <div>
                    {selfiePreview ? (
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        Subido ✓
                      </span>
                    ) : (
                      <label className="cursor-pointer py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition inline-block">
                        {uploadingSelfie ? 'Subiendo...' : 'Adjuntar'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'selfie')}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {submitSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmitKyc}
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-cyan-500 text-bg font-black text-xs hover:bg-cyan-400 active:scale-[0.98] transition shadow-lg shadow-cyan-500/25 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? 'Enviando a Auditoría...' : 'Enviar Documentos para Verificación'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
