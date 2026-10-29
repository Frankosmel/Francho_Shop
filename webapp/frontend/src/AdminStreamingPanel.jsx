import React, { useState, useEffect, useMemo } from 'react'
import api from './api/client'
import {
  Tv, Search, RefreshCw, Eye, EyeOff, Edit3, Save, X, Check,
  AlertCircle, DollarSign, Boxes, Clock, Copy, CheckCircle2,
  Sparkles, Layers, SlidersHorizontal, ArrowUpRight, TrendingUp
} from 'lucide-react'

export function AdminStreamingPanel() {
  const [profile, setProfile] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | 'orders'
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' | 'HIDDEN'
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  // Edit modal
  const [editingProduct, setEditingProduct] = useState(null)
  const [editForm, setEditForm] = useState({
    custom_name: '',
    custom_image_url: '',
    custom_description: '',
    custom_terms: '',
    retail_price_usd: '',
    reseller_price_usd: '',
    is_hidden: 0,
    is_featured: 0,
    sort_order: 100
  })

  // Copied toast
  const [copiedId, setCopiedId] = useState(null)

  async function loadData(forceSync = false) {
    if (forceSync) setSyncing(true)
    else setLoading(true)
    setErr(null)

    try {
      if (forceSync) {
        await api.streamingAdminSync().catch(() => null)
      }

      // 1. Obtener perfil del proveedor (billetera)
      const profRes = await api.streamingAdminProfile().catch(() => ({ ok: false }))
      if (profRes && profRes.ok && profRes.profile) {
        setProfile(profRes.profile)
      }

      // 2. Obtener catálogo (con fallback automático a endpoint público si el admin falla)
      let loadedProducts = []
      try {
        const catRes = await api.streamingAdminCatalog()
        if (catRes && catRes.ok && Array.isArray(catRes.products) && catRes.products.length > 0) {
          loadedProducts = catRes.products
        }
      } catch (adminCatErr) {
        console.warn('Fallback a streamingCatalog:', adminCatErr)
      }

      // Fallback si admin catalog falló
      if (loadedProducts.length === 0) {
        const pubRes = await api.streamingCatalog().catch(() => ({ ok: false, products: [] }))
        if (pubRes && Array.isArray(pubRes.products)) {
          loadedProducts = pubRes.products.map(p => ({
            ...p,
            price_usd: p.price ? (p.price / 1.30) : 0,
            retail_price_usd: p.price,
            reseller_price_usd: p.price ? (p.price / 1.30 * 1.15) : 0,
            final_name: p.name,
            final_image_url: p.image_url,
            final_description: p.description,
            final_terms: p.terms_and_conditions
          }))
        }
      }

      setProducts(loadedProducts)

      // 3. Obtener órdenes
      const ordRes = await api.streamingAdminOrders(50).catch(() => ({ ok: false, orders: [] }))
      if (ordRes && ordRes.ok) setOrders(ordRes.orders || [])

      if (forceSync) {
        setMsg('Catálogo y stock sincronizados con éxito desde StreamZone')
        setTimeout(() => setMsg(null), 3500)
      }
    } catch (e) {
      setErr(e.message || 'Error al cargar datos del proveedor')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Categorías únicas
  const categories = useMemo(() => {
    const set = new Set()
    products.forEach(p => {
      if (p.category) set.add(p.category)
    })
    return ['ALL', ...Array.from(set)]
  }, [products])

  // Contadores para filtros
  const inStockCount = useMemo(() => products.filter(p => p.in_stock && p.stock_available > 0).length, [products])
  const outOfStockCount = useMemo(() => products.filter(p => !p.in_stock || p.stock_available === 0).length, [products])
  const hiddenCount = useMemo(() => products.filter(p => Boolean(p.is_hidden)).length, [products])

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase().trim()
      const pName = (p.final_name || p.name || '').toLowerCase()
      const pCat = (p.category || '').toLowerCase()
      const pCode = (p.code || '').toLowerCase()

      const matchesSearch = !q || pName.includes(q) || pCat.includes(q) || pCode.includes(q)
      const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter

      let matchesStatus = true
      if (statusFilter === 'IN_STOCK') matchesStatus = p.in_stock && p.stock_available > 0
      else if (statusFilter === 'OUT_OF_STOCK') matchesStatus = !p.in_stock || p.stock_available === 0
      else if (statusFilter === 'HIDDEN') matchesStatus = Boolean(p.is_hidden)

      return matchesSearch && matchesCat && matchesStatus
    })
  }, [products, searchQuery, categoryFilter, statusFilter])

  function openEditModal(prod) {
    setEditingProduct(prod)
    setEditForm({
      custom_name: prod.custom_name || '',
      custom_image_url: prod.custom_image_url || '',
      custom_description: prod.custom_description || prod.description || '',
      custom_terms: prod.custom_terms || prod.terms_and_conditions || '',
      retail_price_usd: prod.retail_price_usd ?? (prod.price_usd ? (prod.price_usd * 1.30).toFixed(2) : ''),
      reseller_price_usd: prod.reseller_price_usd ?? (prod.price_usd ? (prod.price_usd * 1.15).toFixed(2) : ''),
      is_hidden: prod.is_hidden ? 1 : 0,
      is_featured: prod.is_featured ? 1 : 0,
      sort_order: prod.sort_order ?? 100
    })
  }

  async function handleSaveOverride() {
    if (!editingProduct) return
    setSaving(true)
    setErr(null)

    try {
      const payload = {
        product_id: editingProduct.id,
        custom_name: editForm.custom_name.trim() || null,
        custom_image_url: editForm.custom_image_url.trim() || null,
        custom_description: editForm.custom_description.trim() || null,
        custom_terms: editForm.custom_terms.trim() || null,
        retail_price_usd: editForm.retail_price_usd !== '' ? Number(editForm.retail_price_usd) : null,
        reseller_price_usd: editForm.reseller_price_usd !== '' ? Number(editForm.reseller_price_usd) : null,
        is_hidden: Number(editForm.is_hidden ? 1 : 0),
        is_featured: Number(editForm.is_featured ? 1 : 0),
        sort_order: Number(editForm.sort_order || 100)
      }

      const res = await api.streamingAdminOverride(payload)
      if (res && res.ok) {
        setMsg(`Producto "${editingProduct.final_name || editingProduct.name}" actualizado con éxito`)
        setEditingProduct(null)
        setTimeout(() => setMsg(null), 3500)
        await loadData()
      } else {
        setErr(res?.error || 'No se pudo guardar la configuración')
      }
    } catch (e) {
      setErr(e.message || 'Error al guardar cambios')
    } finally {
      setSaving(false)
    }
  }

  async function quickToggleVisibility(prod) {
    try {
      const newHidden = prod.is_hidden ? 0 : 1
      await api.streamingAdminOverride({
        product_id: prod.id,
        custom_name: prod.custom_name || null,
        custom_image_url: prod.custom_image_url || null,
        custom_description: prod.custom_description || null,
        custom_terms: prod.custom_terms || null,
        retail_price_usd: prod.retail_price_usd,
        reseller_price_usd: prod.reseller_price_usd,
        is_hidden: newHidden,
        is_featured: prod.is_featured || 0,
        sort_order: prod.sort_order || 100
      })
      await loadData()
    } catch (e) {
      alert(`Error al cambiar visibilidad: ${e.message}`)
    }
  }

  const copyText = (txt, id) => {
    navigator.clipboard.writeText(txt)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="w-full space-y-6 pb-16 max-w-7xl mx-auto">
      {/* ─── 1. HEADER PRINCIPAL Y ESTADO ─── */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-white/10 p-5 md:p-7 shadow-2xl backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Tv className="h-3.5 w-3.5 text-blue-400" /> Proveedor StreamZone B2B
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" /> API Conectada
            </span>
            <span className="text-[11px] font-mono text-white/50 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
              Titular: {profile?.name || 'Frank del río cambra'}
            </span>
          </div>

          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight pt-1">
            Gestor de Streaming, Cuentas & Licencias
          </h1>
          <p className="text-xs md:text-sm text-white/60 max-w-3xl leading-relaxed">
            Controla precios para clientes finales y revendedores B2B, cambia portadas, oculta o muestra servicios y monitorea el stock disponible en tiempo real.
          </p>
        </div>

        {/* ─── TARJETAS DE MÉTRICAS & BOTÓN DE SINCRONIZACIÓN (GRID LIMPIO SIN APLASTAR) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          {/* Card 1: Billetera Proveedor */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 truncate">
                Billetera Proveedor
              </p>
              <p className="text-sm md:text-base font-black text-white truncate">
                {profile?.wallet?.formattedUSD || '$0.00 USD'}
                <span className="text-[10px] font-normal text-white/40 block truncate">
                  {profile?.wallet?.formattedCOP || '$0 COP'}
                </span>
              </p>
            </div>
          </div>

          {/* Card 2: Catálogo Total */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 truncate">
                Catálogo Activo
              </p>
              <p className="text-sm md:text-base font-black text-white truncate">
                {products.length} Servicios
              </p>
              <p className="text-[10px] text-emerald-400 font-semibold truncate">
                {inStockCount} con stock disponible
              </p>
            </div>
          </div>

          {/* Card 3: Tasa de Cambio */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 truncate">
                Tasa de Cambio COP
              </p>
              <p className="text-sm md:text-base font-black text-white truncate">
                1 USD = 3,182 COP
              </p>
              <p className="text-[10px] text-white/40 truncate">
                Conversión oficial StreamZone
              </p>
            </div>
          </div>

          {/* Card 4: Botón de Sincronización Dedicado */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={syncing}
            className="w-full h-full min-h-[58px] p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">
              {syncing ? 'Sincronizando Stock...' : 'Sincronizar Stock en Bodega'}
            </span>
          </button>
        </div>

        {/* ─── BANNER DEL WEBHOOK PARA ALERTAS DE PRECIO ─── */}
        <div className="mt-4 p-3.5 rounded-2xl bg-black/50 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-white/80">
            <span className="font-bold text-sky-400 flex items-center gap-1.5 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" /> Webhook para Cambios de Precios (price.updated):
            </span>
            <code className="px-2 py-0.5 rounded bg-white/10 font-mono text-white text-[11px] select-all break-all">
              https://franchoshop.com/api/webhooks/streamzone
            </code>
          </div>
          <button
            type="button"
            onClick={() => copyText('https://franchoshop.com/api/webhooks/streamzone', 'webhook_url')}
            className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-[11px] transition flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            {copiedId === 'webhook_url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedId === 'webhook_url' ? '¡Copiado!' : 'Copiar URL Webhook'}
          </button>
        </div>

        {/* Notificaciones de Éxito o Error */}
        {msg && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {msg}
          </div>
        )}
        {err && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}
      </div>

      {/* ─── 2. PESTAÑAS (CATÁLOGO vs PEDIDOS) ─── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Boxes className="h-4 w-4" /> Catálogo de Streaming ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Clock className="h-4 w-4" /> Historial de Compras ({orders.length})
        </button>
      </div>

      {/* ─── 3. CONTENIDO: CATÁLOGO DE PRODUCTOS ─── */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Barra de Filtros: Categorías en Píldoras Rápidas */}
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                }`}
              >
                {cat === 'ALL' ? `Todos (${products.length})` : cat}
              </button>
            ))}
          </div>

          {/* Búsqueda y Filtro de Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por Netflix, Disney, Amazon, Spotify, VPN, Canva..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="ALL" className="bg-slate-900 text-white">Todos los estados ({products.length})</option>
                <option value="IN_STOCK" className="bg-slate-900 text-white">✓ En Stock Bodega ({inStockCount})</option>
                <option value="OUT_OF_STOCK" className="bg-slate-900 text-white">Sin Stock Bodega ({outOfStockCount})</option>
                <option value="HIDDEN" className="bg-slate-900 text-white">🚫 Ocultos de Tienda ({hiddenCount})</option>
              </select>
            </div>
          </div>

          {/* ─── GRILLA DE PRODUCTOS ─── */}
          {loading ? (
            <div className="py-24 text-center text-white/40 text-xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-7 w-7 animate-spin text-blue-400" />
              <span>Cargando catálogo enriquecido desde StreamZone...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-white/5 border border-white/10 p-8 text-white/50 text-xs space-y-2">
              <Tv className="h-8 w-8 text-white/20 mx-auto" />
              <p className="font-bold text-sm text-white/70">No se encontraron productos</p>
              <p>Prueba cambiando el término de búsqueda o seleccionando "Todos".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(prod => {
                const isHidden = Boolean(prod.is_hidden)
                const inStock = prod.in_stock && prod.stock_available > 0
                const costUsd = Number(prod.price_usd || 0)
                const retailPrice = Number(prod.retail_price_usd || (costUsd * 1.30))
                const resellerPrice = Number(prod.reseller_price_usd || (costUsd * 1.15))
                const retailProfit = (retailPrice - costUsd).toFixed(2)
                const resellerProfit = (resellerPrice - costUsd).toFixed(2)

                return (
                  <div
                    key={prod.id}
                    className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-lg ${
                      isHidden
                        ? 'bg-slate-900/40 border-white/5 opacity-70'
                        : inStock
                          ? 'bg-slate-900/80 border-white/10 hover:border-blue-500/40'
                          : 'bg-slate-900/60 border-white/10'
                    }`}
                  >
                    <div>
                      {/* Cabecera Tarjeta: Portada + Título + Badges */}
                      <div className="p-4 flex items-start gap-3 border-b border-white/5">
                        <div className="relative h-16 w-16 rounded-2xl overflow-hidden bg-black/50 border border-white/10 shrink-0 flex items-center justify-center">
                          {prod.final_image_url ? (
                            <img
                              src={prod.final_image_url}
                              alt={prod.final_name}
                              className="h-full w-full object-cover"
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          ) : (
                            <Tv className="h-7 w-7 text-white/25" />
                          )}
                          {prod.badge && (
                            <span className="absolute bottom-0 inset-x-0 bg-red-600 text-[8px] font-black uppercase tracking-wider text-center text-white py-0.2">
                              PROMO
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider truncate">
                              {prod.category || 'Streaming'}
                            </span>
                            <span className="text-[10px] font-mono text-white/40 shrink-0">
                              {prod.duration_days || 30} días
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-white truncate mt-0.5" title={prod.final_name}>
                            {prod.final_name}
                          </h3>

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {/* Stock Badge */}
                            {inStock ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                <Check className="h-2.5 w-2.5" /> Stock: {prod.stock_available}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                                Sin Stock
                              </span>
                            )}

                            {/* Visibilidad Badge */}
                            {isHidden ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                <EyeOff className="h-2.5 w-2.5" /> Oculto
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/60 bg-white/5 px-2 py-0.5 rounded-md">
                                <Eye className="h-2.5 w-2.5" /> Visible
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detalles Financieros: Coste vs Venta */}
                      <div className="p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-white/50 text-[11px]">
                          <span>Coste Proveedor:</span>
                          <span className="font-mono font-bold text-white">
                            ${costUsd.toFixed(2)} USD <span className="text-[10px] text-white/40">(${prod.price_cop || 0} COP)</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-emerald-300 font-semibold">Precio Cliente Final:</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-400 text-xs">
                              ${retailPrice.toFixed(2)} USD
                            </span>
                            <span className="block text-[9px] text-emerald-400/70">
                              +${retailProfit} ganancia
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-black/30 border border-white/5">
                          <span className="text-indigo-300 font-semibold">Precio Revendedor (B2B):</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-indigo-400 text-xs">
                              ${resellerPrice.toFixed(2)} USD
                            </span>
                            <span className="block text-[9px] text-indigo-400/70">
                              +${resellerProfit} margen
                            </span>
                          </div>
                        </div>

                        {prod.final_description && (
                          <p className="text-[11px] text-white/50 line-clamp-2 mt-2 leading-relaxed italic">
                            "{prod.final_description.replace(/\n/g, ' ')}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer de Tarjeta: Acciones */}
                    <div className="p-3 bg-black/50 border-t border-white/5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => quickToggleVisibility(prod)}
                        title={isHidden ? 'Hacer visible en tienda' : 'Ocultar de tienda'}
                        className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          isHidden
                            ? 'text-amber-400 hover:bg-amber-500/10'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        <span className="text-[10px]">{isHidden ? 'Mostrar' : 'Ocultar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(prod)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 border border-blue-500/30 text-white text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-blue-300" /> Ajustar Producto
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── 4. CONTENIDO: HISTORIAL DE COMPRAS ─── */}
      {activeTab === 'orders' && (
        <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" /> Órdenes & Credenciales Despachadas
            </h2>
            <span className="text-xs text-white/50 font-mono">
              Total registradas: {orders.length}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-white/40 text-xs">
              Aún no hay compras de cuentas de streaming registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-black/40 text-[10px] font-bold uppercase tracking-wider text-white/40 border-b border-white/10">
                  <tr>
                    <th className="p-3">ID Francho / SZ</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Servicio</th>
                    <th className="p-3">Coste / Venta</th>
                    <th className="p-3">Credenciales Entregadas</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {orders.map(o => {
                    let creds = []
                    try {
                      creds = JSON.parse(o.credentials_json || '[]')
                    } catch {
                      creds = []
                    }

                    return (
                      <tr key={o.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-semibold text-white">
                          <div>{o.streamzone_order_id || `#${o.id}`}</div>
                        </td>
                        <td className="p-3 text-white/70">
                          {o.username ? `@${o.username}` : `ID ${o.user_id}`}
                        </td>
                        <td className="p-3 text-white font-sans font-bold">
                          {o.product_name}
                        </td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-bold">${Number(o.sell_price_usd || 0).toFixed(2)}</span>
                          <span className="block text-[10px] text-white/40 font-normal">coste: ${Number(o.cost_price_usd || 0).toFixed(2)}</span>
                        </td>
                        <td className="p-3 font-sans">
                          {creds.length > 0 ? (
                            <div className="space-y-1">
                              {creds.map((c, i) => (
                                <div key={i} className="p-2 rounded bg-black/40 border border-white/10 text-[11px] font-mono">
                                  <div className="text-blue-300 font-bold">{c.email}</div>
                                  <div className="text-white/80">Clave: {c.password}</div>
                                  {c.profile && <div className="text-white/60">Perfil: {c.profile} {c.pin ? `(PIN: ${c.pin})` : ''}</div>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-white/30 text-[11px] italic">Sin credenciales</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-white/40 text-[10px]">
                          {o.created_at ? new Date(o.created_at * 1000).toLocaleString() : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DE EDICIÓN DEL PRODUCTO ─── */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0f172a] border border-slate-700 shadow-2xl p-6 text-white space-y-5">
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    src={editForm.custom_image_url || editingProduct.image_url}
                    alt={editingProduct.name}
                    className="h-full w-full object-cover"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Ajustar: {editingProduct.name}
                  </h3>
                  <p className="text-xs text-white/50">
                    Coste del proveedor: ${Number(editingProduct.price_usd).toFixed(2)} USD ({editingProduct.price_cop} COP)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario */}
            <div className="space-y-4 text-xs">
              {/* Sección Precios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-black/30 border border-white/5">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                    Precio Cliente Final (USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.retail_price_usd}
                      onChange={e => setEditForm(prev => ({ ...prev, retail_price_usd: e.target.value }))}
                      placeholder="Ej: 3.99"
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-white/40 mt-1 block">
                    Ganancia aprox: ${(Number(editForm.retail_price_usd || 0) - Number(editingProduct.price_usd || 0)).toFixed(2)} USD
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-400 mb-1">
                    Precio Revendedores B2B (USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.reseller_price_usd}
                      onChange={e => setEditForm(prev => ({ ...prev, reseller_price_usd: e.target.value }))}
                      placeholder="Ej: 3.20"
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <span className="text-[10px] text-white/40 mt-1 block">
                    Margen B2B: ${(Number(editForm.reseller_price_usd || 0) - Number(editingProduct.price_usd || 0)).toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Visibilidad & Destacado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="font-bold text-white text-[11px]">Visibilidad en Tienda & API</p>
                    <p className="text-[10px] text-white/40">Ocultar o mostrar a clientes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, is_hidden: prev.is_hidden ? 0 : 1 }))}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition ${
                      editForm.is_hidden
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {editForm.is_hidden ? 'Oculto' : 'Visible'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="font-bold text-white text-[11px]">Producto Destacado</p>
                    <p className="text-[10px] text-white/40">Mostrar en primeros lugares</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, is_featured: prev.is_featured ? 0 : 1 }))}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition ${
                      editForm.is_featured
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/10 text-white/50 border border-white/10'
                    }`}
                  >
                    {editForm.is_featured ? 'Destacado ★' : 'Normal'}
                  </button>
                </div>
              </div>

              {/* Nombre Personalizado */}
              <div>
                <label className="block text-[11px] font-bold text-white/70 mb-1">
                  Nombre Personalizado (Opcional)
                </label>
                <input
                  type="text"
                  value={editForm.custom_name}
                  onChange={e => setEditForm(prev => ({ ...prev, custom_name: e.target.value }))}
                  placeholder={`Por defecto: ${editingProduct.name}`}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Imagen Personalizada */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-white/70">
                    URL de Imagen o Portada (Opcional)
                  </label>
                  {editingProduct.image_url && (
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, custom_image_url: editingProduct.image_url }))}
                      className="text-[10px] text-blue-400 hover:underline"
                    >
                      Usar portada oficial de Cloudinary
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={editForm.custom_image_url}
                  onChange={e => setEditForm(prev => ({ ...prev, custom_image_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Descripción & Textos */}
              <div>
                <label className="block text-[11px] font-bold text-white/70 mb-1">
                  Descripción & Textos Explicativos
                </label>
                <textarea
                  rows={3}
                  value={editForm.custom_description}
                  onChange={e => setEditForm(prev => ({ ...prev, custom_description: e.target.value }))}
                  placeholder="Instrucciones para el cliente..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Términos & Condiciones */}
              <div>
                <label className="block text-[11px] font-bold text-white/70 mb-1">
                  Términos y Condiciones / Reglas de Garantía
                </label>
                <textarea
                  rows={4}
                  value={editForm.custom_terms}
                  onChange={e => setEditForm(prev => ({ ...prev, custom_terms: e.target.value }))}
                  placeholder="Términos específicos para este servicio..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white leading-relaxed font-mono text-[11px] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminStreamingPanel
