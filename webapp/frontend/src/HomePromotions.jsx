import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles, Flame, Store, Gift, Info, Plus, Edit2, Trash2,
  Check, X, ExternalLink, RefreshCw, Zap, ShieldCheck, ArrowRight,
  Tag, Upload, Image as ImageIcon
} from 'lucide-react'
import { api } from './api/client'

// ════════════════════════════════════════════════════════════════
// PROMOCIONES PREDETERMINADAS (Fallback / Semilla visual)
// ════════════════════════════════════════════════════════════════
export const DEFAULT_PROMOTIONS = [
  {
    id: 5,
    title: 'VPN Normal · Conexion Privada y Streaming',
    subtitle: 'Navegacion libre sin bloqueos, redes sociales y streaming en Cuba. WireGuard nativo con trafico ilimitado y prueba gratis.',
    badge: 'PRUEBA GRATIS 1 DIA',
    image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=75',
    bg_gradient: 'from-cyan-600/30 via-blue-600/20 to-indigo-600/10',
    action_type: 'vpn',
    action_url: '',
    action_text: 'Ver Planes VPN',
    info_title: 'Francho VPN Normal: Conexion Privada para Cuba',
    info_content: 'Conexion privada con servidor de alta velocidad:\n\n• Desbloqueo total de sitios web restringidos en Cuba (ChatGPT, bancos, TikTok, PayPal).\n• Streaming fluido en alta definicion para YouTube, Netflix, Disney+ y Spotify.\n• Protocolo WireGuard nativo con entrega automatica e instantanea.\n• Trafico 100% ilimitado y prueba gratuita de 24 horas.',
    is_active: 1,
    sort_order: 1
  },
  {
    id: 1,
    title: '¡Deposita Hoy y Obtén +10% EXTRA!',
    subtitle: 'Bono especial activo por tiempo limitado. Paga con USDT o Cripto y recibe 10% adicional directo a tu saldo.',
    badge: '🔥 BONO +10% SALDO',
    image_url: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=800&q=75',
    bg_gradient: 'from-amber-500/30 via-yellow-600/20 to-emerald-600/10',
    action_type: 'topup',
    action_url: '',
    action_text: 'Depositar Ahora',
    info_title: 'Promoción Oficial: +10% de Saldo Adicional en Depósitos',
    info_content: 'Aprovecha nuestra bonificación activa por tiempo limitado en Francho Shop:\n\n• Válido para todas las recargas de saldo mediante USDT (TRC-20, BEP-20, Polygon, TON) y criptomonedas soportadas.\n• Recibe un 10% adicional sobre el monto total depositado (ejemplo: recargas $50 y recibes $55.00 en saldo real).\n• El saldo bonificado se acredita en cuestión de segundos y queda 100% disponible para compras inmediatas.\n• Puedes gastarlo libremente en cuentas de streaming, licencias de IA, recargas de juegos y tarjetas de regalo.',
    is_active: 1,
    sort_order: 1
  },
  {
    id: 2,
    title: 'Vende con Nosotros · Abre tu Tienda',
    subtitle: 'Publica tus suscripciones, cuentas de streaming, licencias IA y recargas. Gana comisiones en USDT con bajas tarifas.',
    badge: '🚀 GAMSGO SELLER',
    image_url: 'https://images.unsplash.com/photo-1556742049-0a67e55722c6?auto=format&fit=crop&w=800&q=75',
    bg_gradient: 'from-blue-600/30 via-indigo-600/20 to-purple-600/10',
    action_type: 'seller',
    action_url: '',
    action_text: 'Empezar a Vender',
    info_title: 'Programa Oficial de Vendedores y Tiendas Digitales Francho Shop',
    info_content: 'Conviértete en comerciante verificado del mercado digital al estilo GamsGo y G2A:\n\n• Publica ofertas estandarizadas con 1 clic usando el Catálogo Maestro Oficial (Netflix, Disney+, Max, ChatGPT Plus, Claude, Midjourney y recargas por UID).\n• Acceso a tu Panel de Vendedor con horario comercial UTC-4 (07:00 a 17:00) y atención de Ben (Seller Manager).\n• Entregas automatizadas con stock instantáneo o gestión manual con chat privado.\n• Retira tus ganancias de forma rápida y transparente en USDT directo a tu billetera personal.',
    is_active: 1,
    sort_order: 2
  },
  {
    id: 3,
    title: '¡Invita Amigos y Gana 5% de por Vida!',
    subtitle: 'Comparte tu código único de 7 dígitos. Gana 5% de comisión en saldo cada vez que tus amigos compren en la tienda.',
    badge: '🎁 5% COMISIÓN EN SALDO',
    image_url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=75',
    bg_gradient: 'from-emerald-600/30 via-teal-600/20 to-cyan-600/10',
    action_type: 'referral',
    action_url: '',
    action_text: 'Ver Mi Código',
    info_title: 'Nuevo Programa de Referidos: Gana 5% en Saldo Real',
    info_content: '¡Bienvenido al nuevo Programa de Referidos oficial de Francho Shop!\n\n• Tu Código Único de 7 Dígitos: Cada usuario registrado tiene asignado un código personal de 7 números (ejemplo: 3875074) y su enlace directo para compartir.\n• 5% de Comisión Automática: Cada vez que un amigo que use tu código compre en la plataforma y su pedido se complete, el 5% se abona inmediatamente a tu saldo disponible en Francho Shop.\n• Registro sin complicaciones: Tus amigos pueden usar tu enlace directo o simplemente escribir tu código de 7 dígitos en la casilla de invitación al crear su cuenta (con Email o con Google).\n• Saldo 100% Utilizable: El saldo acumulado por comisiones puedes gastarlo libremente en cualquier producto de la tienda (recargas, juegos, suscripciones, etc.).\n• Estadísticas en Vivo: En la sección \'Programa de referidos\' de tu perfil puedes consultar cuántos amigos tienes vinculados, cuánto han comprado y tus ganancias acumuladas.',
    is_active: 1,
    sort_order: 1
  },
  {
    id: 4,
    title: 'Catálogo Maestro · Entrega Inmediata',
    subtitle: 'Streaming, IA y Juegos estandarizados con 1 clic. Cuentas privadas con PIN y stock automático garantizado por FranchoShield.',
    badge: '⚡ ENTREGA 1-CLIC',
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=75',
    bg_gradient: 'from-purple-600/30 via-pink-600/20 to-amber-500/10',
    action_type: 'catalog',
    action_url: '',
    action_text: 'Explorar Catálogo',
    info_title: 'Catálogo Maestro Estandarizado de Francho Shop',
    info_content: 'El ecosistema más rápido y confiable para servicios digitales de alta demanda:\n\n• Modalidades claras y verificadas: Full Access, 1 Perfil Privado con PIN, Cuenta Compartida o Grupo Familiar.\n• Entregas automáticas: tus accesos o códigos digitales se generan en menos de 10 segundos.\n• Transparencia total: consulta y compara ofertas de distintas tiendas oficiales y vendedores comunitarios.\n• Protección FranchoShield: periodo de garantía y reemplazo inmediato ante cualquier inconveniente posventa.',
    is_active: 1,
    sort_order: 4
  }
]

