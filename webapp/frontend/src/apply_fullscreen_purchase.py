file_path = '/home/ubuntu/gamestore/webapp/frontend/src/ResellerB2B.jsx'
with open(file_path, 'r') as f:
    code = f.read()

# Remove getOfferIcon function if present
if 'function getOfferIcon' in code:
    import re
    code = re.sub(r'function getOfferIcon\(.*?\n\}', '', code, flags=re.DOTALL)

modal_start_marker = '{/* ─── MODAL COMPLETO DE SELECCIÓN DE OFERTAS & COMPRA B2B ─── */}'
modal_end_marker = '{/* Modal de Comprobante tras compra exitosa */}'

start_idx = code.find(modal_start_marker)
end_idx = code.find(modal_end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find modal markers")
    exit(1)

new_fullscreen_code = """{/* ─── MODAL COMPLETO DE SELECCIÓN DE OFERTAS & COMPRA B2B ─── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-[#070a0f] text-white flex flex-col overflow-hidden animate-in fade-in duration-200">
          
          {/* Barra Superior Pantalla Completa */}
          <header className="px-4 py-3 sm:px-8 sm:py-4 bg-[#0d121d] border-b border-white/10 flex items-center justify-between gap-4 z-10 shrink-0">
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
                  {selectedProduct.region && <span>· {selectedProduct.region}</span>}
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
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-6">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                              isSelected 
                                ? 'bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-500/15 text-white ring-1 ring-emerald-400/40' 
                                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-white/80'
                            }`}
                          >
                            <strong className={`text-xs sm:text-sm block truncate pr-2 ${isSelected ? 'text-white font-black' : 'text-white/90'}`}>
                              {offer.name}
                            </strong>

                            <div className="flex items-center gap-3 flex-shrink-0">
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

                  {/* Cantidad si aplica */}
                  {selectedOffer && (
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 text-xs sm:text-sm">
                      <div>
                        <span className="text-white font-bold block">Cantidad a comprar</span>
                        <span className="text-xs text-white/40">Multiplica este paquete</span>
                      </div>
                      <div className="flex items-center gap-3 bg-[#0d121d] border border-white/15 rounded-xl p-1">
                        <button 
                          type="button"
                          onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition text-base"
                        >
                          -
                        </button>
                        <span className="font-black text-white text-sm min-w-[32px] text-center">{purchaseQuantity}</span>
                        <button 
                          type="button"
                          onClick={() => setPurchaseQuantity(purchaseQuantity + 1)}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition text-base"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer Completo Sticky con Total y Botón de Confirmar */}
          {selectedOffer && (
            <footer className="p-4 sm:p-5 bg-[#0d121d] border-t border-white/10 shrink-0">
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
                  const unitPrice = parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0);
                  const totalCost = unitPrice * purchaseQuantity;
                  const isInsufficientBalance = wallet && parseFloat(wallet.balance || 0) < totalCost;

                  return (
                    <button 
                      disabled={purchaseLoading || !selectedOffer || isMissingRequired || isInsufficientBalance}
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
      )}
"""

code = code[:start_idx] + new_fullscreen_code + "\n      " + code[end_idx:]

with open(file_path, 'w') as f:
    f.write(code)

print("Applied full screen purchase view and removed emojis successfully!")
