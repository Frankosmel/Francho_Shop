import re

file_path = '/home/ubuntu/gamestore/webapp/frontend/src/ResellerB2B.jsx'
with open(file_path, 'r') as f:
    code = f.read()

# 1. Update state to track selectedOfferId
if 'const [selectedOfferId, setSelectedOfferId] = useState(null);' not in code:
    code = code.replace(
        "const [selectedOffer, setSelectedOffer] = useState(null);",
        "const [selectedOffer, setSelectedOffer] = useState(null);\n  const [selectedOfferId, setSelectedOfferId] = useState(null);"
    )

# 2. Update handleOpenProduct to set selectedOfferId
old_open = """    setLoadingOffers(true);
    try {
      const res = await b2bUserApi(`/catalog/offers?provider_type=${product.provider_type}&category_id=${product.id}`);
      inMemoryCatalogCache.offers[cacheKey] = res;
      setOffersPayload(res);
      if (res.offers?.length > 0) setSelectedOffer(res.offers[0]);"""

new_open = """    setLoadingOffers(true);
    try {
      const res = await b2bUserApi(`/catalog/offers?provider_type=${product.provider_type}&category_id=${product.id}`);
      inMemoryCatalogCache.offers[cacheKey] = res;
      setOffersPayload(res);
      if (res.offers?.length > 0) {
        setSelectedOffer(res.offers[0]);
        setSelectedOfferId(res.offers[0].id || res.offers[0].offer_id);
      }"""

code = code.replace(old_open, new_open)

# Also check cache branch
old_cache = """    if (inMemoryCatalogCache.offers[cacheKey]) {
      const cached = inMemoryCatalogCache.offers[cacheKey];
      setOffersPayload(cached);
      if (cached.offers?.length > 0) setSelectedOffer(cached.offers[0]);
      return;
    }"""

new_cache = """    if (inMemoryCatalogCache.offers[cacheKey]) {
      const cached = inMemoryCatalogCache.offers[cacheKey];
      setOffersPayload(cached);
      if (cached.offers?.length > 0) {
        setSelectedOffer(cached.offers[0]);
        setSelectedOfferId(cached.offers[0].id || cached.offers[0].offer_id);
      }
      return;
    }"""

code = code.replace(old_cache, new_cache)

# 3. Replace the modal markup completely
modal_start_marker = '{/* ─── MODAL COMPLETO DE SELECCIÓN DE OFERTAS & COMPRA B2B ─── */}'
modal_end_marker = '{/* Modal de Comprobante tras compra exitosa */}'

