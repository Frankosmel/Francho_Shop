import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { api, request } from './api/client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Loader2, Trash2, WalletCards, ReceiptText, Boxes, Search, ShoppingCart, 
  ArrowLeftRight, Filter, KeyRound, Check, X, Shield, Webhook,
  User, Mail, Phone, Crown, CheckCircle2, AlertTriangle, AlertCircle, 
  ArrowLeft, Download, RefreshCw, Copy, ExternalLink, Sparkles, Clock,
  Send, Layers, ShieldCheck, ChevronRight, FileText, Flame, Gamepad2, 
  CreditCard, Tv, Tag, Star, ChevronDown, CheckCircle,
  Code2, Terminal, BookOpen, Cpu, Globe, CheckCheck, Hash, Play, HelpCircle, FlaskConical, Store
} from 'lucide-react';

// Caché en memoria para carga instantánea (0ms)
const inMemoryCatalogCache = {
  categories: null,
  offers: {},
  timestamp: 0
};

function mapB2BPath(path) {
  let clean = path.startsWith('/') ? path : '/' + path;
  if (clean.startsWith('/v1/catalog/products')) {
    return '/reseller/catalog/categories';
  }
  if (clean.startsWith('/account/profile')) {
    return '/reseller/settings/profile';
  }
  if (!clean.startsWith('/reseller/')) {
    clean = '/reseller' + clean;
  }
  return clean;
}

export async function b2bUserApi(path, options = {}) {
  const targetPath = mapB2BPath(path);
  const doReq = request || api?.request;
  const data = await doReq(targetPath, options);
  if (data && typeof data === 'object') {
    if (!data.data && Array.isArray(data.items)) data.data = data.items;
    else if (!data.data && Array.isArray(data.categories)) data.data = data.categories;
    else if (!data.data && Array.isArray(data.deliveries)) data.data = data.deliveries;
  }
  return data;
}

export async function b2bUserApiMut(path, body = {}, method = 'POST') {
  const targetPath = mapB2BPath(path);
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== null && body !== undefined ? JSON.stringify(body) : undefined
  };
  const doReq = request || api?.request;
  const data = await doReq(targetPath, opts);
  if (data && typeof data === 'object') {
    if (data.api_key && !data.secret) data.secret = data.api_key;
    if (data.key && !data.data) data.data = { ...data.key, secret: data.api_key || data.secret };
    if (!data.data && data.webhook) data.data = { ...data.webhook, secret: data.secret };
    if (!data.data && Array.isArray(data.items)) data.data = data.items;
  }
  return data;
}

export function useB2BUserSession() {
  return { ready: true, error: null };
}

