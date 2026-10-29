import { useState, useEffect, useMemo } from 'react'
import {
  Boxes, Package, Plus, Edit3, Trash2, Search, Check, X,
  ChevronDown, ChevronRight, ChevronLeft, Sparkles, ShieldCheck, ShieldAlert, Layers,
  Loader2, Tag, DollarSign, Info, AlertTriangle, ArrowRight, ArrowLeft, Eye, EyeOff,
  Store, Clock, Star, Award, Zap, ExternalLink, Shield, BadgeCheck,
  Bot, Film, Headphones, Gamepad2, Gift, Coins, Lock, Moon
} from 'lucide-react'
import { api } from './api/client'
import AdminAiConfigPanel from './AdminAiConfigPanel'

export { AdminAiConfigPanel }

export function getMasterCatalogIcon(item, className = "h-5 w-5") {
  const name = ((item?.name || '') + ' ' + (item?.slug || '')).toLowerCase()
  if (name.includes('ia') || name.includes('ai') || name.includes('inteligencia') || name.includes('chatgpt') || name.includes('claude') || name.includes('gemini') || name.includes('grok') || name.includes('software')) {
    return <Bot className={className} />
  }
  if (name.includes('stream') || name.includes('svod') || name.includes('netflix') || name.includes('disney') || name.includes('max') || name.includes('prime') || name.includes('cine') || name.includes('pelicula')) {
    return <Film className={className} />
  }
  if (name.includes('music') || name.includes('música') || name.includes('spotify') || name.includes('apple music')) {
    return <Headphones className={className} />
  }
  if (name.includes('recarga') || name.includes('topup') || name.includes('diamante') || name.includes('direct') || name.includes('puntos')) {
    return <Zap className={className} />
  }
  if (name.includes('gift') || name.includes('tarjeta') || name.includes('card')) {
    return <Gift className={className} />
  }
  if (name.includes('cuenta') || name.includes('account') || name.includes('juego') || name.includes('game') || name.includes('steam') || name.includes('roblox') || name.includes('free fire')) {
    return <Gamepad2 className={className} />
  }
  if (name.includes('objeto') || name.includes('item') || name.includes('pase') || name.includes('skin')) {
    return <ShieldCheck className={className} />
  }
  if (name.includes('moneda') || name.includes('coin') || name.includes('gold') || name.includes('oro')) {
    return <Coins className={className} />
  }
  if (name.includes('market') || name.includes('tienda')) {
    return <Store className={className} />
  }
  return <Boxes className={className} />
}

// ════════════════════════════════════════════════════════════════
//   TEXTO OFICIAL DE AVISO DE RIESGO DE CUENTAS (ESTILO GAMSGO)
// ════════════════════════════════════════════════════════════════
export const GAMSGO_SHARED_ACCOUNT_WARNING =
  "Las cuentas compartidas son utilizadas por varias personas, lo que puede ocasionar restricciones de uso. " +
  "Recientemente, las políticas de estos servicios han sido ajustadas y los controles de riesgo son más estrictos. " +
  "Se recomienda leer cuidadosamente la descripción del producto y la garantía posventa antes de comprar, " +
  "y priorizar planes de menor duración con mayor cobertura."

// ════════════════════════════════════════════════════════════════
//   PANEL DE ADMINISTRACIÓN: CATÁLOGO MAESTRO (CRUD COMPLETO)
// ════════════════════════════════════════════════════════════════

