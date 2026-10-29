import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, Download, Gamepad2, Globe2, HelpCircle, Lock, QrCode, RefreshCw, Share2, ShieldCheck, X, Zap } from 'lucide-react'
import { api } from './api/client'

const assetUrl = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw || /^(data:|blob:|https?:\/\/)/i.test(raw)) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  try { return window.Capacitor?.isNativePlatform?.() ? `https://franchoshop.com${path}` : path } catch { return path }
}

function planMeta(option) {
  const raw = String(option?.name || '')
  const lower = raw.toLowerCase()
  const price = Number(option?.price || 0)
  const title = price === 0 ? 'Prueba de 24 horas'
    : /anual|365|año|year/.test(lower) ? 'Plan anual'
    : /trimestral|90|3\s*mes/.test(lower) ? 'Plan trimestral'
    : /quincenal|15/.test(lower) ? 'Plan quincenal'
    : /semanal|7/.test(lower) ? 'Plan semanal'
    : /mensual|30|1\s*mes/.test(lower) ? 'Plan mensual'
    : raw.replace(/\([^)]*\)/g, '').trim() || 'Plan VPN'
  const duration = price === 0 ? 'Conoce el servicio sin costo'
    : /anual|365|año|year/.test(lower) ? '365 días de conexión'
    : /trimestral|90|3\s*mes/.test(lower) ? '90 días de conexión'
    : /quincenal|15/.test(lower) ? '15 días de conexión'
    : /semanal|7/.test(lower) ? '7 días de conexión'
    : /mensual|30|1\s*mes/.test(lower) ? '30 días de conexión'
    : 'Tráfico ilimitado'
  return { title, duration, price, free: price === 0, popular: /mensual|30|1\s*mes/.test(lower) }
}

