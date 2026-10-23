import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Headphones, Package, Bot, Store, ShieldCheck, ShieldAlert,
  Search, ArrowLeft, Send, Paperclip, Check, CheckCheck, Clock,
  AlertTriangle, RefreshCcw, X, Plus, ChevronRight, MessageSquare,
  Sparkles, ExternalLink, User, Lock, Award, FileText, CheckCircle2
} from 'lucide-react'
import { api } from './api/client'

// Helper para formato de tiempo relativo en español
export function formatInboxTime(ts) {
  if (!ts) return ''
  const now = Date.now() / 1000
  const diff = now - Number(ts)
  if (diff < 60) return 'Ahora mismo'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
  if (diff < 172800) return 'Ayer'
  const d = new Date(Number(ts) * 1000)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Helper para badges de estado
export function getStatusBadge(status) {
  switch (status) {
    case 'open':
    case 'dispute':
      return { label: 'En revisión', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
    case 'waiting_customer':
      return { label: 'Esperando respuesta', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' }
    case 'waiting_seller':
      return { label: 'Esperando vendedor', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' }
    case 'delivered':
      return { label: 'Entregado · Verificar', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
    case 'resolved':
    case 'closed':
    case 'completed':
      return { label: 'Resuelto', color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' }
    default:
      return { label: status || 'Activo', color: 'bg-white/10 text-white/70 border-white/15' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MODAL DE REPORTE GUIADO DE UN PEDIDO ("Reportar un Pedido")
// ═══════════════════════════════════════════════════════════════════════════════
export function ReportOrderModal({ me, onClose, onSuccess }) {
  const [step, setStep] = useState(1) // 1: Seleccionar Pedido, 2: Describir Problema
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderSearch, setOrderSearch] = useState('')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const COMMON_REASONS = [
    'No he recibido la recarga ni el saldo',
    'Credenciales o contraseña incorrectas',
    'Problema con la cuenta o suscripción',
    'Demora excesiva en la entrega',
    'Cobro duplicado o monto incorrecto',
    'Otro problema'
  ]

  useEffect(() => {
    let cancelled = false
    // Cargar historial de pedidos
    Promise.all([
      api.myOrders().catch(() => []),
      api.myManualOrders().catch(() => []),
      api.smsMyOrders(20).catch(() => ({ items: [] })),
      api.smmMyOrders(20).catch(() => ({ items: [] })),
      api.streamingMyOrders(20).catch(() => ({ items: [] }))
    ]).then(([auto, manual, sms, smm, streaming]) => {
      if (cancelled) return
      const autoList = (Array.isArray(auto) ? auto : []).map(o => ({
        ...o,
        order_kind: 'automatic',
        title: o.product_name || o.product || 'Recarga automática',
        price: o.sell_price || o.price || 0,
        date: o.created_at
      }))
      const manualList = (Array.isArray(manual) ? manual : []).map(o => ({
        ...o,
        order_kind: 'manual',
        title: o.product_name || o.product || 'Producto manual',
        price: o.price || 0,
        date: o.created_at
      }))
      const streamingItems = Array.isArray(streaming) ? streaming : (streaming?.items || [])
      const streamingList = streamingItems.map(o => ({
        ...o,
        order_kind: 'streaming',
        title: `${o.product_name || 'Cuenta Streaming'} (Streaming)`,
        price: o.sell_price_usd || o.price || 0,
        date: o.created_at
      }))
      const combined = [...manualList, ...streamingList, ...autoList].sort((a, b) => (b.date || 0) - (a.date || 0))
      setOrders(combined)
      setLoadingOrders(false)
    }).catch(e => {
      if (cancelled) return
      setErr(e.message || 'Error al cargar tus pedidos')
      setLoadingOrders(false)
    })
    return () => { cancelled = true }
  }, [])

  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders
    const q = orderSearch.toLowerCase()
    return orders.filter(o => 
      String(o.id).includes(q) || 
      (o.title || '').toLowerCase().includes(q)
    )
  }, [orders, orderSearch])

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!selectedOrder) {
      setErr('Debes seleccionar un pedido primero')
      return
    }
    if (!description.trim()) {
      setErr('Por favor explica brevemente qué sucedió con el pedido')
      return
    }

    setSubmitting(true)
    setErr('')
    try {
      const subject = `Reclamo Pedido #${selectedOrder.id} - ${reason || 'Problema con pedido'}`
      const isManual = selectedOrder.order_kind === 'manual'
      
      const res = await api.createSupportTicket({
        category: 'order_issue',
        subject: subject,
        description: description.trim(),
        associated_order_id: String(selectedOrder.id),
        associated_order_type: isManual ? 'manual' : 'automatic',
        associated_seller_id: selectedOrder.seller_id || selectedOrder.product_owner_id || null
      })

      if (res?.ok) {
        onSuccess?.(res)
      } else {
        throw new Error(res?.message || 'No se pudo crear el reporte')
      }
    } catch (e) {
      setErr(e.message || 'Ocurrió un error al enviar el reporte')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-[#0e1620] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-gradient-to-r from-accent/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Reportar un Pedido</h3>
              <p className="text-xs text-white/50">
                {step === 1 ? 'Paso 1: Elige el pedido afectado' : `Paso 2: Detalles del Pedido #${selectedOrder?.id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido según el paso */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {err && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs font-semibold text-red-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          {step === 1 && (
            <>
              {/* Buscador de pedidos */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar por ID o nombre de producto..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-xs text-white placeholder-white/40 outline-none focus:border-accent"
                />
              </div>

              {loadingOrders ? (
                <div className="py-12 text-center text-white/50 text-xs">
                  <RefreshCcw className="mx-auto mb-2 h-5 w-5 animate-spin text-accent" />
                  Cargando tus compras recientes...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-10 text-center text-white/40 text-xs rounded-2xl border border-dashed border-white/10">
                  <Package className="mx-auto mb-2 h-8 w-8 text-white/20" />
                  No se encontraron pedidos recientes para reportar.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredOrders.map((o) => (
                    <button
                      key={`${o.order_kind}-${o.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedOrder(o)
                        setStep(2)
                        setErr('')
                      }}
                      className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left hover:border-accent/40 hover:bg-accent/5 transition active:scale-[0.99] group"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-accent">#{o.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${o.order_kind === 'manual' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'}`}>
                            {o.order_kind === 'manual' ? 'Entrega Manual' : 'Automático'}
                          </span>
                        </div>
                        <p className="font-bold text-sm text-white truncate group-hover:text-accent transition">
                          {o.title}
                        </p>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          ${Number(o.price || 0).toFixed(2)} USDT · {formatInboxTime(o.date)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-accent group-hover:translate-x-0.5 transition flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 2 && selectedOrder && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tarjeta del pedido seleccionado */}
              <div className="rounded-2xl border border-accent/30 bg-accent/10 p-3.5 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-accent">Pedido #{selectedOrder.id}</span>
                    <span className="text-[10px] font-bold text-white/60">(${Number(selectedOrder.price || 0).toFixed(2)} USDT)</span>
                  </div>
                  <p className="font-bold text-sm text-white truncate mt-0.5">{selectedOrder.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-accent hover:underline flex-shrink-0 ml-3"
                >
                  Cambiar
                </button>
              </div>

              {/* Selector de motivo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                  ¿Cuál es el problema principal?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition active:scale-95 ${
                        reason === r 
                          ? 'border-accent bg-accent text-black font-black' 
                          : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Explicación detallada */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                  Describe qué sucedió con claridad:
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ej: Ya pasaron 30 minutos y no he recibido el código / la cuenta dice contraseña incorrecta..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 p-3.5 text-xs text-white placeholder-white/40 outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                  maxLength={1000}
                />
                <span className="block text-right text-[10px] text-white/40 mt-1">
                  {description.length} / 1000 caracteres
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/70 hover:bg-white/10 transition active:scale-95"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-accent to-[#1fcfa4] py-3 text-xs font-black text-[#07110f] shadow-lg shadow-accent/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      <span>Enviando reporte...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Abrir Reclamo Oficial</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MODAL DE SALA DE CHAT DE SOPORTE (Tickets y Atención Humana)
// ═══════════════════════════════════════════════════════════════════════════════
export function SupportRoomModal({ roomId, onClose, me, onOpenOrderCase }) {
  const [messages, setMessages] = useState([])
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' })
  }

  async function loadMessages(silent = false) {
    if (!silent) setLoading(true)
    try {
      const data = await api.getChatMessages(roomId)
      if (data?.ok) {
        setMessages(data.messages || [])
        if (data.room) setRoom(data.room)
      }
    } catch (e) {
      if (!silent) setErr(e.message || 'Error al conectar con la sala')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
    const interval = setInterval(() => loadMessages(true), 4000)
    return () => clearInterval(interval)
  }, [roomId])

  useEffect(() => {
    scrollToBottom(true)
  }, [messages.length])

  async function handleSend(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    try {
      await api.sendChatMessage(roomId, text)
      await loadMessages(true)
      setTimeout(() => scrollToBottom(), 50)
    } catch (e) {
      setErr(e.message || 'No se pudo enviar el mensaje')
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await api.uploadChatFile(roomId, file)
      if (res?.url) {
        await api.sendChatMessage(roomId, `Archivo adjunto: ${res.filename || file.name}`, res.url, res.type || 'image')
        await loadMessages(true)
        setTimeout(() => scrollToBottom(), 50)
      }
    } catch (e) {
      setErr(e.message || 'Error al subir el archivo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleResolveTicket() {
    if (!room?.ticket_id) return
    if (!confirm('¿Deseas marcar este ticket como resuelto?')) return
    try {
      await api.adminUpdateTicketStatus(room.ticket_id, 'resolved')
      await loadMessages(true)
    } catch (e) {
      alert(e.message || 'Error al actualizar el ticket')
    }
  }

  const isAdmin = me?.role === 'admin'
  const badgeInfo = getStatusBadge(room?.ticket_status || room?.status || 'active')

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center bg-black/85 p-0 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-none sm:rounded-3xl border-0 sm:border border-white/15 bg-[#0a0f16] shadow-2xl overflow-hidden flex flex-col h-full sm:h-[88vh]">
        {/* Cabecera del chat */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0d141e]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/30 flex-shrink-0">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white truncate">
                  {room?.ticket_id ? `Caso #${room.ticket_id}` : `Chat Sala #${roomId}`}
                </h3>
                <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${badgeInfo.color}`}>
                  {badgeInfo.label}
                </span>
              </div>
              <p className="text-[11px] text-white/50 truncate">
                {room?.subject || room?.category || 'Atención personalizada Francho Shop'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isAdmin && room?.ticket_id && room?.ticket_status !== 'resolved' && (
              <button
                onClick={handleResolveTicket}
                className="px-2.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold transition active:scale-95 flex items-center gap-1"
                title="Marcar como resuelto"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Resolver</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Banner de pedido asociado si existe */}
        {room?.associated_order_id && (
          <div className="px-4 py-2 bg-accent/5 border-b border-white/5 flex items-center justify-between text-xs">
            <span className="text-white/60">
              Vinculado al Pedido <strong className="text-accent font-mono">#{room.associated_order_id}</strong>
            </span>
            {onOpenOrderCase && (
              <button
                onClick={() => onOpenOrderCase(Number(room.associated_order_id))}
                className="text-accent font-bold hover:underline flex items-center gap-1"
              >
                Ver seguimiento <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Lista de mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-[#090e15] to-[#070b10]">
          {loading && messages.length === 0 ? (
            <div className="py-20 text-center text-white/50 text-xs flex flex-col items-center">
              <RefreshCcw className="h-6 w-6 animate-spin text-accent mb-2" />
              Cargando historial del caso...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-white/40 text-xs rounded-2xl border border-dashed border-white/5">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-white/20" />
              Inicia la conversación escribiendo tu mensaje abajo.
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMine = m.sender_id === me?.user_id || m.sender_id === me?.id
              const isSupport = m.sender_role === 'admin' || m.sender_role === 'support'
              return (
                <div key={m.id || idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Etiqueta de remitente */}
                  <span className="text-[10px] text-white/40 mb-1 px-1">
                    {isMine ? 'Tú' : isSupport ? '🛡️ Soporte Francho Shop' : `Usuario #${m.sender_id}`}
                  </span>

                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-lg ${
                    isMine
                      ? 'bg-gradient-to-r from-accent to-[#1fcfa4] text-[#07110f] font-semibold rounded-tr-sm'
                      : isSupport
                      ? 'bg-[#152232] text-white border border-accent/25 rounded-tl-sm'
                      : 'bg-[#121a24] text-white/90 border border-white/10 rounded-tl-sm'
                  }`}>
                    {/* Archivo adjunto */}
                    {m.attachment_url && (
                      <div className="mb-2">
                        {m.attachment_type === 'image' || /\.(jpg|jpeg|png|webp)$/i.test(m.attachment_url) ? (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer">
                            <img
                              src={m.attachment_url}
                              alt="Adjunto"
                              className="max-h-48 rounded-xl object-cover border border-black/20 hover:opacity-90 transition"
                            />
                          </a>
                        ) : (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> Descargar adjunto
                          </a>
                        )}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words">{m.message_text || m.message}</p>
                  </div>
                  <span className="text-[9px] text-white/30 mt-0.5 px-1 font-mono">
                    {formatInboxTime(m.created_at)}
                  </span>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input para responder */}
        <div className="border-t border-white/10 bg-[#0d141e] p-3">
          {err && (
            <p className="mb-2 text-[11px] text-red-300 font-semibold px-2">
              {err}
            </p>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,application/pdf"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition"
              title="Adjuntar imagen o comprobante"
            >
              {uploading ? <RefreshCcw className="h-4 w-4 animate-spin text-accent" /> : <Paperclip className="h-4 w-4" />}
            </button>

            <input
              type="text"
              placeholder="Escribe tu mensaje para soporte..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-white/40 outline-none focus:border-accent"
            />

            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-[#07110f] hover:bg-accent/90 active:scale-95 transition disabled:opacity-40"
              aria-label="Enviar mensaje"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PANTALLA UNIFICADA: CENTRO DE SOPORTE & CASOS (Cliente)
// ═══════════════════════════════════════════════════════════════════════════════
export function SupportInboxScreen({ me, onBack, onOpenCase, onOpenAi, initialChatRoomId, onClearInitialChatRoom }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'orders' | 'support' | 'unread' | 'closed'
  const [search, setSearch] = useState('')
  const [showReportModal, setShowReportModal] = useState(false)
  const [activeRoomId, setActiveRoomId] = useState(() => initialChatRoomId || null)

  async function loadInbox(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await api.getInbox()
      if (res?.ok) {
        setItems(res.items || [])
      }
    } catch (e) {
      if (!silent) setErr(e.message || 'Error al cargar tus casos')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadInbox()
    const timer = setInterval(() => loadInbox(true), 8000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (initialChatRoomId) {
      setActiveRoomId(initialChatRoomId)
    }
  }, [initialChatRoomId])

  const counts = useMemo(() => {
    return {
      all: items.length,
      orders: items.filter(i => i.type === 'order_case' || i.type === 'order_ticket').length,
      support: items.filter(i => i.type === 'support' || i.type === 'ai_handoff' || i.type === 'seller_chat').length,
      unread: items.filter(i => Number(i.unread_count || 0) > 0).length,
      closed: items.filter(i => ['resolved', 'closed', 'completed'].includes(i.status)).length
    }
  }, [items])

  const filteredItems = useMemo(() => {
    let result = items
    if (activeFilter === 'orders') {
      result = result.filter(i => i.type === 'order_case' || i.type === 'order_ticket')
    } else if (activeFilter === 'support') {
      result = result.filter(i => i.type === 'support' || i.type === 'ai_handoff' || i.type === 'seller_chat')
    } else if (activeFilter === 'unread') {
      result = result.filter(i => Number(i.unread_count || 0) > 0)
    } else if (activeFilter === 'closed') {
      result = result.filter(i => ['resolved', 'closed', 'completed'].includes(i.status))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i => 
        (i.title || '').toLowerCase().includes(q) ||
        (i.last_message || '').toLowerCase().includes(q) ||
        String(i.order_id || '').includes(q) ||
        String(i.ticket_id || '').includes(q)
      )
    }
    return result
  }, [items, activeFilter, search])

  const handleCardClick = (item) => {
    if (item.type === 'order_case' && item.order_id) {
      onOpenCase?.(Number(item.order_id), me?.role === 'admin')
    } else if (item.room_id) {
      setActiveRoomId(item.room_id)
    }
  }

  const FILTERS = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'orders', label: '📦 Reclamos Pedidos', count: counts.orders },
    { id: 'support', label: '🎧 Soporte Humano / IA', count: counts.support },
    { id: 'unread', label: '🔔 No leídos', count: counts.unread, highlight: counts.unread > 0 },
    { id: 'closed', label: '✅ Resueltos', count: counts.closed }
  ]

  return (
    <div className="min-h-screen bg-bg text-white pb-28">
      {/* Cabecera Principal */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-bg/95 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/80 active:scale-95 transition"
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Headphones className="h-5 w-5 text-accent" />
                Centro de Reclamos & Soporte
              </h1>
              <p className="text-[11px] text-white/50">
                Historial unificado de reclamos, disputas y asistencia técnica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-black text-[#07110f] shadow-lg shadow-accent/20 hover:bg-accent/90 active:scale-95 transition"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Reportar Pedido</span>
              <span className="sm:hidden">Reportar</span>
            </button>

            {onOpenAi && (
              <button
                onClick={onOpenAi}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-white transition active:scale-95"
                title="Abrir Asistente IA"
              >
                <Bot className="h-4 w-4 text-accent" />
                <span className="hidden sm:inline">Francho AI</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 space-y-4">
        {/* Barra de búsqueda y Filtros */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar caso por #pedido, asunto o texto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-card/60 py-2.5 pl-10 pr-4 text-xs text-white placeholder-white/40 outline-none focus:border-accent shadow-inner backdrop-blur"
            />
          </div>

          {/* Filtros horizontales */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                  activeFilter === f.id
                    ? 'bg-accent text-[#07110f] shadow-sm'
                    : 'bg-card border border-white/10 text-white/70 hover:border-white/20'
                }`}
              >
                <span>{f.label}</span>
                {f.count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    activeFilter === f.id 
                      ? 'bg-black/20 text-black' 
                      : f.highlight 
                      ? 'bg-accent text-[#07110f]' 
                      : 'bg-white/10 text-white/60'
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Listado de Casos Unificado */}
        {loading && items.length === 0 ? (
          <div className="py-20 text-center text-white/50 text-xs">
            <RefreshCcw className="mx-auto mb-2 h-6 w-6 animate-spin text-accent" />
            Cargando tus casos de soporte...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-white/40 text-xs rounded-3xl border border-dashed border-white/10 bg-card/20 p-6">
            <Package className="mx-auto mb-3 h-10 w-10 text-white/20" />
            <p className="font-bold text-sm text-white/70">No tienes casos en esta sección</p>
            <p className="text-white/40 mt-1 max-w-sm mx-auto">
              Si tuviste algún inconveniente con una recarga o compra, puedes reportarlo fácilmente aquí.
            </p>
            <button
              onClick={() => setShowReportModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-black text-[#07110f] active:scale-95 transition"
            >
              <Plus className="h-4 w-4" />
              Crear Reclamo de Pedido
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((item) => {
              const isOrderCase = item.type === 'order_case'
              const isAiHandoff = item.type === 'ai_handoff'
              const isSupport = item.type === 'support' || item.type === 'order_ticket'
              const hasUnread = Number(item.unread_count || 0) > 0
              const badge = getStatusBadge(item.status)

              return (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all active:scale-[0.99] cursor-pointer group shadow-sm flex items-start justify-between gap-3 ${
                    hasUnread 
                      ? 'border-accent/40 bg-accent/5 hover:border-accent' 
                      : 'border-white/10 bg-card/70 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Icono de tipo */}
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
                      isOrderCase 
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' 
                        : isAiHandoff 
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}>
                      {isOrderCase ? <Package className="h-5 w-5" /> : isAiHandoff ? <Bot className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-black text-sm text-white truncate group-hover:text-accent transition">
                          {item.title}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      <p className="text-xs text-white/60 line-clamp-1">
                        <strong className="text-white/80 font-semibold">{item.last_message_sender ? `${item.last_message_sender}: ` : ''}</strong>
                        {item.last_message || 'Sin mensajes aún'}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-white/40 mt-1.5 font-mono">
                        <span>{formatInboxTime(item.last_message_time)}</span>
                        {item.order_id && <span>· Pedido #{item.order_id}</span>}
                        {item.customer_name && me?.role === 'admin' && <span>· Cliente: {item.customer_name}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-center">
                    {hasUnread && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-black text-[#07110f] animate-pulse">
                        {item.unread_count}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-accent group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Reporte de Pedido */}
      {showReportModal && (
        <ReportOrderModal
          me={me}
          onClose={() => setShowReportModal(false)}
          onSuccess={(res) => {
            setShowReportModal(false)
            loadInbox(true)
            if (res?.case_id && res?.order_id) {
              onOpenCase?.(Number(res.order_id), me?.role === 'admin')
            } else if (res?.ticket?.room_id) {
              setActiveRoomId(res.ticket.room_id)
            }
          }}
        />
      )}

      {/* Modal de Sala de Chat de Soporte */}
      {activeRoomId && (
        <SupportRoomModal
          roomId={activeRoomId}
          me={me}
          onClose={() => {
            setActiveRoomId(null)
            onClearInitialChatRoom?.()
            loadInbox(true)
          }}
          onOpenOrderCase={(orderId) => {
            setActiveRoomId(null)
            onOpenCase?.(orderId, me?.role === 'admin')
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PESTAÑA DEL PANEL DE ADMINISTRACIÓN: BANDEJA DE ENTRADA UNIFICADA
// ═══════════════════════════════════════════════════════════════════════════════
export function AdminSupportInboxPanel({ me, onOpenCase }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'disputes' | 'tickets' | 'pending' | 'resolved'
  const [search, setSearch] = useState('')
  const [activeRoomId, setActiveRoomId] = useState(null)

  async function loadData() {
    setLoading(true)
    try {
      const res = await api.getInbox()
      if (res?.ok) {
        setItems(res.items || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const stats = useMemo(() => {
    return {
      total: items.length,
      disputes: items.filter(i => i.type === 'order_case').length,
      tickets: items.filter(i => i.type === 'support' || i.type === 'ai_handoff' || i.type === 'order_ticket').length,
      unread: items.filter(i => Number(i.unread_count || 0) > 0).length,
      pending: items.filter(i => !['resolved', 'closed', 'completed'].includes(i.status)).length,
      resolved: items.filter(i => ['resolved', 'closed', 'completed'].includes(i.status)).length
    }
  }, [items])

  const filtered = useMemo(() => {
    let res = items
    if (filter === 'disputes') res = res.filter(i => i.type === 'order_case')
    else if (filter === 'tickets') res = res.filter(i => i.type === 'support' || i.type === 'ai_handoff' || i.type === 'order_ticket')
    else if (filter === 'pending') res = res.filter(i => !['resolved', 'closed', 'completed'].includes(i.status))
    else if (filter === 'resolved') res = res.filter(i => ['resolved', 'closed', 'completed'].includes(i.status))

    if (search.trim()) {
      const q = search.toLowerCase()
      res = res.filter(i => 
        (i.title || '').toLowerCase().includes(q) ||
        (i.customer_name || '').toLowerCase().includes(q) ||
        (i.last_message || '').toLowerCase().includes(q) ||
        String(i.order_id || '').includes(q) ||
        String(i.ticket_id || '').includes(q)
      )
    }
    return res
  }, [items, filter, search])

  return (
    <div className="space-y-4">
      {/* Tarjetas KPI de Soporte */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Pendientes</p>
          <p className="mt-1 text-2xl font-black text-amber-200">{stats.pending}</p>
        </div>
        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Disputas Pedidos</p>
          <p className="mt-1 text-2xl font-black text-cyan-200">{stats.disputes}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Soporte Humano / IA</p>
          <p className="mt-1 text-2xl font-black text-emerald-200">{stats.tickets}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Resueltos</p>
          <p className="mt-1 text-2xl font-black text-white/80">{stats.resolved}</p>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar por cliente, pedido #, o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-xs text-white placeholder-white/40 outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[
            { id: 'all', label: `Todos (${stats.total})` },
            { id: 'pending', label: `Pendientes (${stats.pending})` },
            { id: 'disputes', label: `Disputas (${stats.disputes})` },
            { id: 'tickets', label: `Tickets (${stats.tickets})` },
            { id: 'resolved', label: `Resueltos (${stats.resolved})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                filter === f.id
                  ? 'bg-accent text-[#07110f]'
                  : 'bg-card border border-white/10 text-white/70 hover:border-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Casos para el Administrador */}
      {loading ? (
        <div className="py-16 text-center text-white/50 text-xs">
          <RefreshCcw className="mx-auto mb-2 h-6 w-6 animate-spin text-accent" />
          Cargando bandeja de soporte...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-white/40 text-xs rounded-2xl border border-dashed border-white/10">
          No hay casos que coincidan con el filtro seleccionado.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const isOrderCase = item.type === 'order_case'
            const badge = getStatusBadge(item.status)
            const hasUnread = Number(item.unread_count || 0) > 0

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isOrderCase && item.order_id) {
                    onOpenCase?.(Number(item.order_id), true)
                  } else if (item.room_id) {
                    setActiveRoomId(item.room_id)
                  }
                }}
                className={`rounded-2xl border p-4 text-left transition-all active:scale-[0.99] cursor-pointer group shadow-sm flex items-start justify-between gap-3 ${
                  hasUnread
                    ? 'border-accent/40 bg-accent/5 hover:border-accent'
                    : 'border-white/10 bg-card hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                    isOrderCase ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {isOrderCase ? <Package className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-black text-sm text-white truncate group-hover:text-accent transition">
                        {item.title}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <p className="text-xs text-white/60 line-clamp-1">
                      <strong className="text-white/80 font-semibold">{item.last_message_sender ? `${item.last_message_sender}: ` : ''}</strong>
                      {item.last_message || 'Sin mensajes'}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-white/40 mt-1 font-mono">
                      <span>{formatInboxTime(item.last_message_time)}</span>
                      {item.customer_name && <span>· Cliente: {item.customer_name}</span>}
                      {item.order_id && <span>· Pedido #{item.order_id}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-center">
                  {hasUnread && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-black text-[#07110f] animate-pulse">
                      {item.unread_count}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-accent group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Chat de Soporte para el Administrador */}
      {activeRoomId && (
        <SupportRoomModal
          roomId={activeRoomId}
          me={me}
          onClose={() => {
            setActiveRoomId(null)
            loadData()
          }}
          onOpenOrderCase={(orderId) => {
            setActiveRoomId(null)
            onOpenCase?.(orderId, true)
          }}
        />
      )}
    </div>
  )
}