// ─── HELPERS PARA COMPROBANTES Y FORMATO ───
export function formatReceiptDate(val) {
  if (!val) return null;
  let d;
  if (typeof val === 'number') {
    d = new Date(val > 1e11 ? val : val * 1000);
  } else if (!isNaN(Number(val)) && String(val).trim() !== '') {
    const num = Number(val);
    d = new Date(num > 1e11 ? num : num * 1000);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatDeliveryDuration(createdVal, completedVal) {
  if (!createdVal || !completedVal) return null;
  const cMs = typeof createdVal === 'number' ? (createdVal > 1e11 ? createdVal : createdVal * 1000) : new Date(createdVal).getTime();
  const fMs = typeof completedVal === 'number' ? (completedVal > 1e11 ? completedVal : completedVal * 1000) : new Date(completedVal).getTime();
  if (isNaN(cMs) || isNaN(fMs) || fMs <= cMs) return null;
  const diffSec = Math.round((fMs - cMs) / 1000);
  if (diffSec <= 0) return 'Inmediata';
  if (diffSec < 60) return `${diffSec} seg`;
  const diffMin = Math.floor(diffSec / 60);
  const remSec = diffSec % 60;
  return remSec > 0 ? `${diffMin}m ${remSec}s` : `${diffMin} min`;
}

export function getProductImage(order) {
  if (!order) return '/franchoshop-logo.png';

  const rawCat = (order.category_id || order.provider_category_id || '').toLowerCase().trim();
  const pName = (order.product || order.product_name || order.category_name || order.category_id || '').toLowerCase().trim();

  // 1. Mapeo directo y prioritario a carátulas locales de alta resolución (mismo origen, 100% compatibles con CORS y toPng)
  if (pName.includes('free fire') || pName.includes('freefire') || rawCat.includes('free_fire')) return '/game-covers/free_fire.png';
  if (pName.includes('blood strike') || pName.includes('bloodstrike') || rawCat.includes('blood_strike')) return '/game-covers/blood_strike.jpg';
  if (pName.includes('roblox') || rawCat.includes('roblox')) return '/game-covers/roblox.webp';
  if (pName.includes('delta force') || pName.includes('deltaforce') || rawCat.includes('delta_force')) return '/game-covers/delta_force.png';
  if (pName.includes('mobile legend') || pName.includes('mobile_legend') || rawCat.includes('mobile_legend')) return '/game-covers/mobile_legends.webp';
  if (pName.includes('pubg') || rawCat.includes('pubg')) return '/game-covers/pubg_mobile.webp';
  if (pName.includes('genshin') || rawCat.includes('genshin')) return '/game-covers/genshin_impact.jpg';
  if (pName.includes('8 ball') || pName.includes('8_ball') || rawCat.includes('8_ball')) return '/game-covers/8_ball_pool.png';
  if (pName.includes('telegram premium') || rawCat.includes('telegram_prem')) return '/game-covers/telegram_premium.jpg';
  if (pName.includes('telegram star') || pName.includes('stars') || rawCat.includes('telegram_stars') || pName.includes('telegram') || rawCat.includes('telegram')) return '/game-covers/telegram_stars.jpg';
  if (pName.includes('call of duty') || pName.includes('codm') || rawCat.includes('call_of_duty')) return '/game-covers/call_of_duty_mobile.jpg';
  if (pName.includes('clash of clans') || rawCat.includes('clash_of_clans')) return '/game-covers/clash_of_clans.jpg';
  if (pName.includes('brawl stars') || rawCat.includes('brawl_stars')) return '/game-covers/brawl_stars.jpg';
  if (pName.includes('honor of kings') || rawCat.includes('honor_of_kings')) return '/game-covers/honor_of_kings.webp';
  if (pName.includes('valorant') || rawCat.includes('valorant')) return '/game-covers/valorant_us.webp';
  if (pName.includes('arena breakout') || rawCat.includes('arena_breakout')) return '/api/icons/9b91f6dfcf58.jpg';
  if (pName.includes('razer gold') || rawCat.includes('razer_gold')) return '/api/icons/manual-1780325895-e842de5c.jpg';
  if (pName.includes('apple') || rawCat.includes('apple')) return '/api/icons/manual-1780406019-5316f000.jpg';
  if (pName.includes('google play') || rawCat.includes('google_play')) return '/api/icons/manual-1780405992-23a8d5a8.jpg';
  if (pName.includes('playstation') || rawCat.includes('playstation')) return '/api/icons/manual-1780325539-57d6d1df.jpg';
  if (pName.includes('nintendo') || rawCat.includes('nintendo')) return '/api/icons/manual-1780325700-a050e3a8.jpg';
  if (pName.includes('xbox') || rawCat.includes('xbox')) return '/api/icons/manual-1780325557-a04d7809.jpg';
  if (pName.includes('steam') || rawCat.includes('steam')) return 'https://cdn.akamai.steamstatic.com/store/home/store_home_share.jpg';

  // 2. Si la orden ya trae una imagen propia o provista
  const candidate = order.image_url || order.icon_url || order.product_image;
  if (candidate && !candidate.includes('franchoshop-logo')) {
    if (candidate.startsWith('/') || (typeof window !== 'undefined' && candidate.includes(window.location.hostname))) {
      return candidate;
    }
    // Para URLs externas (como fazercards u otros proveedores), usamos el proxy de imágenes para garantizar CORS y evitar bloqueos
    return `/api/image-proxy?url=${encodeURIComponent(candidate)}`;
  }

  // 3. Buscar en catálogo en memoria
  let catList = inMemoryCatalogCache.categories || [];
  if (!catList.length) {
    try {
      const stored = sessionStorage.getItem('fsb2b_categories_cache_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) catList = parsed;
      }
    } catch (e) {}
  }

  const found = catList.find(c =>
    (order.category_id && String(c.id).toLowerCase() === String(order.category_id).toLowerCase()) ||
    (c.name && order.product && c.name.toLowerCase() === order.product.toLowerCase()) ||
    (c.id && order.product && String(c.id).toLowerCase() === order.product.toLowerCase())
  );
  if (found?.image_url && !found.image_url.includes('franchoshop-logo')) {
    if (found.image_url.startsWith('/') || (typeof window !== 'undefined' && found.image_url.includes(window.location.hostname))) {
      return found.image_url;
    }
    return `/api/image-proxy?url=${encodeURIComponent(found.image_url)}`;
  }

  return '/franchoshop-logo.png';
}

// ─── COMPONENTE COMPARTIDO: MODAL DE COMPROBANTE DE PEDIDO ───
export function OrderDetailModal({ order, onClose }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const receiptCardRef = useRef(null);

  if (!order) return null;

  // Extraer código de entrega / credenciales
  let extractedCode = "";
  if (order.provider_response) {
    let resp = order.provider_response;
    try {
      if (typeof resp === "string") resp = JSON.parse(resp);
    } catch (e) {}

    if (typeof resp === "object" && resp !== null) {
      if (resp.code || resp.key || resp.voucher_code) {
        extractedCode = resp.code || resp.key || resp.voucher_code;
        if (resp.pin) extractedCode += `  (PIN: ${resp.pin})`;
      } else if (resp.delivery_message || resp.instructions) {
        extractedCode = resp.delivery_message || resp.instructions;
      } else if (resp.items && Array.isArray(resp.items)) {
        const validItems = resp.items.map((i) => i.code || i.key || i.pin).filter(Boolean);
        if (validItems.length) extractedCode = validItems.join("\n");
      }
    } else if (typeof resp === "string" && !resp.trim().startsWith("{")) {
      extractedCode = resp;
    }
  }

  const LABEL_MAP = {
    player_id: "ID de jugador",
    user_id: "ID de usuario",
    account_id: "ID de cuenta",
    server_id: "Servidor",
    zone_id: "Zona",
    username: "Usuario",
    steam_login: "Usuario de Steam",
    invite_url: "Enlace de invitación",
  };

  let parsedInputs = null;
  if (order.input_summary) {
    try {
      parsedInputs = typeof order.input_summary === "string" ? JSON.parse(order.input_summary) : order.input_summary;
    } catch (e) {
      parsedInputs = { "Destino": String(order.input_summary) };
    }
  }

  // Clean raw JSON or "Destino: {..." from order.offer if passed accidentally
  let cleanOffer = order.offer || "";
  if (cleanOffer && (cleanOffer.includes('{"') || cleanOffer.includes("{'"))) {
    try {
      const match = cleanOffer.match(/\{.*\}/);
      if (match) {
        const jsonOffer = JSON.parse(match[0]);
        if (!parsedInputs) parsedInputs = jsonOffer;
      }
    } catch (e) {}
    cleanOffer = "";
  }

  // Normalize parsedInputs keys with friendly labels
  if (parsedInputs && typeof parsedInputs === "object") {
    const normalized = {};
    for (const [k, v] of Object.entries(parsedInputs)) {
      if (v !== null && v !== "" && typeof v !== "object") {
        const cleanKey = LABEL_MAP[k.toLowerCase()] || k.replace(/_/g, " ");
        normalized[cleanKey] = String(v);
      } else if (typeof v === "object" && v !== null) {
        for (const [subK, subV] of Object.entries(v)) {
          const cleanKey = LABEL_MAP[subK.toLowerCase()] || subK.replace(/_/g, " ");
          normalized[cleanKey] = String(subV);
        }
      }
    }
    parsedInputs = Object.keys(normalized).length > 0 ? normalized : null;
  }

  const copyCodeToClipboard = async () => {
    if (!extractedCode) return;
    try {
      await navigator.clipboard.writeText(extractedCode.trim());
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {}
  };

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(String(order.id));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {}
  };

  const createdFormatted = formatReceiptDate(order.created_at);
  const completedTimestamp = order.completed_at || (order.status === 'completed' ? (order.updated_at || order.created_at) : null);
  const completedFormatted = completedTimestamp ? formatReceiptDate(completedTimestamp) : (order.status === 'completed' ? createdFormatted : null);
  const deliveryDuration = formatDeliveryDuration(order.created_at, completedTimestamp);
  const productImg = getProductImage(order);

  const copySummaryForCustomer = async () => {
    let destText = "";
    if (parsedInputs && typeof parsedInputs === 'object') {
      destText = Object.entries(parsedInputs).map(([k, v]) => `• ${k.replace(/_/g, " ").toUpperCase()}: ${v}`).join("\n");
    }

    let text = `🧾 *COMPROBANTE OFICIAL FRANCHO SHOP*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📦 *Producto:* ${order.product || "Servicio Digital"}\n`;
    if (cleanOffer) text += `⚡ *Opción:* ${cleanOffer}\n`;
    if (destText) text += `🎯 *Destino:*\n${destText}\n`;
    if (extractedCode.trim()) {
      text += `🔑 *Código / Entrega:*\n${extractedCode.trim()}\n`;
    }
    text += `✅ *Estado:* ${order.status?.toUpperCase() || 'COMPLETADO'}\n`;
    text += `💰 *Total Pagado:* $${order.total || order.amount} USDT\n`;
    text += `🆔 *ID de Pedido:* ${order.id}\n`;
    if (order.delivery_time) text += `⏱️ *Tiempo Estimado:* ${order.delivery_time}\n`;
    if (createdFormatted) text += `📅 *Creado:* ${createdFormatted}\n`;
    if (completedFormatted) text += `⚡ *Entregado:* ${completedFormatted}${deliveryDuration ? ` (${deliveryDuration})` : ''}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Francho Shop · Comercio Digital Seguro\n`;
    text += `🌐 franchoshop.com`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch (err) {}
  };

  const downloadReceiptImage = async () => {
    if (!receiptCardRef.current || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(receiptCardRef.current, {
        quality: 0.98,
        pixelRatio: 2.5,
        backgroundColor: '#070a0f',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `comprobante-${order.id || 'pedido'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating receipt PNG with cacheBust:', err);
      try {
        const dataUrl2 = await toPng(receiptCardRef.current, {
          quality: 0.95,
          pixelRatio: 2,
          backgroundColor: '#070a0f',
        });
        const link = document.createElement('a');
        link.download = `comprobante-${order.id || 'pedido'}.png`;
        link.href = dataUrl2;
        link.click();
      } catch (err2) {
        alert('No se pudo generar la imagen del comprobante: ' + (err2.message || 'Error de captura'));
      }
    } finally {
      setDownloading(false);
    }
  };

  const statusConfig = {
    completed: { label: 'Completado', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: CheckCircle2 },
    processing: { label: 'En Proceso', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: Clock },
    pending: { label: 'Pendiente', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', icon: Clock },
    failed: { label: 'Fallido', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: AlertTriangle },
    refunded: { label: 'Reembolsado', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: CheckCircle2 }
  };
  const currentStatus = statusConfig[order.status] || { label: order.status || 'Completado', badge: 'bg-white/10 text-white border-white/20', icon: CheckCircle2 };
  const StatusIconComp = currentStatus.icon;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="card w-full max-w-lg p-4 sm:p-6 border border-white/15 rounded-3xl bg-[#0b0f17] shadow-2xl my-auto max-h-[92vh] flex flex-col">
        {/* Header Modal Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Comprobante Digital</h3>
          </div>


          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>



        {/* Scrollable Receipt Preview */}
        <div className="overflow-y-auto py-3 my-1 flex-1 pr-1 scrollbar-thin">
          {/* Printable Ticket Card (Target for html-to-image) */}
          <div 
            ref={receiptCardRef}
            className="bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#06080d] border border-white/15 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden text-white"
            style={{ minWidth: '280px' }}
          >
            {/* Watermark Logo in background */}
            <div className="absolute -right-8 -bottom-8 w-44 h-44 opacity-5 pointer-events-none select-none">
              <img src="/franchoshop-logo.png" alt="" className="w-full h-full object-contain" />
            </div>



            {/* Receipt Brand Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10 relative z-10">
              <div className="flex items-center gap-2.5">
                <img 
                  src="/franchoshop-logo.png" 
                  alt="Francho Shop" 
                  crossOrigin="anonymous"
                  className="w-9 h-9 rounded-xl object-contain bg-black/40 border border-white/15 p-1 shadow-sm shrink-0" 
                />
                <div>
                  <div className="text-sm font-black text-white tracking-wider">
                    FRANCHO SHOP
                  </div>


                  <div className="text-[10px] text-white/50 tracking-tight font-medium">Comprobante de Entrega</div>
                </div>


              </div>



              <div className="text-right shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${currentStatus.badge}`}>
                  <StatusIconComp className="w-3 h-3" />
                  {currentStatus.label}
                </span>
              </div>


            </div>



            {/* Product Highlight Box with Product Image */}
            <div className="my-3.5 p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3 relative z-10">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-black/50 border border-white/10 shrink-0 shadow-md">
                {productImg ? (
                  <img 
                    src={productImg} 
                    alt={order.product || "Producto"} 
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/franchoshop-logo.png'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Boxes className="w-7 h-7 text-accent/60" />
                  </div>


                )}
              </div>


              <div className="min-w-0 flex-1">
                <h4 className="text-sm sm:text-base font-black text-white leading-tight truncate">
                  {order.product || 'Servicio Digital'}
                </h4>
                {cleanOffer && (
                  <p className="text-xs font-bold text-accent mt-0.5 truncate">
                    {cleanOffer}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1 text-[11px] text-white/60">
                  <span>Cantidad: <strong className="text-white font-mono">{order.quantity || 1}</strong></span>
                  <span>•</span>
                  <span>Total: <strong className="text-accent font-black text-xs font-mono">${order.total || order.amount} USDT</strong></span>
                </div>


              </div>


            </div>



            {/* Creado y Entregado Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3 relative z-10 text-xs">
              <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-white/45 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-white/40" /> Creado
                </span>
                <span className="font-mono text-white text-[11px] font-semibold block mt-0.5">
                  {createdFormatted || '—'}
                </span>
              </div>


              <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-white/45 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Entregado
                </span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="font-mono text-emerald-400 text-[11px] font-bold truncate">
                    {completedFormatted || (order.status === 'processing' ? 'En proceso...' : '—')}
                  </span>
                  {deliveryDuration && (
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-bold font-mono shrink-0">
                      ⚡ {deliveryDuration}
                    </span>
                  )}
                </div>


              </div>


            </div>



            {/* Tiempo estimado de entrega si aplica */}
            {order.delivery_time && (
              <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 my-2.5 relative z-10 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/45 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-accent" /> Tiempo Estimado
                </span>
                <span className="font-mono text-accent text-[11px] font-bold">
                  ⏱️ {order.delivery_time}
                </span>
              </div>


            )}

            {/* Transaction ID & References */}
            <div className="bg-black/20 rounded-xl p-2.5 border border-white/5 my-3 relative z-10 space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-white/45 text-[11px]">ID de Pedido:</span>
                <button 
                  onClick={copyOrderId} 
                  className="font-mono text-[11px] font-bold text-white hover:text-accent flex items-center gap-1 active:scale-95 transition"
                  title="Copiar ID"
                >
                  {order.id}
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/40" />}
                </button>
              </div>


              {order.reference && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-white/45">Referencia:</span>
                  <span className="font-mono text-white/80 truncate max-w-[180px]">{order.reference}</span>
                </div>


              )}
            </div>



            {/* Datos ingresados para entrega */}
            {parsedInputs && Object.keys(parsedInputs).length > 0 && (
              <div className="my-3 relative z-10">
                <span className="text-[10px] uppercase tracking-wider text-white/45 font-bold block mb-1.5">
                  Datos de destino:
                </span>
                <div className="space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/5 text-xs">
                  {Object.entries(parsedInputs).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center">
                      <span className="text-white/60 capitalize text-[11px]">{k.replace(/_/g, " ")}:</span>
                      <strong className="text-white font-mono text-[11px] truncate max-w-[200px]">{String(v)}</strong>
                    </div>


                  ))}
                </div>


              </div>


            )}

            {/* Digital Code / Key Delivery or Direct Delivery Note */}
            {extractedCode.trim() ? (
              <div className="my-3.5 p-3.5 rounded-xl bg-accent/10 border border-accent/30 relative z-10">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-black text-accent flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4" /> Código / PIN Entregado:
                  </span>
                  <button 
                    onClick={copyCodeToClipboard}
                    className="text-[11px] bg-accent text-bg font-black px-2 py-0.5 rounded-lg hover:bg-accent/90 transition flex items-center gap-1 active:scale-95"
                  >
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCode ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>


                <pre className="p-2.5 bg-black/70 rounded-lg text-emerald-400 font-mono text-xs select-all whitespace-pre-wrap break-all border border-accent/20">
                  {extractedCode.trim()}
                </pre>
              </div>


            ) : order.status === 'completed' ? (
              <div className="my-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 relative z-10">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span className="leading-tight text-[11px]">Recarga directa acreditada con éxito en la cuenta de destino.</span>
              </div>


            ) : order.status === 'processing' ? (
              <div className="my-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2 relative z-10">
                <Clock className="w-4 h-4 animate-pulse flex-shrink-0 text-amber-400" />
                <span className="leading-tight text-[11px]">El pedido se está procesando automáticamente.</span>
              </div>


            ) : null}

            {/* Security Guarantee Seal Footer */}
            <div className="pt-3 mt-2 border-t border-dashed border-white/10 flex items-center justify-between text-[9px] text-white/40 relative z-10">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Transacción Verificada
              </span>
              <span className="font-mono">www.franchoshop.com</span>
            </div>


          </div>


        </div>



        {/* Modal Bottom Actions */}
        <div className="space-y-2 pt-3 border-t border-white/10 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button 
              onClick={downloadReceiptImage}
              disabled={downloading}
              className="py-2.5 px-4 rounded-xl bg-accent hover:bg-accent/90 text-bg font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-lg disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Generando imagen...' : 'Descargar Imagen (PNG)'}
            </button>

            <button 
              onClick={copySummaryForCustomer}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
            >
              {copiedSummary ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
              {copiedSummary ? '¡Copiado para WhatsApp!' : 'Copiar Texto para Cliente'}
            </button>
          </div>


        </div>


      </div>


    </div>,
    document.body
  );
}

// ─── 1. RESUMEN B2B (DASHBOARD) ───
export function ResellerB2BDashboard({ onNavigate }) {
  const { ready, error: authError } = useB2BUserSession();
  const [data, setData] = useState({
    account: { business_name: 'Revendedor', full_name: 'Revendedor', plan: { name: 'Mayorista' } }
  });
  const [wallet, setWallet] = useState({ balance: '0.00', reserved: '0.00', movements: [] });
  const [recentOrders, setRecentOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    Promise.all([
      b2bUserApi('/me').catch(() => null),
      b2bUserApi('/wallet').catch(() => null),
      b2bUserApi('/orders').catch(() => ({ items: [] }))
    ]).then(([meRes, walletRes, ordersRes]) => {
      if (meRes?.account) setData(meRes);
      if (walletRes) setWallet(walletRes);
      const orderList = ordersRes?.items || ordersRes?.orders || ordersRes?.data || [];
      if (Array.isArray(orderList)) setRecentOrders(orderList.slice(0, 4));
    }).finally(() => {
      setLoading(false);
    });
  }, [ready]);

  if (authError) return <div className="card p-6 text-rose-400 font-semibold">{authError}</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Hero card de bienvenida */}
      <div className="card p-8 bg-gradient-to-br from-accent/20 via-[#0b0f17] to-bg border border-accent/20 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Crown className="w-36 h-36" />
        </div>


        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Portal Revendedores B2B
            </div>


            <h2 className="text-2xl md:text-3xl font-black text-white">
              Hola, {data.account?.business_name || data.account?.full_name || 'Revendedor'}
            </h2>
            <p className="text-sm text-white/70 mt-1 max-w-xl">
              Nivel Mayorista: <strong className="uppercase text-accent tracking-wide">{data.account?.plan?.name || 'Inicial'}</strong>. Tienes acceso prioritario a precios mayoristas y entregas automáticas.
            </p>
          </div>


          <div className="flex flex-wrap items-center gap-2">
            <button 
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-reseller-pricing'))}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/10 font-bold px-4 py-2.5 rounded-xl text-xs transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" /> Ver Precios por Recarga
            </button>
            <button 
              onClick={() => onNavigate ? onNavigate('res-b2b-catalog') : null}
              className="bg-accent hover:bg-accent/90 text-bg font-bold px-5 py-2.5 rounded-xl text-xs transition-transform active:scale-95 flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" /> Comprar Productos
            </button>
          </div>


        </div>


      </div>



      {/* Tarjetas de Saldos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6 border border-white/10 rounded-2xl bg-card/50 hover:bg-card transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3.5 bg-accent/15 rounded-xl text-accent"><WalletCards className="w-7 h-7"/></div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/50">Saldo Unificado</span>
                <div className="text-3xl md:text-4xl font-black text-accent">${wallet.balance}</div>
              </div>


            </div>


            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-deposit'))}
              className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              + Recargar
            </button>
          </div>


          <p className="text-xs text-white/50 border-t border-white/5 pt-3">
            Sincronizado 100% con tu saldo de Francho Shop para compras directas sin comisiones extra.
          </p>
        </div>



        <div className="card p-6 border border-white/10 rounded-2xl bg-card/50 hover:bg-card transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3.5 bg-amber-500/15 rounded-xl text-amber-500"><ReceiptText className="w-7 h-7"/></div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">Saldo Reservado</span>
              <div className="text-3xl md:text-4xl font-black text-amber-500">${wallet.reserved}</div>
            </div>


          </div>


          <p className="text-xs text-white/50 border-t border-white/5 pt-3">
            Bloqueado temporalmente en custodia segura (escrow) mientras tus pedidos activos se procesan.
          </p>
        </div>


      </div>



      {/* Accesos directos a secciones de catálogo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button 
          onClick={() => {
            sessionStorage.setItem('fsb2b_catalog_initial_section', 'service_topup');
            if (onNavigate) onNavigate('res-b2b-catalog');
          }}
          className="card p-4 border border-white/10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent hover:border-accent/40 text-left transition group"
        >
          <Flame className="w-5 h-5 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
          <strong className="text-xs text-white block">Recargas Directas</strong>
          <span className="text-[10px] text-white/50">Free Fire, Blood Strike, MLBB</span>
        </button>

        <button 
          onClick={() => {
            sessionStorage.setItem('fsb2b_catalog_initial_section', 'giftcards');
            if (onNavigate) onNavigate('res-b2b-catalog');
          }}
          className="card p-4 border border-white/10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent hover:border-emerald-500/40 text-left transition group"
        >
          <CreditCard className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
          <strong className="text-xs text-white block">Gift Cards & Pines</strong>
          <span className="text-[10px] text-white/50">Google Play, Apple, Roblox, PSN</span>
        </button>

        <button 
          onClick={() => {
            sessionStorage.setItem('fsb2b_catalog_initial_section', 'telegram_stars');
            if (onNavigate) onNavigate('res-b2b-catalog');
          }}
          className="card p-4 border border-white/10 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent hover:border-blue-500/40 text-left transition group"
        >
          <Star className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
          <strong className="text-xs text-white block">Telegram Stars</strong>
          <span className="text-[10px] text-white/50">Stars & Telegram Premium</span>
        </button>

        <button 
          onClick={() => {
            sessionStorage.setItem('fsb2b_catalog_initial_section', 'subscriptions');
            if (onNavigate) onNavigate('res-b2b-catalog');
          }}
          className="card p-4 border border-white/10 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent hover:border-purple-500/40 text-left transition group"
        >
          <Tv className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
          <strong className="text-xs text-white block">Suscripciones</strong>
          <span className="text-[10px] text-white/50">Streaming, CapCut, Spotify</span>
        </button>
      </div>



      {/* Últimos Pedidos Widget */}
      <div className="card border border-white/10 rounded-2xl overflow-hidden bg-card/40">
        <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" /> Últimas Compras B2B
          </h3>
          <button 
            onClick={() => onNavigate ? onNavigate('res-b2b-orders') : null}
            className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
          >
            Ver todas <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>



        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-xs">
            Aún no has realizado compras B2B. ¡Explora el catálogo para hacer tu primer pedido!
          </div>


        ) : (
          <div className="divide-y divide-white/5">
            {recentOrders.map(o => (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className="p-3.5 hover:bg-white/5 flex items-center justify-between cursor-pointer transition"
              >
                <div>
                  <div className="font-bold text-white text-xs">{o.product}</div>
                  <div className="text-[10px] text-white/50 font-mono mt-0.5">
                    {new Date(o.created_at).toLocaleDateString('es-ES')} · ID: {o.id}
                  </div>


                </div>


                <div className="flex items-center gap-3">
                  <span className="font-black text-accent text-xs">${o.amount || o.total}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider ${
                    o.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                    o.status === 'processing' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/10 text-white'
                  }`}>
                    {o.status}
                  </span>
                </div>


              </div>


            ))}
          </div>


        )}
      </div>



      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

// ─── 2. CATÁLOGO B2B POTENCIADO CON SECCIONES Y ULTRA VELOCIDAD ───

function getFieldGuide(field) {
  const key = String(field?.key || field?.id || "").toLowerCase();
  if (field?.description) return field.description;
  if (field?.guide) return field.guide;
  if (["player_id", "user_id", "uid", "account_id", "character_id", "role_id", "game_uid", "id"].some(k => key === k || key.includes(k))) {
    return "Busca este ID numérico en el perfil dentro del juego y cópialo exactamente. No uses el nombre visible.";
  }
  if (key.includes("server") || key.includes("zone")) {
    return "Verifica la zona o servidor en tu perfil (ej: 1234).";
  }
  if (key.includes("riot")) {
    return "Escribe tu Riot ID completo incluyendo el #TAG (ej: Usuario#LAN).";
  }
  if (key.includes("telegram")) {
    return "Escribe el @usuario de Telegram sin espacios (ej: @usuario).";
  }
  if (key.includes("email") || key.includes("correo")) {
    return "Correo electrónico donde se enviarán las credenciales o confirmación.";
  }
  return "Verifica que el dato sea exacto antes de confirmar la compra.";
}



export function ResellerB2BCatalog({ onNavigate }) {
  const { ready } = useB2BUserSession();
  const [categories, setCategories] = useState(() => inMemoryCatalogCache.categories);
  const [loadingCats, setLoadingCats] = useState(!inMemoryCatalogCache.categories);
  const [wallet, setWallet] = useState(null);

  // Sección activa del catálogo
  const [activeSection, setActiveSection] = useState(() => {
    return sessionStorage.getItem('fsb2b_catalog_initial_section') || 'featured';
  });

  // Búsqueda y paginación
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(36);

  // Estado del modal de compra y selección de producto
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [offersPayload, setOffersPayload] = useState(null);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [purchaseFields, setPurchaseFields] = useState({});
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Carga ultra rápida de categorías (Caché local + Background Revalidate)
  useEffect(() => {
    // Si ya existe en sessionStorage, cargarlo de inmediato
    const cached = sessionStorage.getItem('fsb2b_categories_cache_v2');
    if (cached && !categories) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          inMemoryCatalogCache.categories = parsed;
          setLoadingCats(false);
        }
      } catch(e) {}
    }

    if (ready) {
      b2bUserApi('/wallet').then(setWallet).catch(()=>{});
      b2bUserApi('/catalog/categories')
        .then(res => {
          const list = res?.categories || res?.items || res?.data || (Array.isArray(res) ? res : null);
          if (Array.isArray(list) && list.length > 0) {
            setCategories(list);
            inMemoryCatalogCache.categories = list;
            sessionStorage.setItem('fsb2b_categories_cache_v2', JSON.stringify(list));
          }
        })
        .catch(console.error)
        .finally(() => setLoadingCats(false));
    }
  }, [ready]);

  // Lista de secciones organizadas
  const catalogSections = [
    { id: 'featured', label: 'Destacados', icon: Flame, color: 'text-amber-400' },
    { id: 'service_topup', label: 'Recargas Directas', icon: Sparkles, color: 'text-cyan-400' },
    { id: 'giftcards', label: 'Gift Cards & Pines', icon: CreditCard, color: 'text-emerald-400' },
    { id: 'telegram_stars', label: 'Telegram Stars', icon: Star, color: 'text-blue-400' },
    { id: 'steam', label: 'Saldo Steam', icon: Gamepad2, color: 'text-indigo-400' },
    { id: 'subscriptions', label: 'Suscripciones', icon: Tv, color: 'text-purple-400' },
    { id: 'gamekeys', label: 'Game Keys', icon: KeyRound, color: 'text-rose-400' },
    { id: 'all', label: 'Todo el Catálogo', icon: Boxes, color: 'text-white/70' },
  ];

  // Chips de búsqueda rápida de marcas populares
  const quickBrandChips = [
    'Free Fire', 'Blood Strike', 'Mobile Legends', 'Roblox', 
    'Google Play', 'PlayStation', 'Xbox', 'Steam', 'Telegram'
  ];

  // Identificadores de productos destacados
  const featuredIds = useMemo(() => new Set([
    'free_fire_latam', 'blood_strike', 'free_fire_id', 'free_fire_br',
    'mobile_legends_global', 'pubg_mobile_auto', 'telegram_stars',
    'telegram_premium', 'steam_cis', 'roblox_global', 'google_play_usa',
    'playstation_network_usa', 'xbox_gift_card_usa', 'razer_gold_global'
  ]), []);

  // Filtrado optimizado de productos
  const filteredProducts = useMemo(() => {
    if (!categories) return [];
    let items = categories;

    // Filtro de sección
    if (activeSection === 'featured') {
      items = items.filter(c => featuredIds.has(c.id) || (c.name || '').toLowerCase().includes('free fire') || (c.name || '').toLowerCase().includes('blood strike') || (c.name || '').toLowerCase().includes('telegram') || (c.name || '').toLowerCase().includes('roblox') || (c.name || '').toLowerCase().includes('steam'));
    } else if (activeSection === 'steam') {
      items = items.filter(c => c.catalog_group === 'steam_topup' || c.catalog_group === 'steam_gifts' || (c.name || '').toLowerCase().includes('steam'));
    } else if (activeSection !== 'all') {
      items = items.filter(c => c.catalog_group === activeSection || c.type === activeSection);
    }

    // Búsqueda por texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (c.id || '').toLowerCase().includes(q) ||
        (c.region && c.region !== '__standard__' && c.region.toLowerCase() !== 'standard' ? c.region : '').toLowerCase().includes(q)
      );
    }

    return items;
  }, [categories, activeSection, searchQuery, featuredIds]);

  // Abrir modal de opciones / paquetes de un producto
  const handleOpenProduct = async (product) => {
    setSelectedProduct(product);
    setPurchaseFields({});
    setPurchaseQuantity(1);
    setSelectedOffer(null);

    // Revisar caché en memoria primero
    const cacheKey = `${product.provider_type}_${product.id}`;
    if (inMemoryCatalogCache.offers[cacheKey]) {
      const cached = inMemoryCatalogCache.offers[cacheKey];
      setOffersPayload(cached);
      if (cached.offers?.length > 0) {
        const firstOffer = cached.offers[0];
        setSelectedOffer(firstOffer);
        setSelectedOfferId(firstOffer.id || firstOffer.offer_id);
        const isStarsProd = product.id === 'telegram_stars' || product.category_id === 'telegram_stars';
        const initialQty = Number(firstOffer.min_quantity) || (isStarsProd ? 50 : 1);
        setPurchaseQuantity(initialQty);
      }
      return;
    }

    setLoadingOffers(true);
    try {
      const res = await b2bUserApi(`/catalog/offers?provider_type=${product.provider_type}&category_id=${product.id}`);
      inMemoryCatalogCache.offers[cacheKey] = res;
      setOffersPayload(res);
      if (res.offers?.length > 0) {
        const firstOffer = res.offers[0];
        setSelectedOffer(firstOffer);
        setSelectedOfferId(firstOffer.id || firstOffer.offer_id);
        const isStarsProd = product.id === 'telegram_stars' || product.category_id === 'telegram_stars';
        const initialQty = Number(firstOffer.min_quantity) || (isStarsProd ? 50 : 1);
        setPurchaseQuantity(initialQty);
      }
    } catch (err) {
      alert('Error cargando opciones: ' + err.message);
      setSelectedProduct(null);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Ejecutar orden de compra
  const handleConfirmPurchase = async () => {
    if (!selectedProduct || !selectedOffer) return;
    setPurchaseLoading(true);
    try {
      const req = {
        provider_type: selectedProduct.provider_type,
        category_id: selectedProduct.id,
        offer_id: selectedOffer.id || selectedOffer.offer_id,
        quantity: parseInt(purchaseQuantity, 10) || 1,
        fields: purchaseFields,
        client_request_id: crypto.randomUUID ? crypto.randomUUID() : `fs-${Date.now()}`
      };
      const res = await b2bUserApiMut('/orders', req);
      
      // Actualizar saldo de inmediato
      b2bUserApi('/wallet').then(setWallet).catch(()=>{});
      try { window.dispatchEvent(new CustomEvent('franchoshop:refresh-me')); } catch(e) {}
      
      // Cerrar modal de compra y abrir comprobante digital
      setSelectedProduct(null);
      setCompletedOrder(res.order || {
        id: res.id,
        product: selectedProduct.name,
        offer: selectedOffer.name,
        total: (parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0) * purchaseQuantity).toFixed(2),
        status: 'completed',
        created_at: new Date().toISOString(),
        provider_response: res.provider_response || res.result
      });
    } catch (err) {
      alert('Error al procesar la compra: ' + err.message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const getBadgeStyle = (type) => {
    if (type === 'topup') return { label: 'Recarga ID', bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
    if (type === 'giftcard') return { label: 'Gift Card', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (type === 'telegram') return { label: 'Telegram', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    if (type === 'subscription') return { label: 'Suscripción', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    return { label: 'Digital', bg: 'bg-white/10 text-white/70 border-white/20' };
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Barra de Búsqueda y Saldo rápido */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="search"
            placeholder="Buscar por juego, tarjeta o país (ej: Free Fire, Roblox, Steam, USA)..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setVisibleLimit(36); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/40 focus:border-accent outline-none transition"
          />
        </div>



        {wallet && (
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between sm:justify-end gap-3">
            <span className="text-xs text-white/50">Tu Saldo B2B:</span>
            <span className="text-sm font-black text-accent">${wallet.balance}</span>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-deposit'))}
              className="text-[10px] bg-accent/20 text-accent font-bold px-2 py-0.5 rounded-md hover:bg-accent/30 transition"
            >
              + Recargar
            </button>
          </div>


        )}
      </div>



      {/* SECCIONES DEL CATÁLOGO (Barra de Pestañas Scrollable) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {catalogSections.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => {
                setActiveSection(sec.id);
                setSearchQuery('');
                setVisibleLimit(36);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all shrink-0 ${
                isActive 
                  ? 'bg-accent text-bg shadow-lg shadow-accent/20 scale-100' 
                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-bg' : sec.color}`} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>



      {/* Chips de marcas rápidas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
        <span className="text-white/40 font-semibold uppercase tracking-wider text-[9px] mr-1 shrink-0">Populares:</span>
        {quickBrandChips.map(brand => (
          <button
            key={brand}
            onClick={() => { setSearchQuery(brand); setVisibleLimit(36); }}
            className={`px-2.5 py-1 rounded-lg border transition shrink-0 ${
              searchQuery.toLowerCase() === brand.toLowerCase()
                ? 'bg-accent/20 border-accent text-accent font-bold'
                : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {brand}
          </button>
        ))}
      </div>



      {/* CONTENIDO DEL CATÁLOGO */}
      {loadingCats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="card p-3 border border-white/5 rounded-2xl bg-card/20 animate-pulse flex flex-col h-48">
              <div className="aspect-square bg-white/5 rounded-xl mb-3" />
              <div className="h-3 bg-white/5 rounded w-3/4 mb-2 mt-auto" />
              <div className="h-2 bg-white/5 rounded w-1/2" />
            </div>


          ))}
        </div>


      ) : filteredProducts.length === 0 ? (
        <div className="card p-16 text-center text-white/40 border border-white/10 rounded-2xl flex flex-col items-center gap-2">
          <Boxes className="w-10 h-10 opacity-20" />
          <p className="font-semibold text-sm">No encontramos productos en esta sección.</p>
          <span className="text-xs text-white/40">Prueba usando el buscador superior o cambia de categoría.</span>
        </div>


      ) : (
        <>
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-white/50 px-1">
            <span>Mostrando {Math.min(filteredProducts.length, visibleLimit)} de {filteredProducts.length} productos</span>
            <div className="flex items-center gap-2">
              {activeSection !== 'all' && (
                <span className="text-accent font-semibold hidden sm:inline">Precios con margen mayorista activo</span>
              )}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-reseller-pricing'))}
                className="text-accent hover:underline flex items-center gap-1 font-bold text-xs transition-colors bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-lg hover:bg-accent/20"
              >
                <Sparkles className="w-3 h-3" />
                <span>Ver escala de precios por recarga</span>
              </button>
            </div>


          </div>



          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {filteredProducts.slice(0, visibleLimit).map(prod => {
              const badge = getBadgeStyle(prod.type || prod.provider_type);
              return (
                <div 
                  key={prod.id}
                  onClick={() => handleOpenProduct(prod)}
                  className="card p-3 border border-white/10 rounded-2xl hover:border-accent/50 transition-all cursor-pointer hover:bg-white/5 group bg-card/40 hover:-translate-y-1 shadow-md flex flex-col justify-between h-full"
                >
                  <div>
                    {/* Visual Cover con Badge */}
                    <div className="aspect-square bg-black/40 rounded-xl overflow-hidden mb-3 relative border border-white/5">
                      {prod.image_url ? (
                        <img 
                          src={prod.image_url} 
                          alt={prod.name} 
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                          <Boxes className="w-8 h-8 text-white/20"/>
                        </div>


                      )}
                      <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider backdrop-blur-md border ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>



                    <h3 className="text-xs font-bold text-white leading-tight line-clamp-2 mb-1 group-hover:text-accent transition-colors">
                      {prod.name}
                    </h3>
                    
                    {prod.region && prod.region !== '__standard__' && prod.region.toLowerCase() !== 'standard' && (
                      <span className="text-[10px] text-white/40 block uppercase tracking-wider">
                        {prod.region}
                      </span>
                    )}
                  </div>



                  <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-accent font-bold text-[11px] group-hover:underline">
                      Comprar
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:text-accent group-hover:translate-x-0.5 transition" />
                  </div>


                </div>


              );
            })}
          </div>



          {/* Botón Cargar Más */}
          {visibleLimit < filteredProducts.length && (
            <div className="text-center pt-4">
              <button 
                onClick={() => setVisibleLimit(prev => prev + 36)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 transition"
              >
                Cargar más productos (+36)
              </button>
            </div>


          )}
        </>
      )}

      {/* ─── MODAL COMPLETO DE SELECCIÓN DE OFERTAS & COMPRA B2B ─── */}
      {selectedProduct && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] bg-[#070a0f] text-white flex flex-col overflow-hidden animate-in fade-in duration-200">
          
          {/* Barra Superior Pantalla Completa - Cubre 100% el notch y el fondo de atrás */}
          <header className="px-4 py-3 sm:px-8 sm:py-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] bg-[#0d121d] border-b border-white/10 flex items-center justify-between gap-4 z-10 shrink-0 select-none shadow-md">
            <button 
              onClick={() => { setSelectedProduct(null); setSelectedOfferId(null); }}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-2 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al catálogo</span>
              <span className="sm:hidden">Volver</span>
            </button>

            <div className="flex items-center gap-3 min-w-0 flex-1 justify-center sm:justify-start">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/60 overflow-hidden flex-shrink-0 border border-white/10 shadow">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Boxes className="w-5 h-5 m-2 text-white/30" />
                )}
              </div>


              <div className="min-w-0 text-center sm:text-left">
                <h2 className="text-sm sm:text-base font-black text-white truncate leading-tight">
                  {selectedProduct.name}
                </h2>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] text-white/50">
                  <span className="text-accent font-bold uppercase">{selectedProduct.type === 'topup' ? 'Recarga Directa' : 'Producto Digital'}</span>
                  {selectedProduct.region && selectedProduct.region !== '__standard__' && selectedProduct.region.toLowerCase() !== 'standard' && (
                    <span>· {selectedProduct.region}</span>
                  )}
                </div>


              </div>


            </div>



            <button 
              onClick={() => { setSelectedProduct(null); setSelectedOfferId(null); }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Contenido Principal Pantalla Completa */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-6 bg-[#070a0f]">
            <div className="max-w-4xl mx-auto space-y-6">
              {loadingOffers ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  <span className="text-xs text-white/50 font-medium">Cargando opciones y stock...</span>
                </div>


              ) : (offersPayload?.offers || []).length === 0 ? (
                <div className="py-16 text-center text-white/40 text-sm">
                  No hay opciones disponibles en este momento para este producto.
                </div>


              ) : (
                <>
                  {/* Lista de Paquetes (SIN EMOJIS) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                        Selecciona tu paquete o denominación:
                      </span>
                      <span className="text-xs text-white/40 font-medium">
                        {offersPayload?.offers?.length} opciones disponibles
                      </span>
                    </div>



                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(offersPayload?.offers || []).map(offer => {
                        const offerId = offer.id || offer.offer_id;
                        const isSelected = selectedOfferId ? (offerId === selectedOfferId) : (selectedOffer?.id === offerId);
                        const priceUsd = offer.price_usdt || offer.price_usd || offer.price || '0.00';

                        return (
                          <div 
                            key={offerId}
                            onClick={() => {
                              setSelectedOffer(offer);
                              setSelectedOfferId(offerId);
                            }}
                            className={`px-2.5 py-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                              isSelected 
                                ? 'bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-500/15 text-white ring-1 ring-emerald-400/40' 
                                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-white/80'
                            }`}
                          >
                            <strong className={`text-xs sm:text-sm block truncate pr-2 ${isSelected ? 'text-white font-black' : 'text-white/90'}`}>
                              {offer.name}
                            </strong>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-sm sm:text-base font-black ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                                ${priceUsd} <small className="text-[10px] font-bold text-white/40">USDT</small>
                              </span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected ? 'border-emerald-400 bg-emerald-400 text-bg' : 'border-white/30 bg-black/30'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3] text-black" />}
                              </div>


                            </div>


                          </div>


                        );
                      })}
                    </div>


                  </div>



                  {/* Formulario de Campos Requeridos */}
                  {selectedOffer && (() => {
                    const fieldsList = offersPayload?.fields || offersPayload?.fields_required || selectedProduct.fields || selectedProduct.fields_required || [];
                    if (fieldsList.length === 0) return null;

                    return (
                      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white block">
                          Datos requeridos para la entrega:
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {fieldsList.map((f, idx) => {
                            const fKey = f.key || f.id || `field_${idx}`;
                            const fLabel = f.label || f.name || fKey;
                            const isRequired = f.required !== false;
                            const fGuide = getFieldGuide(f);

                            return (
                              <div key={fKey} className={fieldsList.length === 1 ? 'sm:col-span-2' : ''}>
                                <label className="block text-xs font-bold text-white/80 mb-1.5">
                                  {fLabel} {isRequired && <span className="text-rose-400">*</span>}
                                </label>
                                
                                {f.type === 'select' && Array.isArray(f.options) && f.options.length > 0 ? (
                                  <select
                                    value={purchaseFields[fKey] || ''}
                                    onChange={e => setPurchaseFields({...purchaseFields, [fKey]: e.target.value})}
                                    className="w-full bg-[#0d121d] border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:border-emerald-400 outline-none transition"
                                  >
                                    <option value="">Selecciona una opción...</option>
                                    {f.options.map(opt => (
                                      <option key={opt.value || opt} value={opt.value || opt}>
                                        {opt.label || opt.name || opt.value || opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input 
                                    type={fKey.includes('email') ? 'email' : 'text'}
                                    required={isRequired}
                                    placeholder={f.placeholder || `Ingresa ${fLabel}`}
                                    value={purchaseFields[fKey] || ''}
                                    onChange={e => setPurchaseFields({...purchaseFields, [fKey]: e.target.value})}
                                    className="w-full bg-[#0d121d] border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:border-emerald-400 outline-none transition font-medium"
                                  />
                                )}

                                {fGuide && (
                                  <span className="block text-[11px] text-white/40 mt-1 leading-normal">
                                    💡 {fGuide}
                                  </span>
                                )}
                              </div>


                            );
                          })}
                        </div>


                      </div>


                    );
                  })()}

                  {/* Cantidad / Estrellas */}
                  {selectedOffer && (() => {
                    const isStars = selectedProduct?.id === 'telegram_stars' || selectedProduct?.category_id === 'telegram_stars' || selectedOffer?.id === 'stars';
                    const minQty = Number(selectedOffer?.min_quantity) || (isStars ? 50 : 1);
                    const maxQty = Number(selectedOffer?.max_quantity) || (isStars ? 10000 : 100);
                    const step = isStars ? 50 : 1;
                    const starPresets = [50, 100, 250, 500, 1000, 2500, 5000];

                    return (
                      <div className="p-4 sm:p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white block">
                              {isStars ? 'Cantidad de Telegram Stars:' : 'Cantidad de unidades:'}
                            </span>
                            <span className="text-[11px] text-white/50">
                              {isStars 
                                ? `Mínimo ${minQty} y máximo ${maxQty.toLocaleString()} Stars ($${selectedOffer.price_usdt || '0.0163'} USDT c/u)` 
                                : `Mínimo: ${minQty} · Máximo: ${maxQty}`
                              }
                            </span>
                          </div>



                          {/* Control numérico directo y botones de paso */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <div className="flex items-center bg-[#0d121d] border border-white/20 rounded-xl p-1 shadow-inner">
                              <button 
                                type="button"
                                onClick={() => setPurchaseQuantity(Math.max(minQty, Number(purchaseQuantity || minQty) - step))}
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition active:scale-95 text-lg"
                              >
                                -
                              </button>
                              
                              <input 
                                type="number"
                                min={minQty}
                                max={maxQty}
                                step={step}
                                value={purchaseQuantity}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10);
                                  if (isNaN(val)) setPurchaseQuantity('');
                                  else setPurchaseQuantity(val);
                                }}
                                onBlur={() => {
                                  const val = Number(purchaseQuantity);
                                  if (isNaN(val) || val < minQty) setPurchaseQuantity(minQty);
                                  else if (val > maxQty) setPurchaseQuantity(maxQty);
                                }}
                                className="w-20 sm:w-24 text-center bg-transparent text-white font-black text-sm sm:text-base outline-none focus:text-accent transition font-mono"
                              />

                              <button 
                                type="button"
                                onClick={() => setPurchaseQuantity(Math.min(maxQty, Number(purchaseQuantity || 0) + step))}
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition active:scale-95 text-lg"
                              >
                                +
                              </button>
                            </div>


                          </div>


                        </div>



                        {/* Chips rápidos de cantidad para Telegram Stars */}
                        {isStars && (
                          <div className="pt-2 border-t border-white/5">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                              Cantidades frecuentes de Stars:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {starPresets.map(preset => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setPurchaseQuantity(preset)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    Number(purchaseQuantity) === preset
                                      ? 'bg-emerald-500 text-bg shadow-md shadow-emerald-500/20 scale-105'
                                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                                  }`}
                                >
                                  {preset.toLocaleString()} Stars
                                </button>
                              ))}
                            </div>


                          </div>


                        )}
                      </div>


                    );
                  })()}
                </>
              )}
            </div>


          </div>



          {/* Footer Completo Sticky con Total y Botón de Confirmar */}
          {selectedOffer && (
            <footer className="p-4 sm:p-5 bg-[#0d121d] border-t border-white/10 shrink-0 select-none shadow-lg">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider block">Total a Pagar</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                      ${(parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0) * purchaseQuantity).toFixed(4)}
                    </span>
                    <span className="text-xs text-white/60 font-bold uppercase">USDT</span>
                  </div>


                  {wallet && (
                    <span className="text-xs text-white/40 block mt-0.5">
                      Saldo disponible: ${wallet.balance} USDT
                    </span>
                  )}
                </div>



                {(() => {
                  const fieldsList = offersPayload?.fields || offersPayload?.fields_required || selectedProduct.fields || selectedProduct.fields_required || [];
                  const isMissingRequired = fieldsList.some(f => {
                    const k = f.key || f.id;
                    const isReq = f.required !== false;
                    return isReq && (!purchaseFields[k] || !String(purchaseFields[k]).trim());
                  });
                  const isStars = selectedProduct?.id === 'telegram_stars' || selectedProduct?.category_id === 'telegram_stars' || selectedOffer?.id === 'stars';
                  const minQty = Number(selectedOffer?.min_quantity) || (isStars ? 50 : 1);
                  const maxQty = Number(selectedOffer?.max_quantity) || (isStars ? 10000 : 100);
                  const numQty = parseInt(purchaseQuantity, 10) || 0;
                  const isInvalidQty = numQty < minQty || numQty > maxQty;
                  const unitPrice = parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0);
                  const totalCost = unitPrice * numQty;
                  const isInsufficientBalance = wallet && parseFloat(wallet.balance || 0) < totalCost;

                  return (
                    <button 
                      disabled={purchaseLoading || !selectedOffer || isMissingRequired || isInsufficientBalance || isInvalidQty}
                      onClick={handleConfirmPurchase}
                      className="bg-emerald-500 hover:bg-emerald-400 text-bg px-7 sm:px-10 py-3.5 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 shadow-xl shadow-emerald-500/20"
                    >
                      {purchaseLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Procesando Compra...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Confirmar Compra
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>


            </footer>
          )}
        </div>

,
        document.body
      )}

      {/* Modal de Comprobante tras compra exitosa */}
      {completedOrder && (
        <OrderDetailModal order={completedOrder} onClose={() => setCompletedOrder(null)} />
      )}
    </div>
  );
}

// ─── 3. MIS PEDIDOS (ORDERS) ───
export function ResellerB2BOrders() {
  const { ready } = useB2BUserSession();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = () => {
    setRefreshing(true);
    b2bUserApi('/orders')
      .then(r => {
        const list = r?.items || r?.orders || r?.data || (Array.isArray(r) ? r : []);
        setOrders(list);
      })
      .catch(console.error)
      .finally(() => {
        setRefreshing(false);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (ready) {
      fetchOrders();
      const interval = setInterval(() => {
        b2bUserApi('/orders').then(r => {
          const list = r?.items || r?.orders || r?.data;
          if (Array.isArray(list)) setOrders(list);
        }).catch(()=>{});
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [ready]);

  const filteredOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    return orders.filter(o => {
      const matchSearch = 
        (o.product || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.reference || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (o.status || '').toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  if (loading && orders.length === 0) return <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-accent"/></div>;

  const statusColors = { 
    completed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', 
    processing: 'bg-amber-500/15 text-amber-400 border border-amber-500/30', 
    pending: 'bg-orange-500/15 text-orange-400 border border-orange-500/30', 
    failed: 'bg-rose-500/15 text-rose-400 border border-rose-500/30', 
    refunded: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' 
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Historial de Pedidos</h2>
          <p className="text-xs text-white/50">Toca cualquier pedido para ver el código entregado, PIN o comprobante.</p>
        </div>


        <button 
          onClick={fetchOrders}
          disabled={refreshing}
          className="self-start sm:self-auto px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-accent' : ''}`} /> Actualizar
        </button>
      </div>



      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="search"
            placeholder="Buscar por ID, juego, producto o referencia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/40 focus:border-accent outline-none transition"
          />
        </div>



        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-accent"
        >
          <option value="all">Todos los Estados</option>
          <option value="completed">Completados</option>
          <option value="processing">En Proceso</option>
          <option value="failed">Fallidos</option>
          <option value="refunded">Reembolsados</option>
        </select>
      </div>



      <div className="card overflow-hidden border border-white/10 rounded-2xl bg-card/40 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-black/30 text-white/50 border-b border-white/10 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Producto & Opción</th>
                <th className="px-5 py-3.5 text-right">Monto</th>
                <th className="px-5 py-3.5">Fecha</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-white/40">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="w-8 h-8 opacity-20" />
                      <p>No se encontraron pedidos con los filtros aplicados.</p>
                    </div>


                  </td>
                </tr>
              ) : filteredOrders.map(o => (
                <tr 
                  key={o.id} 
                  onClick={() => setSelectedOrder(o)}
                  className="hover:bg-white/5 transition cursor-pointer group"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-white text-xs group-hover:text-accent transition">{o.product}</div>
                    <div className="text-[10px] text-white/40 font-mono mt-0.5">ID: {o.id} {o.reference ? `· ${o.reference}` : ''}</div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-black text-accent text-sm">
                    ${o.amount || o.total}
                  </td>
                  <td className="px-5 py-3.5 text-white/60">
                    {new Date(o.created_at).toLocaleString('es-ES', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black tracking-wide ${statusColors[o.status] || 'bg-white/10 text-white'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); }}
                      className="text-xs text-white/60 group-hover:text-accent font-semibold inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> Comprobante
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


      </div>



      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

// ─── 4. MI SALDO (WALLET) ───
export function ResellerB2BWallet() {
  const { ready } = useB2BUserSession();
  const [wallet, setWallet] = useState({ balance: '0.00', reserved: '0.00', movements: [] });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = () => {
    if (!ready) return;
    setRefreshing(true);
    b2bUserApi('/wallet')
      .then(res => {
        if (res && typeof res === 'object') {
          setWallet({
            balance: res.balance || '0.00',
            reserved: res.reserved || '0.00',
            movements: Array.isArray(res.movements) ? res.movements : []
          });
        }
      })
      .catch(console.error)
      .finally(() => {
        setRefreshing(false);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (ready) {
      fetchWallet();
      const handleRefresh = () => fetchWallet();
      window.addEventListener('b2b:refresh-wallet', handleRefresh);
      window.addEventListener('franchoshop:refresh-me', handleRefresh);
      return () => {
        window.removeEventListener('b2b:refresh-wallet', handleRefresh);
        window.removeEventListener('franchoshop:refresh-me', handleRefresh);
      };
    }
  }, [ready]);

  const exportCSV = () => {
    if (!wallet?.movements?.length) return;
    let csv = "Fecha,Descripcion,Referencia,Monto,Saldo Posterior\n";
    wallet.movements.forEach(m => {
      const date = new Date(m.created_at).toISOString();
      csv += `"${date}","${m.description || m.type}","${m.reference || ''}","${m.amount}","${m.balance_after}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `movimientos_b2b_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMovements = useMemo(() => {
    if (!wallet?.movements || !Array.isArray(wallet.movements)) return [];
    if (filterType === 'in') return wallet.movements.filter(m => parseFloat(m.amount) > 0);
    if (filterType === 'out') return wallet.movements.filter(m => parseFloat(m.amount) < 0);
    return wallet.movements;
  }, [wallet, filterType]);

  if (loading && !wallet.movements?.length && wallet.balance === '0.00') return <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-accent"/></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Tarjeta de Saldo */}
      <div className="card p-5 sm:p-6 border border-white/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-card to-bg shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider block">Saldo Disponible</span>
            <button 
              onClick={fetchWallet} 
              disabled={refreshing}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition"
              title="Actualizar saldo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-accent' : ''}`} />
            </button>
          </div>


          <div className="text-3xl sm:text-4xl font-black text-accent mt-1">${wallet.balance}</div>
          <span className="text-[11px] text-white/40 block mt-1">Saldo retenido en pedidos: ${wallet.reserved}</span>
        </div>


        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-deposit'))}
          className="bg-accent hover:bg-accent/90 text-bg px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-accent/20"
        >
          <WalletCards className="w-4 h-4" /> Recargar Saldo
        </button>
      </div>



      {/* Historial de Movimientos Recientes Compacto */}
      <div className="card border border-white/10 rounded-2xl overflow-hidden bg-card/40 shadow-xl">
        <div className="p-3 sm:p-3.5 border-b border-white/10 bg-black/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-accent"/>
            <h3 className="font-bold text-white text-xs sm:text-sm">Movimientos Recientes</h3>
            <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full font-mono">
              {filteredMovements.length}
            </span>
          </div>


          <div className="flex items-center gap-2 self-end sm:self-auto">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-accent"
            >
              <option value="all">Todos</option>
              <option value="in">Ingresos (+)</option>
              <option value="out">Egresos (-)</option>
            </select>
            <button 
              onClick={exportCSV}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>


        </div>



        {filteredMovements.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-xs flex flex-col items-center gap-2">
            <ReceiptText className="w-7 h-7 opacity-20" />
            <p>No hay movimientos registrados.</p>
          </div>


        ) : (
          <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5 scrollbar-thin">
            {filteredMovements.map((m, i) => {
              const isPositive = parseFloat(m.amount) > 0;
              return (
                <div key={i} className="py-2 px-3 sm:py-2.5 sm:px-4 hover:bg-white/5 flex justify-between items-center transition gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white/90 text-[11px] sm:text-xs truncate leading-snug">
                      {m.description || m.type}
                    </div>


                    <div className="text-[9px] sm:text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono bg-white/5 px-1 rounded text-[9px] truncate max-w-[110px] inline-block">{m.reference || 'N/A'}</span>
                      <span>•</span>
                      <span className="truncate">{new Date(m.created_at).toLocaleString('es-ES', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                    </div>


                  </div>


                  <div className="text-right flex-shrink-0">
                    <div className={`font-black text-xs sm:text-sm font-mono ${isPositive ? 'text-emerald-400' : 'text-white/90'}`}>
                      {isPositive ? '+' : ''}{m.amount}
                    </div>


                    <div className="text-[9px] text-white/40 font-mono mt-0.5">Saldo: ${m.balance_after}</div>
                  </div>


                </div>


              );
            })}
          </div>


        )}
      </div>


    </div>
  );
}

// ─── 5. API Y WEBHOOKS & DOCUMENTACIÓN ───

const API_ENDPOINTS = [
  {
    id: 'get-wallet',
    method: 'GET',
    path: '/v1/wallet',
    category: 'wallet',
    scope: 'wallet:read',
    title: 'Consultar Saldo B2B',
    desc: 'Devuelve el saldo disponible, el importe reservado en órdenes activas y la moneda oficial (USDT).',
    params: [],
    response: {
      data: {
        balance: "150.0000",
        reserved: "12.5000",
        available: "137.5000",
        currency: "USDT"
      }
    }
  },
  {
    id: 'get-wallet-movements',
    method: 'GET',
    path: '/v1/wallet/movements',
    category: 'wallet',
    scope: 'wallet:read',
    title: 'Historial de Movimientos de Saldo',
    desc: 'Lista transacciones (depósitos, compras automáticas, reembolsos y ajustes) con paginación por cursor.',
    params: [
      { name: 'limit', in: 'query', type: 'integer', req: false, desc: 'Máximo de resultados (1-100, default: 25)' },
      { name: 'cursor', in: 'query', type: 'string', req: false, desc: 'Cursor devuelto en next_cursor' },
      { name: 'type', in: 'query', type: 'string', req: false, desc: 'Filtrar por: deposit, order, refund' }
    ],
    response: {
      data: [
        {
          id: "mov_8a7b6c5d4e3f",
          type: "order",
          amount: "-0.7531",
          balance_after: "137.5000",
          currency: "USDT",
          reference: "FSB2B-A1B2C3D4E5F6",
          description: "Compra 110 Diamonds - Free Fire (LATAM)",
          created_at: "2026-09-06T18:30:00Z"
        }
      ],
      meta: { limit: 25, has_more: false, next_cursor: null }
    }
  },
  {
    id: 'get-catalog-products',
    method: 'GET',
    path: '/v1/catalog/products',
    category: 'catalog',
    scope: 'catalog:read',
    title: 'Listar Catálogo de Juegos y Productos',
    desc: 'Devuelve todos los servicios automatizados del catálogo (Free Fire, Blood Strike, Roblox, Telegram Stars, Steam, etc.) con sus identificadores públicos opacos.',
    params: [
      { name: 'limit', in: 'query', type: 'integer', req: false, desc: 'Resultados por página (1-100, default: 50)' },
      { name: 'group', in: 'query', type: 'string', req: false, desc: 'Filtro de grupo: service_topup, giftcards, gamekeys, manual_services, steam_gifts' },
      { name: 'search', in: 'query', type: 'string', req: false, desc: 'Búsqueda por texto (ej: "free fire", "blood strike")' },
      { name: 'available', in: 'query', type: 'boolean', req: false, desc: 'Filtrar por disponibilidad (true/false)' },
      { name: 'cursor', in: 'query', type: 'string', req: false, desc: 'Cursor de paginación para la siguiente página' }
    ],
    response: {
      data: [
        {
          id: "prd_RBynh3P7Ux7ECLEbKpIEpsYW",
          name: "Free Fire (LATAM)",
          type: "topup",
          group: "service_topup",
          region: "LATAM",
          platform: "Garena",
          available: true,
          image_url: "/api/v1/reseller/catalog/products/prd_RBynh3P7Ux7ECLEbKpIEpsYW/image"
        },
        {
          id: "prd_WXP2RZvedVw_O8soK4evYweN",
          name: "Blood Strike",
          type: "topup",
          group: "service_topup",
          region: "Global",
          platform: "NetEase",
          available: true,
          image_url: "/api/v1/reseller/catalog/products/prd_WXP2RZvedVw_O8soK4evYweN/image"
        }
      ],
      meta: { limit: 50, has_more: true, next_cursor: "eyJpZCI6...==" }
    }
  },
  {
    id: 'get-catalog-offers',
    method: 'GET',
    path: '/v1/catalog/products/{product_id}/offers',
    category: 'catalog',
    scope: 'catalog:read',
    title: 'Ofertas, Precios Mayoristas y Campos Requeridos',
    desc: 'Devuelve todas las denominaciones (diamantes, pases, saldo) del juego seleccionado con el precio final mayorista según tu plan activo y los campos requeridos en la orden (ej: player_id).',
    params: [
      { name: 'product_id', in: 'path', type: 'string', req: true, desc: 'ID público del producto (ej: prd_RBynh3P7Ux7ECLEbKpIEpsYW)' }
    ],
    response: {
      data: {
        product: {
          id: "prd_RBynh3P7Ux7ECLEbKpIEpsYW",
          name: "Free Fire (LATAM)",
          type: "topup",
          group: "service_topup",
          available: true
        },
        offers: [
          {
            id: "off_2bN8vG9_110diamonds",
            name: "110 Diamonds",
            unit_price: "0.7531",
            currency: "USDT",
            available: true,
            min_quantity: 1,
            max_quantity: 1,
            delivery_minutes: 1
          },
          {
            id: "off_4dE0xI1_341diamonds",
            name: "341 Diamonds",
            unit_price: "2.2549",
            currency: "USDT",
            available: true,
            min_quantity: 1,
            max_quantity: 1,
            delivery_minutes: 1
          }
        ],
        fields: [
          {
            key: "player_id",
            label: "ID de Jugador (UID)",
            type: "text",
            required: true,
            options: []
          }
        ],
        purchases_allowed: true
      }
    }
  },
  {
    id: 'get-product-image',
    method: 'GET',
    path: '/v1/catalog/products/{product_id}/image',
    category: 'catalog',
    scope: 'catalog:read',
    title: 'Obtener Imagen Oficial de Producto',
    desc: 'Retorna directamente el stream binario de la imagen oficial del producto (WebP/PNG/JPEG) para su visualización en tiendas o bots.',
    params: [
      { name: 'product_id', in: 'path', type: 'string', req: true, desc: 'ID público del producto' }
    ],
    response: "[Contenido binario de la imagen con su cabecera Content-Type correspondiente]"
  },
  {
    id: 'post-orders',
    method: 'POST',
    path: '/v1/orders',
    category: 'orders',
    scope: 'orders:write',
    title: 'Crear Pedido Automatizado',
    desc: 'Ejecuta una compra mayorista real descontando saldo de tu billetera y enviando la recarga de forma instantánea. Requiere Idempotency-Key para garantizar cero duplicados.',
    params: [
      { name: 'Idempotency-Key', in: 'header', type: 'string', req: true, desc: 'Clave única de 8 a 128 caracteres para evitar cargos dobles' },
      { name: 'product_id', in: 'body', type: 'string', req: true, desc: 'ID del producto obtenido del catálogo (prd_...)' },
      { name: 'offer_id', in: 'body', type: 'string', req: true, desc: 'ID de la oferta seleccionada (off_...)' },
      { name: 'quantity', in: 'body', type: 'integer', req: false, desc: 'Cantidad deseada (default: 1)' },
      { name: 'fields', in: 'body', type: 'object', req: true, desc: 'Campos requeridos por el juego: {"player_id": "123456789"}' }
    ],
    request: {
      product_id: "prd_RBynh3P7Ux7ECLEbKpIEpsYW",
      offer_id: "off_2bN8vG9_110diamonds",
      quantity: 1,
      fields: {
        player_id: "123456789"
      }
    },
    response: {
      data: {
        id: "FSB2B-A1B2C3D4E5F6G7H8",
        status: "completed",
        product_name: "Free Fire (LATAM)",
        offer_name: "110 Diamonds",
        quantity: 1,
        unit_price: "0.7531",
        total: "0.7531",
        currency: "USDT",
        fields: { player_id: "123456789" },
        delivery: {
          type: "direct_account_credit",
          note: "Recarga acreditada con éxito en la cuenta de juego"
        },
        created_at: "2026-09-06T18:32:00Z"
      }
    }
  },
  {
    id: 'get-orders',
    method: 'GET',
    path: '/v1/orders',
    category: 'orders',
    scope: 'orders:read',
    title: 'Listar Historial de Pedidos',
    desc: 'Devuelve pedidos ordenados cronológicamente con paginación por cursor. Reconcilia automáticamente estados con el motor de procesamiento.',
    params: [
      { name: 'limit', in: 'query', type: 'integer', req: false, desc: 'Resultados por página (1-100, default: 25)' },
      { name: 'status', in: 'query', type: 'string', req: false, desc: 'Filtrar por: processing, completed, failed, refunded' },
      { name: 'cursor', in: 'query', type: 'string', req: false, desc: 'Cursor de paginación' }
    ],
    response: {
      data: [
        {
          id: "FSB2B-A1B2C3D4E5F6G7H8",
          status: "completed",
          product_name: "Free Fire (LATAM)",
          offer_name: "110 Diamonds",
          total: "0.7531",
          currency: "USDT",
          created_at: "2026-09-06T18:32:00Z"
        }
      ],
      meta: { limit: 25, has_more: false, next_cursor: null }
    }
  },
  {
    id: 'get-order-detail',
    method: 'GET',
    path: '/v1/orders/{order_id}',
    category: 'orders',
    scope: 'orders:read',
    title: 'Consultar Estado y Entrega de Pedido',
    desc: 'Consulta el detalle final de un pedido. En productos de código o pines (giftcards, llaves), incluye el PIN en la clave delivery.pins.',
    params: [
      { name: 'order_id', in: 'path', type: 'string', req: true, desc: 'ID único del pedido (ej: FSB2B-A1B2C3D4E5F6G7H8)' }
    ],
    response: {
      data: {
        id: "FSB2B-A1B2C3D4E5F6G7H8",
        status: "completed",
        delivery: {
          type: "code_delivery",
          codes: ["GIFT-XYZ-9821-4432"],
          pin: "GIFT-XYZ-9821-4432"
        },
        product_name: "Free Fire (LATAM)",
        offer_name: "110 Diamonds",
        total: "0.7531"
      }
    }
  },
  {
    id: 'post-api-keys',
    method: 'POST',
    path: '/api-keys',
    category: 'keys',
    scope: 'admin/session',
    title: 'Crear Clave API',
    desc: 'Crea una clave API segura fsb2b_... para conectar tus bots o servidores. El token completo se muestra una única vez.',
    params: [
      { name: 'name', in: 'body', type: 'string', req: true, desc: 'Nombre descriptivo (ej: Bot Telegram)' },
      { name: 'scopes', in: 'body', type: 'array', req: false, desc: 'Lista de scopes: catalog:read, orders:read, orders:write, wallet:read, webhooks:read, webhooks:write' }
    ],
    response: {
      data: { id: "ak_81726", name: "Bot Telegram", prefix: "fsb2b_c8a9e2...", scopes: ["catalog:read","orders:read","orders:write","wallet:read"], secret: "fsb2b_c8a9e2f41d0b741893...", created_at: "2026-09-06T18:00:00Z" }
    }
  },
  {
    id: 'get-webhooks',
    method: 'GET',
    path: '/v1/webhooks',
    category: 'webhooks',
    scope: 'webhooks:read',
    title: 'Listar Endpoints Webhook',
    desc: 'Devuelve la lista de URLs receptoras configuradas para recibir notificaciones en tiempo real.',
    params: [
      { name: 'limit', in: 'query', type: 'integer', req: false, desc: 'Máximo de resultados (1-100, default: 25)' }
    ],
    response: {
      data: [
        {
          id: "whe_abc123",
          name: "Bot Telegram",
          url: "https://mi-servidor.com/webhook",
          masked_secret: "whsec_e4b8...7f2d",
          events: ["order.completed", "order.failed"],
          status: "active",
          created_at: "2026-09-06T18:00:00Z"
        }
      ]
    }
  },
  {
    id: 'post-webhooks',
    method: 'POST',
    path: '/v1/webhooks',
    category: 'webhooks',
    scope: 'webhooks:write',
    title: 'Registrar Endpoint Webhook',
    desc: 'Configura una URL HTTPS en tu servidor para recibir eventos en tiempo real firmados con HMAC-SHA256. El secreto se entrega una sola vez.',
    params: [
      { name: 'name', in: 'body', type: 'string', req: true, desc: 'Nombre identificador (ej: Bot Telegram, Mi CRM)' },
      { name: 'url', in: 'body', type: 'string', req: true, desc: 'URL HTTPS pública receptora' },
      { name: 'events', in: 'body', type: 'array', req: true, desc: 'Lista de eventos a escuchar: order.completed, order.failed, order.processing' }
    ],
    response: {
      data: {
        id: "whe_abc123",
        name: "Bot Telegram",
        url: "https://mi-servidor.com/webhook",
        secret: "whsec_e4b8a1c97f2d...",
        events: ["order.completed", "order.failed"]
      }
    }
  },
  {
    id: 'get-webhook-deliveries',
    method: 'GET',
    path: '/v1/webhook-deliveries',
    category: 'webhooks',
    scope: 'webhooks:read',
    title: 'Historial de Entregas de Webhooks',
    desc: 'Lista los registros de eventos enviados a tus servidores con código HTTP de respuesta, tiempo de ejecución y estado.',
    params: [
      { name: 'limit', in: 'query', type: 'integer', req: false, desc: 'Máximo de resultados (1-100, default: 25)' },
      { name: 'status', in: 'query', type: 'string', req: false, desc: 'Filtrar por: delivered, failed, pending' }
    ],
    response: {
      data: [
        {
          id: "del_9f8e7d6c5b",
          event: "order.completed",
          status: "delivered",
          status_code: 200,
          attempts: 1,
          created_at: "2026-09-06T18:32:05Z"
        }
      ]
    }
  },
  {
    id: 'get-sms-countries',
    method: 'GET',
    path: '/sms/countries',
    category: 'sms',
    scope: 'sms:read',
    title: 'Listar Países para Números SMS',
    desc: 'Devuelve la lista completa de países con bandera emoji, nombre y código ISO para solicitar números virtuales.',
    params: [],
    response: {
      ok: true,
      items: [
        { country: "usa", name: "Estados Unidos", iso: "US", flag_emoji: "🇺🇸", image_url: "https://franchoshop.com/api/icons/usa.png", icon_url: "https://franchoshop.com/api/icons/usa.png", is_featured: true },
        { country: "england", name: "Reino Unido", iso: "GB", flag_emoji: "🇬🇧", image_url: null, icon_url: null, is_featured: true },
        { country: "brazil", name: "Brasil", iso: "BR", flag_emoji: "🇧🇷", image_url: null, icon_url: null, is_featured: false }
      ],
      count: 180
    }
  },
  {
    id: 'get-sms-services',
    method: 'GET',
    path: '/sms/services',
    category: 'sms',
    scope: 'sms:read',
    title: 'Servicios SMS y Precios Mayoristas por Nivel',
    desc: 'Lista servicios/apps disponibles (WhatsApp, Telegram, etc.) con sus iconos configurados, stock en tiempo real y precio USDT según tu nivel (Oro VIP +7%, Plata +10%, Bronce +14%, Estándar +50%).',
    params: [
      { name: 'country', in: 'query', type: 'string', req: true, desc: 'Código del país (ej: usa, england, brazil)' }
    ],
    response: {
      ok: true,
      country: "usa",
      currency: "USDT",
      tier: "gold",
      tier_name: "Oro VIP",
      markup_pct: 7.0,
      items: [
        { service: "whatsapp", name: "WhatsApp", price: "0.75", currency: "USDT", image_url: "https://franchoshop.com/api/icons/whatsapp.png", icon_url: "https://franchoshop.com/api/icons/whatsapp.png", qty: 240, is_featured: true },
        { service: "telegram", name: "Telegram", price: "0.55", currency: "USDT", image_url: "https://franchoshop.com/api/icons/telegram.png", icon_url: "https://franchoshop.com/api/icons/telegram.png", qty: 580, is_featured: true },
        { service: "google", name: "Google / Gmail / YouTube", price: "0.45", currency: "USDT", image_url: null, icon_url: null, qty: 1200, is_featured: true }
      ],
      count: 150
    }
  },
  {
    id: 'get-sms-operators',
    method: 'GET',
    path: '/sms/operators',
    category: 'sms',
    scope: 'sms:read',
    title: 'Operadores Móviles para País y Servicio',
    desc: 'Lista operadores disponibles, stock y costo específico para una combinación de país y servicio.',
    params: [
      { name: 'country', in: 'query', type: 'string', req: true, desc: 'Código del país (ej: usa)' },
      { name: 'service', in: 'query', type: 'string', req: true, desc: 'Código del servicio (ej: whatsapp)' }
    ],
    response: {
      ok: true,
      country: "usa",
      service: "whatsapp",
      items: [
        { operator: "virtual21", price: "0.75", currency: "USDT", qty: 150, rate: 95 },
        { operator: "any", price: "0.75", currency: "USDT", qty: 240, rate: 92 }
      ],
      count: 2
    }
  },
  {
    id: 'post-sms-order',
    method: 'POST',
    path: '/sms/orders',
    category: 'sms',
    scope: 'sms:write',
    title: 'Comprar Número Virtual SMS',
    desc: 'Reserva un número virtual de teléfono. Descuenta el saldo USDT al precio mayorista de tu nivel. Admite Idempotency-Key y client_order_id.',
    params: [
      { name: 'Idempotency-Key', in: 'header', type: 'string', req: false, desc: 'Identificador único de idempotencia (recomendado)' },
      { name: 'country', in: 'body', type: 'string', req: true, desc: 'Código del país (ej: usa)' },
      { name: 'service', in: 'body', type: 'string', req: true, desc: 'Servicio (ej: whatsapp, telegram)' },
      { name: 'operator', in: 'body', type: 'string', req: false, desc: 'Operador específico o "any" (por defecto el más económico)' },
      { name: 'client_order_id', in: 'body', type: 'string', req: false, desc: 'Identificador único de orden en tu sistema' }
    ],
    response: {
      ok: true,
      order_id: "sms_45",
      id: 45,
      client_order_id: "sms-wa-1001",
      phone: "+12025550198",
      country: "usa",
      service: "whatsapp",
      operator: "virtual21",
      price: "0.75",
      currency: "USDT",
      tier: "gold",
      tier_name: "Oro VIP",
      markup_pct: 7.0,
      status: "pending",
      can_cancel_after_seconds: 120,
      expires_in_seconds: 1200,
      created_at: 1759590000.0
    }
  },
  {
    id: 'get-sms-order',
    method: 'GET',
    path: '/sms/orders/{order_id}',
    category: 'sms',
    scope: 'sms:read',
    title: 'Consultar Estado y Código SMS Recibido',
    desc: 'Sincroniza en tiempo real con la operadora. Cuando llega el SMS, devuelve el código en sms_code y el mensaje completo en sms_text. Expiración automática a los 20 min con reembolso 100%.',
    params: [
      { name: 'order_id', in: 'path', type: 'string', req: true, desc: 'ID de la orden (ej: sms_45 o 45)' }
    ],
    response: {
      ok: true,
      order_id: "sms_45",
      id: 45,
      phone: "+12025550198",
      country: "usa",
      service: "whatsapp",
      operator: "virtual21",
      status: "completed",
      sms_code: "482910",
      sms_text: "Tu codigo de WhatsApp es 482-910",
      price: "0.75",
      currency: "USDT",
      can_cancel: false,
      seconds_remaining: 0,
      refunded: false
    }
  },
  {
    id: 'post-sms-order-cancel',
    method: 'POST',
    path: '/sms/orders/{order_id}/cancel',
    category: 'sms',
    scope: 'sms:write',
    title: 'Cancelar Número Virtual y Reembolsar',
    desc: 'Cancela la orden si han pasado al menos 120 segundos (2 minutos) sin recibir código SMS. Reembolsa el 100% del saldo USDT de forma instantánea.',
    params: [
      { name: 'order_id', in: 'path', type: 'string', req: true, desc: 'ID de la orden a cancelar (ej: sms_45)' }
    ],
    response: {
      ok: true,
      order_id: "sms_45",
      status: "canceled",
      refunded: true,
      refund_amount: "0.75",
      currency: "USDT",
      message: "Orden cancelada con éxito y saldo reembolsado inmediatamente."
    }
  },
  {
    id: 'get-sms-orders',
    method: 'GET',
    path: '/sms/orders',
    category: 'sms',
    scope: 'sms:read',
    title: 'Historial Paginado de Órdenes SMS',
    desc: 'Lista los pedidos de números virtuales de la cuenta con paginación por cursor y filtros.',
    params: [
      { name: 'limit', in: 'query', type: 'integer', req: false, desc: 'Límite de resultados (1-100, default: 25)' },
      { name: 'cursor', in: 'query', type: 'string', req: false, desc: 'Cursor de paginación para la siguiente página' }
    ],
    response: {
      ok: true,
      items: [
        {
          id: 45,
          order_id: "sms_45",
          phone: "+12025550198",
          country: "usa",
          service: "whatsapp",
          status: "completed",
          sms_code: "482910",
          price: "0.75",
          currency: "USDT",
          created_at: 1759590000.0
        }
      ],
      count: 1,
      has_more: false,
      next_cursor: null
    }
  }
];

const GAMES_GUIDE = [
  { name: "Free Fire (LATAM / USA / BR / EU)", type: "Recarga Automática ID", fields: "player_id (UID del jugador)", notes: "Entrega automática en 5–30 segundos directamente en la cuenta." },
  { name: "Blood Strike & Blood Strike MENA", type: "Recarga Automática ID", fields: "player_id (User ID)", notes: "Acreditación directa e instantánea de Oro y Pases." },
  { name: "Roblox", type: "Recarga Automática ID / Code", fields: "player_id / username", notes: "Robux acreditados directamente o vía gift card digital." },
  { name: "Mobile Legends: Bang Bang", type: "Recarga Automática ID", fields: "player_id (User ID) + zone_id (Servidor)", notes: "Acreditación inmediata de Diamantes y Pases Semanales." },
  { name: "Telegram Stars & Premium", type: "Recarga Directa a Usuario", fields: "telegram_username (ej: @usuario)", notes: "Entrega oficial directa a cuentas de Telegram sin pedir contraseña." },
  { name: "Steam Wallet (Auto-Tasa)", type: "Recarga por Saldo", fields: "steam_login (Login de Steam) + amount (Monto)", notes: "Carga automática de saldo en la moneda local o USD." },
  { name: "Steam Gifts (Juegos Digitales)", type: "Entrega por Invitación", fields: "invite_url (Enlace de amigo Steam)", notes: "Envío automatizado del juego a la biblioteca de Steam." },
  { name: "CapCut Pro", type: "Suscripción", fields: "email (Correo de cuenta CapCut)", notes: "Activación directa de membresías Pro." },
  { name: "Gift Cards Digitales", type: "Códigos PIN Digitales", fields: "Ninguno", notes: "Apple, Google Play, PlayStation, Xbox, Razer Gold, Nintendo. Entrega de PINs en respuesta y webhook." }
];

// Caché de blobs compartida para imágenes (evita recargas y oculta el proveedor)
const _imgBlobCache = new Map();

function AuthImage({ src, alt, className, fallbackText }) {
  const [blobUrl, setBlobUrl] = useState(() => _imgBlobCache.get(src) || null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  // IntersectionObserver: solo carga cuando es visible en pantalla
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '60px' });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !src || _imgBlobCache.get(src)) return;
    let cancelled = false;
    fetch(src, { credentials: 'include' })
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        _imgBlobCache.set(src, url);
        setBlobUrl(url);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [visible, src]);

  return (
    <div ref={ref} className="w-full h-full">
      {failed ? (
        <div className="w-full h-full flex items-center justify-center text-white/20 text-[8px] font-bold text-center px-1 leading-tight">
          {fallbackText || '?'}
        </div>


      ) : blobUrl ? (
        <img src={blobUrl} alt={alt} className={className} />
      ) : (
        <div className="w-full h-full bg-white/5 animate-pulse rounded" />
      )}
    </div>
  );
}

export function ResellerB2BAPI({ standalone = false, onBack = null, onNavigateToPanel = null, initialSubtab = 'docs', isSandboxOnly = false }) {
  const { ready } = useB2BUserSession();
  const [activeSubtab, setActiveSubtab] = useState(initialSubtab || (standalone ? 'docs' : 'keys'));
  const [b2bAccount, setB2bAccount] = useState(null);

  // Keys & Webhooks state
  const [keys, setKeys] = useState([]);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState(null); // spinner per-key delete
  const [shareAIModal, setShareAIModal] = useState(false);  // modal compartir con IA

  const [webhooks, setWebhooks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [showAddWebhookModal, setShowAddWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookName, setWebhookName] = useState('');
  const [webhookEvents, setWebhookEvents] = useState(['order.completed', 'order.failed']);

  // Docs interactive state
  const [copiedId, setCopiedId] = useState(null);
  const [codeLang, setCodeLang] = useState('curl'); // 'curl', 'node', 'python'
  const [codeSnippet, setCodeSnippet] = useState('create_order');
  const [endpointFilter, setEndpointFilter] = useState('all');
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);

  // Catalog live preview state (no purchases, read-only)
  const [previewProducts, setPreviewProducts] = useState([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogGroupFilter, setCatalogGroupFilter] = useState('all');

  useEffect(() => {
    if (ready) {
      loadKeys();
      loadWebhooks();
      loadDeliveries();
      b2bUserApi('/me')
        .then(r => setB2bAccount(r.account || null))
        .catch(() => {});
    }
  }, [ready]);

  const isSandboxMode = isSandboxOnly || b2bAccount?.is_sandbox_only || b2bAccount?.subscription?.plan?.code === 'sandbox';

  // Load catalog preview when session is ready (read-only, no purchases)
  useEffect(() => {
    if (ready) {
      b2bUserApi('/v1/catalog/products?limit=100&available=true')
        .then(r => {
          if (Array.isArray(r.data)) setPreviewProducts(r.data);
          setPreviewLoaded(true);
        })
        .catch(() => setPreviewLoaded(true));
    }
  }, [ready]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const loadKeys = () => {
    b2bUserApi('/api-keys')
      .then(r => {
        setKeys(r.data || []);
        setKeysLoaded(true);
      })
      .catch(err => {
        console.error('Error cargando claves:', err);
        setKeys([]);
        setKeysLoaded(true);
      });
  };

  const loadWebhooks = () => {
    b2bUserApi('/webhooks')
      .then(r => setWebhooks(r.data || []))
      .catch(err => {
        console.error('Error cargando webhooks:', err);
        setWebhooks([]);
      });
  };

  const loadDeliveries = () => {
    b2bUserApi('/webhook-deliveries?limit=25')
      .then(r => setDeliveries(r.data || []))
      .catch(err => {
        console.error('Error cargando entregas:', err);
        setDeliveries([]);
      });
  };

  const handleCreateKey = async (isTest = false) => {
    if (isSandboxMode && !isTest) {
      alert("Tu cuenta está en Modo Desarrollador Sandbox.\n\nPuedes crear claves de prueba Sandbox para simular pedidos y webhooks con costo cero.\n\nPara activar claves de Producción en vivo con acceso comercial mayorista, recarga un mínimo de $50.00 USDT en tu cuenta.");
      return;
    }

    const isTestFinal = isTest || isSandboxMode;
    const typeLabel = isTestFinal ? 'de PRUEBAS (Sandbox - Cero cobros)' : 'de PRODUCCIÓN';
    const defaultName = isTestFinal ? 'Bot Pruebas Sandbox' : 'Bot Telegram';
    const name = prompt(`Nombre identificador para la nueva clave API ${typeLabel}:`, defaultName);
    if (!name || !name.trim()) return;
    setLoading(true);
    try {
      const res = await b2bUserApiMut('/api-keys', {
        name: name.trim(),
        is_test: isTestFinal,
        scopes: ['catalog:read', 'orders:read', 'orders:write', 'wallet:read', 'webhooks:read', 'webhooks:write']
      });
      const secret = res.data?.secret || res.secret;
      setNewKeySecret({ name: name.trim(), secret, isTest: isTestFinal });
      // Actualización optimista: añadir la clave a la lista sin recargar
      const newKey = res.data || {};
      setKeys(prev => [...prev, { ...newKey, name: name.trim(), is_test: isTestFinal }]);
      // Luego sincronizar con el servidor para tener los datos reales
      setTimeout(() => loadKeys(), 500);
    } catch (e) {
      alert('Error creando clave: ' + (e.message || 'Intenta de nuevo'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm('¿Revocar esta clave API?\n\nCualquier bot o servidor que la use dejará de funcionar inmediatamente.')) return;
    // Optimistic remove
    setDeletingKeyId(id);
    setKeys(prev => prev.filter(k => k.id !== id));
    try {
      await b2bUserApiMut(`/api-keys/${id}`, null, 'DELETE');
    } catch (e) {
      // Revertir si falla
      loadKeys();
      alert('Error al revocar: ' + (e.message || 'Intenta de nuevo'));
    } finally {
      setDeletingKeyId(null);
    }
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!webhookUrl || !webhookName) return;
    setLoading(true);
    try {
      await b2bUserApiMut('/webhooks', {
        name: webhookName,
        url: webhookUrl,
        events: webhookEvents
      });
      setShowAddWebhookModal(false);
      setWebhookUrl('');
      setWebhookName('');
      loadWebhooks();
      alert('Endpoint registrado correctamente.');
    } catch (err) {
      alert('Error al registrar webhook: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (id) => {
    if (!confirm('¿Desactivar este webhook?')) return;
    try {
      await b2bUserApiMut(`/webhooks/${id}`, null, 'DELETE');
      loadWebhooks();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRetryDelivery = async (id) => {
    try {
      await b2bUserApiMut(`/webhook-deliveries/${id}/retry`, {}, 'POST');
      alert('Reintento enviado correctamente.');
      loadDeliveries();
    } catch (err) {
      alert(err.message);
    }
  };

  // Filtered endpoints
  const filteredEndpoints = API_ENDPOINTS.filter(ep => {
    if (endpointFilter === 'all') return true;
    return ep.category === endpointFilter;
  });

  // Code Snippet generators
  const getCodeContent = () => {
    const baseUrl = "https://franchoshop.com/api/v1/reseller";

    if (codeLang === 'curl') {
      if (codeSnippet === 'wallet') {
        return `curl -X GET "${baseUrl}/v1/wallet" \
  -H "Authorization: Bearer fs_live_TU_CLAVE_API"`;
      }
      if (codeSnippet === 'catalog') {
        return `curl -X GET "${baseUrl}/v1/catalog/products?limit=25&group=service_topup" \
  -H "Authorization: Bearer fs_live_TU_CLAVE_API"`;
      }
      if (codeSnippet === 'offers') {
        return `curl -X GET "${baseUrl}/v1/catalog/products/prd_RBynh3P7Ux7ECLEbKpIEpsYW/offers" \
  -H "Authorization: Bearer fs_live_TU_CLAVE_API"`;
      }
      if (codeSnippet === 'create_order') {
        return `curl -X POST "${baseUrl}/v1/orders" \
  -H "Authorization: Bearer fs_live_TU_CLAVE_API" \
  -H "Idempotency-Key: bot-order-$(date +%s)" \
  -H "X-Sandbox: true" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prd_RBynh3P7Ux7ECLEbKpIEpsYW",
    "offer_id": "off_2bN8vG9_110diamonds",
    "quantity": 1,
    "fields": {
      "player_id": "123456789"
    }
  }'`;
      }
      if (codeSnippet === 'order_status') {
        return `curl -X GET "${baseUrl}/v1/orders/FSB2B-A1B2C3D4E5F6G7H8" \
  -H "Authorization: Bearer fs_live_TU_CLAVE_API"`;
      }
      if (codeSnippet === 'webhook_verify') {
        return `# El encabezado X-Francho-Signature contiene la firma HMAC-SHA256 del cuerpo recibido:
# X-Francho-Signature: sha256=abcdef123456...
# Verifica con tu secreto (whsec_...) que coincida con el digest del body.`;
      }
    }

    if (codeLang === 'node') {
      if (codeSnippet === 'wallet') {
        return `// Consultar Saldo B2B (Node.js 18+ / ESM)
const res = await fetch("${baseUrl}/v1/wallet", {
  headers: { "Authorization": "Bearer fs_live_TU_CLAVE_API" }
});
const { data: wallet } = await res.json();
console.log("Saldo disponible:", wallet.available, wallet.currency);`;
      }
      if (codeSnippet === 'catalog') {
        return `// Listar Productos del Catálogo
const res = await fetch("${baseUrl}/v1/catalog/products?limit=25", {
  headers: { "Authorization": "Bearer fs_live_TU_CLAVE_API" }
});
const { data: products } = await res.json();
console.log("Productos disponibles:", products.map(p => ({ id: p.id, name: p.name })));`;
      }
      if (codeSnippet === 'offers') {
        return `// Consultar Ofertas y Precios de Free Fire LATAM
const productId = "prd_RBynh3P7Ux7ECLEbKpIEpsYW";
const res = await fetch(\`${baseUrl}/v1/catalog/products/\${productId}/offers\`, {
  headers: { "Authorization": "Bearer fs_live_TU_CLAVE_API" }
});
const { data } = await res.json();
console.log("Ofertas disponibles:", data.offers.map(o => \`\${o.name}: \${o.unit_price} USDT\`));
console.log("Campos requeridos:", data.fields);`;
      }
      if (codeSnippet === 'create_order') {
        return `import crypto from "crypto";

// Crear Pedido con Idempotencia
const res = await fetch("${baseUrl}/v1/orders", {
  method: "POST",
  headers: {
    "Authorization": "Bearer fs_live_TU_CLAVE_API",
    "Idempotency-Key": "pedido-" + crypto.randomUUID(),
    "X-Sandbox": "true", // Opcional: prueba sin cobro real
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    product_id: "prd_RBynh3P7Ux7ECLEbKpIEpsYW", // Free Fire (LATAM)
    offer_id: "off_2bN8vG9_110diamonds",
    quantity: 1,
    fields: {
      player_id: "123456789"
    }
  })
});

const result = await res.json();
console.log("Pedido creado:", result.data.id, "Estado:", result.data.status);`;
      }
      if (codeSnippet === 'order_status') {
        return `// Consultar Estado y Pines de Entrega
const orderId = "FSB2B-A1B2C3D4E5F6G7H8";
const res = await fetch(\`${baseUrl}/v1/orders/\${orderId}\`, {
  headers: { "Authorization": "Bearer fs_live_TU_CLAVE_API" }
});
const { data: order } = await res.json();
console.log("Estado:", order.status, "Entrega:", order.delivery);`;
      }
      if (codeSnippet === 'webhook_verify') {
        return `import crypto from "crypto";
import express from "express";

const app = express();
const WEBHOOK_SECRET = "whsec_TU_SECRETO_CONFIGURADO";

// Usar express.raw para preservar los bytes exactos del cuerpo
app.post("/webhook/francho", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-francho-signature"]; // sha256=...
  const expected = "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(req.body).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature || ""), Buffer.from(expected))) {
    return res.status(401).send("Firma HMAC inválida");
  }

  const event = JSON.parse(req.body.toString("utf-8"));
  console.log("Evento recibido:", event.event, event.data);
  res.json({ ok: true });
});`;
      }
    }

    if (codeLang === 'python') {
      if (codeSnippet === 'wallet') {
        return `import requests

res = requests.get(
    "${baseUrl}/v1/wallet",
    headers={"Authorization": "Bearer fs_live_TU_CLAVE_API"},
    timeout=15,
)
wallet = res.json()["data"]
print(f"Saldo disponible: {wallet['available']} {wallet['currency']}")`;
      }
      if (codeSnippet === 'catalog') {
        return `import requests

res = requests.get(
    "${baseUrl}/v1/catalog/products",
    params={"limit": 25, "group": "service_topup"},
    headers={"Authorization": "Bearer fs_live_TU_CLAVE_API"},
    timeout=20,
)
for product in res.json()["data"]:
    print(product["id"], product["name"], product["type"])`;
      }
      if (codeSnippet === 'offers') {
        return `import requests

product_id = "prd_RBynh3P7Ux7ECLEbKpIEpsYW" # Free Fire LATAM
res = requests.get(
    f"${baseUrl}/v1/catalog/products/{product_id}/offers",
    headers={"Authorization": "Bearer fs_live_TU_CLAVE_API"},
    timeout=20,
)
data = res.json()["data"]
for offer in data["offers"]:
    print(f"{offer['id']}: {offer['name']} -> \${offer['unit_price']} USDT")
print("Campos requeridos:", data["fields"])`;
      }
      if (codeSnippet === 'create_order') {
        return `import requests, uuid

API_KEY = "fs_live_TU_CLAVE_API"

payload = {
    "product_id": "prd_RBynh3P7Ux7ECLEbKpIEpsYW",  # Free Fire (LATAM)
    "offer_id": "off_2bN8vG9_110diamonds",
    "quantity": 1,
    "fields": {"player_id": "123456789"},
}

res = requests.post(
    "${baseUrl}/v1/orders",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Idempotency-Key": f"bot-order-{uuid.uuid4()}",
        "X-Sandbox": "true",  # Opcional: prueba sin costo real
        "Content-Type": "application/json",
    },
    json=payload,
    timeout=45,
)

order = res.json()["data"]
print(f"Pedido: {order['id']} - Estado: {order['status']} - Total: {order['total']} USDT")`;
      }
      if (codeSnippet === 'order_status') {
        return `import requests

order_id = "FSB2B-A1B2C3D4E5F6G7H8"
res = requests.get(
    f"${baseUrl}/v1/orders/{order_id}",
    headers={"Authorization": "Bearer fs_live_TU_CLAVE_API"},
    timeout=15,
)
order = res.json()["data"]
print(f"Estado: {order['status']}, Entrega: {order.get('delivery')}")`;
      }
      if (codeSnippet === 'webhook_verify') {
        return `import hmac, hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = "whsec_TU_SECRETO_CONFIGURADO"

@app.post("/webhook/francho")
async def webhook_handler(request: Request):
    signature = request.headers.get("x-francho-signature", "")
    body_bytes = await request.body()
    
    expected = "sha256=" + hmac.new(WEBHOOK_SECRET.encode(), body_bytes, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Firma inválida")

    event = await request.json()
    print("Evento recibido:", event.get("event"), event.get("data"))
    return {"ok": True}`;
      }
    }

    return '';
  };

  return (
    <div className={standalone ? "w-full flex-1 h-full min-h-0 overflow-y-auto bg-[#070b10] text-[#eef3f6] pb-28 [will-change:scroll-position] overscroll-y-contain" : "space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300"}>
      
      {/* Standalone Header (cuando se visita directamente desde la tienda o footer) */}
      {standalone && (
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0b1015]/95 px-4 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold transition active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 text-accent" /> Volver
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-white hidden sm:inline">FRANCHO <span className="text-accent">SHOP</span></span>
              <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30 text-[10px] font-black uppercase tracking-wider">
                API B2B · v1.0
              </span>
            </div>


          </div>



          <div className="flex items-center gap-2">
            {onNavigateToPanel && (
              <button
                onClick={onNavigateToPanel}
                className="bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-accent" /> Panel B2B
              </button>
            )}
          </div>


        </header>
      )}

      {/* Main Container */}
      <div className={standalone ? "max-w-5xl mx-auto px-4 py-6 space-y-6" : "space-y-6"}>
        
        {/* Top bar with Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Code2 className="w-6 h-6 text-accent" />
              API B2B & Automatización
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              Conecta tu bot de Telegram, tienda o servidor al catálogo mayorista con saldo en USDT.
            </p>
          </div>



          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-start sm:self-auto flex-nowrap gap-1 overflow-x-auto max-w-full whitespace-nowrap">
            <button 
              onClick={() => setActiveSubtab('docs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubtab === 'docs' ? 'bg-accent text-bg shadow font-black' : 'text-white/60 hover:text-white'}`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Docs
            </button>
            <button 
              onClick={() => setActiveSubtab('keys')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubtab === 'keys' ? 'bg-accent text-bg shadow font-black' : 'text-white/60 hover:text-white'}`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Claves API
            </button>
            <button 
              onClick={() => setActiveSubtab('webhooks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubtab === 'webhooks' ? 'bg-accent text-bg shadow font-black' : 'text-white/60 hover:text-white'}`}
            >
              <Webhook className="w-3.5 h-3.5" /> Webhooks
            </button>
            <button 
              onClick={() => setActiveSubtab('deliveries')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubtab === 'deliveries' ? 'bg-accent text-bg shadow font-black' : 'text-white/60 hover:text-white'}`}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Entregas
            </button>
          </div>


        </div>



        {/* ── SUBTAB 1: DOCUMENTACIÓN Y REFERENCIA API ── */}
        {/* ── SUBTAB 1: DOCUMENTACIÓN Y REFERENCIA API ── */}
        {activeSubtab === 'docs' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* ── HEADER BANNER OFICIAL (Estilo Docs) ── */}
            <div className="card border border-white/10 rounded-2xl p-6 bg-gradient-to-br from-[#111820] to-[#0c1219] space-y-4 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                      Documentación Oficial
                    </span>
                    <span className="text-[10px] font-black text-white/40">API v1.0</span>
                  </div>


                  <h1 className="text-xl sm:text-2xl font-black text-white mt-2">
                    Reseller API v1
                  </h1>
                  <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-2xl leading-relaxed">
                    Integra el catálogo mayorista autorizado, precios de revendedor, saldo USDT y compras automáticas de Francho Shop en tu bot, servidor o tienda web.
                  </p>
                </div>



                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="/api/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-bold transition flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-accent" />
                    <span>Docs Externas</span>
                  </a>
                  <a
                    href="/api/docs/openapi.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-accent text-bg hover:bg-accent/90 text-xs font-black transition flex items-center gap-2 shadow-lg"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>OpenAPI JSON</span>
                  </a>
                </div>


              </div>



              {/* Base URL Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-black/50 rounded-xl border border-white/10 font-mono text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white/40 text-[11px] font-sans font-bold uppercase shrink-0">Base URL:</span>
                  <span className="text-accent truncate">https://franchoshop.com/api/v1/reseller</span>
                </div>


                <button
                  onClick={() => handleCopy("https://franchoshop.com/api/v1/reseller", "base_url_hero")}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[11px] font-sans font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95"
                >
                  {copiedId === "base_url_hero" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === "base_url_hero" ? "Copiado" : "Copiar URL"}</span>
                </button>
              </div>



              {/* Security Notice */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed text-[11px]">
                  <strong>Uso exclusivo en servidor backend:</strong> La API key debe utilizarse desde tu backend o servidor seguro. Nunca la expongas en JavaScript público del navegador, aplicaciones cliente ni repositorios.
                </span>
              </div>


            </div>



            {/* Quick Hero / Specs Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="card p-3.5 border border-white/10 rounded-2xl bg-card/60">
                <span className="text-[10px] font-black uppercase text-white/40 block">Base URL</span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-xs text-accent truncate">/api/v1/reseller</span>
                  <button 
                    onClick={() => handleCopy("https://franchoshop.com/api/v1/reseller", "base_url")}
                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white text-[10px]"
                    title="Copiar URL completa"
                  >
                    {copiedId === "base_url" ? <Check className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
                  </button>
                </div>


              </div>



              <div className="card p-3.5 border border-white/10 rounded-2xl bg-card/60">
                <span className="text-[10px] font-black uppercase text-white/40 block">Autenticación</span>
                <span className="font-mono text-xs text-white block mt-1">Bearer fs_live_...</span>
              </div>



              <div className="card p-3.5 border border-white/10 rounded-2xl bg-card/60">
                <span className="text-[10px] font-black uppercase text-white/40 block">Moneda Oficial</span>
                <span className="font-bold text-xs text-emerald-400 block mt-1">USDT (Decimal Exacto)</span>
              </div>



              <div className="card p-3.5 border border-white/10 rounded-2xl bg-card/60">
                <span className="text-[10px] font-black uppercase text-white/40 block">Catálogo</span>
                <span className="font-bold text-xs text-cyan-400 block mt-1">+1200 Productos</span>
              </div>


            </div>



            {/* ── MODO SANDBOX Y PRUEBAS ── */}
            <div className="card border border-purple-500/30 rounded-2xl p-5 bg-gradient-to-r from-purple-500/10 via-[#0c1219] to-[#0c1219] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                    <FlaskConical className="w-4 h-4" />
                  </div>


                  <div>
                    <h3 className="text-sm font-black text-white">Modo Sandbox & Pruebas Gratuitas</h3>
                    <p className="text-[11px] text-purple-300/70">Prueba tus bots, tiendas o scripts con compras simuladas y cero cobros reales.</p>
                  </div>


                </div>


                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Cero Costo Real
                </span>
              </div>



              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                  <strong className="text-purple-300 text-xs block flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" /> Método 1: Cabecera X-Sandbox
                  </strong>
                  <p className="text-white/60 text-[11px] leading-relaxed">
                    Envía el encabezado <code className="text-purple-300 font-mono bg-purple-500/10 px-1 py-0.5 rounded border border-purple-500/20">X-Sandbox: true</code> en tu petición <code className="text-accent font-mono">POST /v1/orders</code> con tu clave habitual.
                  </p>
                </div>


                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                  <strong className="text-purple-300 text-xs block flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-purple-400" /> Método 2: Clave Sandbox
                  </strong>
                  <p className="text-white/60 text-[11px] leading-relaxed">
                    Crea una clave en la pestaña <strong>Claves API</strong> con el botón <strong>"Clave Sandbox"</strong> (prefijo <code className="text-purple-300 font-mono">fsb2b_test_...</code>). Todas sus peticiones corren en modo prueba automático.
                  </p>
                </div>


              </div>



              <div className="text-[11px] text-white/50 border-t border-white/5 pt-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Simulación de fallo: Envía <code className="text-rose-400 font-mono bg-rose-500/10 px-1 py-0.5 rounded">X-Sandbox-Simulate: failed</code> para probar cómo gestiona tu bot o webhook un pedido rechazado.</span>
              </div>


            </div>



            {/* ── CATÁLOGO EN VIVO (Vista previa con imágenes reales) ── */}
            <div className="card border border-white/10 rounded-2xl overflow-hidden bg-card/40">
              <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/20">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-accent" />
                  <div>
                    <span className="font-bold text-white text-xs uppercase tracking-wider">Vista Previa del Catálogo</span>
                    <span className="text-[10px] text-white/40 ml-2">{previewProducts.length > 0 ? `${previewProducts.length} productos disponibles` : 'Cargando...'}</span>
                  </div>


                </div>


                <div className="flex gap-2 flex-wrap">
                  {/* Group filter chips */}
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'service_topup', label: 'Recargas' },
                    { id: 'giftcards', label: 'Gift Cards' },
                    { id: 'gamekeys', label: 'Game Keys' },
                    { id: 'steam_gifts', label: 'Steam Gifts' },
                  ].map(g => (
                    <button
                      key={g.id}
                      onClick={() => setCatalogGroupFilter(g.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${catalogGroupFilter === g.id ? 'bg-accent text-bg' : 'bg-white/5 text-white/50 hover:text-white'}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>


              </div>



              {/* Search bar */}
              <div className="px-4 py-2 border-b border-white/5 bg-black/10">
                <input
                  type="text"
                  placeholder="Buscar producto (Free Fire, Roblox, Steam...)"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:border-accent outline-none placeholder:text-white/30"
                />
              </div>



              {/* Products Grid */}
              <div className="p-4">
                {!previewLoaded ? (
                  <div className="flex items-center justify-center py-8 text-white/40 text-xs">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Cargando catálogo...
                  </div>


                ) : previewProducts.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-xs">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Inicia sesión B2B para ver el catálogo completo con imágenes.</p>
                  </div>


                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {previewProducts
                      .filter(p => catalogGroupFilter === 'all' || p.group === catalogGroupFilter)
                      .filter(p => !catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                      .slice(0, 48)
                      .map(p => (
                        <div
                          key={p.id}
                          className="group relative flex flex-col items-center gap-1 p-2 rounded-xl bg-black/30 hover:bg-white/5 border border-white/5 hover:border-white/15 transition cursor-default"
                          title={`${p.name}${p.region && p.region !== '__standard__' && p.region.toLowerCase() !== 'standard' ? ' · ' + p.region : ''}`}
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                            <AuthImage
                              src={p.image_url}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              fallbackText={p.name.slice(0, 5)}
                            />
                          </div>


                          <span className="text-[9px] text-white/60 text-center leading-tight line-clamp-2 w-full">{p.name}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                            p.group === 'service_topup' ? 'bg-emerald-500/15 text-emerald-400' :
                            p.group === 'giftcards' ? 'bg-amber-500/15 text-amber-400' :
                            p.group === 'gamekeys' ? 'bg-purple-500/15 text-purple-400' :
                            p.group === 'steam_gifts' ? 'bg-cyan-500/15 text-cyan-400' :
                            'bg-white/10 text-white/40'
                          }`}>
                            {p.group === 'service_topup' ? 'Recarga' : p.group === 'giftcards' ? 'Gift' : p.group === 'gamekeys' ? 'Key' : p.group === 'steam_gifts' ? 'Steam' : p.type}
                          </span>
                        </div>


                      ))
                    }
                  </div>


                )}
                {previewProducts.filter(p => catalogGroupFilter === 'all' || p.group === catalogGroupFilter).filter(p => !catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase())).length > 48 && (
                  <p className="text-center text-[11px] text-white/30 mt-3">
                    Mostrando 48 de {previewProducts.filter(p => catalogGroupFilter === 'all' || p.group === catalogGroupFilter).length} productos — usa la API para paginar todos.
                  </p>
                )}
              </div>


            </div>



            {/* Quickstart Code Playground */}
            <div className="card border border-white/10 rounded-2xl overflow-hidden bg-[#0c1219]">
              <div className="p-4 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0a0f15]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-accent" />
                  <span className="font-bold text-white text-xs uppercase tracking-wider">Ejemplos Rápidos de Código</span>
                </div>



                {/* Language Switcher */}
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                  <button 
                    onClick={() => setCodeLang('curl')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${codeLang === 'curl' ? 'bg-accent text-bg' : 'text-white/60 hover:text-white'}`}
                  >
                    cURL
                  </button>
                  <button 
                    onClick={() => setCodeLang('node')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${codeLang === 'node' ? 'bg-accent text-bg' : 'text-white/60 hover:text-white'}`}
                  >
                    Node.js
                  </button>
                  <button 
                    onClick={() => setCodeLang('python')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${codeLang === 'python' ? 'bg-accent text-bg' : 'text-white/60 hover:text-white'}`}
                  >
                    Python
                  </button>
                </div>


              </div>



              {/* Snippet Action Selector */}
              <div className="px-4 py-2 border-b border-white/5 bg-black/20 flex gap-2 overflow-x-auto text-[11px]">
                {[
                  { id: 'create_order', label: '1. Crear Pedido' },
                  { id: 'wallet', label: '2. Consultar Saldo' },
                  { id: 'catalog', label: '3. Listar Catálogo' },
                  { id: 'offers', label: '4. Ofertas de Producto' },
                  { id: 'order_status', label: '5. Consultar Pedido' },
                  { id: 'webhook_verify', label: '6. Verificar Webhook' }
                ].map(op => (
                  <button
                    key={op.id}
                    onClick={() => setCodeSnippet(op.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${codeSnippet === op.id ? 'bg-white/15 text-white font-bold' : 'text-white/50 hover:text-white'}`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>



              {/* Code Display */}
              <div className="relative">
                <button
                  onClick={() => handleCopy(getCodeContent(), 'playground_code')}
                  className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition"
                >
                  {copiedId === 'playground_code' ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
                <pre className="p-4 pt-4 overflow-x-auto text-xs font-mono leading-relaxed text-[#c3d1dc] bg-[#080d12]">
                  {getCodeContent()}
                </pre>
              </div>


            </div>



            {/* Endpoints Directory & Filter */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-accent" />
                    Referencia de Endpoints
                  </h3>
                  <p className="text-xs text-white/50">Todos los endpoints oficiales disponibles para tu clave API.</p>
                </div>



                {/* Filter Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'catalog', label: 'Catálogo' },
                    { id: 'orders', label: 'Pedidos' },
                    { id: 'sms', label: 'Números SMS' },
                    { id: 'wallet', label: 'Billetera' },
                    { id: 'webhooks', label: 'Webhooks' },
                    { id: 'keys', label: 'Claves' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setEndpointFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${endpointFilter === f.id ? 'bg-accent text-bg font-black' : 'bg-white/5 text-white/60 hover:text-white'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>


              </div>



              {/* Endpoint Cards List */}
              <div className="space-y-3">
                {filteredEndpoints.map(ep => {
                  const isExpanded = expandedEndpoint === ep.id;
                  const isGet = ep.method === 'GET';
                  const isPost = ep.method === 'POST';
                  const isDelete = ep.method === 'DELETE';

                  return (
                    <div 
                      key={ep.id} 
                      className="card border border-white/10 rounded-2xl overflow-hidden bg-card/40 transition hover:border-white/20"
                    >
                      {/* Card Header */}
                      <div 
                        onClick={() => setExpandedEndpoint(isExpanded ? null : ep.id)}
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-white/5"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-black uppercase tracking-wider ${
                            isGet ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                            isPost ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                            'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {ep.method}
                          </span>
                          <span className="font-mono text-xs font-bold text-white truncate">
                            {ep.path}
                          </span>
                          <span className="hidden md:inline text-xs text-white/40">·</span>
                          <span className="hidden md:inline text-xs text-white/70 truncate">
                            {ep.title}
                          </span>
                        </div>



                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-white/5 text-white/40 rounded text-[10px] font-mono hidden sm:inline">
                            {ep.scope}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>


                      </div>



                      {/* Card Body (Expanded) */}
                      {isExpanded && (
                        <div className="p-4 pt-2 border-t border-white/5 space-y-4 bg-black/20 text-xs animate-in fade-in">
                          <p className="text-white/70 leading-relaxed">{ep.desc}</p>

                          {/* Parameters Table */}
                          {ep.params && ep.params.length > 0 && (
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-2">Parámetros</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-white/10 text-[10px] text-white/40 uppercase">
                                      <th className="pb-1.5 font-bold">Parámetro</th>
                                      <th className="pb-1.5 font-bold">Ubicación</th>
                                      <th className="pb-1.5 font-bold">Tipo</th>
                                      <th className="pb-1.5 font-bold">Obligatorio</th>
                                      <th className="pb-1.5 font-bold">Descripción</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                                    {ep.params.map(p => (
                                      <tr key={p.name}>
                                        <td className="py-2 text-accent font-bold">{p.name}</td>
                                        <td className="py-2 text-white/50 font-sans">{p.in}</td>
                                        <td className="py-2 text-white/50 font-sans">{p.type}</td>
                                        <td className="py-2 font-sans">
                                          {p.req ? (
                                            <span className="text-rose-400 font-bold">Sí</span>
                                          ) : (
                                            <span className="text-white/40">Opcional</span>
                                          )}
                                        </td>
                                        <td className="py-2 text-white/70 font-sans">{p.desc}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>


                            </div>


                          )}

                          {/* Request Body Example (if any) */}
                          {ep.request && (
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5 flex justify-between items-center">
                                <span>Cuerpo JSON (Request Body)</span>
                                <button
                                  onClick={() => handleCopy(JSON.stringify(ep.request, null, 2), `req_${ep.id}`)}
                                  className="text-accent hover:underline text-[10px] flex items-center gap-1"
                                >
                                  {copiedId === `req_${ep.id}` ? '✓ Copiado' : 'Copiar JSON'}
                                </button>
                              </div>


                              <pre className="p-3 bg-black/60 rounded-xl font-mono text-[11px] text-[#b8c9d4] overflow-x-auto border border-white/5">
                                {JSON.stringify(ep.request, null, 2)}
                              </pre>
                            </div>


                          )}

                          {/* Response Example */}
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5 flex justify-between items-center">
                              <span>Ejemplo de Respuesta (200 OK / 201 Created)</span>
                              {typeof ep.response === 'object' && (
                                <button
                                  onClick={() => handleCopy(JSON.stringify(ep.response, null, 2), `res_${ep.id}`)}
                                  className="text-accent hover:underline text-[10px] flex items-center gap-1"
                                >
                                  {copiedId === `res_${ep.id}` ? '✓ Copiado' : 'Copiar Respuesta'}
                                </button>
                              )}
                            </div>


                            <pre className="p-3 bg-black/60 rounded-xl font-mono text-[11px] text-emerald-400/90 overflow-x-auto border border-white/5">
                              {typeof ep.response === 'string' ? ep.response : JSON.stringify(ep.response, null, 2)}
                            </pre>
                          </div>


                        </div>


                      )}
                    </div>


                  );
                })}
              </div>


            </div>



            {/* Games & Required Fields Table */}
            <div className="card border border-white/10 rounded-2xl p-5 bg-card/40 space-y-4">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-black text-white">Guía de Juegos y Campos Requeridos (`fields`)</h3>
              </div>


              <p className="text-xs text-white/60">
                Al enviar el endpoint <code className="text-accent bg-black/40 px-1.5 py-0.5 rounded">POST /v1/orders</code>, 
                el objeto <code className="text-white font-mono">fields</code> debe incluir los identificadores según el tipo de producto:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] text-white/40 uppercase">
                      <th className="pb-2 font-bold">Servicio / Juego</th>
                      <th className="pb-2 font-bold">Tipo de Entrega</th>
                      <th className="pb-2 font-bold">Campos en `fields`</th>
                      <th className="pb-2 font-bold">Notas de Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {GAMES_GUIDE.map((g, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="py-2.5 font-bold text-white">{g.name}</td>
                        <td className="py-2.5 text-white/60">{g.type}</td>
                        <td className="py-2.5 font-mono text-accent text-[11px]">{g.fields}</td>
                        <td className="py-2.5 text-white/50 text-[11px]">{g.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>


            </div>



            {/* Webhook Verification Guide */}
            <div className="card border border-white/10 rounded-2xl p-5 bg-card/40 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-black text-white">Seguridad y Verificación Criptográfica HMAC</h3>
              </div>


              <p className="text-xs text-white/70 leading-relaxed">
                Cada evento enviado a tus webhooks incluye la cabecera <code className="text-accent font-mono bg-black/40 px-1.5 py-0.5 rounded">X-Francho-Signature</code> con el formato <code className="font-mono text-white">sha256=&lt;hex_hash&gt;</code>.
                Utiliza el secreto de tu webhook (<code className="font-mono text-white/70">whsec_...</code>) para calcular el HMAC-SHA256 del cuerpo crudo (raw body) y verificar la autenticidad antes de procesar el evento.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                  <strong className="text-white text-xs block">Eventos Disponibles:</strong>
                  <ul className="space-y-1 text-white/60 text-[11px]">
                    <li><code className="text-accent">order.completed</code>: Recarga completada exitosamente.</li>
                    <li><code className="text-rose-400">order.failed</code>: Falló la recarga (saldo devuelto a billetera).</li>
                    <li><code className="text-amber-400">order.processing</code>: En proceso de entrega por el proveedor.</li>
                    <li><code className="text-cyan-400">wallet.deposit</code>: Depósito USDT acreditado en tu saldo.</li>
                  </ul>
                </div>



                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                  <strong className="text-white text-xs block">Reglas de Respuesta:</strong>
                  <ul className="space-y-1 text-white/60 text-[11px]">
                    <li>Tu servidor debe responder con código HTTP <code className="text-emerald-400 font-bold">200</code> o <code className="text-emerald-400 font-bold">2xx</code>.</li>
                    <li>Tiempo límite de respuesta: <strong>10 segundos</strong>.</li>
                    <li>Si tu servidor falla o devuelve error, se aplican reintentos automáticos con retroceso exponencial.</li>
                  </ul>
                </div>


              </div>


            </div>



            {/* Error Codes Reference */}
            <div className="card border border-white/10 rounded-2xl p-5 bg-card/40 space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">Códigos de Estado y Errores Estándar</h3>
              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-rose-400 font-bold">400 INVALID_CURSOR</span>
                  <p className="text-[11px] text-white/60 mt-1">El cursor de paginación está corrupto o expiró.</p>
                </div>


                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-rose-400 font-bold">401 AUTHENTICATION_REQUIRED</span>
                  <p className="text-[11px] text-white/60 mt-1">Falta la cabecera Authorization o la clave API es inválida.</p>
                </div>


                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-rose-400 font-bold">403 INSUFFICIENT_PERMISSIONS</span>
                  <p className="text-[11px] text-white/60 mt-1">La clave API carece del scope necesario para esta operación.</p>
                </div>


                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-rose-400 font-bold">404 OFFER_NOT_FOUND</span>
                  <p className="text-[11px] text-white/60 mt-1">El producto o la oferta especificada no existe en el catálogo.</p>
                </div>


                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-amber-400 font-bold">409 INSUFFICIENT_BALANCE</span>
                  <p className="text-[11px] text-white/60 mt-1">Saldo en billetera insuficiente para procesar la orden.</p>
                </div>


                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-amber-400 font-bold">409 IDEMPOTENCY_CONFLICT</span>
                  <p className="text-[11px] text-white/60 mt-1">La misma Idempotency-Key ya fue enviada con otro payload diferente.</p>
                </div>


                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-amber-400 font-bold">422 QUANTITY_OUT_OF_RANGE</span>
                  <p className="text-[11px] text-white/60 mt-1">La cantidad no respeta el min_quantity o max_quantity permitido.</p>
                </div>


                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                  <span className="font-mono text-rose-400 font-bold">502 PURCHASE_REJECTED</span>
                  <p className="text-[11px] text-white/60 mt-1">La compra fue rechazada por el motor de procesamiento (saldo liberado de inmediato).</p>
                </div>


              </div>


            </div>



          </div>


        )}
        {/* ── SUBTAB 2: CLAVES API ── */}
        {activeSubtab === 'keys' && (
          <div className="space-y-4 animate-in fade-in duration-200">

            {/* Header row */}
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/50 block">Claves API Activas</span>
                <span className="text-[11px] text-white/40">Usa estas credenciales como Bearer Token en tus bots y servidores.</span>
              </div>


              <div className="flex gap-2">
                {/* Compartir con IA */}
                <button
                  onClick={() => {
                    const baseUrl = 'https://franchoshop.com/api/v1/reseller';
                    const prompt = `Tengo acceso a una API B2B de recarga de videojuegos y gift cards digitales.

BASE URL: ${baseUrl}
AUTENTICACIÓN: Header "Authorization: Bearer fs_live_TU_CLAVE_API"
MONEDA: USDT

ENDPOINTS PRINCIPALES:
1. GET /v1/wallet → Consultar saldo disponible
2. GET /v1/wallet/movements?limit=25 → Historial de movimientos
3. GET /v1/catalog/products?limit=50&group=service_topup → Listar catálogo (Free Fire, Blood Strike, Roblox, MLBB, Telegram Stars, Steam, CapCut, Gift Cards)
4. GET /v1/catalog/products/{product_id}/offers → Precios mayoristas y campos requeridos del juego
5. POST /v1/orders → Crear pedido (requiere Header "Idempotency-Key: <uuid-único>")
   Body: { "product_id": "prd_...", "offer_id": "off_...", "quantity": 1, "fields": { "player_id": "123456789" } }
6. GET /v1/orders → Historial de pedidos
7. GET /v1/orders/{order_id} → Estado y entrega de un pedido
8. GET /v1/webhooks → Listar webhooks
9. POST /v1/webhooks → Registrar webhook HMAC-SHA256
10. GET /v1/webhook-deliveries → Historial y logs de entregas

CAMPOS REQUERIDOS POR JUEGO (objeto "fields" en POST /v1/orders):
- Free Fire: player_id (UID)
- Blood Strike: player_id (User ID)
- Roblox: player_id o username
- Mobile Legends: player_id + zone_id (servidor)
- Telegram Stars/Premium: telegram_username (ej: @usuario)
- Steam Wallet: steam_login + amount
- Steam Gifts: invite_url (enlace amigo)
- CapCut Pro: email
- Gift Cards: ninguno (se devuelve código PIN)

EJEMPLO COMPLETO (crear pedido Free Fire):
curl -X POST "${baseUrl}/v1/orders" \\
  -H "Authorization: Bearer fs_live_TU_CLAVE_API" \\
  -H "Idempotency-Key: pedido-único-123" \\
  -H "Content-Type: application/json" \\
  -d '{"product_id":"prd_RBynh3P7Ux7ECLEbKpIEpsYW","offer_id":"off_2bN8vG9_110diamonds","quantity":1,"fields":{"player_id":"123456789"}}'

RESPUESTA EXITOSA (pedido):
{ "data": { "id": "FSB2B-...", "status": "completed", "total": "0.7531", "currency": "USDT", "delivery": { "type": "direct_account_credit" } } }

ERRORES COMUNES:
- 401 AUTHENTICATION_REQUIRED: falta o es inválida la clave API
MODO SANDBOX / PRUEBAS:
- Envía el header "X-Sandbox: true" en POST /v1/orders para simular compras exitosas sin gastar saldo real.
- O usa una clave API de prueba (fsb2b_test_...).
- Opcional: Envía "X-Sandbox-Simulate: failed" para simular compras rechazadas.

ERRORES COMUNES:
- 401 AUTHENTICATION_REQUIRED: falta o es inválida la clave API
- 409 INSUFFICIENT_BALANCE: saldo insuficiente en billetera
- 409 IDEMPOTENCY_CONFLICT: Idempotency-Key ya usada con otro payload
- 422 QUANTITY_OUT_OF_RANGE: cantidad fuera del rango permitido
- 502 PURCHASE_REJECTED: compra rechazada (saldo liberado automáticamente)

Ayúdame a integrar esta API en mi proyecto.`;
                    navigator.clipboard.writeText(prompt);
                    setShareAIModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-xs font-bold transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Compartir con IA
                </button>
                {/* Botón Clave Sandbox */}
                <button
                  onClick={() => handleCreateKey(true)}
                  disabled={loading}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 ${
                    isSandboxMode 
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40' 
                      : 'bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300'
                  }`}
                  title="Crear clave para pruebas sin gastar saldo real"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-purple-200" />
                  <span>{isSandboxMode ? 'Crear Clave Sandbox' : 'Clave Sandbox'}</span>
                </button>
                {/* Botón Clave Producción */}
                <button
                  onClick={() => handleCreateKey(false)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 ${
                    isSandboxMode
                      ? 'bg-white/5 hover:bg-white/10 text-white/50 border border-white/10'
                      : 'bg-accent hover:bg-accent/90 text-bg shadow-lg shadow-accent/20'
                  }`}
                  title={isSandboxMode ? 'Requiere activación de revendedor con depósito' : 'Crear clave en vivo'}
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isSandboxMode ? <Shield className="w-3.5 h-3.5 text-white/40" /> : <KeyRound className="w-3.5 h-3.5" />)}
                  <span>{isSandboxMode ? 'Clave Live (Revendedor)' : (loading ? 'Creando...' : 'Crear Clave Live')}</span>
                </button>
              </div>


            </div>



            {/* Banner explicativo de Sandbox para no revendedores */}
            {isSandboxMode && (
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <FlaskConical className="w-4 h-4" />
                </div>


                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white flex items-center gap-2">
                    Modo Desarrollador Sandbox
                    <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-bold font-mono uppercase">Activo</span>
                  </div>


                  <p className="text-white/70 mt-1">
                    Puedes crear claves de prueba y simular compras o webhooks con <strong className="text-purple-300">costo cero y sin saldo</strong>. Para desbloquear claves Live en producción y compras reales con precios mayoristas, realiza una recarga mínima de $50.00 USDT.
                  </p>
                </div>


              </div>


            )}

            {/* Nueva clave creada — banner prominente */}
            {newKeySecret && (
              <div className={`p-5 rounded-2xl animate-in fade-in slide-in-from-top-2 space-y-3 shadow-lg ${
                newKeySecret.isTest || (newKeySecret.secret || '').startsWith('fsb2b_test_')
                  ? 'bg-purple-500/10 border border-purple-500/40 shadow-purple-500/10'
                  : 'bg-emerald-500/10 border border-emerald-500/40 shadow-emerald-500/10'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${
                      newKeySecret.isTest || (newKeySecret.secret || '').startsWith('fsb2b_test_') ? 'text-purple-400' : 'text-emerald-400'
                    }`} />
                    <div>
                      <strong className={`text-sm font-bold block ${
                        newKeySecret.isTest || (newKeySecret.secret || '').startsWith('fsb2b_test_') ? 'text-purple-300' : 'text-emerald-400'
                      }`}>
                        ¡Clave {newKeySecret.isTest ? 'Sandbox (Pruebas)' : 'Live (Producción)'} "{newKeySecret.name}" creada!
                      </strong>
                      <span className="text-[11px] text-white/70">
                        {newKeySecret.isTest ? 'Esta clave simula compras con cero costo real. ' : ''}
                        Cópiala ahora — <strong>no volverá a mostrarse jamás</strong> por seguridad.
                      </span>
                    </div>


                  </div>


                  <button onClick={() => setNewKeySecret(null)} className="text-white/40 hover:text-white p-1"><X className="w-4 h-4"/></button>
                </div>


                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newKeySecret.secret}
                    onClick={e => e.target.select()}
                    className={`flex-1 bg-black/70 border text-xs font-mono px-3.5 py-2.5 rounded-xl outline-none cursor-text ${
                      newKeySecret.isTest || (newKeySecret.secret || '').startsWith('fsb2b_test_')
                        ? 'border-purple-500/40 text-purple-300'
                        : 'border-emerald-500/40 text-emerald-300'
                    }`}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newKeySecret.secret);
                      setCopiedId('new_secret');
                      setTimeout(() => setCopiedId(null), 2500);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                      newKeySecret.isTest || (newKeySecret.secret || '').startsWith('fsb2b_test_')
                        ? 'bg-purple-500 hover:bg-purple-400 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    }`}
                  >
                    {copiedId === 'new_secret' ? (
                      <><CheckCheck className="w-3.5 h-3.5"/> ¡Copiada!</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5"/> Copiar Token</>
                    )}
                  </button>
                </div>


              </div>


            )}

            {/* Lista de claves */}
            <div className="card border border-white/10 rounded-2xl overflow-hidden bg-card/40">
              {!keysLoaded ? (
                <div className="p-12 text-center text-white/40 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" /> Cargando claves...
                </div>


              ) : keys.length === 0 ? (
                <div className="p-12 text-center text-white/40 text-xs space-y-2">
                  <KeyRound className="w-8 h-8 mx-auto opacity-40 text-accent" />
                  <p className="text-white/60 font-medium">No tienes claves API creadas aún.</p>
                  <p className="text-[11px] text-white/40">Crea una clave Live para producción o una clave Sandbox para pruebas gratuitas.</p>
                </div>


              ) : (
                <div className="divide-y divide-white/5">
                  {keys.map(k => {
                    const isKeyTest = k.is_test || (k.prefix || k.key_prefix || '').startsWith('fsb2b_test_');
                    return (
                      <div key={k.id} className="p-4 flex items-center justify-between gap-3 hover:bg-white/5 transition group">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-xs flex items-center gap-2 flex-wrap">
                            {k.name}
                            {isKeyTest ? (
                              <span className="px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded text-[9px] font-black uppercase flex items-center gap-1">
                                <FlaskConical className="w-2.5 h-2.5 text-purple-400" /> Sandbox
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black uppercase">
                                Producción
                              </span>
                            )}
                            {k.scopes && (
                              <span className="text-[9px] text-white/30 font-mono hidden sm:inline">{Array.isArray(k.scopes) ? k.scopes.join(', ') : k.scopes}</span>
                            )}
                          </div>


                          {/* Prefijo visible con botón copiar */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border ${
                              isKeyTest ? 'text-purple-300/80 bg-purple-500/10 border-purple-500/20' : 'text-white/50 bg-white/5 border-white/5'
                            }`}>
                              {k.prefix || k.key_prefix || (isKeyTest ? 'fsb2b_test_' : 'fsb2b_live_')}••••{k.last4 || k.key_last4 || '••••'}
                            </span>
                            <button
                              onClick={() => {
                                const prefix = (k.prefix || k.key_prefix || (isKeyTest ? 'fsb2b_test_' : 'fsb2b_live_')) + '...';
                                navigator.clipboard.writeText(prefix);
                                setCopiedId(`key_prefix_${k.id}`);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                              title="Copiar prefijo"
                            >
                              {copiedId === `key_prefix_${k.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <span className="text-[10px] text-white/30">
                              Creada {k.created_at ? new Date(k.created_at * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente'}
                            </span>
                          </div>


                        </div>


                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          disabled={deletingKeyId === k.id}
                          className="text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition disabled:opacity-40 flex-shrink-0"
                          title="Revocar clave"
                        >
                          {deletingKeyId === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>


                    );
                  })}
                </div>


              )}
            </div>



            {/* Tip de seguridad */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[11px] text-amber-300/70">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>Tratar las claves API como contraseñas. Nunca las compartas públicamente ni las incluyas en código fuente del lado cliente. Rota las claves periódicamente.</span>
            </div>


          </div>


        )}

        {/* ── SUBTAB 3: WEBHOOKS ── */}
        {activeSubtab === 'webhooks' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/50 block">Endpoints de Notificación</span>
                <span className="text-[11px] text-white/40">Recibe alertas automáticas en tu backend cuando cambie el estado de tus compras.</span>
              </div>


              <button 
                onClick={() => setShowAddWebhookModal(true)}
                className="bg-accent hover:bg-accent/90 text-bg px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-accent/20"
              >
                <Webhook className="w-3.5 h-3.5" /> Agregar Endpoint
              </button>
            </div>



            <div className="card border border-white/10 rounded-2xl overflow-hidden bg-card/40">
              {webhooks.length === 0 ? (
                <div className="p-12 text-center text-white/40 text-xs space-y-2">
                  <Webhook className="w-8 h-8 mx-auto opacity-40 text-accent" />
                  <p className="text-white/60 font-medium">No tienes endpoints de webhook configurados.</p>
                  <p className="text-[11px] text-white/40">Registra tu URL HTTPS para recibir confirmaciones inmediatas.</p>
                </div>


              ) : (
                <div className="divide-y divide-white/5">
                  {webhooks.map(w => (
                    <div key={w.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition">
                      <div className="min-w-0 flex-1 mr-4">
                        <div className="font-bold text-white text-xs font-mono truncate">{w.url}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(w.events || []).map(ev => (
                            <span key={ev} className="px-1.5 py-0.5 bg-white/5 text-white/60 text-[9px] rounded font-mono">
                              {ev}
                            </span>
                          ))}
                        </div>


                      </div>


                      <button 
                        onClick={() => handleDeleteWebhook(w.id)}
                        className="text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition"
                        title="Eliminar webhook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>


                  ))}
                </div>


              )}
            </div>



            {showAddWebhookModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="card w-full max-w-md p-6 border border-white/10 rounded-2xl bg-[#0b0f17] shadow-2xl space-y-4">
                  <div className="flex justify-between items-start pb-3 border-b border-white/10">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-accent" />
                      Registrar Nuevo Webhook
                    </h3>
                    <button onClick={() => setShowAddWebhookModal(false)} className="text-white/50 hover:text-white"><X className="w-4 h-4"/></button>
                  </div>



                  <form onSubmit={handleCreateWebhook} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-white/60 mb-1">Nombre Identificador</label>
                      <input
                        type="text"
                        required
                        placeholder="Bot Telegram, Mi Tienda, CRM..."
                        value={webhookName}
                        onChange={e => setWebhookName(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent outline-none"
                      />
                    </div>



                    <div>
                      <label className="block text-xs font-bold text-white/60 mb-1">URL del Endpoint (HTTPS)</label>
                      <input 
                        type="url"
                        required
                        placeholder="https://tudominio.com/api/b2b-webhook"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent outline-none font-mono"
                      />
                    </div>



                    <div>
                      <label className="block text-xs font-bold text-white/60 mb-2">Eventos a Escuchar</label>
                      <div className="space-y-2">
                        {[
                          { id: 'order.completed', label: 'order.completed (Pedido entregado con éxito)' },
                          { id: 'order.failed', label: 'order.failed (Pedido fallido / rechazado)' },
                          { id: 'order.processing', label: 'order.processing (En proceso de entrega)' },
                          { id: 'wallet.deposit', label: 'wallet.deposit (Recarga de saldo USDT acreditada)' }
                        ].map(ev => (
                          <label key={ev.id} className="flex items-center gap-2 text-xs text-white/70 cursor-pointer hover:text-white">
                            <input 
                              type="checkbox"
                              checked={webhookEvents.includes(ev.id)}
                              onChange={e => {
                                if (e.target.checked) setWebhookEvents([...webhookEvents, ev.id]);
                                else setWebhookEvents(webhookEvents.filter(x => x !== ev.id));
                              }}
                              className="rounded accent-accent"
                            />
                            <span className="font-mono text-[11px]">{ev.label}</span>
                          </label>
                        ))}
                      </div>


                    </div>



                    <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                      <button 
                        type="button" 
                        onClick={() => setShowAddWebhookModal(false)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white font-semibold"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        disabled={loading || !webhookUrl || !webhookName}
                        className="px-5 py-2 bg-accent hover:bg-accent/90 text-bg rounded-xl text-xs font-bold disabled:opacity-50 transition active:scale-95"
                      >
                        Guardar Endpoint
                      </button>
                    </div>


                  </form>
                </div>


              </div>


            )}
          </div>


        )}

        {/* ── SUBTAB 4: ENTREGAS DE WEBHOOK ── */}
        {activeSubtab === 'deliveries' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/50 block">Registro de Envíos Recientes</span>
                <span className="text-[11px] text-white/40">Inspecciona las peticiones enviadas hacia tus URLs receptoras.</span>
              </div>


              <button 
                onClick={loadDeliveries}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>



            <div className="card border border-white/10 rounded-2xl overflow-hidden bg-card/40">
              {deliveries.length === 0 ? (
                <div className="p-12 text-center text-white/40 text-xs space-y-1">
                  <RefreshCw className="w-8 h-8 mx-auto opacity-30 text-white" />
                  <p>No hay historial de envíos de webhooks disponible todavía.</p>
                </div>


              ) : (
                <div className="divide-y divide-white/5">
                  {deliveries.map(d => (
                    <div key={d.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition text-xs">
                      <div>
                        <div className="font-bold text-white font-mono flex items-center gap-2">
                          {d.event}
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black ${
                            d.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-400' :
                            d.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {d.status}
                          </span>
                        </div>


                        <div className="text-[10px] text-white/50 mt-1 font-mono">
                          {d.created_at ? new Date(d.created_at).toLocaleString('es-ES') : ''} · Intentos: {d.attempts || 1}
                        </div>


                      </div>


                      <div className="flex items-center gap-3">
                        {d.status === 'failed' && (
                          <button 
                            onClick={() => handleRetryDelivery(d.id)}
                            className="px-2.5 py-1 bg-white/10 hover:bg-accent hover:text-bg text-white rounded-lg text-[10px] font-bold transition"
                          >
                            Reintentar
                          </button>
                        )}
                      </div>


                    </div>


                  ))}
                </div>


              )}
            </div>


          </div>


        )}

      </div>



      {/* ── MODAL: COMPARTIR CON IA ── */}
      {shareAIModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={e => { if (e.target === e.currentTarget) setShareAIModal(false); }}
        >
          <div className="w-full max-w-sm bg-[#10141c] border border-purple-500/30 rounded-3xl p-6 space-y-5 shadow-2xl shadow-purple-500/10 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>


                <div>
                  <h3 className="font-black text-white text-sm">Enlace OpenAPI JSON para IA</h3>
                  <p className="text-[11px] text-purple-300/70">Esquema público auditable para asistentes de IA</p>
                </div>


              </div>


              <button onClick={() => setShareAIModal(false)} className="text-white/30 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>



            {/* Enlace JSON copiable */}
            <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">URL del JSON de la API (OpenAPI 3.1)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase">Público</span>
              </div>


              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value="https://franchoshop.com/api/openapi.json"
                  onClick={e => e.target.select()}
                  className="flex-1 bg-black/60 border border-purple-500/30 text-purple-200 font-mono text-[11px] px-2.5 py-2 rounded-xl outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("https://franchoshop.com/api/openapi.json");
                    setCopiedId('openapi_json_url');
                    setTimeout(() => setCopiedId(null), 2500);
                  }}
                  className="bg-purple-500 hover:bg-purple-400 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 flex-shrink-0 shadow"
                >
                  {copiedId === 'openapi_json_url' ? (
                    <><CheckCheck className="w-3.5 h-3.5" /> ¡Copiado!</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copiar</>
                  )}
                </button>
              </div>


              <p className="text-[10px] text-white/50 leading-relaxed">
                Pega este enlace en <strong>ChatGPT Actions</strong>, <strong>Claude</strong> o <strong>Gemini</strong>. La IA leerá automáticamente todos los endpoints, parámetros y respuestas.
              </p>
            </div>



            <div className="flex gap-2">
              <a 
                href="https://franchoshop.com/api/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <BookOpen className="w-3.5 h-3.5 text-accent" /> Ver Swagger UI
              </a>
              <a 
                href="https://franchoshop.com/api/openapi.json" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Code2 className="w-3.5 h-3.5 text-purple-400" /> Ver Raw JSON
              </a>
            </div>



            {/* Accesos directos a IAs */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">Abrir Asistente:</span>
              <div className="grid grid-cols-3 gap-2">
                <a href="https://chat.openai.com/" target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#10a37f]/10 hover:bg-[#10a37f]/20 border border-[#10a37f]/20 transition group text-center">
                  <span className="w-6 h-6 rounded-lg bg-[#10a37f] text-white font-black text-xs flex items-center justify-center mb-1">G</span>
                  <span className="text-white font-bold text-[11px]">ChatGPT</span>
                </a>

                <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition group text-center">
                  <Sparkles className="w-5 h-5 text-blue-400 mb-1" />
                  <span className="text-white font-bold text-[11px]">Gemini</span>
                </a>

                <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 transition group text-center">
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 text-white font-black text-[10px] flex items-center justify-center mb-1">C</span>
                  <span className="text-white font-bold text-[11px]">Claude</span>
                </a>
              </div>


            </div>



            <button onClick={() => setShareAIModal(false)}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold transition">
              Cerrar
            </button>
          </div>


        </div>

,
        document.body
      )}
    </div>
  );
}

// ─── 6. CONFIGURACIÓN (SETTINGS) ───
export function ResellerB2BSettings() {
  const { ready } = useB2BUserSession();
  const [data, setData] = useState({
    account: { business_name: 'Revendedor', full_name: 'Revendedor', plan: { name: 'Mayorista' }, email: '', phone: '' }
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [contact, setContact] = useState('');

  useEffect(() => {
    if (ready) {
      b2bUserApi('/me').then(res => {
        if (res && typeof res === 'object') {
          setData(res);
          if (res.account) {
            setFullName(res.account.full_name || '');
            setBusinessName(res.account.business_name || '');
            setContact(res.account.phone || res.account.contact || '');
          }
        }
      }).catch(console.error);
    }
  }, [ready]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await b2bUserApiMut('/account/profile', {
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        contact: contact.trim()
      }, 'PATCH');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      b2bUserApi('/me').then(res => { if (res) setData(res); }).catch(()=>{});
    } catch (err) {
      alert('Error al guardar cambios: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-black text-white">Configuración de Revendedor</h2>
        <p className="text-xs text-white/50">Gestiona tus datos de negocio, contacto y nivel mayorista B2B.</p>
      </div>



      <div className="card p-6 border border-white/10 rounded-2xl bg-card/40 flex flex-col sm:flex-row items-center gap-5 shadow-xl">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/30 flex items-center justify-center text-3xl font-black text-accent flex-shrink-0">
          {data.account?.business_name ? data.account.business_name.charAt(0).toUpperCase() : 'R'}
        </div>


        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
            <h3 className="text-lg font-black text-white truncate">
              {data.account?.business_name || data.account?.full_name || 'Revendedor Francho Shop'}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[10px] font-black uppercase self-center sm:self-auto">
              {data.account?.plan?.name || 'Inicial'}
            </span>
          </div>


          <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> {data.account?.email || 'N/A'}</span>
            <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> {data.account?.phone || contact || 'N/A'}</span>
          </div>


        </div>


      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 border border-white/10 rounded-2xl bg-card/40 shadow-xl">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-accent" /> Datos de la Tienda / Contacto
          </h3>
          
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1">Nombre Completo</label>
              <input 
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-accent outline-none"
              />
            </div>



            <div>
              <label className="block text-xs font-bold text-white/60 mb-1">Nombre Comercial de tu Tienda</label>
              <input 
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-accent outline-none"
              />
            </div>



            <div>
              <label className="block text-xs font-bold text-white/60 mb-1">Teléfono / WhatsApp de Contacto</label>
              <input 
                type="text"
                value={contact}
                onChange={e => setContact(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-accent outline-none"
              />
            </div>



            <div className="pt-2">
              <button 
                type="submit"
                disabled={saving}
                className="w-full bg-accent hover:bg-accent/90 text-bg py-2.5 rounded-xl font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                {saveSuccess ? '¡Guardado Correctamente!' : 'Guardar Cambios'}
              </button>
            </div>


          </form>
        </div>



        <div className="card p-6 border border-white/10 rounded-2xl bg-gradient-to-br from-accent/10 to-transparent flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-accent mb-3">
              <Crown className="w-5 h-5" />
              <h3 className="font-bold text-sm">Suscripción Mayorista B2B</h3>
            </div>


            <p className="text-3xl font-black text-white uppercase mb-2">{data.account?.plan?.name || 'Inicial'}</p>
            <p className="text-xs text-white/60 leading-relaxed mb-4">
              Tu cuenta tiene acceso sin límites a tarifas mayoristas de descuento, panel de API y webhooks, y procesamiento de órdenes 24/7.
            </p>
            <div className="space-y-2 border-t border-white/5 pt-3 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" /> Sin mensualidades obligatorias
              </div>


              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" /> Saldo compartido con Francho Shop
              </div>


            </div>


          </div>



          <div className="mt-6 pt-4 border-t border-white/10">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-deposit'))}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
            >
              Recargar Saldo para Compras
            </button>
          </div>


        </div>


      </div>


    </div>
  );
}

// ─── 7. SOPORTE VIP NATIVO ───
export function ResellerB2BSupport() {
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      q: '¿Cómo se procesan y entregan las recargas de videojuegos?',
      a: 'Todas las recargas por ID (Free Fire, Blood Strike, Roblox, MLBB, etc.) y Gift Cards se procesan de forma automatizada e inmediata a través de nuestros proveedores oficiales. La entrega suele tardar entre 5 y 60 segundos.'
    },
    {
      q: '¿Cómo recargo mi saldo para compras mayoristas?',
      a: 'Puedes recargar en cualquier momento usando USDT a través de la pasarela OxaPay sin comisiones ocultas. El saldo se acredita al instante una vez confirmada la transacción en la red blockchain (BEP20 / TRC20 / Polygon).'
    },
    {
      q: '¿Qué ocurre si un pedido falla o el ID de jugador es incorrecto?',
      a: 'Si un pedido no puede completarse debido a un ID inválido o problema del servidor del juego, el saldo se reembolsa automáticamente de vuelta a tu billetera y el estado de la orden cambia a "Fallido".'
    },
    {
      q: '¿Cómo integro mi bot o tienda web mediante la API?',
      a: 'Dirígete a la pestaña "Integración API", genera tu clave secreta ("fs_live_...") y sigue los ejemplos en cURL, Python o Node.js. También puedes conectar ChatGPT, Claude o Gemini cargando nuestra especificación OpenAPI.'
    },
    {
      q: '¿Cómo recibo notificaciones automáticas cuando se completa un pedido?',
      a: 'Configura un Webhook en la sección de Integración API con tu URL de callback. Recibirás un evento POST firmado con HMAC-SHA256 cada vez que un pedido cambie de estado a completado o fallido.'
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sistemas Operativos 24/7
          </div>


          <h2 className="text-2xl font-black text-white">Soporte Prioritario VIP</h2>
          <p className="text-xs text-white/50">Atención directa y prioritaria para revendedores, bots integrados y compras mayoristas.</p>
        </div>


        <a 
          href="https://t.me/FranchoSoporte" 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-bg font-black text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-accent/20 active:scale-95"
        >
          <Send className="w-4 h-4" /> Contactar en Telegram
        </a>
      </div>



      {/* Grid de canales de atención */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border border-white/10 rounded-2xl bg-card/60 flex flex-col justify-between hover:border-accent/30 transition">
          <div>
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-accent mb-3">
              <Send className="w-5 h-5" />
            </div>


            <h3 className="font-bold text-white text-sm">Telegram Directo VIP</h3>
            <p className="text-xs text-white/50 mt-1">
              Atención directa con nuestro equipo de soporte técnico y resolución de incidencias en minutos.
            </p>
          </div>


          <a 
            href="https://t.me/FranchoSoporte" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-4 text-xs font-bold text-accent hover:underline flex items-center gap-1"
          >
            Abrir @FranchoSoporte <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>



        <div className="card p-5 border border-white/10 rounded-2xl bg-card/60 flex flex-col justify-between hover:border-purple-500/30 transition">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
              <Code2 className="w-5 h-5" />
            </div>


            <h3 className="font-bold text-white text-sm">Soporte de Integración API</h3>
            <p className="text-xs text-white/50 mt-1">
              Asistencia técnica para conectar tus bots de Telegram, páginas web o consultar la especificación OpenAPI.
            </p>
          </div>


          <a 
            href="https://franchoshop.com/api/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-4 text-xs font-bold text-purple-400 hover:underline flex items-center gap-1"
          >
            Ver Documentación Swagger <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>



        <div className="card p-5 border border-white/10 rounded-2xl bg-card/60 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
              <WalletCards className="w-5 h-5" />
            </div>


            <h3 className="font-bold text-white text-sm">Billetera & Facturación</h3>
            <p className="text-xs text-white/50 mt-1">
              Recargas en USDT automáticas mediante OxaPay. Saldo 100% unificado para compras directas y API.
            </p>
          </div>


          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-deposit'))}
            className="mt-4 text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 text-left"
          >
            Recargar Saldo USDT <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>


      </div>



      {/* Preguntas frecuentes (FAQ) */}
      <div className="card p-6 border border-white/10 rounded-2xl bg-card/60">
        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-accent" /> Preguntas Frecuentes de Revendedores
        </h3>
        <p className="text-xs text-white/50 mb-4">Respuestas rápidas a las consultas más habituales sobre el panel y la API.</p>

        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = openFaq === i;
            return (
              <div 
                key={i} 
                className="border border-white/10 rounded-xl overflow-hidden bg-black/20 transition"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs font-bold text-white hover:text-accent transition"
                >
                  <span>{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-white/70 leading-relaxed border-t border-white/5 pt-3 animate-in fade-in duration-150">
                    {f.a}
                  </div>


                )}
              </div>


            );
          })}
        </div>


      </div>


    </div>
  );
}
