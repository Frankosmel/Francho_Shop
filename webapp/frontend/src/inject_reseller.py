import re

file_path = '/home/ubuntu/gamestore/webapp/frontend/src/App.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add import statement
import_statement = "import { ResellerB2BDashboard, ResellerB2BCatalog, ResellerB2BOrders, ResellerB2BWallet, ResellerB2BAPI, ResellerB2BSettings, ResellerB2BSupport } from './ResellerB2B'\n"
if "ResellerB2BDashboard" not in content[:2000]:
    content = content.replace("import { api, tg, setSellerId, getSellerId } from './api/client'", import_statement + "import { api, tg, setSellerId, getSellerId } from './api/client'")

# 2. Remove any existing ResellerB2B code in App.jsx
native_comp_pattern = r'// ─── NATIVE B2B RESELLER PORTAL ───.*?function AdminB2BDashboard\(\) \{'
content = re.sub(native_comp_pattern, 'function AdminB2BDashboard() {', content, flags=re.DOTALL)

embedded_comp_pattern = r'// ─── EMBEDDED B2B RESELLER PORTAL ───.*?function AdminB2BDashboard\(\) \{'
content = re.sub(embedded_comp_pattern, 'function AdminB2BDashboard() {', content, flags=re.DOTALL)

# 3. Fix activeTab logic
content = content.replace(
    "else if (activeRole === 'reseller') setActiveTab('catalog')",
    "else if (activeRole === 'reseller') setActiveTab('res-b2b-dashboard')"
)

# 4. Make sure tabs are correct
tabs_start = content.find("} else if (activeRole === 'reseller') {")
if tabs_start != -1:
    tabs_end = content.find("return []", tabs_start)
    if tabs_end != -1:
        old_tabs = content[tabs_start:tabs_end]
        new_tabs = """} else if (activeRole === 'reseller') {
      return [
        { id: 'res-b2b-dashboard', label: 'Resumen B2B', icon: LayoutDashboard },
        { id: 'res-b2b-catalog', label: 'Catálogo B2B', icon: Boxes },
        { id: 'res-b2b-orders', label: 'Mis Pedidos', icon: ReceiptText },
        { id: 'res-b2b-wallet', label: 'Mi Saldo', icon: WalletCards },
        { id: 'res-b2b-api', label: 'API y Webhooks', icon: Wrench },
        { id: 'res-b2b-settings', label: 'Configuración', icon: User },
        { id: 'res-b2b-support', label: 'Soporte VIP', icon: Smile },
      ]
    }\n    """
        content = content.replace(old_tabs, new_tabs)

# 5. Fix rendering block
render_start = content.find("{activeRole === 'reseller' && activeTab.startsWith('res-b2b-')")
if render_start != -1:
    render_end = content.find(")}", render_start) + 2
    if render_end > render_start + 2:
        old_render = content[render_start:render_end]
        new_render = """{activeRole === 'reseller' && activeTab === 'res-b2b-dashboard' && <ResellerB2BDashboard />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-catalog' && <ResellerB2BCatalog />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-orders' && <ResellerB2BOrders />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-wallet' && <ResellerB2BWallet />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-api' && <ResellerB2BAPI />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-settings' && <ResellerB2BSettings />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-support' && <ResellerB2BSupport />}"""
        content = content.replace(old_render, new_render)
else:
    # Check if old native render is there
    render_start = content.find("{activeRole === 'reseller' && activeTab === 'res-b2b-dashboard'")
    if render_start != -1:
        render_end = content.find("{activeRole === 'reseller' && activeTab === 'res-b2b-wallet' && <ResellerB2BWallet />}") + len("{activeRole === 'reseller' && activeTab === 'res-b2b-wallet' && <ResellerB2BWallet />}")
        old_render = content[render_start:render_end]
        new_render = """{activeRole === 'reseller' && activeTab === 'res-b2b-dashboard' && <ResellerB2BDashboard />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-catalog' && <ResellerB2BCatalog />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-orders' && <ResellerB2BOrders />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-wallet' && <ResellerB2BWallet />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-api' && <ResellerB2BAPI />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-settings' && <ResellerB2BSettings />}
          {activeRole === 'reseller' && activeTab === 'res-b2b-support' && <ResellerB2BSupport />}"""
        content = content.replace(old_render, new_render)

with open(file_path, 'w') as f:
    f.write(content)

print("Injected native reseller B2B components properly.")