export function VpnStoreScreen({ me, initialType = 'normal', onBack, onLoginRequired, onTopUp, onBought }) {
  const [type, setType] = useState(initialType === 'gaming' ? 'gaming' : 'normal')
  const [products, setProducts] = useState({ normal: null, gaming: null })
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrData, setQrData] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    api.publicManualProducts().then((items) => {
      if (!active) return
      const normal = items.find((item) => Number(item.id) === 34 || /vpn normal/i.test(item.name || '')) || null
      const gaming = items.find((item) => Number(item.id) === 33 || /vpn gaming/i.test(item.name || '')) || null
      setProducts({ normal, gaming })
      const initial = (type === 'gaming' ? gaming : normal) || normal || gaming
      setSelectedId(initial?.options?.find((item) => Number(item.price) === 0)?.id || initial?.options?.[0]?.id || null)
    }).catch(() => setError('No se pudieron cargar los planes de VPN.')).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const product = products[type]
  const options = useMemo(() => [...(product?.options || [])].sort((a, b) => Number(a.price || 0) - Number(b.price || 0)), [product])
  const selected = options.find((item) => String(item.id) === String(selectedId)) || options[0]
  const meta = planMeta(selected)
  const guest = !me || me.is_guest
  const hasBalance = Number(me?.balance || 0) >= meta.price

  const switchType = (next) => {
    setType(next); setError(''); setResult(null)
    const target = products[next]
    setSelectedId(target?.options?.find((item) => Number(item.price) === 0)?.id || target?.options?.[0]?.id || null)
  }
  const downloadConfig = (config, orderId) => {
    if (!config) return
    const href = URL.createObjectURL(new Blob([config], { type: 'application/octet-stream' }))
    const link = document.createElement('a')
    link.href = href; link.download = `francho-vpn-${orderId || 'wireguard'}.conf`; link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1500)
  }
  const copyConfig = async (config) => {
    try { await navigator.clipboard.writeText(config); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setError('No se pudo copiar la configuración.') }
  }
  const openQr = async () => {
    setQrOpen(true)
    if (qrData || !result?.delivery_data) return
    setQrLoading(true)
    try { setQrData((await api.getVpnQr(result.delivery_data))?.qr_data_url || '') } catch { setError('No se pudo generar el código QR.') } finally { setQrLoading(false) }
  }
  const buy = async () => {
    if (guest) return onLoginRequired?.()
    if (!meta.free && !hasBalance) return onTopUp?.()
    if (!product || !selected) return
    setBuying(true); setError('')
    try {
      const field = product.fields?.[0]?.id || 42
      const order = await api.buyManualProduct(product.id, selected.id, { [String(field)]: me?.username || me?.name || 'Cliente VPN' })
      setResult(order); api.me().then(onBought).catch(() => {})
    } catch (err) { setError(err.message || 'No se pudo activar el plan. Inténtalo nuevamente.') } finally { setBuying(false) }
  }
  // Keep a stable hero asset. Swapping it for API artwork after bootstrap caused a flash in Android WebView.
  const heroImage = assetUrl('/images/vpn-network-hero.png')

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#eef3f0] text-[#13221c] dark:bg-[#08130e] dark:text-[#f0f8f3]">
      <header className="border-b border-[#173d2b]/10 bg-[#eef3f0]/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#08130e]/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <button type="button" onClick={onBack} aria-label="Volver" className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#244a36] shadow-[0_3px_0_#cbd8d0] transition active:translate-y-[2px] active:shadow-none dark:bg-white/10 dark:text-white dark:shadow-none"><ArrowLeft className="h-5 w-5" /></button>
          <p className="text-base font-black tracking-tight">Francho VPN</p>
          <button type="button" onClick={() => navigator.share?.({ title: 'Francho VPN', url: 'https://franchoshop.com/vpn' }).catch(() => {})} aria-label="Compartir" className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#244a36] shadow-[0_3px_0_#cbd8d0] transition active:translate-y-[2px] active:shadow-none dark:bg-white/10 dark:text-white dark:shadow-none"><Share2 className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="h-[calc(100dvh-8.8rem)] overflow-y-auto pb-7">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          {result ? (
            <section className="overflow-hidden rounded-lg border border-emerald-500/25 bg-white shadow-[0_10px_0_#cbe5d6,0_20px_40px_rgba(18,53,35,.12)] dark:bg-[#0d1c14] dark:shadow-none">
              <div className="flex items-start justify-between bg-emerald-600 px-5 py-5 text-white">
                <div><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-100">VPN activada</p><h1 className="mt-1 text-2xl font-black">Todo listo.</h1><p className="mt-2 text-xs text-emerald-50/85">Pedido #{result.order_id}</p></div>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><CheckCircle2 className="h-6 w-6" /></span>
              </div>
              <div className="p-4">
                <button type="button" onClick={() => downloadConfig(result.delivery_data, result.order_id)} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#173d2b] text-sm font-black text-white shadow-[0_4px_0_#092014] transition active:translate-y-[3px] active:shadow-[0_1px_0_#092014]"><Download className="h-4 w-4" />Descargar configuración</button>
                <div className="mt-3 grid grid-cols-2 gap-3"><button type="button" onClick={openQr} className="h-11 rounded-lg border border-[#173d2b]/15 bg-[#f4f8f5] text-xs font-bold text-[#244a36] shadow-[0_3px_0_#d2dfd7] transition active:translate-y-[2px] active:shadow-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:shadow-none"><QrCode className="mr-1 inline h-4 w-4" />Ver QR</button><button type="button" onClick={() => copyConfig(result.delivery_data)} className="h-11 rounded-lg border border-[#173d2b]/15 bg-[#f4f8f5] text-xs font-bold text-[#244a36] shadow-[0_3px_0_#d2dfd7] transition active:translate-y-[2px] active:shadow-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:shadow-none"><Copy className="mr-1 inline h-4 w-4" />{copied ? 'Copiado' : 'Copiar'}</button></div>
                <button type="button" onClick={() => setSetupOpen(true)} className="mt-4 flex w-full items-center justify-between text-left text-xs font-bold text-emerald-700 dark:text-emerald-300">Guía de instalación <ChevronRight className="h-4 w-4" /></button>
              </div>
            </section>
          ) : (
            <>
              <section className="relative overflow-hidden rounded-lg bg-[#143a29] text-white shadow-[0_9px_0_#0b2518,0_22px_36px_rgba(12,42,28,.28)]">
                <img src={heroImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="eager" decoding="sync" fetchPriority="high" />
                <div className="absolute inset-0 bg-[#0d321f]/65" />
                <div className="relative min-h-[156px] px-5 py-5 sm:px-7">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />WireGuard</span>
                  <div className="mt-6"><h1 className="text-3xl font-black leading-none sm:text-4xl">Conéctate mejor.</h1><p className="mt-2 text-sm text-emerald-50/85">Elige un plan y actívalo en minutos.</p></div>
                </div>
              </section>

              <section className="mt-6">
                <h2 className="mb-3 text-base font-black text-[#244a36] dark:text-white">¿Para qué la usarás?</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => switchType('normal')} className={`rounded-lg border p-3.5 text-left transition ${type === 'normal' ? 'border-emerald-500 bg-emerald-50 text-[#173d2b] shadow-[0_5px_0_#a9d8ba,0_11px_20px_rgba(22,122,70,.13)] dark:bg-emerald-400/15 dark:text-white dark:shadow-none' : 'border-[#173d2b]/10 bg-white shadow-[0_4px_0_#d1ddd5] active:translate-y-[3px] active:shadow-[0_1px_0_#d1ddd5] dark:border-white/10 dark:bg-white/5 dark:shadow-none'}`}>
                    <span className={`grid h-10 w-10 place-items-center rounded-lg ${type === 'normal' ? 'bg-emerald-600 text-white shadow-[0_3px_0_#0d5a36]' : 'bg-[#e9f0eb] text-[#315941] dark:bg-white/10 dark:text-white'}`}><Globe2 className="h-5 w-5" /></span><p className="mt-3 text-base font-black">Navegar</p>
                  </button>
                  <button type="button" onClick={() => switchType('gaming')} className={`rounded-lg border p-3.5 text-left transition ${type === 'gaming' ? 'border-emerald-500 bg-emerald-50 text-[#173d2b] shadow-[0_5px_0_#a9d8ba,0_11px_20px_rgba(22,122,70,.13)] dark:bg-emerald-400/15 dark:text-white dark:shadow-none' : 'border-[#173d2b]/10 bg-white shadow-[0_4px_0_#d1ddd5] active:translate-y-[3px] active:shadow-[0_1px_0_#d1ddd5] dark:border-white/10 dark:bg-white/5 dark:shadow-none'}`}>
                    <span className={`grid h-10 w-10 place-items-center rounded-lg ${type === 'gaming' ? 'bg-emerald-600 text-white shadow-[0_3px_0_#0d5a36]' : 'bg-[#e9f0eb] text-[#315941] dark:bg-white/10 dark:text-white'}`}><Gamepad2 className="h-5 w-5" /></span><p className="mt-3 text-base font-black">Jugar</p>
                  </button>
                </div>
              </section>

              <section className="mt-7">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-black text-[#244a36] dark:text-white">Selecciona un plan</h2><ShieldCheck className="h-5 w-5 text-emerald-600" /></div>
                {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-[74px] animate-pulse rounded-lg bg-white shadow-sm dark:bg-white/5" />)}</div> : <div className="space-y-3">{options.map((option) => { const data = planMeta(option); const active = String(selectedId) === String(option.id); return <button key={option.id} type="button" onClick={() => { setSelectedId(option.id); setError('') }} className={`relative flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition ${active ? 'border-emerald-500 bg-emerald-50 shadow-[0_5px_0_#a9d8ba,0_11px_20px_rgba(22,122,70,.12)] dark:bg-emerald-400/15 dark:shadow-none' : 'border-[#173d2b]/10 bg-white shadow-[0_4px_0_#d1ddd5] active:translate-y-[3px] active:shadow-[0_1px_0_#d1ddd5] dark:border-white/10 dark:bg-white/5 dark:shadow-none'}`}><span className={`grid h-5 w-5 flex-none place-items-center rounded-full border ${active ? 'border-emerald-600 bg-emerald-600 text-white shadow-[0_2px_0_#0d5a36]' : 'border-[#9bb0a1] dark:border-white/30'}`}>{active && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-base font-black">{data.title}</span>{data.popular && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">Popular</span>}</span><span className="mt-0.5 block text-xs text-[#6a806f] dark:text-white/50">{data.duration}</span></span><span className={`text-right text-lg font-black ${data.free ? 'text-emerald-600' : ''}`}>{data.free ? 'Gratis' : `$${data.price.toFixed(2)}`} {!data.free && <small className="block text-[9px] font-bold text-[#708478] dark:text-white/45">USDT</small>}</span></button> })}</div>}
              </section>

              {error && <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-xs font-medium text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">{error}</p>}
              <button type="button" onClick={() => setSetupOpen(!setupOpen)} className="mt-6 flex w-full items-center justify-between rounded-lg border border-[#173d2b]/10 bg-white px-4 py-3.5 text-left shadow-[0_3px_0_#d1ddd5] transition active:translate-y-[2px] active:shadow-none dark:border-white/10 dark:bg-white/5 dark:shadow-none"><span className="flex items-center gap-2 text-sm font-black"><HelpCircle className="h-4 w-4 text-emerald-600" />Instalación</span><ChevronDown className={`h-4 w-4 transition-transform ${setupOpen ? 'rotate-180' : ''}`} /></button>
              {setupOpen && <div className="border-x border-b border-[#173d2b]/10 bg-white px-4 py-4 text-sm leading-6 text-[#567061] dark:border-white/10 dark:bg-white/5 dark:text-white/65"><ol className="space-y-2"><li><b>1.</b> Instala WireGuard.</li><li><b>2.</b> Descarga tu archivo <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">.conf</code>.</li><li><b>3.</b> Impórtalo y activa la conexión.</li></ol><a href="https://play.google.com/store/apps/details?id=com.wireguard.android" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">Obtener WireGuard <ChevronRight className="h-4 w-4" /></a></div>}
            </>
          )}
        </div>
      </main>

      {!result && <footer className="border-t border-[#173d2b]/10 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0b1610]/95"><div className="mx-auto flex max-w-3xl items-center gap-3"><div className="min-w-[86px]"><p className="text-[10px] font-bold uppercase tracking-wide text-[#718378] dark:text-white/45">Total</p><p className="mt-0.5 text-lg font-black">{meta.free ? 'Gratis' : `$${meta.price.toFixed(2)}`}</p></div>{guest ? <button type="button" onClick={onLoginRequired} className="h-12 flex-1 rounded-lg bg-[#173d2b] text-sm font-black text-white shadow-[0_4px_0_#092014] transition active:translate-y-[3px] active:shadow-[0_1px_0_#092014]"><Lock className="mr-1.5 inline h-4 w-4" />Iniciar sesión</button> : (!meta.free && !hasBalance) ? <button type="button" onClick={onTopUp} className="h-12 flex-1 rounded-lg bg-amber-400 text-sm font-black text-[#362b08] shadow-[0_4px_0_#a56a05] transition active:translate-y-[3px] active:shadow-[0_1px_0_#a56a05]"><Zap className="mr-1.5 inline h-4 w-4" />Recargar saldo</button> : <button type="button" data-tour="vpn-buy-button" onClick={buy} disabled={buying || !selected} className="h-12 flex-1 rounded-lg bg-emerald-600 text-sm font-black text-white shadow-[0_4px_0_#0d5a36,0_9px_16px_rgba(12,101,58,.24)] transition active:translate-y-[3px] active:shadow-[0_1px_0_#0d5a36] disabled:translate-y-0 disabled:shadow-none disabled:opacity-50">{buying ? 'Activando...' : meta.free ? 'Empezar gratis' : 'Activar plan'}</button>}</div></footer>}

      {qrOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4"><div className="w-full max-w-sm rounded-lg bg-white p-5 text-center shadow-2xl dark:bg-[#102018]"><button type="button" onClick={() => setQrOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button><QrCode className="mx-auto mt-1 h-7 w-7 text-emerald-600" /><h2 className="mt-2 text-lg font-black">Escanea en WireGuard</h2><div className="mx-auto my-5 grid h-56 w-56 place-items-center rounded bg-white p-3">{qrLoading ? <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" /> : <img src={qrData || assetUrl(`/api/manual-orders/${result?.order_id}/qr`)} alt="Código QR WireGuard" className="h-full w-full object-contain" />}</div><button type="button" onClick={() => downloadConfig(result?.delivery_data, result?.order_id)} className="h-11 w-full rounded-lg bg-[#173d2b] text-sm font-black text-white shadow-[0_3px_0_#092014] active:translate-y-[2px] active:shadow-none"><Download className="mr-1.5 inline h-4 w-4" />Descargar archivo</button></div></div>}
    </div>
  )
}

export function VpnCatalogCard({ onSelect }) {
  return (
    <button onClick={onSelect} className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#16181f]/90 text-left transition-all duration-300 active:scale-95 hover:border-emerald-400/70 hover:shadow-[0_4px_20px_rgba(52,211,153,.14)] hover:-translate-y-0.5">
      <span className="relative block aspect-[1/1.1] w-full flex-shrink-0 overflow-hidden bg-[#163d2b]">
        <img src={assetUrl('/api/icons/manual-1792981314-9096bf6e.jpg')} alt="VPN WireGuard" className="h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-105" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#16181f] to-transparent" />
      </span>
      <span className="block flex-1 p-1.5"><span className="block truncate text-[11px] font-bold leading-tight text-white transition-colors group-hover:text-emerald-300">VPN WireGuard</span></span>
    </button>
  )
}