// ════════════════════════════════════════════════════════════════
// CARRUSEL ROTATIVO DE PROMOCIONES EN HOME (SIN TEXTO ENCIMA DE LA IMAGEN)
// ════════════════════════════════════════════════════════════════
export function HomePromotionsCarousel({ onTopUp, onNav, onLoginRequired, me, className = '' }) {
  const [promotions, setPromotions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [infoModalPromo, setInfoModalPromo] = useState(null)
  const timerRef = useRef(null)

  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)

  // Cargar promociones activas desde backend
  const loadPromos = async () => {
    try {
      const res = await api.promotions()
      if (res && Array.isArray(res.promotions)) {
        setPromotions(res.promotions)
      } else {
        setPromotions([])
      }
    } catch {
      setPromotions([])
    }
  }

  useEffect(() => {
    loadPromos()
  }, [])

  // Auto-rotación de banners cada 3.5 segundos (entre 3 y 4 segundos)
  useEffect(() => {
    if (promotions.length <= 1 || isPaused) return

    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % promotions.length)
    }, 3500)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [promotions.length, isPaused])

  if (!promotions || promotions.length === 0) return null

  const currentPromo = promotions[currentIndex] || promotions[0]

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % promotions.length)
  }

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + promotions.length) % promotions.length)
  }

  // Deslizado táctil en móvil (swipe)
  const handleTouchStart = (e) => {
    setIsPaused(true)
    if (e.targetTouches?.[0]) {
      touchStartX.current = e.targetTouches[0].clientX
      touchEndX.current = e.targetTouches[0].clientX
    }
  }

  const handleTouchMove = (e) => {
    if (e.targetTouches?.[0]) {
      touchEndX.current = e.targetTouches[0].clientX
    }
  }

  const handleTouchEnd = () => {
    setIsPaused(false)
    const diff = touchStartX.current - touchEndX.current
    if (diff > 40) {
      handleNext()
    } else if (diff < -40) {
      handlePrev()
    }
  }

  // Deslizado con ratón en desktop (drag)
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return
    setIsPaused(true)
    isDragging.current = true
    dragStartX.current = e.clientX
  }

  const handleMouseUp = (e) => {
    if (!isDragging.current) return
    isDragging.current = false
    setIsPaused(false)
    const diff = dragStartX.current - e.clientX
    if (diff > 45) {
      handleNext()
    } else if (diff < -45) {
      handlePrev()
    }
  }

  const handleActionClick = (promo) => {
    if (!promo) return
    const type = promo.action_type || 'topup'

    if (type === 'topup') {
      if (me?.is_guest && typeof onLoginRequired === 'function') {
        onLoginRequired()
      } else if (typeof onTopUp === 'function') {
        onTopUp()
      }
    } else if (type === 'seller') {
      if (me?.is_guest && typeof onLoginRequired === 'function') {
        onLoginRequired()
        return
      }
      if (typeof onNav === 'function') {
        onNav('seller')
      }
    } else if (type === 'referral') {
      if (me?.is_guest && typeof onLoginRequired === 'function') {
        onLoginRequired()
        return
      }
      if (typeof onNav === 'function') {
        onNav('referrals')
      }
    } else if (type === 'vpn') {
      if (typeof onNav === 'function') {
        onNav('vpn')
      }
    } else if (type === 'catalog') {
      const el = document.getElementById('catalog-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      } else {
        window.scrollTo({ top: 350, behavior: 'smooth' })
      }
    } else if (type === 'link' && promo.action_url) {
      window.open(promo.action_url, '_blank')
    }
  }

  return (
    <div
      className={`relative h-[190px] mb-4 overflow-hidden rounded-2xl border border-white/15 bg-card shadow-xl select-none cursor-grab active:cursor-grabbing touch-pan-y ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { setIsPaused(false); isDragging.current = false; }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Contenedor del Banner: LA IMAGEN ES LA PROTAGONISTA LIMPIA, SIN TEXTO ENCIMA */}
      <div 
        key={currentPromo.id || currentIndex}
        onClick={() => setInfoModalPromo(currentPromo)}
        className="relative h-[190px] w-full overflow-hidden flex flex-col justify-end cursor-pointer"
      >
        {currentPromo.image_url ? (
          <img
            src={currentPromo.image_url}
            alt={currentPromo.title || 'Promoción'}
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-r ${currentPromo.bg_gradient || 'from-amber-600 to-indigo-700'}`} />
        )}

        {/* Gradiente sutil inferior para contraste de los botones */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Barra Inferior con Botones: Saber más y Acción directa */}
        <div className="relative z-10 p-2.5 sm:p-3.5 flex items-center justify-between gap-2 flex-wrap">
          {/* Botón Saber más (Explica todo lo que hay dentro de la oferta) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setInfoModalPromo(currentPromo)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-black/80 hover:bg-black text-white border border-white/20 font-black text-xs sm:text-sm backdrop-blur-md transition-all active:scale-95 shadow-lg cursor-pointer"
          >
            <Info className="h-3.5 w-3.5 text-accent" />
            <span>Saber más</span>
          </button>

          {/* Botón Acción directa */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleActionClick(currentPromo)
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-accent hover:brightness-110 text-black font-black text-xs sm:text-sm transition-all active:scale-95 shadow-lg shadow-accent/25 cursor-pointer ml-auto"
          >
            <Zap className="h-3.5 w-3.5 fill-current" />
            <span>{currentPromo.action_text || 'Aprovechar'}</span>
          </button>
        </div>

        {/* Indicador de diapositivas (Dots discretos en esquina superior) */}
        {promotions.length > 1 && (
          <div className="absolute top-2.5 right-3 z-20 flex items-center gap-1.5 bg-black/55 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
            {promotions.map((p, idx) => (
              <button
                key={p.id || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex(idx)
                }}
                className={`transition-all rounded-full ${
                  idx === currentIndex
                    ? 'w-5 h-1.5 bg-accent shadow-sm'
                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Ir a promoción ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Saber Más: Explica detalladamente TODO lo que hay dentro de la oferta */}
      {infoModalPromo && (
        <PromotionInfoModal
          promo={infoModalPromo}
          onClose={() => setInfoModalPromo(null)}
          onAction={() => {
            const p = infoModalPromo
            setInfoModalPromo(null)
            handleActionClick(p)
          }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MODAL "SABER MÁS": EXPLICA TODO LO QUE HAY DENTRO DE LA OFERTA
// ════════════════════════════════════════════════════════════════
export function PromotionInfoModal({ promo, onClose, onAction }) {
  if (!promo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/20 bg-bg shadow-2xl overflow-hidden text-left flex flex-col max-h-[90vh]">
        {/* Encabezado con imagen completa de la promoción */}
        <div className="relative overflow-hidden border-b border-white/10 flex-shrink-0">
          {promo.image_url ? (
            <div className="relative aspect-[16/8] w-full">
              <img
                src={promo.image_url}
                alt={promo.title}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
            </div>
          ) : (
            <div className={`p-6 bg-gradient-to-r ${promo.bg_gradient || 'from-amber-600 to-indigo-700'}`} />
          )}

          <div className="absolute top-3 right-3 z-10">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white/80 hover:text-white flex items-center justify-center transition border border-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5 relative z-10 space-y-1">
            {promo.badge && (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent font-black text-xs uppercase tracking-wider">
                {promo.badge}
              </span>
            )}
            <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
              {promo.info_title || promo.title}
            </h3>
          </div>
        </div>

        {/* Contenido Desplazable: Explica todo lo que hay dentro de la oferta */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm text-white/85 leading-relaxed">
          {/* Subtítulo / Resumen */}
          {promo.subtitle && (
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-medium">
              {promo.subtitle}
            </div>
          )}

          {/* Detalles Completos de la Oferta */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              <span>Todo lo que incluye esta oferta:</span>
            </h4>
            {promo.info_content ? (
              <div className="space-y-2 whitespace-pre-line text-white/80 leading-relaxed bg-card/60 p-4 rounded-2xl border border-white/10">
                {promo.info_content}
              </div>
            ) : (
              <p className="text-white/60">
                {promo.subtitle || 'Consulta con nuestro soporte para obtener más información.'}
              </p>
            )}
          </div>

          {/* Garantía y Seguridad FranchoShield */}
          <div className="p-4 rounded-2xl bg-accent/10 border border-accent/25 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-extrabold text-white text-xs block">
                Protección y Respaldo FranchoShield
              </span>
              <p className="text-[11px] text-white/65 leading-relaxed">
                Todas las transacciones y promociones de la plataforma cuentan con custodia segura de fondos y garantía 24/7.
              </p>
            </div>
          </div>
        </div>

        {/* Footer con Botón de Acción */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-card/60 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-bold transition"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onAction}
            className="px-5 py-2 rounded-xl bg-accent hover:brightness-110 text-black font-black text-xs sm:text-sm transition flex items-center gap-1.5 active:scale-95 shadow-lg shadow-accent/20"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>{promo.action_text || 'Aprovechar Oferta'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PANEL DE ADMINISTRACIÓN DE PROMOCIONES (CON SUBIDA DESDE LA GALERÍA)
// ════════════════════════════════════════════════════════════════
export function AdminPromotionsManagementPanel() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingPromo, setEditingPromo] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [cardUploadPromoId, setCardUploadPromoId] = useState(null)
  const [msg, setMsg] = useState('')
  const fileInputRef = useRef(null)

  const loadPromos = async () => {
    setLoading(true)
    try {
      const res = await api.adminPromotions()
      if (res && res.promotions) {
        setPromotions(res.promotions)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPromos()
  }, [])

  const handleOpenCreate = () => {
    setEditingPromo({
      title: '',
      subtitle: '',
      badge: '🔥 PROMO DESTACADA',
      image_url: '',
      bg_gradient: 'from-amber-500/30 via-yellow-600/20 to-emerald-600/10',
      action_type: 'topup',
      action_url: '',
      action_text: 'Depositar Ahora',
      info_title: '',
      info_content: '',
      is_active: 1,
      sort_order: (promotions.length + 1)
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (promo) => {
    setEditingPromo({ ...promo })
    setIsModalOpen(true)
  }

  const handleToggle = async (id) => {
    try {
      await api.adminTogglePromotion(id)
      await loadPromos()
    } catch (err) {
      alert('Error al cambiar estado: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta promoción del carrusel?')) return
    try {
      await api.adminDeletePromotion(id)
      await loadPromos()
    } catch (err) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  // Subir imagen directamente desde la galería del dispositivo
  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const res = await api.uploadPromotionImage(file)
      if (res && res.url) {
        if (cardUploadPromoId) {
          const promoToUpdate = promotions.find(p => p.id === cardUploadPromoId)
          if (promoToUpdate) {
            await api.adminUpdatePromotion(cardUploadPromoId, { ...promoToUpdate, image_url: res.url })
            await loadPromos()
            setMsg('¡Imagen actualizada con éxito desde la galería!')
            setTimeout(() => setMsg(''), 3500)
          }
        } else {
          setEditingPromo(prev => ({ ...prev, image_url: res.url }))
        }
      } else {
        alert('No se pudo obtener la URL de la imagen subida.')
      }
    } catch (err) {
      alert('Error al subir la imagen: ' + (err.message || 'Error desconocido'))
    } finally {
      setUploadingImage(false)
      setCardUploadPromoId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      if (editingPromo.id) {
        await api.adminUpdatePromotion(editingPromo.id, editingPromo)
      } else {
        await api.adminCreatePromotion(editingPromo)
      }
      setIsModalOpen(false)
      setEditingPromo(null)
      await loadPromos()
      setMsg('Promoción guardada exitosamente')
      setTimeout(() => setMsg(''), 3500)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      {/* Input oculto para subir desde la galería */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageFileSelect}
        className="hidden"
      />

      {/* Cabecera del Panel */}
      <div className="card p-6 rounded-3xl bg-card border border-white/10 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-black">
            <Tag className="h-4 w-4" />
            <span>Gestión de Marketing & Home</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Banners Promocionales Rotativos
          </h1>
          <p className="text-xs sm:text-sm text-white/60">
            Sube imágenes promocionales desde tu galería. La imagen explicará la oferta visualmente y el botón "Saber más" mostrará todos los detalles.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-accent hover:brightness-110 text-black font-black text-xs sm:text-sm transition flex items-center gap-1.5 active:scale-95 shadow-lg shadow-accent/20"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Promoción</span>
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>{msg}</span>
        </div>
      )}

      {/* Lista de Promociones */}
      {loading ? (
        <div className="p-12 text-center text-white/40">Cargando promociones...</div>
      ) : promotions.length === 0 ? (
        <div className="card p-12 text-center text-white/40 rounded-3xl border border-white/10 space-y-3">
          <Tag className="h-8 w-8 mx-auto text-accent" />
          <p className="text-sm font-bold text-white">No hay promociones registradas</p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-accent text-black font-black text-xs transition"
          >
            Crear primera promoción
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="card rounded-3xl bg-card border border-white/10 shadow-lg overflow-hidden flex flex-col justify-between"
            >
              {/* Vista previa limpia de la imagen promocional */}
              <div className="relative aspect-[16/7] w-full overflow-hidden bg-black/40 border-b border-white/5">
                {promo.image_url ? (
                  <img
                    src={promo.image_url}
                    alt={promo.title}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-bold">
                    Sin imagen cargada
                  </div>
                )}

                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-accent font-black uppercase tracking-wider border border-white/10">
                    {promo.badge || 'Promo'}
                  </span>
                </div>

                <div className="absolute top-2.5 right-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase shadow ${
                    promo.is_active ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
                  }`}>
                    {promo.is_active ? 'Activa' : 'Pausada'}
                  </span>
                </div>
              </div>

              {/* Información interna de la promo */}
              <div className="p-4 space-y-2">
                <h3 className="font-black text-sm text-white line-clamp-1">
                  {promo.title}
                </h3>
                <p className="text-xs text-white/60 line-clamp-2">
                  {promo.subtitle}
                </p>
              </div>

              {/* Acciones del Admin */}
              <div className="p-3.5 bg-white/5 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-white/40 text-[10px] block">Acción:</span>
                  <span className="text-accent font-bold">
                    {promo.action_type === 'topup' && '⚡ Recargar'}
                    {promo.action_type === 'seller' && '🏪 Vendedor'}
                    {promo.action_type === 'referral' && '🎁 Referidos'}
                    {promo.action_type === 'catalog' && '🛍️ Catálogo'}
                    {promo.action_type === 'link' && '🔗 Web'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCardUploadPromoId(promo.id)
                      fileInputRef.current?.click()
                    }}
                    className="p-1.5 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs transition flex items-center gap-1"
                    title="Subir o cambiar foto desde la Galería"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold">Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggle(promo.id)}
                    className={`px-3 py-1 rounded-xl font-bold transition text-xs ${
                      promo.is_active ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    }`}
                  >
                    {promo.is_active ? 'Pausar' : 'Activar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(promo)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
                    aria-label="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(promo.id)}
                    className="p-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 transition"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Crear / Editar con Subida desde Galería */}
      {isModalOpen && editingPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl rounded-3xl border border-white/20 bg-bg shadow-2xl overflow-hidden text-left max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base sm:text-lg font-black text-white">
                {editingPromo.id ? 'Editar Promoción' : 'Nueva Promoción del Home'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/15 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* SUBIDA DE IMAGEN DESDE LA GALERÍA */}
              <div className="p-4 rounded-2xl bg-card border border-white/15 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-white text-xs flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-accent" />
                    <span>Imagen Promocional (Banner / Flyer)</span>
                  </label>
                  <span className="text-[10px] text-white/50">La imagen explica la oferta visualmente</span>
                </div>

                {/* Previsualización si ya hay imagen */}
                {editingPromo.image_url ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[16/7] w-full rounded-xl overflow-hidden border border-white/15 shadow">
                      <img
                        src={editingPromo.image_url}
                        alt="Vista previa"
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-accent text-black font-black text-xs shadow flex items-center justify-center gap-1.5 active:scale-95 transition"
                      >
                        {uploadingImage ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin text-black" />
                            <span>Subiendo imagen...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 text-black" />
                            <span>Cambiar imagen desde la Galería</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPromo(prev => ({ ...prev, image_url: '' }))}
                        className="py-2.5 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-bold text-xs shadow active:scale-95 transition"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="w-full py-8 rounded-xl border-2 border-dashed border-accent/40 hover:border-accent bg-accent/5 hover:bg-accent/10 transition-all flex flex-col items-center justify-center gap-2 text-accent cursor-pointer active:scale-[0.99]"
                  >
                    {uploadingImage ? (
                      <>
                        <RefreshCw className="h-6 w-6 animate-spin text-accent" />
                        <span className="font-bold text-xs">Subiendo imagen desde la galería...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                          <Upload className="h-5 w-5" />
                        </div>
                        <span className="font-extrabold text-sm text-white">
                          Toca aquí para subir desde la Galería
                        </span>
                        <span className="text-[11px] text-white/50">
                          Formatos JPG, PNG, WEBP, GIF hasta 15 MB
                        </span>
                      </>
                    )}
                  </button>
                )}

                {/* Opción secundaria: URL directa */}
                <div className="pt-2 border-t border-white/5">
                  <input
                    value={editingPromo.image_url}
                    onChange={e => setEditingPromo({ ...editingPromo, image_url: e.target.value })}
                    placeholder="O pega una URL de imagen externa..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white/80 text-[11px] outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Título y Subtítulo para la oferta */}
              <div className="space-y-1">
                <label className="font-bold text-white/70 block">Título de la Oferta</label>
                <input
                  required
                  value={editingPromo.title}
                  onChange={e => setEditingPromo({ ...editingPromo, title: e.target.value })}
                  placeholder="Ej: ¡Deposita hoy y obtén +10% extra!"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-white/70 block">Subtítulo / Resumen</label>
                <input
                  required
                  value={editingPromo.subtitle}
                  onChange={e => setEditingPromo({ ...editingPromo, subtitle: e.target.value })}
                  placeholder="Resumen rápido de la promoción..."
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-white/70 block">Etiqueta / Badge (ej: 🔥 BONO +10%)</label>
                  <input
                    value={editingPromo.badge}
                    onChange={e => setEditingPromo({ ...editingPromo, badge: e.target.value })}
                    placeholder="🔥 +10% EXTRA"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-white/70 block">Orden en carrusel (1, 2, 3...)</label>
                  <input
                    type="number"
                    value={editingPromo.sort_order}
                    onChange={e => setEditingPromo({ ...editingPromo, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-white/70 block">Tipo de Acción</label>
                  <select
                    value={editingPromo.action_type}
                    onChange={e => setEditingPromo({ ...editingPromo, action_type: e.target.value })}
                    className="w-full bg-card border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                  >
                    <option value="topup">⚡ Recargar Saldo (onTopUp)</option>
                    <option value="seller">🏪 Panel de Vendedor (seller)</option>
                    <option value="referral">🎁 Referidos USDT (referrals)</option>
                    <option value="catalog">🛍️ Ver Catálogo Maestro</option>
                    <option value="link">🔗 Abrir Enlace Externo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-white/70 block">Texto del Botón de Acción</label>
                  <input
                    value={editingPromo.action_text}
                    onChange={e => setEditingPromo({ ...editingPromo, action_text: e.target.value })}
                    placeholder="Depositar Ahora / Empezar"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                  />
                </div>
              </div>

              {editingPromo.action_type === 'link' && (
                <div className="space-y-1">
                  <label className="font-bold text-white/70 block">URL Externa de Destino</label>
                  <input
                    value={editingPromo.action_url}
                    onChange={e => setEditingPromo({ ...editingPromo, action_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* SECCIÓN SABER MÁS: EXPLICA TODO LO QUE HAY DENTRO DE LA OFERTA */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="font-black text-accent text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  <span>Información Detallada (Botón "Saber más")</span>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-white/70 block">Título en la Ventana de "Saber más"</label>
                  <input
                    value={editingPromo.info_title}
                    onChange={e => setEditingPromo({ ...editingPromo, info_title: e.target.value })}
                    placeholder="Ej: Promoción Oficial: ..."
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-white/70 block">
                    Todo lo que hay dentro de esta oferta (Puntos, Pasos, Condiciones, Bonos)
                  </label>
                  <textarea
                    rows={5}
                    value={editingPromo.info_content}
                    onChange={e => setEditingPromo({ ...editingPromo, info_content: e.target.value })}
                    placeholder="Escribe todo lo que el usuario obtendrá, condiciones y pasos para aprovechar la oferta..."
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-white outline-none focus:border-accent leading-relaxed font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="px-5 py-2 rounded-xl bg-accent hover:brightness-110 text-black font-black flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
                >
                  {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingPromo.id ? 'Guardar Cambios' : 'Crear Promoción'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