start_idx = code.find(modal_start_marker)
end_idx = code.find(modal_end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find modal markers")
    exit(1)

new_modal_code = """{/* ─── MODAL COMPLETO DE SELECCIÓN DE OFERTAS & COMPRA B2B ─── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="card w-full max-w-2xl rounded-2xl bg-[#0d121d] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header Limpio y Directo */}
            <div className="p-4 sm:p-5 bg-white/5 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-black/60 overflow-hidden flex-shrink-0 border border-white/15 shadow">
                  {selectedProduct.image_url ? (
                    <img src={selectedProduct.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Boxes className="w-6 h-6 m-3 text-white/20" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight truncate">
                    {selectedProduct.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-accent font-bold uppercase tracking-wider">
                      {selectedProduct.type === 'topup' ? 'Recarga Directa' : selectedProduct.type === 'giftcard' ? 'Gift Card' : 'Digital'}
                    </span>
                    {selectedProduct.region && (
                      <span className="text-[10px] text-white/40 uppercase">
                        · {selectedProduct.region}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { setSelectedProduct(null); setSelectedOfferId(null); }} 
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {loadingOffers ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-accent" />
                  <span className="text-xs text-white/50">Cargando opciones...</span>
                </div>
              ) : (offersPayload?.offers || []).length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">
                  No hay opciones disponibles en este momento.
                </div>
              ) : (
                <>
                  {/* Lista de Paquetes / Opciones */}
                  <div>
                    <span className="text-xs font-bold text-white/70 block mb-2">
                      Selecciona una opción:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {(offersPayload?.offers || []).map(offer => {
                        const offerId = offer.id || offer.offer_id;
                        const isSelected = selectedOfferId ? (offerId === selectedOfferId) : (selectedOffer?.id === offerId);
                        const priceUsd = offer.price_usdt || offer.price_usd || offer.price || '0.00';
                        const icon = getOfferIcon(selectedProduct.type, offer.name);

                        return (
                          <div 
                            key={offerId}
                            onClick={() => {
                              setSelectedOffer(offer);
                              setSelectedOfferId(offerId);
                            }}
                            className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                              isSelected 
                                ? 'bg-emerald-500/20 border-emerald-400 shadow-md shadow-emerald-500/10 text-white ring-1 ring-emerald-400/40' 
                                : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10 text-white/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                              <span className="text-lg flex-shrink-0">{icon}</span>
                              <strong className={`text-xs block truncate ${isSelected ? 'text-white font-black' : 'text-white/90'}`}>
                                {offer.name}
                              </strong>
                            </div>

                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <span className={`text-xs sm:text-sm font-black ${isSelected ? 'text-emerald-300' : 'text-accent'}`}>
                                ${priceUsd} <small className="text-[9px] font-bold text-white/50">USDT</small>
                              </span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                isSelected ? 'border-emerald-400 bg-emerald-400 text-bg' : 'border-white/30 bg-black/30'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3] text-black" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Campos Requeridos */}
                  {selectedOffer && (() => {
                    const fieldsList = offersPayload?.fields || offersPayload?.fields_required || selectedProduct.fields || selectedProduct.fields_required || [];
                    if (fieldsList.length === 0) return null;

                    return (
                      <div className="p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                        <span className="text-xs font-bold text-white block">
                          Datos requeridos para la entrega:
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {fieldsList.map((f, idx) => {
                            const fKey = f.key || f.id || `field_${idx}`;
                            const fLabel = f.label || f.name || fKey;
                            const isRequired = f.required !== false;
                            const fGuide = getFieldGuide(f);

                            return (
                              <div key={fKey} className={fieldsList.length === 1 ? 'sm:col-span-2' : ''}>
                                <label className="block text-xs font-semibold text-white/80 mb-1">
                                  {fLabel} {isRequired && <span className="text-rose-400">*</span>}
                                </label>
                                
                                {f.type === 'select' && Array.isArray(f.options) && f.options.length > 0 ? (
                                  <select
                                    value={purchaseFields[fKey] || ''}
                                    onChange={e => setPurchaseFields({...purchaseFields, [fKey]: e.target.value})}
                                    className="w-full bg-[#070a12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-400 outline-none transition"
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
                                    className="w-full bg-[#070a12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-400 outline-none transition font-medium"
                                  />
                                )}

                                {fGuide && (
                                  <span className="block text-[10px] text-white/40 mt-0.5 leading-tight">
                                    {fGuide}
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
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 text-xs">
                      <div>
                        <span className="text-white font-bold block">Cantidad</span>
                        <span className="text-[10px] text-white/40">Unidades de este paquete</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#070a12] border border-white/10 rounded-lg p-0.5">
                        <button 
                          type="button"
                          onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                          className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition"
                        >
                          -
                        </button>
                        <span className="font-black text-white text-xs min-w-[24px] text-center">{purchaseQuantity}</span>
                        <button 
                          type="button"
                          onClick={() => setPurchaseQuantity(purchaseQuantity + 1)}
                          className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Limpio con Total y Confirmar */}
            {selectedOffer && (
              <div className="p-4 sm:p-5 bg-white/5 border-t border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-emerald-400">
                      ${(parseFloat(selectedOffer.price_usdt || selectedOffer.price_usd || selectedOffer.price || 0) * purchaseQuantity).toFixed(4)}
                    </span>
                    <span className="text-[10px] text-white/60 font-bold uppercase">USDT</span>
                  </div>
                  {wallet && (
                    <span className="text-[10px] text-white/40 block">
                      Saldo en cuenta: ${wallet.balance} USDT
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
                      className="bg-emerald-500 hover:bg-emerald-400 text-bg px-5 sm:px-7 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      {purchaseLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
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
            )}

          </div>
        </div>
      )}
"""

code = code[:start_idx] + new_modal_code + "\n      " + code[end_idx:]

with open(file_path, 'w') as f:
    f.write(code)

print("Cleaned up purchase modal successfully!")
