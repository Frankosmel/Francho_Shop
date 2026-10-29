file_path = '/home/ubuntu/gamestore/webapp/frontend/src/ResellerB2B.jsx'
with open(file_path, 'r') as f:
    code = f.read()

# 1. In handleOpenProduct, set initial quantity to min_quantity if available or 50 if telegram_stars
old_set_offer = """      if (res.offers?.length > 0) {
        setSelectedOffer(res.offers[0]);
        setSelectedOfferId(res.offers[0].id || res.offers[0].offer_id);
      }"""

new_set_offer = """      if (res.offers?.length > 0) {
        const firstOffer = res.offers[0];
        setSelectedOffer(firstOffer);
        setSelectedOfferId(firstOffer.id || firstOffer.offer_id);
        const isStarsProd = product.id === 'telegram_stars' || product.category_id === 'telegram_stars';
        const initialQty = Number(firstOffer.min_quantity) || (isStarsProd ? 50 : 1);
        setPurchaseQuantity(initialQty);
      }"""

code = code.replace(old_set_offer, new_set_offer)

# Also in cache branch of handleOpenProduct
old_cache_offer = """      if (cached.offers?.length > 0) {
        setSelectedOffer(cached.offers[0]);
        setSelectedOfferId(cached.offers[0].id || cached.offers[0].offer_id);
      }
      return;"""

new_cache_offer = """      if (cached.offers?.length > 0) {
        const firstOffer = cached.offers[0];
        setSelectedOffer(firstOffer);
        setSelectedOfferId(firstOffer.id || firstOffer.offer_id);
        const isStarsProd = product.id === 'telegram_stars' || product.category_id === 'telegram_stars';
        const initialQty = Number(firstOffer.min_quantity) || (isStarsProd ? 50 : 1);
        setPurchaseQuantity(initialQty);
      }
      return;"""

code = code.replace(old_cache_offer, new_cache_offer)

# 2. Replace quantity UI block
old_qty_block = """                  {/* Cantidad si aplica */}
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
                  )}"""

new_qty_block = """                  {/* Cantidad / Estrellas */}
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
                  })()}"""

if old_qty_block in code:
    code = code.replace(old_qty_block, new_qty_block)
else:
    print("Could not find old_qty_block")

with open(file_path, 'w') as f:
    f.write(code)

print("Updated Telegram Stars quantity controls successfully!")
