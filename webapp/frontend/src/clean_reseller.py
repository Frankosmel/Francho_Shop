import re

file_path = '/home/ubuntu/gamestore/webapp/frontend/src/ResellerB2B.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# The modal code starts with "{purchaseItem && (" and ends before the next export function or end of file
modal_start_pattern = r'      \{purchaseItem && \(\n        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">.*?\}'

# Remove all occurrences of the modal code
content = re.sub(modal_start_pattern, '', content, flags=re.DOTALL)

# Re-insert it ONLY inside ResellerB2BCatalog
# The end of ResellerB2BCatalog is before `export function ResellerB2BAPI`
catalog_end_pos = content.find("export function ResellerB2BAPI")
if catalog_end_pos != -1:
    before_api = content[:catalog_end_pos]
    
    modal_code = """
      {purchaseItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="card w-full max-w-md p-6 border border-white/10 rounded-2xl bg-[#0b0f17] shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-black text-white">{purchaseItem.name}</h3>
                <p className="text-sm text-accent font-bold">${purchaseItem.price} <span className="text-white/40 font-normal">x 1</span></p>
              </div>
              <button onClick={() => setPurchaseItem(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-4 mb-6">
              {(selectedCatObj?.fields_required || []).map(f => (
                <div key={f.id}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">{f.name}</label>
                  <input 
                    type={f.id.includes('email') ? 'email' : 'text'} 
                    required 
                    placeholder={f.description || ''}
                    value={purchaseFields[f.id] || ''}
                    onChange={e => setPurchaseFields({...purchaseFields, [f.id]: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-accent outline-none transition-colors"
                  />
                </div>
              ))}
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">Cantidad</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity-1))} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-bold hover:bg-white/10">-</button>
                  <span className="font-black text-xl text-white">{purchaseQuantity}</span>
                  <button onClick={() => setPurchaseQuantity(purchaseQuantity+1)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-bold hover:bg-white/10">+</button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-white/50 uppercase font-bold tracking-wide">Total a pagar</p>
                <p className="text-2xl font-black text-accent">${(parseFloat(purchaseItem.price) * purchaseQuantity).toFixed(2)}</p>
              </div>
              <button 
                disabled={purchaseLoading || (selectedCatObj?.fields_required || []).some(f => !purchaseFields[f.id])}
                onClick={async () => {
                  setPurchaseLoading(true);
                  try {
                    const req = {
                      provider_type: selectedCatObj.provider_type,
                      category_id: selectedCatObj.id,
                      offer_id: purchaseItem.id,
                      quantity: purchaseQuantity,
                      fields: purchaseFields,
                      client_request_id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
                    };
                    await b2bUserApiMut('/orders', req);
                    alert('¡Pedido realizado con éxito!');
                    setPurchaseItem(null);
                    window.dispatchEvent(new CustomEvent('b2b-order-created'));
                  } catch (e) {
                    alert(e.message);
                  } finally {
                    setPurchaseLoading(false);
                  }
                }}
                className="bg-accent hover:bg-accent/90 text-bg px-6 py-3 rounded-xl font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
              >
                {purchaseLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
"""
    # Look for the last "    </div>\n  );\n}" before API
    last_div = before_api.rfind("    </div>\n  );\n}")
    if last_div != -1:
        before_api = before_api[:last_div] + modal_code + "    </div>\n  );\n}\n\n"
        
        content = before_api + content[catalog_end_pos:]

with open(file_path, 'w') as f:
    f.write(content)

print("Cleaned ResellerB2B")