export function AdminMasterCatalogPanel({ initialSubtab = 'catalog' } = {}) {
  const [activeMainTab, setActiveMainTab] = useState(initialSubtab || 'catalog')
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedCat, setExpandedCat] = useState({})
  const [expandedSub, setExpandedSub] = useState({})
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)

  // Modales
  const [catModal, setCatModal] = useState(null)
  const [subModal, setSubModal] = useState(null)
  const [pkgModal, setPkgModal] = useState(null)

  async function loadCatalog() {
    setLoading(true)
    setErr(null)
    try {
      const data = await api.adminMasterCatalogAll()
      setTree(data || [])
      if (data && data.length > 0) {
        setExpandedCat(prev => ({ ...prev, [data[0].id]: true }))
        if (data[0].subcategories && data[0].subcategories.length > 0) {
          setExpandedSub(prev => ({ ...prev, [data[0].subcategories[0].id]: true }))
        }
      }
    } catch (e) {
      setErr(e.message || 'Error cargando catálogo maestro')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCatalog()
  }, [])

  const filteredTree = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return tree
    return tree.map(cat => {
      const catMatch = cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q)
      const matchingSubs = (cat.subcategories || []).filter(sub => {
        const subMatch = sub.name.toLowerCase().includes(q) || (sub.badge_text || '').toLowerCase().includes(q)
        const matchingPkgs = (sub.packages || []).filter(p => p.name.toLowerCase().includes(q))
        return subMatch || matchingPkgs.length > 0
      })
      if (catMatch || matchingSubs.length > 0) {
        return {
          ...cat,
          subcategories: matchingSubs.length > 0 ? matchingSubs : cat.subcategories
        }
      }
      return null
    }).filter(Boolean)
  }, [tree, search])

  // Handlers CRUD
  async function handleDeleteCat(id, name) {
    if (!confirm(`¿Eliminar la categoría "${name}" y todos sus servicios asociados?`)) return
    try {
      await api.adminDeleteMasterCategory(id)
      setMsg(`Categoría "${name}" eliminada`)
      loadCatalog()
    } catch (e) { setErr(e.message) }
  }

  async function handleDeleteSub(id, name) {
    if (!confirm(`¿Eliminar el servicio "${name}" y sus paquetes?`)) return
    try {
      await api.adminDeleteMasterSubcategory(id)
      setMsg(`Servicio "${name}" eliminado`)
      loadCatalog()
    } catch (e) { setErr(e.message) }
  }

  async function handleDeletePkg(id, name) {
    if (!confirm(`¿Eliminar el paquete "${name}"?`)) return
    try {
      await api.adminDeleteMasterPackage(id)
      setMsg(`Paquete "${name}" eliminado`)
      loadCatalog()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Pestañas Superiores: Catálogo Maestro vs Proveedores IA */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveMainTab('catalog')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeMainTab === 'catalog'
              ? 'bg-accent text-black shadow-md shadow-accent/20'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Boxes className="h-4 w-4" /> Catálogo Maestro Estandarizado
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('ai')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeMainTab === 'ai'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bot className="h-4 w-4" /> Proveedores de IA & Gateway
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-black">
            vibi.top + Gemini
          </span>
        </button>
      </div>

      {activeMainTab === 'ai' ? (
        <AdminAiConfigPanel />
      ) : (
        <>
          {/* Header */}
          <div className="card p-5 sm:p-6 rounded-3xl bg-card border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-2xl bg-accent/20 text-accent">
              <Boxes className="h-6 w-6" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Catálogo Maestro Estandarizado
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-white/60">
            Define la taxonomía oficial de suscripciones de IA, streaming y juegos para que todos los vendedores publiquen fichas homogéneas.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCatModal({ mode: 'create', data: { sort_order: tree.length + 1, is_active: true } })}
            className="px-4 py-2.5 rounded-2xl bg-accent text-black font-bold text-xs sm:text-sm hover:bg-accent/90 transition shadow-lg shadow-accent/20 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Categoría Principal
          </button>
        </div>
      </div>

      {err && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <span>{err}</span>
        </div>
      )}
      {msg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-3">
          <Check className="h-5 w-5 flex-shrink-0 text-emerald-400" />
          <span>{msg}</span>
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar categorías, servicios (ej: ChatGPT, Claude, Netflix) o paquetes..."
          className="w-full bg-card border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-white placeholder:text-white/40 outline-none focus:border-accent transition"
        />
      </div>

      {loading ? (
        <div className="p-12 text-center text-white/40 flex items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span>Cargando catálogo maestro...</span>
        </div>
      ) : filteredTree.length === 0 ? (
        <div className="card p-12 text-center text-white/40">
          No se encontraron categorías ni servicios con ese término de búsqueda.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTree.map(cat => {
            const isCatExpanded = expandedCat[cat.id] ?? false
            const subCount = cat.subcategories?.length || 0
            const pkgCount = (cat.subcategories || []).reduce((acc, s) => acc + (s.packages?.length || 0), 0)

            return (
              <div key={cat.id} className="card rounded-3xl border border-white/10 overflow-hidden bg-card/80 shadow-md">
                {/* Categoría Header */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-white/5 border-b border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setExpandedCat(prev => ({ ...prev, [cat.id]: !isCatExpanded }))}
                      className="p-1.5 rounded-xl hover:bg-white/10 text-white/60 transition"
                    >
                      {isCatExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center flex-shrink-0">
                      {getMasterCatalogIcon(cat, "h-5 w-5")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-white truncate">
                          {cat.name}
                        </h3>
                        {!cat.is_active && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 truncate">
                        slug: <code className="text-accent">{cat.slug}</code> · {subCount} servicios · {pkgCount} paquetes
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setSubModal({ mode: 'create', categoryId: cat.id, data: { category_id: cat.id, is_active: true } })}
                      className="p-2 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-xs font-bold transition flex items-center gap-1"
                      title="Añadir Servicio a esta categoría"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Servicio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatModal({ mode: 'edit', id: cat.id, data: cat })}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition"
                      title="Editar Categoría"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCat(cat.id, cat.name)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                      title="Eliminar Categoría"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subcategorías / Servicios */}
                {isCatExpanded && (
                  <div className="p-3 sm:p-5 space-y-3 bg-black/20">
                    {subCount === 0 ? (
                      <div className="p-6 text-center text-xs text-white/40">
                        No hay servicios en esta categoría todavía.
                      </div>
                    ) : (
                      cat.subcategories.map(sub => {
                        const isSubExpanded = expandedSub[sub.id] ?? false
                        const pCount = sub.packages?.length || 0

                        return (
                          <div key={sub.id} className="rounded-2xl border border-white/5 bg-card/60 overflow-hidden">
                            {/* Servicio Header */}
                            <div className="p-3 sm:p-4 flex items-center justify-between gap-3 bg-white/5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setExpandedSub(prev => ({ ...prev, [sub.id]: !isSubExpanded }))}
                                  className="p-1 rounded-lg hover:bg-white/10 text-white/50 transition"
                                >
                                  {isSubExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                                {sub.icon_url ? (
                                  <img src={sub.icon_url} alt="" className="h-6 w-6 rounded-lg object-contain bg-black/30 p-0.5" />
                                ) : (
                                  <div className="w-6 h-6 rounded-lg bg-white/10 text-white/70 flex items-center justify-center flex-shrink-0">
                                    {getMasterCatalogIcon(sub, "h-3.5 w-3.5")}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-white truncate">{sub.name}</h4>
                                    {sub.badge_text && (
                                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-accent/20 text-accent font-bold">
                                        {sub.badge_text}
                                      </span>
                                    )}
                                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/10 text-white/60 font-mono">
                                      {sub.delivery_type}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-white/40 truncate">
                                    {pCount} paquetes oficiales definidos
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPkgModal({ mode: 'create', subcategoryId: sub.id, data: { subcategory_id: sub.id, delivery_type: sub.delivery_type || 'account', is_active: true } })}
                                  className="p-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-[11px] font-bold transition flex items-center gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span className="hidden sm:inline">Paquete</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSubModal({ mode: 'edit', id: sub.id, data: sub })}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSub(sub.id, sub.name)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {/* Paquetes del Servicio */}
                            {isSubExpanded && (
                              <div className="p-3 space-y-2 border-t border-white/5 bg-black/30">
                                {pCount === 0 ? (
                                  <div className="p-4 text-center text-xs text-white/40">
                                    No hay paquetes predefinidos en este servicio.
                                  </div>
                                ) : (
                                  sub.packages.map(pkg => (
                                    <div
                                      key={pkg.id}
                                      className="p-3 rounded-xl bg-card border border-white/5 flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-extrabold text-white text-sm">{pkg.name}</span>
                                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                                            {pkg.delivery_type}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5">{pkg.description}</p>
                                        <div className="flex items-center gap-3 text-[10px] text-white/40 mt-1">
                                          <span>Garantía: <strong className="text-white/70">{pkg.account_warranty}</strong></span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                          <span className="text-[10px] text-white/40 block">Sugerido</span>
                                          <span className="font-mono font-bold text-accent text-sm">
                                            ${Number(pkg.suggested_price || 0).toFixed(2)} USDT
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setPkgModal({ mode: 'edit', id: pkg.id, data: pkg })}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition"
                                          >
                                            <Edit3 className="h-3 w-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePkg(pkg.id, pkg.name)}
                                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Categoría */}
      {catModal && (
        <CategoryEditModal
          modal={catModal}
          onClose={() => setCatModal(null)}
          onSaved={() => { setCatModal(null); loadCatalog(); setMsg('Categoría guardada') }}
        />
      )}

      {/* Modal Subcategoría */}
      {subModal && (
        <SubcategoryEditModal
          modal={subModal}
          categories={tree}
          onClose={() => setSubModal(null)}
          onSaved={() => { setSubModal(null); loadCatalog(); setMsg('Servicio guardado') }}
        />
      )}

      {/* Modal Paquete */}
      {pkgModal && (
        <PackageEditModal
          modal={pkgModal}
          onClose={() => setPkgModal(null)}
          onSaved={() => { setPkgModal(null); loadCatalog(); setMsg('Paquete guardado') }}
        />
      )}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//   WIZARD PASO A PASO: PLANTILLAS OFICIALES (VENDEDORES & ADMIN)
// ════════════════════════════════════════════════════════════════

export function MasterCatalogTemplateModal({ onSelectTemplate, onClose }) {
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)

  // Pasos: 1 = Categoría, 2 = Servicio, 3 = Paquete, 4 = Personalización de Oferta
  const [step, setStep] = useState(1)

  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [selectedPkg, setSelectedPkg] = useState(null)

  // Filtros de búsqueda
  const [catSearch, setCatSearch] = useState('')
  const [subSearch, setSubSearch] = useState('')

  // Permisos de categoría estilo GamsGo
  const [approvedPerms, setApprovedPerms] = useState([])
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [permNoticeCat, setPermNoticeCat] = useState(null)

  useEffect(() => {
    api.sellerCategoryPermissions()
      .then(res => {
        setApprovedPerms(res?.permissions || [])
        setIsAdminUser(Boolean(res?.is_admin))
      })
      .catch(() => {})
  }, [])

  // Campos editables del Paso 4 (Personalización de la Oferta)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customDeliveryTime, setCustomDeliveryTime] = useState('Instante')
  const [customAccountType, setCustomAccountType] = useState('Cuenta Privada')
  const [customWarranty, setCustomWarranty] = useState('30 días garantía posventa')
  const [customDescription, setCustomDescription] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')

  useEffect(() => {
    api.masterCatalogTree()
      .then(data => {
        setTree(data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Filtrado de categorías en Paso 1
  const filteredCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase()
    if (!q) return tree
    return tree.filter(cat => {
      const matchCat = cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q)
      const matchSub = (cat.subcategories || []).some(s => s.name.toLowerCase().includes(q))
      return matchCat || matchSub
    })
  }, [tree, catSearch])

  // Filtrado de servicios en Paso 2
  const filteredServices = useMemo(() => {
    if (!selectedCat) return []
    const q = subSearch.trim().toLowerCase()
    const subs = selectedCat.subcategories || []
    if (!q) return subs
    return subs.filter(s => s.name.toLowerCase().includes(q) || (s.badge_text || '').toLowerCase().includes(q))
  }, [selectedCat, subSearch])

  // Selección de paquete -> Pasa al Paso 4 para personalizar
  function handleSelectPackage(pkg) {
    setSelectedPkg(pkg)
    setCustomName(pkg.name || '')
    setCustomPrice(String(pkg.suggested_price || ''))
    setCustomDeliveryTime(
      pkg.delivery_type === 'digital_stock' ? 'Instante' :
      pkg.delivery_type === 'id_topup' ? '5 - 15 minutos' :
      'Instante'
    )
    setCustomAccountType(
      pkg.name.toLowerCase().includes('compartida') || pkg.name.toLowerCase().includes('slot') ? 'Cuenta Compartida / Slot' :
      pkg.delivery_type === 'id_topup' ? 'Recarga Directa por ID' :
      pkg.delivery_type === 'key' ? 'Clave / Licencia Digital' :
      'Cuenta Privada 100%'
    )
    setCustomWarranty(pkg.account_warranty || '30 días garantía posventa')
    setCustomDescription(pkg.description || selectedSub?.description || '')
    setCustomInstructions(pkg.default_instructions || 'Tus datos de acceso o recarga se gestionan de forma segura por el pedido.')
    setStep(4)
  }

  // Confirmar y aplicar al producto
  function handleConfirmOffer() {
    if (!selectedPkg || !selectedSub) return
    const catSlug = String(selectedCat?.slug || '').toLowerCase()
    const pkgDelType = String(selectedPkg.delivery_type || selectedSub.delivery_type || 'account').toLowerCase()

    let derivedCategory = 'service'
    if (['ia-software', 'ai', 'streaming', 'svod-streaming', 'musica', 'svod'].includes(catSlug)) {
      derivedCategory = 'subscription'
    } else if (['recargas-juegos', 'juegos-recargas', 'recargas', 'juegos-monedas', 'monedas'].includes(catSlug) || pkgDelType === 'id_topup') {
      derivedCategory = 'topup'
    } else if (['juegos-cuentas', 'cuentas'].includes(catSlug) || pkgDelType === 'game_account') {
      derivedCategory = 'game_account'
    } else if (['giftcards', 'tarjetas-regalo'].includes(catSlug)) {
      derivedCategory = 'card'
    } else if (['software', 'marketplace'].includes(catSlug)) {
      derivedCategory = 'service'
    } else if (pkgDelType === 'key' || pkgDelType === 'code') {
      derivedCategory = 'code'
    }

    onSelectTemplate({
      name: customName,
      description: customDescription,
      category: derivedCategory,
      category_slug: catSlug,
      suggested_price: parseFloat(customPrice) || selectedPkg.suggested_price || 0,
      delivery_type: selectedPkg.delivery_type || selectedSub.delivery_type || 'account',
      delivery_time: customDeliveryTime,
      instructions: customInstructions,
      account_warranty: customWarranty,
      account_game: selectedSub.name,
      account_platform: 'Multiplataforma',
      account_region: 'Global',
      icon_url: selectedSub.icon_url || '',
      category_id: selectedCat?.id,
      subcategory_id: selectedSub?.id,
      package_id: selectedPkg?.id
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-bg border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-left">
        {/* Header con indicador de pasos */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-card/70 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-accent/20 text-accent">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-black text-base sm:text-lg text-white">
                  Plantillas Oficiales del Catálogo Maestro
                </h3>
                <p className="text-xs text-white/60">
                  Selección guiada paso a paso: Categoría › Servicio › Paquete › Personalización
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 text-white/60 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] sm:text-xs font-bold pt-1">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`p-2 rounded-xl border transition flex items-center justify-center gap-1 ${
                step === 1 ? 'bg-accent text-black border-accent shadow-sm' : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
              }`}
            >
              <span>1. Categoría</span>
            </button>
            <button
              type="button"
              onClick={() => selectedCat && setStep(2)}
              disabled={!selectedCat}
              className={`p-2 rounded-xl border transition flex items-center justify-center gap-1 ${
                step === 2 ? 'bg-accent text-black border-accent shadow-sm' : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 disabled:opacity-40'
              }`}
            >
              <span>2. Servicio</span>
            </button>
            <button
              type="button"
              onClick={() => selectedSub && setStep(3)}
              disabled={!selectedSub}
              className={`p-2 rounded-xl border transition flex items-center justify-center gap-1 ${
                step === 3 ? 'bg-accent text-black border-accent shadow-sm' : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 disabled:opacity-40'
              }`}
            >
              <span>3. Paquete</span>
            </button>
            <button
              type="button"
              onClick={() => selectedPkg && setStep(4)}
              disabled={!selectedPkg}
              className={`p-2 rounded-xl border transition flex items-center justify-center gap-1 ${
                step === 4 ? 'bg-accent text-black border-accent shadow-sm' : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 disabled:opacity-40'
              }`}
            >
              <span>4. Tu Oferta</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-white/50">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-xs">Cargando catálogo maestro estandarizado...</p>
            </div>
          ) : (
            <>
              {/* ──────────────────────────────────────────────────────────
                  PASO 1: SELECCIONAR CATEGORÍA PRINCIPAL
                  ────────────────────────────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white">
                        Paso 1: Elige la categoría principal
                      </h4>
                      <p className="text-xs text-white/50">
                        Selecciona el tipo de producto que vas a publicar en tu tienda
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                      <input
                        value={catSearch}
                        onChange={e => setCatSearch(e.target.value)}
                        placeholder="Buscar categoría o servicio..."
                        className="w-full bg-card border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Banner Informativo de Progresión de Categorías para Vendedores */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-accent/10 via-purple-500/10 to-transparent border border-accent/25 flex items-start gap-3 text-xs leading-relaxed">
                    <div className="p-1.5 rounded-xl bg-accent/20 text-accent flex-shrink-0 mt-0.5">
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Categorías y Niveles de Vendedor</span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                          Progresión Oficial
                        </span>
                      </p>
                      <p className="text-white/65 text-[11px]">
                        Los vendedores nuevos (Nivel 1) inician con <strong>Recargas de Juegos (UID)</strong>. Las cuentas de <strong>Streaming privadas e Inteligencia Artificial</strong> requieren Nivel 2 (5+ ventas completadas con buena calificación).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredCategories.map(cat => {
                      const count = (cat.subcategories || []).length
                      const catNameLower = (cat.name + ' ' + (cat.slug || '')).toLowerCase()
                      const isJuegos = catNameLower.includes('juego') || catNameLower.includes('game')
                      const isStreaming = catNameLower.includes('stream') || catNameLower.includes('svod') || catNameLower.includes('suscrip')
                      const isAI = catNameLower.includes('ia') || catNameLower.includes('ai') || catNameLower.includes('inteligen')
                      const isSoftware = catNameLower.includes('soft') || catNameLower.includes('licenc') || catNameLower.includes('key')

                      const tierBadge = isJuegos
                        ? { text: 'Nivel 1 · Abierto', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
                        : (isStreaming || isAI)
                        ? { text: 'Nivel 2 · Verificado', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' }
                        : isSoftware
                        ? { text: 'Nivel 3 · Top Seller', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
                        : { text: `${count} servicios`, color: 'bg-white/5 text-white/60 border-white/10' }

                      const hasPermission = isAdminUser || approvedPerms.includes(cat.slug) || (cat.slug.includes('recargas') && approvedPerms.includes('recargas')) || approvedPerms.length === 0

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (!hasPermission) {
                              setPermNoticeCat(cat)
                              return
                            }
                            setSelectedCat(cat)
                            setSelectedSub(null)
                            setSelectedPkg(null)
                            setStep(2)
                          }}
                          className="group p-4 rounded-2xl bg-card hover:bg-accent/10 border border-white/10 hover:border-accent/50 text-left transition-all active:scale-[0.98] flex flex-col justify-between h-34 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center font-black group-hover:scale-110 group-hover:bg-accent group-hover:text-black transition-all">
                              {getMasterCatalogIcon(cat, "h-5 w-5")}
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black ${tierBadge.color}`}>
                              {tierBadge.text}
                            </span>
                          </div>
                          <div>
                            <h5 className="font-extrabold text-sm text-white group-hover:text-accent transition-colors truncate">
                              {cat.name}
                            </h5>
                            <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5">
                              {cat.description}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  PASO 2: SELECCIONAR SERVICIO O PLATAFORMA
                  ────────────────────────────────────────────────────────── */}
              {step === 2 && selectedCat && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-accent font-bold hover:underline flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      ‹ Cambiar categoría ({selectedCat.name})
                    </button>
                    <span className="text-xs text-white/50">
                      {filteredServices.length} servicios disponibles
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-accent/20 text-accent inline-flex items-center justify-center">
                          {getMasterCatalogIcon(selectedCat, "h-4 w-4")}
                        </span>
                        <span>Paso 2: Selecciona el servicio o plataforma</span>
                      </h4>
                      <p className="text-xs text-white/50">
                        {selectedCat.description}
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                      <input
                        value={subSearch}
                        onChange={e => setSubSearch(e.target.value)}
                        placeholder={`Buscar en ${selectedCat.name}...`}
                        className="w-full bg-card border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {filteredServices.map(sub => {
                      const pCount = (sub.packages || []).length
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSelectedSub(sub)
                            setSelectedPkg(null)
                            setStep(3)
                          }}
                          className="group p-3.5 rounded-2xl bg-card hover:bg-accent/10 border border-white/10 hover:border-accent/50 text-left transition-all active:scale-[0.98] flex flex-col justify-between h-28 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            {sub.icon_url ? (
                              <img src={sub.icon_url} alt="" className="h-7 w-7 rounded-lg object-contain bg-black/20 p-0.5" />
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-white/10 text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-black transition-colors">
                                {getMasterCatalogIcon(sub, "h-4 w-4")}
                              </div>
                            )}
                            {sub.badge_text && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent font-black uppercase">
                                {sub.badge_text}
                              </span>
                            )}
                          </div>
                          <div>
                            <h5 className="font-extrabold text-xs sm:text-sm text-white group-hover:text-accent transition-colors truncate">
                              {sub.name}
                            </h5>
                            <span className="text-[10px] text-white/40 block mt-0.5">
                              {pCount} planes oficiales
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  PASO 3: SELECCIONAR PAQUETE OFICIAL
                  ────────────────────────────────────────────────────────── */}
              {step === 3 && selectedSub && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs text-accent font-bold hover:underline flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      ‹ Cambiar servicio ({selectedSub.name})
                    </button>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/60 font-mono">
                      Entrega: {selectedSub.delivery_type}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white">
                      Paso 3: Elige la edición o paquete estándar
                    </h4>
                    <p className="text-xs text-white/50">
                      Selecciona la opción base; luego podrás ajustar tu propio precio y tiempo de entrega.
                    </p>
                  </div>

                  {(!selectedSub.packages || selectedSub.packages.length === 0) ? (
                    <div className="p-8 text-center text-xs text-white/40">
                      No hay paquetes oficiales precargados en este servicio.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedSub.packages.map(pkg => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handleSelectPackage(pkg)}
                          className="w-full group p-4 rounded-2xl border border-white/10 hover:border-accent/60 bg-card hover:bg-accent/5 transition-all flex items-center justify-between gap-3 text-left active:scale-[0.99] shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm sm:text-base text-white group-hover:text-accent transition-colors">
                                {pkg.name}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/70 font-mono">
                                {pkg.delivery_type}
                              </span>
                            </div>
                            <p className="text-xs text-white/60 line-clamp-2 mt-1">
                              {pkg.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-white/50">
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                                {pkg.account_warranty}
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-[10px] text-white/40 block font-medium">Sugerido</span>
                            <span className="text-base sm:text-lg font-black text-accent font-mono">
                              ${Number(pkg.suggested_price || 0).toFixed(2)}
                            </span>
                            <span className="mt-1 flex items-center justify-end gap-1 text-[11px] font-bold text-accent group-hover:translate-x-0.5 transition-transform">
                              Elegir <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  PASO 4: PERSONALIZAR OFERTA PARA TU TIENDA
                  ────────────────────────────────────────────────────────── */}
              {step === 4 && selectedPkg && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-xs text-accent font-bold hover:underline flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      ‹ Cambiar paquete ({selectedPkg.name})
                    </button>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> Plantilla vinculada
                    </span>
                  </div>

                  {/* Resumen del paquete base */}
                  <div className="p-4 rounded-2xl bg-accent/10 border border-accent/25 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-white">
                        {selectedPkg.name}
                      </h4>
                      <p className="text-xs text-white/60 line-clamp-1 mt-0.5">
                        Categoría: <strong>{selectedCat?.name}</strong> › Servicio: <strong>{selectedSub?.name}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Formulario de personalización */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-white/70 mb-1">
                        Nombre de la Oferta en tu Tienda *
                      </label>
                      <input
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        className="w-full bg-card border border-white/15 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-accent"
                        placeholder="Ej: Claude Pro 30 Días | Privado | Entrega instantánea"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-white/70 mb-1">
                          Tu Precio de Venta (USDT) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent font-bold">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={customPrice}
                            onChange={e => setCustomPrice(e.target.value)}
                            className="w-full bg-card border border-white/15 rounded-xl pl-8 pr-4 py-2.5 text-xs sm:text-sm text-white font-mono font-bold outline-none focus:border-accent"
                            placeholder="10.99"
                          />
                        </div>
                        <span className="text-[10px] text-white/40 mt-1 block">
                          Precio oficial sugerido: ${Number(selectedPkg.suggested_price || 0).toFixed(2)} USDT
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white/70 mb-1">
                          Tiempo de Entrega Garantizado *
                        </label>
                        <input
                          value={customDeliveryTime}
                          onChange={e => setCustomDeliveryTime(e.target.value)}
                          className="w-full bg-card border border-white/15 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-accent"
                          placeholder="Instante, 20 minutos, 1 hora..."
                        />
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {['Instante', '15-20 min', '1 hora', '12-24 horas'].map(pill => (
                            <button
                              key={pill}
                              type="button"
                              onClick={() => setCustomDeliveryTime(pill)}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition font-bold"
                            >
                              {pill}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-white/70 mb-1">
                          Tipo de Formato / Cuenta *
                        </label>
                        <input
                          value={customAccountType}
                          onChange={e => setCustomAccountType(e.target.value)}
                          className="w-full bg-card border border-white/15 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-accent"
                          placeholder="Cuenta Privada, Slot Compartido..."
                        />
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {['Cuenta Privada 100%', 'Cuenta Compartida / Slot', 'Activación por Correo', 'Recarga Directa'].map(pill => (
                            <button
                              key={pill}
                              type="button"
                              onClick={() => setCustomAccountType(pill)}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition"
                            >
                              {pill}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white/70 mb-1">
                          Garantía Posventa *
                        </label>
                        <input
                          value={customWarranty}
                          onChange={e => setCustomWarranty(e.target.value)}
                          className="w-full bg-card border border-white/15 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-accent"
                          placeholder="30 días garantía posventa"
                        />
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {['30 días garantía posventa', '60 días garantía total', '1 año completo', 'Garantía de por vida'].map(pill => (
                            <button
                              key={pill}
                              type="button"
                              onClick={() => setCustomWarranty(pill)}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition"
                            >
                              {pill}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-white/70 mb-1">
                        Descripción Detallada
                      </label>
                      <textarea
                        rows={3}
                        value={customDescription}
                        onChange={e => setCustomDescription(e.target.value)}
                        className="w-full bg-card border border-white/15 rounded-xl p-3 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-white/70 mb-1">
                        Instrucciones de Entrega para el Comprador
                      </label>
                      <textarea
                        rows={2}
                        value={customInstructions}
                        onChange={e => setCustomInstructions(e.target.value)}
                        className="w-full bg-card border border-white/15 rounded-xl p-3 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Botón de acción final */}
                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmOffer}
                      className="px-6 py-2.5 rounded-xl bg-accent text-black text-xs sm:text-sm font-black hover:bg-accent/90 transition shadow-lg shadow-accent/20 active:scale-95 flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Aplicar y Cargar a mi Ficha de Producto</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {/* Diálogo de Permiso de Venta Requerido (GamsGo) */}
        {permNoticeCat && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="card p-6 max-w-md w-full rounded-3xl bg-bg border border-amber-500/30 text-left space-y-4 shadow-2xl animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-base text-white">
                    Permiso de Venta Requerido
                  </h4>
                  <p className="text-xs text-amber-300 font-bold">
                    {permNoticeCat.name}
                  </p>
                </div>
              </div>

              <p className="text-xs text-white/70 leading-relaxed">
                En el marketplace de Francho Shop, la categoría <strong>{permNoticeCat.name}</strong> requiere activación previa por parte de soporte o tu <strong>Seller Manager (Ben)</strong> para garantizar la seguridad de los compradores.
              </p>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-white/60 space-y-1">
                <p className="font-bold text-white">¿Cómo activar esta categoría?</p>
                <p>Abre el chat con Ben desde el menú lateral <strong>(Mensaje › Seller Manager - Ben)</strong> y solicita la activación indicando tus juegos principales y tiempo estimado de entrega.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPermNoticeCat(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
                >
                  Entendido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPermNoticeCat(null)
                    onClose?.()
                  }}
                  className="px-4 py-2 rounded-xl bg-accent text-black text-xs font-black transition shadow-md shadow-accent/20 active:scale-95"
                >
                  Ir a Mensajes con Ben
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//   COMPARADOR DE OFERTAS MULTI-TIENDA (GAMSGO / G2A BUY BOX)
// ════════════════════════════════════════════════════════════════

function getStoreLevelInfo(levelStr = '') {
  const clean = String(levelStr || 'Verificado')
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '')
    .trim() || 'Verificado'

  const lower = clean.toLowerCase()
  if (lower.includes('oficial')) {
    return {
      label: clean,
      badgeColor: 'text-amber-400',
      pillClass: 'bg-amber-400/15 text-amber-300 border border-amber-400/30',
    }
  }
  if (lower.includes('top')) {
    return {
      label: clean,
      badgeColor: 'text-violet-400',
      pillClass: 'bg-violet-400/15 text-violet-300 border border-violet-400/30',
    }
  }
  if (lower.includes('pro')) {
    return {
      label: clean,
      badgeColor: 'text-sky-400',
      pillClass: 'bg-sky-400/15 text-sky-300 border border-sky-400/30',
    }
  }
  return {
    label: clean,
    badgeColor: 'text-emerald-400',
    pillClass: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30',
  }
}

export function MultiStoreOffersComparison({
  productId,
  searchKeyword,
  currentProductId,
  onSelectOffer,
  onOpenStore,
  sellerStore,
  currentPrice,
  selectedOption,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productId && !searchKeyword) return
    setLoading(true)
    api.catalogOffers({ product_id: productId, search: searchKeyword })
      .then(res => {
        setData(res || null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [productId, searchKeyword])

  if (loading) {
    return (
      <div className="my-4 p-4 rounded-2xl bg-card border border-white/10 flex items-center justify-center gap-2 text-xs text-white/50">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span>Consultando ofertas de tiendas en el marketplace...</span>
      </div>
    )
  }

  const rawOffers = (data && data.offers && data.offers.length > 0) ? data.offers : []
  const offers = rawOffers.length > 0 ? rawOffers : (sellerStore ? [{
    id: currentProductId || productId,
    name: searchKeyword || 'Oferta disponible',
    price: (currentPrice !== undefined && currentPrice !== null) ? Number(currentPrice) : (sellerStore.price || 0),
    delivery_time: selectedOption?.delivery_time || 'Inmediata',
    account_warranty: 'Garantía oficial',
    seller_store: sellerStore,
    is_recommended: true
  }] : [])

  if (offers.length === 0) {
    return null
  }

  return (
    <div className="my-5 space-y-3 text-left">
      {/* Encabezado comparativo */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
            <Store className="h-4 w-4 text-accent" />
            <span>Tiendas y Vendedores Disponibles ({offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'})</span>
          </h4>
          <p className="text-[11px] text-white/50">
            Compara precios, tiempo de entrega y reputación de cada vendedor verificado
          </p>
        </div>
      </div>

      {/* Listado de Ofertas Multi-Tienda */}
      <div className="space-y-2">
        {offers.map(offer => {
          const isCurrent = Number(offer.id) === Number(currentProductId || productId)
          const store = offer.seller_store || {}
          const levelInfo = getStoreLevelInfo(store.seller_level)

          // Precios, tiempos de entrega y nombres dinámicos según la opción seleccionada
          let effectivePrice = Number(offer.price || 0)
          let effectiveDelivery = offer.delivery_time || 'Inmediata'
          let effectiveName = offer.name

          if (isCurrent) {
            if (currentPrice !== undefined && currentPrice !== null) {
              effectivePrice = Number(currentPrice)
            }
            if (selectedOption?.delivery_time) {
              effectiveDelivery = selectedOption.delivery_time
            }
            if (selectedOption?.name) {
              effectiveName = `${offer.name} · ${selectedOption.name}`
            }
          } else if (selectedOption?.name && Array.isArray(offer.options) && offer.options.length > 0) {
            const optTarget = selectedOption.name.toLowerCase().trim()
            const match = offer.options.find(o => o.name && o.name.toLowerCase().trim() === optTarget) ||
                          offer.options.find(o => o.name && (optTarget.includes(o.name.toLowerCase().trim()) || o.name.toLowerCase().trim().includes(optTarget)))
            if (match) {
              effectivePrice = Number(match.price)
              if (match.delivery_time) {
                effectiveDelivery = match.delivery_time
              }
              effectiveName = `${offer.name} · ${match.name}`
            }
          }

          const rawStoreImage = (store.store_image || '').trim()
          const storeLogoSrc = rawStoreImage && !rawStoreImage.includes('undefined') && !rawStoreImage.includes('null')
            ? rawStoreImage
            : '/franchoshop-logo.png'

          return (
            <div
              key={offer.id}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isCurrent
                  ? 'bg-accent/10 border-accent/50 shadow-md ring-1 ring-accent/30'
                  : 'bg-card hover:bg-white/5 border-white/10'
              }`}
            >
              {/* Vendedor y Reputación */}
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                {/* Imagen / Avatar de la tienda (Click abre la tienda) con Badge de nivel */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    if (store.store_slug) {
                      if (onOpenStore) onOpenStore(store.store_slug)
                      else window.location.href = `/seller/${encodeURIComponent(store.store_slug)}`
                    }
                  }}
                  className={`relative flex-shrink-0 ${store.store_slug ? 'cursor-pointer group/avatar' : ''}`}
                  title={store.store_slug ? `Abrir tienda de ${store.store_name || 'vendedor'}` : ''}
                >
                  <img
                    src={storeLogoSrc}
                    alt={store.store_name || 'Tienda'}
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src = '/franchoshop-logo.png'
                    }}
                    className="w-11 h-11 rounded-xl object-cover border border-white/15 bg-black/40 group-hover/avatar:border-accent group-hover/avatar:scale-105 transition"
                  />
                  {store.verified !== false && (
                    <span
                      className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 shadow-md flex items-center justify-center ring-1 ring-white/10"
                      title={levelInfo.label}
                    >
                      <BadgeCheck className={`h-4 w-4 ${levelInfo.badgeColor}`} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (store.store_slug) {
                          if (onOpenStore) onOpenStore(store.store_slug)
                          else window.location.href = `/seller/${encodeURIComponent(store.store_slug)}`
                        }
                      }}
                      className="font-extrabold text-xs sm:text-sm text-white truncate hover:text-accent transition text-left"
                    >
                      {store.store_name || 'Vendedor'}
                    </button>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${levelInfo.pillClass}`}>
                      {levelInfo.label}
                    </span>
                    {store.ranking && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${store.ranking.badge?.border_class || 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10'}`}>
                        <span>{store.ranking.badge?.icon || '🏆'}</span>
                        <span>{store.ranking.badge?.label || `#${store.ranking.rank_position}`}</span>
                        <span className="text-accent font-black">({store.ranking.score || 100} pts)</span>
                      </span>
                    )}
                    {offer.is_recommended && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-black font-black uppercase tracking-wider">
                        Recomendado
                      </span>
                    )}
                    {offer.is_best_price && !offer.is_recommended && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black uppercase tracking-wider">
                        Mejor Precio
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-white/70 font-medium truncate mt-0.5" title={effectiveName}>
                    {effectiveName}
                  </p>

                  <div className="flex items-center gap-3 text-[10px] text-white/50 mt-1 flex-wrap">
                    {store.schedule && (
                      <span className={`inline-flex items-center gap-1 font-bold ${store.schedule.is_open_now ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {store.schedule.is_open_now ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>En línea</span>
                          </>
                        ) : (
                          <>
                            <Moon className="w-2.5 h-2.5 text-amber-400" />
                            <span>Abre {store.schedule.time_start_formatted || 'mañana'}</span>
                          </>
                        )}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {store.rating || 4.9} ({store.total_orders || 12} ventas)
                    </span>
                    {store.ranking?.on_time_rate !== undefined && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <Check className="h-3 w-3" />
                        {Number(store.ranking.on_time_rate).toFixed(0)}% a tiempo
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-accent">
                      <Clock className="h-3 w-3" />
                      {String(effectiveDelivery || '').replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '').trim() || 'Inmediata'}
                    </span>
                    {offer.account_warranty && (
                      <span className="flex items-center gap-1 text-white/50">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                        {String(offer.account_warranty).replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '').trim()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Precio y Botón de Selección */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 flex-shrink-0">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-white/40 block">Precio</span>
                  <span className="text-base sm:text-lg font-black text-accent font-mono">
                    ${effectivePrice.toFixed(2)} USDT
                  </span>
                </div>

                {isCurrent ? (
                  <span className="px-3.5 py-2 rounded-xl bg-accent/20 border border-accent/40 text-accent text-xs font-bold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>Seleccionado</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectOffer && onSelectOffer(offer, selectedOption)}
                    className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-black text-xs font-bold transition shadow-md shadow-accent/15 active:scale-95 flex items-center gap-1"
                  >
                    <span>Elegir tienda</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//   MODALES INTERNOS PARA CREAR / EDITAR CATÁLOGO MAESTRO
// ════════════════════════════════════════════════════════════════

function CategoryEditModal({ modal, onClose, onSaved }) {
  const isCreate = modal.mode === 'create'
  const [name, setName] = useState(modal.data?.name || '')
  const [slug, setSlug] = useState(modal.data?.slug || '')
  const [emoji, setEmoji] = useState(modal.data?.emoji || '')
  const [description, setDescription] = useState(modal.data?.description || '')
  const [sortOrder, setSortOrder] = useState(modal.data?.sort_order || 1)
  const [isActive, setIsActive] = useState(modal.data?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre es obligatorio'); return }
    setSaving(true)
    setErr(null)
    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      emoji: emoji.trim() || '',
      description: description.trim(),
      sort_order: parseInt(sortOrder) || 1,
      is_active: isActive
    }
    try {
      if (isCreate) {
        await api.adminCreateMasterCategory(payload)
      } else {
        await api.adminUpdateMasterCategory(modal.id, payload)
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-3xl bg-bg border border-white/15 p-6 shadow-2xl animate-slide-up text-left">
        <h3 className="text-lg font-black text-white mb-4">
          {isCreate ? 'Nueva Categoría Principal' : 'Editar Categoría'}
        </h3>
        {err && <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl mb-3">{err}</p>}
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div>
            <label className="block text-white/50 mb-1">Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Inteligencia Artificial (AI)" className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-white/50 mb-1">Slug (opcional)</label>
              <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="ai" className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-white/50 mb-1">Icono / Identificador (opcional)</label>
              <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="bot" className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white text-center text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-white/50 mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-card border border-white/10 rounded-xl p-3 text-white" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="catActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
            <label htmlFor="catActive" className="text-white/80 font-bold">Activa en el catálogo</label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-accent text-black font-black">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SubcategoryEditModal({ modal, categories, onClose, onSaved }) {
  const isCreate = modal.mode === 'create'
  const [categoryId, setCategoryId] = useState(modal.data?.category_id || modal.categoryId || (categories[0]?.id))
  const [name, setName] = useState(modal.data?.name || '')
  const [slug, setSlug] = useState(modal.data?.slug || '')
  const [badgeText, setBadgeText] = useState(modal.data?.badge_text || '')
  const [deliveryType, setDeliveryType] = useState(modal.data?.delivery_type || 'account')
  const [description, setDescription] = useState(modal.data?.description || '')
  const [iconUrl, setIconUrl] = useState(modal.data?.icon_url || '')
  const [isActive, setIsActive] = useState(modal.data?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre del servicio es obligatorio'); return }
    setSaving(true)
    setErr(null)
    const payload = {
      category_id: parseInt(categoryId),
      name: name.trim(),
      slug: slug.trim() || undefined,
      badge_text: badgeText.trim() || undefined,
      delivery_type: deliveryType,
      description: description.trim(),
      icon_url: iconUrl.trim() || undefined,
      is_active: isActive
    }
    try {
      if (isCreate) {
        await api.adminCreateMasterSubcategory(payload)
      } else {
        await api.adminUpdateMasterSubcategory(modal.id, payload)
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-3xl bg-bg border border-white/15 p-6 shadow-2xl animate-slide-up text-left">
        <h3 className="text-lg font-black text-white mb-4">
          {isCreate ? 'Nuevo Servicio / Plataforma' : 'Editar Servicio'}
        </h3>
        {err && <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl mb-3">{err}</p>}
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div>
            <label className="block text-white/50 mb-1">Categoría Padre *</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white">
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-white/50 mb-1">Nombre del Servicio *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: ChatGPT (OpenAI)" className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-white/50 mb-1">Insignia (Badge)</label>
              <input value={badgeText} onChange={e => setBadgeText(e.target.value)} placeholder="Popular, Top Ventas..." className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-white/50 mb-1">Tipo de Entrega</label>
              <select value={deliveryType} onChange={e => setDeliveryType(e.target.value)} className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white">
                <option value="account">account (Cuenta)</option>
                <option value="id_topup">id_topup (Recarga por ID)</option>
                <option value="key">key (Código / Licencia)</option>
                <option value="digital_stock">digital_stock (Stock Inmediato)</option>
                <option value="manual">manual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-white/50 mb-1">URL de Logo / Ícono</label>
            <input value={iconUrl} onChange={e => setIconUrl(e.target.value)} placeholder="https://..." className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[11px]" />
          </div>
          <div>
            <label className="block text-white/50 mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-card border border-white/10 rounded-xl p-3 text-white" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="subActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
            <label htmlFor="subActive" className="text-white/80 font-bold">Activo para la venta</label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-accent text-black font-black">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PackageEditModal({ modal, onClose, onSaved }) {
  const isCreate = modal.mode === 'create'
  const [name, setName] = useState(modal.data?.name || '')
  const [description, setDescription] = useState(modal.data?.description || '')
  const [suggestedPrice, setSuggestedPrice] = useState(modal.data?.suggested_price || '')
  const [deliveryType, setDeliveryType] = useState(modal.data?.delivery_type || 'account')
  const [accountWarranty, setAccountWarranty] = useState(modal.data?.account_warranty || '30 días garantía posventa')
  const [instructions, setInstructions] = useState(modal.data?.default_instructions || '')
  const [isActive, setIsActive] = useState(modal.data?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre del paquete es obligatorio'); return }
    setSaving(true)
    setErr(null)
    const payload = {
      subcategory_id: parseInt(modal.data?.subcategory_id || modal.subcategoryId),
      name: name.trim(),
      description: description.trim(),
      suggested_price: parseFloat(suggestedPrice) || 0.0,
      delivery_type: deliveryType,
      account_warranty: accountWarranty.trim(),
      default_instructions: instructions.trim(),
      is_active: isActive
    }
    try {
      if (isCreate) {
        await api.adminCreateMasterPackage(payload)
      } else {
        await api.adminUpdateMasterPackage(modal.id, payload)
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-3xl bg-bg border border-white/15 p-6 shadow-2xl animate-slide-up text-left">
        <h3 className="text-lg font-black text-white mb-4">
          {isCreate ? 'Nuevo Paquete Estándar' : 'Editar Paquete'}
        </h3>
        {err && <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl mb-3">{err}</p>}
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div>
            <label className="block text-white/50 mb-1">Nombre del Paquete *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: ChatGPT Plus (1 Mes - Perfil Compartido)" className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-white/50 mb-1">Precio Sugerido USDT *</label>
              <input type="number" step="0.01" value={suggestedPrice} onChange={e => setSuggestedPrice(e.target.value)} placeholder="10.00" className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white font-mono" />
            </div>
            <div>
              <label className="block text-white/50 mb-1">Tipo de Entrega</label>
              <select value={deliveryType} onChange={e => setDeliveryType(e.target.value)} className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white">
                <option value="account">account (Cuenta)</option>
                <option value="id_topup">id_topup (Recarga)</option>
                <option value="key">key (Código)</option>
                <option value="digital_stock">digital_stock</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-white/50 mb-1">Garantía Estándar</label>
            <input value={accountWarranty} onChange={e => setAccountWarranty(e.target.value)} placeholder="30 días garantía posventa" className="w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-white/50 mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-card border border-white/10 rounded-xl p-3 text-white" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="pkgActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
            <label htmlFor="pkgActive" className="text-white/80 font-bold">Activo para venta</label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-accent text-black font-black">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
