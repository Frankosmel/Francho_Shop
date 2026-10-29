import re

file_path = '/home/ubuntu/gamestore/webapp/frontend/src/ResellerB2B.jsx'
with open(file_path, 'r') as f:
    code = f.read()

# Helper function for field guide and offer icons
helper_code = """
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

function getOfferIcon(type, name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('diamante') || lower.includes('diamond')) return '💎';
  if (lower.includes('pase') || lower.includes('pass') || lower.includes('booyah')) return '🎟️';
  if (lower.includes('star') || lower.includes('estrella')) return '⭐';
  if (lower.includes('premium')) return '👑';
  if (lower.includes('uc') || lower.includes('pubg')) return '🪙';
  if (lower.includes('oro') || lower.includes('gold')) return '🟡';
  if (type === 'giftcard') return '🎁';
  if (type === 'subscription') return '🍿';
  if (type === 'gamekey') return '🔑';
  return '📦';
}
"""

if 'function getFieldGuide' not in code:
    code = code.replace("export function ResellerB2BCatalog", helper_code + "\nexport function ResellerB2BCatalog")

# Replace modal section inside ResellerB2BCatalog
modal_start_marker = '{/* ─── MODAL COMPLETO DE SELECCIÓN DE OFERTAS & COMPRA B2B ─── */}'
modal_end_marker = '{/* Modal de Comprobante tras compra exitosa */}'

