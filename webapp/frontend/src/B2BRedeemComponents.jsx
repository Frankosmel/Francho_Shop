import React, { useState, useEffect } from 'react'
import {
  AlertTriangle, ArrowLeft, Check, CircleCheck, Copy, ExternalLink, HelpCircle,
  KeyRound, Loader2, RefreshCcw, Search, Send, ShieldCheck, Sparkles, Store,
  Trash2, X, Zap, ChevronDown, ChevronUp, Clipboard, Headphones, MessageCircle, Phone
} from 'lucide-react'
import { api } from './api/client'

export function B2BRedeemScreen({ initialCode = '', onHome }) {
  const [code, setCode] = useState(initialCode || '')
  const [validatedData, setValidatedData] = useState(null)
  const [targetUsername, setTargetUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [copiedId, setCopiedId] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportContact, setSupportContact] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportSending, setSupportSending] = useState(false)
  const [supportSuccess, setSupportSuccess] = useState(false)
  const [supportError, setSupportError] = useState(null)
  const [supportTicketId, setSupportTicketId] = useState(null)

  useEffect(() => {
    if (initialCode && initialCode.trim()) {
      handleValidate(initialCode.trim())
    }
  }, [initialCode])

  const handleValidate = async (codeToValidate) => {
    const clean = (codeToValidate || code).trim().toUpperCase()
    if (!clean) {
      setError('Por favor ingresa tu código de activación o compra.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await api.b2bValidateCode(clean)
      setValidatedData(data)
      setCode(clean)
    } catch (e) {
      setError(e.message || 'Código inválido o ya canjeado.')
      setValidatedData(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        const clean = text.trim().toUpperCase()
        setCode(clean)
        handleValidate(clean)
      }
    } catch (e) {
      // ignore
    }
  }

  const handleRedeem = async (e) => {
    if (e) e.preventDefault()
    if (!validatedData || !code) return
    const cleanTarget = targetUsername.trim().replace(/^@+/, '')
    if (!cleanTarget) {
      setError('Debes ingresar tu usuario de Telegram (@usuario).')
      return
    }
    if (cleanTarget.length < 4) {
      setError('El nombre de usuario de Telegram debe tener al menos 4 caracteres.')
      return
    }
    setError(null)
    setRedeeming(true)
    try {
      const res = await api.b2bRedeem(code, cleanTarget)
      setResult(res)
    } catch (e) {
      setError(e.message || 'Error al procesar la activación en Telegram.')
    } finally {
      setRedeeming(false)
    }
  }

  const copyOrderId = (orderId) => {
    if (orderId) {
      navigator.clipboard.writeText(orderId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleSendSupport = async (e) => {
    if (e) e.preventDefault()
    if (!supportContact.trim()) {
      setSupportError('Por favor ingresa tu contacto (WhatsApp, teléfono o correo).')
      return
    }
    if (!supportMessage.trim()) {
      setSupportError('Por favor escribe tu consulta o el problema con tu código.')
      return
    }
    setSupportError(null)
    setSupportSending(true)
    try {
      const res = await api.b2bSupportRequest({
        code: (code || initialCode || '').trim().toUpperCase() || undefined,
        telegram_username: (targetUsername || '').trim() || undefined,
        contact: supportContact.trim(),
        message: supportMessage.trim()
      })
      setSupportTicketId(res.ticket_id)
      setSupportSuccess(true)
    } catch (err) {
      setSupportError(err.message || 'No se pudo enviar la solicitud. Intenta por WhatsApp directo.')
    } finally {
      setSupportSending(false)
    }
  }

  const buildWhatsAppSupportUrl = () => {
    const text = `Hola Soporte Francho Shop, necesito ayuda con el canje:\n` +
      (code ? `• Código: ${code}\n` : '') +
      (targetUsername ? `• Usuario Telegram: @${targetUsername}\n` : '') +
      (supportContact ? `• Mi contacto: ${supportContact}\n` : '') +
      (supportMessage ? `• Consulta: ${supportMessage}\n` : '')
    return `https://wa.me/5363785631?text=${encodeURIComponent(text)}`
  }

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  const faqs = [
    {
      q: '¿Cómo encuentro mi nombre de usuario de Telegram?',
      a: 'Abre Telegram en tu teléfono o PC, ve a Ajustes / Perfil y busca la sección "Nombre de usuario" (ejemplo: @juan_perez). Si no tienes uno configurado, puedes crearlo ahí mismo en 5 segundos.'
    },
    {
      q: '¿Compré mi código en GamsGo, este es el lugar oficial para canjearlo?',
      a: '¡Sí! Francho Shop es el proveedor oficial de activación automatizada. Al ingresar el código entregado por GamsGo, nuestro sistema envía el regalo oficial a tu Telegram de manera inmediata.'
    },
    {
      q: '¿Necesito darle mi contraseña de Telegram?',
      a: 'Nunca. El proceso de Telegram Premium se realiza mediante el sistema oficial de Regalos (Gifts) de Telegram. Solo necesitamos tu @usuario público.'
    },
    {
      q: '¿Qué pasa si ya tengo una suscripción de Telegram Premium activa?',
      a: '⚠️ Importante: El canje mediante regalo oficial de Telegram solo puede aplicarse en cuentas que NO tengan una suscripción activa en ese momento. Si ya tienes una activa, el código no la extiende ni la renueva; debes esperar a que venza tu plan actual para canjear este código.'
    }
  ]

  return (
    <div className="min-h-screen w-full flex-1 overflow-y-auto bg-[#07090e] text-white flex flex-col justify-between selection:bg-accent selection:text-black font-sans relative">
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-40 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation Bar */}
      <header className="w-full border-b border-white/10 bg-[#0a0e17]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button 
            type="button"
            onClick={onHome}
            className="flex items-center gap-3 group transition"
          >
            <div className="relative flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
              {/* Anillo giratorio verde neón */}
              <div className="absolute -inset-1.5 rounded-full border-2 border-transparent border-t-green-400 border-r-green-400/50 animate-spin pointer-events-none" style={{ animationDuration: '3s' }} />
              {/* Logo circular con imagen oficial y luz verde */}
              <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-accent to-emerald-400 flex items-center justify-center border-2 border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.5)]">
                <img
                  src="/franchoshop.jpg"
                  alt="Francho Shop"
                  className="h-full w-full object-cover rounded-full"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    if (e.target.parentElement) {
                      e.target.parentElement.innerHTML = '<span class="text-xs font-black text-bg">FS</span>'
                    }
                  }}
                />
              </div>
            </div>
            <div className="text-left">
              <div className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                Francho Shop
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 hidden sm:inline-block">
                  Auto-Canje
                </span>
              </div>
              <div className="text-[11px] text-white/45 hidden sm:block">Portal Oficial de Activación</div>
            </div>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => { setShowSupportModal(true); setSupportSuccess(false); setSupportError(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition shadow-sm"
            >
              <Headphones className="h-4 w-4" />
              <span>Soporte</span>
            </button>
            <button
              type="button"
              onClick={onHome}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <Store className="h-4 w-4 text-accent" />
              <span className="hidden sm:inline">Tienda Francho Shop</span>
              <span className="sm:hidden">Tienda</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        
        {/* Hero Title */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 shadow-xl shadow-blue-500/25 mb-4">
            <Send className="h-7 w-7 text-white translate-x-[-1px] translate-y-[1px]" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-accent/10 border border-blue-500/25 text-xs font-bold text-blue-300 mb-3 shadow-inner">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Canje Directo e Instantáneo
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Canjea tu <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">Telegram Premium</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/60 leading-relaxed">
            Francho Shop · Ingresa tu código de activación y recibe tu suscripción oficial directamente en tu cuenta de Telegram en segundos.
          </p>
        </div>

        {/* Central Card */}
        <div className="w-full max-w-xl mx-auto bg-[#101622]/90 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-9 shadow-2xl relative">
          
          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs sm:text-sm space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
                <div className="min-w-0 flex-1 leading-relaxed">{error}</div>
              </div>
              <div className="pt-2 border-t border-red-500/20 flex items-center justify-between">
                <span className="text-[11px] text-white/60">¿Tienes dudas o problemas con tu código?</span>
                <button
                  type="button"
                  onClick={() => { setShowSupportModal(true); setSupportSuccess(false); setSupportError(null); }}
                  className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                >
                  <Headphones className="h-3.5 w-3.5" /> Contactar Soporte
                </button>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {result ? (
            <div className="text-center py-4 space-y-5">
              <div className="relative inline-flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl animate-pulse" />
                <div className="relative h-20 w-20 rounded-full bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center text-bg shadow-xl shadow-green-500/30">
                  <CircleCheck className="h-10 w-10 text-white" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white">¡Suscripción Activada con Éxito!</h3>
                <p className="text-xs sm:text-sm text-white/70 mt-1.5 max-w-sm mx-auto">
                  El regalo oficial de <strong className="text-white">{result.product}</strong> ha sido enviado a <strong className="text-accent">@{result.target.replace('@', '')}</strong>.
                </p>
              </div>

              {/* Receipt card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 text-left space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center text-white/60">
                  <span>Producto activado:</span>
                  <span className="font-bold text-white">{result.product}</span>
                </div>
                <div className="flex justify-between items-center text-white/60">
                  <span>Destinatario en Telegram:</span>
                  <span className="font-bold text-accent">@{result.target.replace('@', '')}</span>
                </div>
                {result.provider_order_id && (
                  <div className="flex justify-between items-center text-white/60">
                    <span>ID de Entrega:</span>
                    <button
                      type="button"
                      onClick={() => copyOrderId(result.provider_order_id)}
                      className="font-mono text-xs text-white/90 bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1 transition"
                      title="Copiar ID"
                    >
                      <span>{result.provider_order_id}</span>
                      {copiedId ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                <div className="flex justify-between items-center text-white/60 pt-1 border-t border-white/5">
                  <span>Estado:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Check className="h-4 w-4" /> Entregado en Telegram
                  </span>
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <a
                  href={`https://t.me/${result.target.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/25 transition active:scale-[0.99]"
                >
                  <Send className="h-5 w-5" /> Abrir Telegram y Comprobar
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setValidatedData(null)
                    setCode('')
                    setTargetUsername('')
                    setError(null)
                  }}
                  className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white/50 hover:text-white transition"
                >
                  Canjear otro código
                </button>
              </div>
            </div>
          ) : (
            /* Form view */
            <div className="space-y-6">
              
              {/* Step 1: Voucher Code Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-accent text-bg text-[11px] font-black">1</span>
                    Código de Activación
                  </label>
                  {!validatedData && (
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
                    >
                      <Clipboard className="h-3 w-3" /> Pegar código
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase())
                      if (validatedData) setValidatedData(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !validatedData) {
                        e.preventDefault()
                        handleValidate()
                      }
                    }}
                    disabled={loading || redeeming}
                    placeholder="Ej. TG3M-892A4B o 849201"
                    className="w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3.5 text-sm sm:text-base font-mono tracking-wider uppercase text-white placeholder-white/25 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition pr-28"
                  />

                  {!validatedData ? (
                    <button
                      type="button"
                      onClick={() => handleValidate()}
                      disabled={loading || !code.trim()}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-xl bg-accent text-bg font-black text-xs sm:text-sm hover:bg-accent-hover transition disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-md shadow-accent/15"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setValidatedData(null)
                        setCode('')
                      }}
                      className="absolute right-3 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition"
                      title="Cambiar código"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-white/40 mt-1.5">
                  Pega el código que recibiste al comprar en GamsGo o Francho Shop.
                </p>
              </div>

              {/* Step 2: Validated Offer & Username Input */}
              {validatedData && (
                <div className="space-y-6 pt-4 border-t border-white/10">
                  
                  {/* Verified Product Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                        <Send className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-black text-white">{validatedData.offer_name}</div>
                        <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                          <Check className="h-3.5 w-3.5" /> Código verificado y listo
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-white/70 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                        {validatedData.code}
                      </span>
                    </div>
                  </div>

                  {/* Username Input Form */}
                  <form onSubmit={handleRedeem} className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-white/80 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-accent text-bg text-[11px] font-black">2</span>
                        Tu Usuario de Telegram
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-base font-bold text-accent">@</span>
                        <input
                          type="text"
                          value={targetUsername}
                          onChange={(e) => setTargetUsername(e.target.value.replace(/[@\s]/g, ''))}
                          disabled={redeeming}
                          placeholder="tu_usuario"
                          autoFocus
                          className="w-full rounded-2xl border border-white/15 bg-black/50 pl-9 pr-4 py-3.5 text-sm sm:text-base font-semibold text-white placeholder-white/25 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                        />
                      </div>
                      <p className="text-[11px] text-white/50 mt-1.5">
                        Escribe tu @usuario (ej: <strong className="text-white">carlos_gamer</strong>). <span className="text-amber-300">Asegúrate de que tu cuenta no tenga una suscripción activa actualmente.</span>
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={redeeming || !targetUsername.trim()}
                      className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-bg shadow-xl shadow-green-500/20 transition active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {redeeming ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" /> Activando en Telegram...
                        </>
                      ) : (
                        <>
                          <Zap className="h-5 w-5 fill-current" /> Canjear y Recibir Suscripción
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-center sm:text-left">
            <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent mb-3 mx-auto sm:mx-0">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Activación en Segundos</h4>
            <p className="text-xs text-white/50 mt-1">Conexión directa vía API oficial con Telegram. Sin demoras ni intermediarios.</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-center sm:text-left">
            <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-3 mx-auto sm:mx-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-white">100% Seguro</h4>
            <p className="text-xs text-white/50 mt-1">Solo requerimos tu @usuario público. Nunca solicitamos tu contraseña o accesos.</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-center sm:text-left">
            <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 mb-3 mx-auto sm:mx-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Suscripción Oficial</h4>
            <p className="text-xs text-white/50 mt-1">Telegram Premium 100% original con todos los beneficios y emojis exclusivos.</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-12 max-w-2xl mx-auto w-full">
          <h3 className="text-lg font-black text-center text-white mb-4 flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-accent" /> Preguntas Frecuentes
          </h3>
          <div className="space-y-2.5">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-accent transition"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="h-4 w-4 text-white/40 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 text-xs text-white/60 leading-relaxed border-t border-white/5 pt-2">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 mt-12 bg-[#07090e]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-white/40">
          <div>
            <p>© {new Date().getFullYear()} Francho Shop · Todos los derechos reservados.</p>
            <p className="mt-1 text-[11px] text-white/25">
              Plataforma oficial de recargas de juegos, suscripciones y servicios digitales.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setShowSupportModal(true); setSupportSuccess(false); setSupportError(null); }}
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/25 hover:bg-accent/15 transition"
            >
              <Headphones className="h-3.5 w-3.5" /> Soporte y Ayuda 24/7
            </button>
          </div>
        </div>
      </footer>

      {/* Support Modal Dialog */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#101622] border border-white/15 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative animate-fade-in">
            <button
              type="button"
              onClick={() => setShowSupportModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-bg font-black shadow-lg shadow-emerald-500/25">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Soporte Francho Shop</h3>
                <p className="text-xs text-white/50 flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Atención Inmediata por Panel y WhatsApp
                </p>
              </div>
            </div>

            {supportSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
                  <Check className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">¡Solicitud de Soporte Enviada!</h4>
                  <p className="text-xs text-white/70 mt-1 max-w-sm mx-auto">
                    Tu consulta fue registrada con el ticket <strong className="text-white">#{supportTicketId}</strong> y notificada de inmediato a nuestro equipo de WhatsApp y administración.
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={buildWhatsAppSupportUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#20bd5a] text-black flex items-center justify-center gap-2 transition"
                  >
                    <MessageCircle className="h-4 w-4" /> Abrir WhatsApp Directo
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(false)}
                    className="py-3 px-4 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendSupport} className="space-y-4">
                {supportError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{supportError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-1.5">
                    Tu WhatsApp, Teléfono o Correo <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={supportContact}
                    onChange={(e) => setSupportContact(e.target.value)}
                    placeholder="ej. +53 55555555 o cliente@gmail.com"
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-white/25 outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                      Código de Activación (Opcional)
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ej. TG3M-XXXX"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-accent font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                      Usuario Telegram (Opcional)
                    </label>
                    <input
                      type="text"
                      value={targetUsername}
                      onChange={(e) => setTargetUsername(e.target.value.replace(/[@\s]/g, ''))}
                      placeholder="ej. carlos_gamer"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-1.5">
                    ¿Cuál es tu consulta o problema? <span className="text-accent">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Describe detalladamente qué ocurre con tu código o activación..."
                    className="w-full rounded-xl border border-white/15 bg-black/50 p-3 text-xs sm:text-sm text-white placeholder-white/25 outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="submit"
                    disabled={supportSending || !supportContact.trim() || !supportMessage.trim()}
                    className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-bg shadow-lg shadow-emerald-500/20 disabled:opacity-40 transition flex items-center justify-center gap-2"
                  >
                    {supportSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Enviar a Soporte
                      </>
                    )}
                  </button>
                  <a
                    href={buildWhatsAppSupportUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl text-xs font-bold bg-[#25D366]/20 border border-[#25D366]/40 hover:bg-[#25D366]/30 text-[#25D366] flex items-center justify-center gap-1.5 transition"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminB2BPanel() {
  const [codes, setCodes] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, redeemed: 0, cancelled: 0 })
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)

  // Generate modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genMonths, setGenMonths] = useState(3)
  const [genQuantity, setGenQuantity] = useState(10)
  const [genPrefix, setGenPrefix] = useState('TG3M')
  const [genNote, setGenNote] = useState('GamsGo Lote 1')
  const [generating, setGenerating] = useState(false)
  const [generatedResult, setGeneratedResult] = useState(null)
  const [copiedBatch, setCopiedBatch] = useState(false)
  const [copiedSingle, setCopiedSingle] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const loadCodes = async () => {
    setLoading(true)
    try {
      const data = await api.b2bAdminGetCodes({
        status: statusFilter,
        batch_id: batchFilter,
        q: searchQuery,
        limit: 50,
        offset: page * 50
      })
      setCodes(data.codes || [])
      setStats(data.stats || { total: 0, active: 0, redeemed: 0, cancelled: 0 })
      setBatches(data.batches || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCodes()
  }, [statusFilter, batchFilter, page])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(0)
    loadCodes()
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await api.b2bAdminGenerate({
        product_type: 'telegram_premium',
        months: Number(genMonths),
        quantity: Number(genQuantity),
        prefix: genPrefix,
        batch_note: genNote
      })
      setGeneratedResult(res)
      loadCodes()
    } catch (e) {
      alert(e.message || 'Error al generar códigos')
    } finally {
      setGenerating(false)
    }
  }

  const handleCancelCode = async (id) => {
    if (!confirm('¿Seguro que deseas cancelar este código? Ya no podrá ser canjeado.')) return
    setActionLoading(id)
    try {
      await api.b2bAdminCancelCode(id)
      loadCodes()
    } catch (e) {
      alert(e.message || 'Error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCode = async (id) => {
    if (!confirm('¿Eliminar definitivamente este código?')) return
    setActionLoading(id)
    try {
      await api.b2bAdminDeleteCode(id)
      loadCodes()
    } catch (e) {
      alert(e.message || 'Error')
    } finally {
      setActionLoading(null)
    }
  }

  const copyToClipboard = (text, id = null) => {
    navigator.clipboard.writeText(text)
    if (id) {
      setCopiedSingle(id)
      setTimeout(() => setCopiedSingle(null), 2000)
    } else {
      setCopiedBatch(true)
      setTimeout(() => setCopiedBatch(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header Card with Stats & Generate Button */}
      <div className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-accent" /> Códigos de Canje / Activación (GamsGo)
            </h3>
            <p className="text-xs text-white/50 mt-1">
              Genera códigos para entregar automáticamente en GamsGo. Los compradores canjean en <code className="bg-white/10 px-1.5 py-0.5 rounded text-accent font-mono">/canjear</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGeneratedResult(null)
                setShowGenerateModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-bg font-black text-xs hover:bg-accent-hover shadow-lg shadow-accent/20 transition active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" /> Generar Lote de Códigos
            </button>
            <button
              type="button"
              onClick={loadCodes}
              disabled={loading}
              className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition"
              title="Recargar lista"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[11px] font-bold text-white/40 uppercase">Total Códigos</span>
            <div className="text-xl font-black text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <span className="text-[11px] font-bold text-green-400/80 uppercase">Disponibles</span>
            <div className="text-xl font-black text-green-400 mt-0.5">{stats.active}</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[11px] font-bold text-blue-400/80 uppercase">Canjeados</span>
            <div className="text-xl font-black text-blue-400 mt-0.5">{stats.redeemed}</div>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-[11px] font-bold text-red-400/80 uppercase">Cancelados</span>
            <div className="text-xl font-black text-red-400 mt-0.5">{stats.cancelled}</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, @usuario o nota..."
            className="w-full rounded-xl border border-white/10 bg-card px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-accent"
          />
          <button type="submit" className="absolute right-2 top-2 p-1 text-white/40 hover:text-white">
            <Search className="h-4 w-4" />
          </button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['all', 'active', 'redeemed', 'cancelled'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => { setStatusFilter(st); setPage(0) }}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-accent/15 border border-accent text-accent'
                  : 'bg-card border border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {st === 'all' ? 'Todos' : st === 'active' ? '🟢 Disponibles' : st === 'redeemed' ? '🔵 Canjeados' : '🔴 Cancelados'}
            </button>
          ))}
        </div>
      </div>

      {/* Codes Table */}
      <div className="rounded-2xl border border-white/10 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Producto / Plan</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Canjeado por</th>
                <th className="py-3 px-4">Lote / Fecha</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {codes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-white/40">
                    {loading ? 'Cargando códigos...' : 'No se encontraron códigos de canje.'}
                  </td>
                </tr>
              ) : (
                codes.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{c.code}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(c.code, c.id)}
                          className="p-1 text-white/30 hover:text-accent transition"
                          title="Copiar código"
                        >
                          {copiedSingle === c.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-white/40" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-white/80">
                      {c.offer_name}
                      <div className="text-[10px] text-white/40">Costo: ${c.cost_price?.toFixed(2)} USDT</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {c.status === 'active' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">
                          Disponible
                        </span>
                      ) : c.status === 'redeemed' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          Canjeado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          Cancelado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {c.redeemed_by_target ? (
                        <div>
                          <a
                            href={`https://t.me/${c.redeemed_by_target.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-accent hover:underline"
                          >
                            @{c.redeemed_by_target.replace('@', '')}
                          </a>
                          {c.provider_order_id && (
                            <div className="text-[10px] text-white/40 font-mono">ID: {c.provider_order_id}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-white/60">
                      <div>{c.batch_note || 'Sin nota'}</div>
                      <div className="text-[10px] text-white/40">
                        {c.redeemed_at ? (
                          `Canjeado: ${new Date(c.redeemed_at * 1000).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`
                        ) : (
                          `Creado: ${new Date(c.created_at * 1000).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleCancelCode(c.id)}
                            disabled={actionLoading === c.id}
                            className="px-2 py-1 rounded bg-red-500/10 text-red-300 hover:bg-red-500/20 text-[11px] font-semibold transition"
                          >
                            Cancelar
                          </button>
                        )}
                        {c.status !== 'redeemed' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCode(c.id)}
                            disabled={actionLoading === c.id}
                            className="p-1 rounded text-white/30 hover:text-red-400 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-card p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowGenerateModal(false)}
              className="absolute right-4 top-4 p-1 text-white/40 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {!generatedResult ? (
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-black text-white">
                  <Sparkles className="h-5 w-5 text-accent" /> Generar Códigos de Canje (GamsGo)
                </div>
                <p className="text-xs text-white/50">
                  Crea un lote de códigos listos para entregar automáticamente en GamsGo o vender directamente en Francho Shop.
                </p>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">Producto</label>
                  <select
                    value={genMonths}
                    onChange={e => {
                      const m = Number(e.target.value)
                      setGenMonths(m)
                      setGenPrefix(`TG${m}M`)
                    }}
                    className="w-full rounded-xl border border-white/10 bg-bg px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                  >
                    <option value={3}>✈️ Telegram Premium 3 Meses (~$12.20 USDT)</option>
                    <option value={6}>✈️ Telegram Premium 6 Meses (~$16.27 USDT)</option>
                    <option value={12}>✈️ Telegram Premium 12 Meses (~$29.50 USDT)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-white/70 mb-1">Cantidad de Códigos</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={genQuantity}
                      onChange={e => setGenQuantity(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-bg px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/70 mb-1">Prefijo de Código</label>
                    <input
                      type="text"
                      value={genPrefix}
                      onChange={e => setGenPrefix(e.target.value.toUpperCase())}
                      placeholder="TG3M"
                      className="w-full rounded-xl border border-white/10 bg-bg px-3.5 py-2.5 text-xs font-mono uppercase text-white outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">Nota o Nombre del Lote</label>
                  <input
                    type="text"
                    value={genNote}
                    onChange={e => setGenNote(e.target.value)}
                    placeholder="ej. GamsGo Lote 1 - Telegram 3M"
                    className="w-full rounded-xl border border-white/10 bg-bg px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-white/60 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="px-5 py-2.5 rounded-xl bg-accent text-bg font-black text-xs hover:bg-accent-hover transition flex items-center gap-1.5"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generar {genQuantity} Códigos
                  </button>
                </div>
              </form>
            ) : (
              /* Success Result View with 1-Click Copy */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-black text-green-300">
                  <CircleCheck className="h-5 w-5 text-green-400" /> ¡{generatedResult.quantity} Códigos Generados!
                </div>
                <p className="text-xs text-white/60">
                  Lote: <strong className="text-white">{generatedResult.batch_note}</strong> ({generatedResult.offer_name})
                </p>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-bold text-white/50 uppercase">Lista de Códigos (Para GamsGo)</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedResult.formatted_text)}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      {copiedBatch ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedBatch ? '¡Copiados al portapapeles!' : 'Copiar todos'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={generatedResult.formatted_text}
                    rows={8}
                    className="w-full rounded-xl border border-white/15 bg-black/50 p-3 text-xs font-mono text-white selection:bg-accent selection:text-bg outline-none"
                  />
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                  💡 <strong>Instrucción para GamsGo:</strong> En la configuración de entrega de GamsGo, pega estos códigos y pon en el mensaje al comprador:
                  <div className="mt-1.5 font-mono text-[11px] bg-black/40 p-2 rounded text-white/90">
                    Canjea tu código en: https://franchoshop.com/canjear
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="w-full py-3 rounded-xl bg-accent text-bg font-black text-xs hover:bg-accent-hover transition"
                  >
                    Listo y Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
