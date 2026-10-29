import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Check, WalletCards, ShieldCheck, Flame, Smartphone, 
  Tv, ArrowRight, Zap, TrendingDown, Layers, HelpCircle, Activity
} from 'lucide-react';
import { api } from './api/client';

export const RESELLER_TIERS_DATA = [
  {
    id: 'standard',
    name: 'Estándar Minorista',
    emoji: '⚡',
    range: '< $25 USDT',
    depositMin: 0,
    quickAmount: 10,
    markup: '+30%',
    markupNum: 1.30,
    savingsText: 'Precio regular',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    colorText: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/10',
    tag: 'Consumo Personal',
    perks: [
      'Recarga puntual sin saldo mínimo',
      '0% de comisiones por depósito OxaPay',
      'Entrega y garantía estándar en tienda'
    ]
  },
  {
    id: 'bronce',
    name: 'Bronce Mayorista',
    emoji: '🥉',
    range: '$25 a $49.99 USDT',
    depositMin: 25,
    quickAmount: 25,
    markup: '+14%',
    markupNum: 1.14,
    savingsText: '~16% de ahorro',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    colorText: 'text-orange-400',
    borderColor: 'border-orange-500/40',
    bgColor: 'bg-orange-500/10',
    tag: 'Inicio Revendedor',
    perks: [
      'Desbloqueo permanente de Rango Revendedor B2B',
      'Margen reducido a +14% en todo el catálogo',
      'Acceso al Catálogo Mayorista y Panel B2B'
    ]
  },
  {
    id: 'plata',
    name: 'Plata Mayorista',
    emoji: '🥈',
    range: '$50 a $99.99 USDT',
    depositMin: 50,
    quickAmount: 50,
    markup: '+10%',
    markupNum: 1.10,
    savingsText: '~20% de ahorro',
    badgeClass: 'bg-slate-300/20 text-slate-200 border-slate-400/40',
    colorText: 'text-slate-300',
    borderColor: 'border-slate-400/40',
    bgColor: 'bg-slate-300/10',
    tag: 'Mayorista Activo + API',
    perks: [
      'Margen reducido a solo +10% en todas tus compras',
      'Acceso a API B2B & Webhooks para bots y tienda propia',
      'Prioridad de despacho en cola de pedidos'
    ]
  },
  {
    id: 'oro',
    name: 'Oro VIP Mayorista',
    emoji: '🥇',
    range: '$100+ USDT',
    depositMin: 100,
    quickAmount: 100,
    markup: '+7%',
    markupNum: 1.07,
    savingsText: '~23% ahorro (Máx)',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    colorText: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    bgColor: 'bg-amber-500/10',
    tag: 'Costo Mínimo Plataforma',
    perks: [
      'Margen mínimo al costo de plataforma (+7%)',
      'Máxima prioridad de entrega inmediata',
      'Soporte VIP prioritario 1-a-1 directo',
      'Stock preferencial para negocios de gran volumen'
    ]
  }
];