start_idx = code.find(modal_start_marker)
end_idx = code.find(modal_end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find modal markers")
    exit(1)

new_modal_code = """{/* ─── MODAL COMPLETO DE SELECCIÓN DE OFERTAS & COMPRA B2B ─── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="card w-full max-w-3xl rounded-3xl bg-[#0d121d] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
            
            {/* Header Visual con Portada y Badges */}
            <div className="p-4 sm:p-6 bg-gradient-to-b from-white/5 to-transparent border-b border-white/10 flex items-start gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/50 overflow-hidden flex-shrink-0 border border-white/10 shadow-lg relative">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Boxes className="w-8 h-8 text-white/20" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[10px] font-black uppercase tracking-wider">
                    {selectedProduct.type === 'topup' ? '⚡ Recarga Directa' : selectedProduct.type === 'giftcard' ? '🎁 Gift Card' : '📦 Producto Digital'}
                  </span>
                  {selectedProduct.region && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold uppercase tracking-wider">
                      🌎 {selectedProduct.region}
                    </span>
                  )}
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Entrega Automática 24/7
                  </span>
                </div>

                <h2 className="text-lg sm:text-2xl font-black text-white leading-tight truncate">
                  {selectedProduct.name}
                </h2>
                <p className="text-xs text-white/50 mt-0.5 truncate">
                  Tarifas oficiales mayoristas con acreditación inmediata.
                </p>
              </div>

              <button 
                onClick={() => setSelectedProduct(null)} 
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido scrolleable del Modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Banner de Nivel Mayorista */}
              <div className="p-3 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Precios Mayoristas Activos</span>
                </div>
                <span className="text-[11px] text-white/60 font-medium">
                  Margen con descuento mayorista aplicado en todas las posiciones
                </span>
              </div>

              {/* Instrucciones / Guía de recarga si existe */}
              {(offersPayload?.note || selectedProduct.note || (typeof offersPayload?.descriptions === 'object' && offersPayload?.descriptions?.es)) && (
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/70 flex items-start gap-2.5">
                  <span className="p-1 rounded-lg bg-accent/15 text-accent flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <strong className="text-white block mb-0.5">Información importante de la entrega:</strong>
                    <p className="whitespace-pre-line leading-relaxed text-white/60 text-[11px]">
                      {offersPayload?.note || selectedProduct.note || offersPayload?.descriptions?.es}
                    </p>
                  </div>
                </div>
              )}

              {loadingOffers ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  <span className="text-xs text-white/50">Consultando paquetes y stock en tiempo real...</span>
                </div>
              ) : (offersPayload?.offers || []).length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">
                  No hay paquetes disponibles en este momento para este producto.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 1. SELECTOR DE PAQUETES / OPCIONES */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] flex items-center justify-center font-black">1</span>
                        Selecciona el Paquete o Denominación
                      </label>
                      <span className="text-[11px] text-white/40">
                        {offersPayload?.offers?.length} opciones disponibles
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                      {(offersPayload?.offers || []).map(offer => {
                        const isSelected = selectedOffer?.id === offer.id || selectedOffer?.offer_id === offer.offer_id;
                        const priceUsd = offer.price_usdt || offer.price_usd || offer.price || '0.00';
                        const icon = getOfferIcon(selectedProduct.type, offer.name);

                        return (
                          <div 
                            key={offer.id || offer.offer_id}
                            onClick={() => setSelectedOffer(offer)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                              isSelected 
                                ? 'bg-gradient-to-r from-accent/20 to-accent/5 border-accent shadow-lg shadow-accent/10 scale-[1.01]' 
                                : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                              <span className="text-xl flex-shrink-0">{icon}</span>
                              <div className="min-w-0 flex-1">
                                <strong className={`text-xs block truncate ${isSelected ? 'text-white font-black' : 'text-white/80 group-hover:text-white'}`}>
                                  {offer.name}
                                </strong>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] uppercase font-bold text-emerald-400">
                                    ⚡ Entrega Inmediata
                                  </span>
                                  {offer.price_cup && (
                                    <span className="text-[10px] text-white/40 font-mono">
                                      ~{offer.price_cup} CUP
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-sm font-black ${isSelected ? 'text-accent' : 'text-white'}`}>
                                ${priceUsd} <small className="text-[9px] font-normal text-white/40">USDT</small>
                              </span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                isSelected ? 'border-accent bg-accent text-bg' : 'border-white/20 bg-transparent'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. PANEL DE DATOS DE COMPRA (SOLO SI HAY OPCIÓN SELECCIONADA) */}
                  {selectedOffer && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      
                      {/* Resumen de Opción Elegida */}
                      <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-accent block">Opción seleccionada</span>
                          <strong className="text-xs text-white font-black">{selectedOffer.name}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-white/50 block">Precio Unitario</span>
                          <span className="text-sm font-black text-accent">
                            ${selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || '0.00'} USDT
                          </span>
                        </div>
                      </div>

                      {/* Campos dinámicos requeridos */}
                      {(() => {
                        const fieldsList = offersPayload?.fields || offersPayload?.fields_required || selectedProduct.fields || selectedProduct.fields_required || [];
                        if (fieldsList.length === 0) return null;

                        return (
                          <div className="space-y-3 pt-1">
                            <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] flex items-center justify-center font-black">2</span>
                              Datos requeridos para la entrega
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {fieldsList.map((f, idx) => {
                                const fKey = f.key || f.id || `field_${idx}`;
                                const fLabel = f.label || f.name || fKey;
                                const fGuide = getFieldGuide(f);
                                const isRequired = f.required !== false;

                                return (
                                  <div key={fKey} className={fieldsList.length === 1 ? 'sm:col-span-2' : ''}>
                                    <label className="block text-xs font-bold text-white/80 mb-1">
                                      {fLabel} {isRequired && <span className="text-rose-400">*</span>}
                                    </label>
                                    
                                    {f.type === 'select' && Array.isArray(f.options) && f.options.length > 0 ? (
                                      <select
                                        value={purchaseFields[fKey] || ''}
                                        onChange={e => setPurchaseFields({...purchaseFields, [fKey]: e.target.value})}
                                        className="w-full bg-[#070a12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-accent outline-none transition"
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
                                        className="w-full bg-[#070a12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-accent outline-none transition font-medium"
                                      />
                                    )}

                                    {fGuide && (
                                      <span className="block text-[10px] text-white/40 mt-1 leading-normal">
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

                      {/* Selector de Cantidad */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div>
                          <span className="text-xs font-bold text-white block">Cantidad de Unidades</span>
                          <span className="text-[10px] text-white/40">Multiplica este paquete</span>
                        </div>
                        <div className="flex items-center gap-2 bg-[#070a12] border border-white/10 rounded-xl p-1">
                          <button 
                            type="button"
                            onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <span className="font-black text-white text-sm min-w-[28px] text-center">{purchaseQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setPurchaseQuantity(purchaseQuantity + 1)}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Desglose Financiero y Chequeo de Saldo */}
                      {wallet && selectedOffer && (() => {
                        const unitPrice = parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0);
                        const totalCost = unitPrice * purchaseQuantity;
                        const currentBalance = parseFloat(wallet.balance || 0);
                        const hasEnoughBalance = currentBalance >= totalCost;
                        const remaining = (currentBalance - totalCost).toFixed(2);

                        return (
                          <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 space-y-2 text-xs">
                            <div className="flex justify-between text-white/60">
                              <span>Tu Saldo disponible:</span>
                              <span className="font-bold text-white">${wallet.balance} USDT</span>
                            </div>
                            <div className="flex justify-between text-white/60">
                              <span>Total a debitar:</span>
                              <span className="font-bold text-accent">-${totalCost.toFixed(4)} USDT</span>
                            </div>
                            <div className="pt-2 border-t border-white/5 flex justify-between items-center font-bold">
                              <span>Saldo restante estimado:</span>
                              <span className={hasEnoughBalance ? 'text-emerald-400' : 'text-rose-400'}>
                                {hasEnoughBalance ? `$${remaining} USDT` : `Saldo insuficiente (faltan $${(totalCost - currentBalance).toFixed(2)} USDT)`}
                              </span>
                            </div>

                            {!hasEnoughBalance && (
                              <div className="pt-2 flex justify-end">
                                <button 
                                  type="button"
                                  onClick={() => window.dispatchEvent(new CustomEvent('open-deposit'))}
                                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                                >
                                  + Recargar Saldo B2B
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Footer: Total y Botón de Confirmación */}
            {selectedOffer && (
              <div className="p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent border-t border-white/10 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider block">Total a Pagar</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-accent">
                      ${(parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0) * purchaseQuantity).toFixed(4)}
                    </span>
                    <span className="text-xs text-white/60 font-bold">USDT</span>
                  </div>
                </div>

                {(() => {
                  const fieldsList = offersPayload?.fields || offersPayload?.fields_required || selectedProduct.fields || selectedProduct.fields_required || [];
                  const isMissingRequired = fieldsList.some(f => {
                    const k = f.key || f.id;
                    const isReq = f.required !== false;
                    return isReq && (!purchaseFields[k] || !String(purchaseFields[k]).trim());
                  });
                  const unitPrice = parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0);
                  const totalCost = unitPrice * purchaseQuantity;
                  const isInsufficientBalance = wallet && parseFloat(wallet.balance || 0) < totalCost;

                  return (
                    <button 
                      disabled={purchaseLoading || !selectedOffer || isMissingRequired || isInsufficientBalance}
                      onClick={handleConfirmPurchase}
                      className="bg-accent hover:bg-accent/90 text-bg px-6 sm:px-8 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 shadow-xl shadow-accent/20"
                    >
                      {purchaseLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Procesando Compra...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 stroke-[2.5]" /> Confirmar Compra Inmediata
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            )}

          </div>
        </div>
      )}
"""

code = code[:start_idx] + new_modal_code + "\n      " + code[end_idx:]

with open(file_path, 'w') as f:
    f.write(code)

print("Successfully replaced purchase modal with ultra-polished version!")