export const RESELLER_SAMPLE_PRODUCTS = [
  // Free Fire (Precios reales de catálogo mayorista FZR Francho Shop con margen configurado +35%)
  {
    id: 'ff-110',
    name: 'Free Fire 110 Diamantes (100 + 10)',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 0.90,
    prices: {
      standard: 0.90,
      bronce: 0.76,
      plata: 0.73,
      oro: 0.71
    }
  },
  {
    id: 'ff-341',
    name: 'Free Fire 341 Diamantes (310 + 31)',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 2.68,
    prices: {
      standard: 2.68,
      bronce: 2.27,
      plata: 2.19,
      oro: 2.13
    }
  },
  {
    id: 'ff-572',
    name: 'Free Fire 572 Diamantes (520 + 52)',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 4.54,
    prices: {
      standard: 4.54,
      bronce: 3.83,
      plata: 3.70,
      oro: 3.60
    }
  },
  {
    id: 'ff-1166',
    name: 'Free Fire 1166 Diamantes (1060 + 106)',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 8.43,
    prices: {
      standard: 8.43,
      bronce: 7.12,
      plata: 6.87,
      oro: 6.68
    }
  },
  {
    id: 'ff-2398',
    name: 'Free Fire 2398 Diamantes (2180 + 218)',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 16.73,
    prices: {
      standard: 16.73,
      bronce: 14.13,
      plata: 13.63,
      oro: 13.26
    }
  },
  {
    id: 'ff-semanal',
    name: 'Free Fire Pase Semanal',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 2.78,
    prices: {
      standard: 2.78,
      bronce: 2.35,
      plata: 2.27,
      oro: 2.20
    }
  },
  {
    id: 'ff-mensual',
    name: 'Free Fire Pase Mensual',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 13.30,
    prices: {
      standard: 13.30,
      bronce: 11.23,
      plata: 10.84,
      oro: 10.54
    }
  },
  {
    id: 'ff-booyah',
    name: 'Free Fire Pase Booyah',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 4.90,
    prices: {
      standard: 4.90,
      bronce: 4.14,
      plata: 3.99,
      oro: 3.89
    }
  },
  {
    id: 'ff-lite',
    name: 'Free Fire Pase Semanal Lite',
    category: 'ff',
    categoryLabel: 'Free Fire',
    retailPrice: 0.65,
    prices: {
      standard: 0.65,
      bronce: 0.55,
      plata: 0.53,
      oro: 0.51
    }
  },

  // SMS Virtuales (Precios reales de catálogo Francho Shop)
  {
    id: 'sms-wa-us',
    name: 'SMS WhatsApp (Estados Unidos)',
    category: 'sms',
    categoryLabel: 'SMS Virtual',
    retailPrice: 1.27,
    prices: {
      standard: 1.27,
      bronce: 1.14,
      plata: 1.06,
      oro: 0.97
    }
  },
  {
    id: 'sms-tg',
    name: 'SMS Telegram (Verificación)',
    category: 'sms',
    categoryLabel: 'SMS Virtual',
    retailPrice: 0.83,
    prices: {
      standard: 0.83,
      bronce: 0.75,
      plata: 0.69,
      oro: 0.64
    }
  },
  {
    id: 'sms-google',
    name: 'SMS Google / Gmail',
    category: 'sms',
    categoryLabel: 'SMS Virtual',
    retailPrice: 0.75,
    prices: {
      standard: 0.75,
      bronce: 0.68,
      plata: 0.62,
      oro: 0.57
    }
  },
  {
    id: 'sms-tiktok',
    name: 'SMS TikTok (USA)',
    category: 'sms',
    categoryLabel: 'SMS Virtual',
    retailPrice: 0.75,
    prices: {
      standard: 0.75,
      bronce: 0.68,
      plata: 0.62,
      oro: 0.57
    }
  },

  // Suscripciones & Herramientas digitales
  {
    id: 'sub-gemini-1',
    name: 'GEMINI PRO 💎 (1 Mes)',
    category: 'subs',
    categoryLabel: 'Suscripción',
    retailPrice: 2.00,
    prices: {
      standard: 2.00,
      bronce: 1.85,
      plata: 1.75,
      oro: 1.65
    }
  },
  {
    id: 'sub-gemini-3',
    name: 'GEMINI PRO 💎 (3 Meses)',
    category: 'subs',
    categoryLabel: 'Suscripción',
    retailPrice: 5.00,
    prices: {
      standard: 5.00,
      bronce: 4.60,
      plata: 4.40,
      oro: 4.15
    }
  },
  {
    id: 'sub-bot-30',
    name: 'Reenvío Plus Bot — Licencia 30 Días',
    category: 'subs',
    categoryLabel: 'Servicio',
    retailPrice: 0.99,
    prices: {
      standard: 0.99,
      bronce: 0.90,
      plata: 0.85,
      oro: 0.80
    }
  }
];

export function ResellerPricingModal({ onClose, onSelectAmount }) {
  const [selectedTierId, setSelectedTierId] = useState('plata');
  const [activeCategory, setActiveCategory] = useState('all');
  const [products, setProducts] = useState(RESELLER_SAMPLE_PRODUCTS);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRealCatalogPrices() {
      try {
        const [fzrOffersRes, smsData] = await Promise.all([
          api.fzrCatalogOffers('topup', 'free_fire_latam').catch(() => null),
          api.smsServices('usa').catch(() => null)
        ]);

        if (cancelled) return;

        const liveList = [];

        // 1. Mapear productos reales de Free Fire desde proveedor mayorista FZR
        if (fzrOffersRes?.ok && Array.isArray(fzrOffersRes?.items) && fzrOffersRes.items.length > 0) {
          const priorityOfferOrder = [
            '110_diamonds',
            '341_diamonds',
            '572_diamonds',
            '1166_diamonds',
            '2398_diamonds',
            'weekly_lite',
            'weekly_membership',
            'booyah_pass',
            'monthly_membership',
            '6160_diamonds'
          ];

          const nameMap = {
            '110_diamonds': 'Free Fire 110 Diamantes (100 + 10)',
            '341_diamonds': 'Free Fire 341 Diamantes (310 + 31)',
            '572_diamonds': 'Free Fire 572 Diamantes (520 + 52)',
            '1166_diamonds': 'Free Fire 1166 Diamantes (1060 + 106)',
            '2398_diamonds': 'Free Fire 2398 Diamantes (2180 + 218)',
            '6160_diamonds': 'Free Fire 6160 Diamantes',
            'weekly_lite': 'Free Fire Pase Semanal Lite',
            'weekly_membership': 'Free Fire Pase Semanal',
            'monthly_membership': 'Free Fire Pase Mensual',
            'booyah_pass': 'Free Fire Pase Booyah'
          };

          const validOffers = fzrOffersRes.items.filter(it => it.offer_id && (priorityOfferOrder.includes(it.offer_id) || it.is_available !== false));

          validOffers.sort((a, b) => {
            const idxA = priorityOfferOrder.indexOf(a.offer_id);
            const idxB = priorityOfferOrder.indexOf(b.offer_id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return (Number(a.cost_usdt) || 0) - (Number(b.cost_usdt) || 0);
          });

          validOffers.slice(0, 10).forEach(it => {
            const cost = Number(it.cost_usdt || it.price_usd || 0);
            const retail = Number(it.price_usdt || (cost * 1.30));
            liveList.push({
              id: `fzr-ff-${it.offer_id}`,
              name: nameMap[it.offer_id] || `Free Fire ${it.name.replace(/Diamonds/gi, 'Diamantes')}`,
              category: 'ff',
              categoryLabel: 'Free Fire',
              retailPrice: Number(retail.toFixed(2)),
              prices: {
                standard: Number(retail.toFixed(2)),
                bronce: Number((cost * 1.14).toFixed(2)),
                plata: Number((cost * 1.10).toFixed(2)),
                oro: Number((cost * 1.07).toFixed(2))
              }
            });
          });
        } else {
          // Fallback a los sample products de Free Fire
          const ffSamples = RESELLER_SAMPLE_PRODUCTS.filter(p => p.category === 'ff');
          liveList.push(...ffSamples);
        }

        // 2. Mapear SMS reales desde la API
        if (smsData?.items && Array.isArray(smsData.items)) {
          const smsKeys = ['whatsapp', 'telegram', 'google', 'whatnot'];
          const targetSms = smsData.items.filter(s => smsKeys.includes(s.key?.toLowerCase()));
          targetSms.forEach(s => {
            const retail = Number(s.price || 0.80);
            const cost = Number((retail / 1.50).toFixed(2));
            liveList.push({
              id: `live-sms-${s.key}`,
              name: `SMS ${s.name} (USA)`,
              category: 'sms',
              categoryLabel: 'SMS Virtual',
              retailPrice: Number(retail.toFixed(2)),
              prices: {
                standard: Number(retail.toFixed(2)),
                bronce: Number((cost * 1.35).toFixed(2)),
                plata: Number((cost * 1.25).toFixed(2)),
                oro: Number((cost * 1.15).toFixed(2))
              }
            });
          });
        }

        // 3. Suscripciones / Cuentas
        const subSamples = RESELLER_SAMPLE_PRODUCTS.filter(p => p.category === 'subs');
        liveList.push(...subSamples);

        if (liveList.length > 0 && !cancelled) {
          setProducts(liveList);
          setIsLive(true);
        }
      } catch (err) {
        console.error("Error fetching live reseller pricing:", err);
      }
    }

    loadRealCatalogPrices();

    return () => { cancelled = true; };
  }, []);

  const selectedTier = RESELLER_TIERS_DATA.find(t => t.id === selectedTierId) || RESELLER_TIERS_DATA[1];

  const filteredProducts = products.filter(p => {
    if (activeCategory === 'all') return true;
    return p.category === activeCategory;
  });

  return (
    <div 
      className="fixed inset-0 z-[1000000] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 text-left"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-bg border border-white/10 shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-card/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white leading-tight truncate">
                  Precios según tu Recarga en USDT
                </h2>
                {isLive && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    En tiempo real
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/50 leading-tight flex items-center gap-1.5">
                <span>Simulador de planes mayoristas y descuentos automáticos</span>
                {isLive && (
                  <span className="text-emerald-400 font-bold sm:hidden">· En vivo</span>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full bg-white/5 p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Selector de Niveles / Rangos */}
          <div>
            <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider block mb-2">
              Selecciona un rango de recarga para simular precios:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RESELLER_TIERS_DATA.map((tier) => {
                const isSelected = tier.id === selectedTierId;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`p-2.5 rounded-2xl border text-left transition-all active:scale-95 flex flex-col justify-between ${
                      isSelected
                        ? `border-accent bg-accent/15 ring-2 ring-accent/30 shadow-md`
                        : `border-white/10 bg-card hover:border-white/20 hover:bg-white/5`
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-base">{tier.emoji}</span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border ${tier.badgeClass}`}>
                          {tier.markup}
                        </span>
                      </div>
                      <div className="font-black text-xs text-white leading-tight">
                        {tier.name}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5 font-mono">
                        {tier.range}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] font-bold text-accent">
                      {tier.savingsText}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tarjeta de Beneficios del Nivel Seleccionado */}
          <div className={`rounded-2xl border ${selectedTier.borderColor} ${selectedTier.bgColor} p-3.5 sm:p-4 space-y-2`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedTier.emoji}</span>
                <div>
                  <span className="text-xs text-white/50 font-semibold block leading-none">Beneficios de:</span>
                  <span className={`text-sm sm:text-base font-black ${selectedTier.colorText}`}>
                    {selectedTier.name} ({selectedTier.markup} de margen)
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-white bg-black/40 px-2.5 py-1 rounded-xl border border-white/10">
                {selectedTier.range}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {selectedTier.perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-white/85">
                  <Check className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filtros de Categorías de Productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                Precios con este nivel en productos populares:
              </label>
              <span className="text-[10px] text-white/40">
                Valores en USDT
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: '⭐ Todos' },
                { id: 'ff', label: '🔥 Free Fire' },
                { id: 'sms', label: '📱 SMS Virtuales' },
                { id: 'subs', label: '🎮 Suscripciones' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    activeCategory === tab.id
                      ? 'bg-accent text-bg shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Precios Comparativa */}
          <div className="rounded-2xl border border-white/10 bg-card overflow-hidden">
            <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40 border-b border-white/5 bg-white/5">
              <div className="col-span-6 sm:col-span-7">Producto</div>
              <div className="col-span-3 sm:col-span-2 text-right">Precio Regular</div>
              <div className="col-span-3 sm:col-span-3 text-right">Tu Precio ({selectedTier.markup})</div>
            </div>

            <div className="divide-y divide-white/5">
              {filteredProducts.map((p) => {
                const tierPrice = p.prices[selectedTier.id] || p.retailPrice;
                const savings = Number((p.retailPrice - tierPrice).toFixed(2));
                const hasDiscount = savings > 0;

                return (
                  <div key={p.id} className="grid grid-cols-12 px-3 py-2.5 items-center hover:bg-white/5 transition-colors">
                    <div className="col-span-6 sm:col-span-7 pr-2">
                      <div className="text-xs font-bold text-white truncate">
                        {p.name}
                      </div>
                      <span className="text-[10px] text-white/40">
                        {p.categoryLabel}
                      </span>
                    </div>

                    <div className="col-span-3 sm:col-span-2 text-right">
                      <span className={`text-xs ${hasDiscount ? 'line-through text-white/35 font-normal' : 'text-white font-bold'}`}>
                        ${p.retailPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="col-span-3 sm:col-span-3 text-right">
                      <div className="text-xs sm:text-sm font-black text-accent">
                        ${tierPrice.toFixed(2)}
                      </div>
                      {hasDiscount && (
                        <span className="text-[9px] font-bold text-emerald-400 block">
                          Ahorras ${savings.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center text-[11px] text-white/50 leading-relaxed px-2">
            {isLive ? (
              <span className="text-emerald-400 font-medium inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Precios sincronizados en tiempo real con el catálogo y costos de proveedores oficiales.</span>
              </span>
            ) : (
              <span>
                💡 <em>Los descuentos se aplican de forma inmediata y automática sobre toda la tienda al completar una recarga única del monto correspondiente.</em>
              </span>
            )}
          </div>
        </div>

        {/* Footer con Botón de Recarga Directo */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-card/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <span className="text-[11px] text-white/50 block">Monto mínimo para este nivel:</span>
            <span className="text-sm sm:text-base font-extrabold text-white">
              ${selectedTier.quickAmount}.00 USDT
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onSelectAmount) {
                onSelectAmount(selectedTier.quickAmount);
              }
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-accent text-bg font-black text-xs sm:text-sm hover:bg-accent/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
          >
            <WalletCards className="h-4 w-4" />
            <span>Recargar ${selectedTier.quickAmount} USDT y Activar Nivel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
