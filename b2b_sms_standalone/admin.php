<?php
/**
 * Panel de Administración para el Revendedor
 * Francho Shop B2B Standalone Script
 */

define('SMS_SYSTEM', true);
require_once __DIR__ . '/db.php';

session_start();

// Manejo de Logout
if (isset($_GET['logout'])) {
    unset($_SESSION['sms_admin_logged']);
    session_destroy();
    header('Location: admin.php');
    exit;
}

// Manejo de Login
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login_password'])) {
    $passInput = trim($_POST['login_password']);
    $hash = get_setting('admin_password_hash');
    
    // Si no está configurado, usar por defecto
    if (empty($hash)) {
        $hash = password_hash(DEFAULT_ADMIN_PASSWORD, PASSWORD_DEFAULT);
        set_setting('admin_password_hash', $hash);
    }

    if (password_verify($passInput, $hash) || $passInput === DEFAULT_ADMIN_PASSWORD) {
        $_SESSION['sms_admin_logged'] = true;
        header('Location: admin.php');
        exit;
    } else {
        $loginError = 'Contraseña incorrecta. Por favor intenta de nuevo.';
    }
}

$isLogged = !empty($_SESSION['sms_admin_logged']);
$storeName = get_setting('store_name', DEFAULT_STORE_NAME);
$primaryColor = get_setting('primary_color', DEFAULT_PRIMARY_COLOR);
$markupPercent = (float)get_setting('markup_percent', DEFAULT_MARKUP_PERCENT);
$apiKey = get_setting('api_key', DEFAULT_API_KEY);
?>
<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel | <?php echo htmlspecialchars($storeName); ?></title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: '<?php echo $primaryColor; ?>',
            darkBg: '#0b0f17',
            cardBg: '#131926'
          }
        }
      }
    }
  </script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #0b0f17;
      color: #f1f5f9;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 9999px;
    }
  </style>
</head>
<body class="min-h-screen bg-[#0b0f17] flex flex-col justify-between selection:bg-brand selection:text-black">

  <?php if (!$isLogged): ?>
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  PANTALLA DE LOGIN DE ADMINISTRADOR                        -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-cardBg border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border border-brand/40 shadow-lg" style="background-color: <?php echo $primaryColor; ?>20; color: <?php echo $primaryColor; ?>;">
            <i data-lucide="shield-check" class="w-6 h-6"></i>
          </div>
          <h2 class="text-lg font-black text-white">Panel de Administración</h2>
          <p class="text-xs text-white/50">Ingresa la contraseña para gestionar el sistema de números SMS</p>
        </div>

        <?php if ($loginError): ?>
          <div class="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-bold text-red-300 text-center">
            <?php echo htmlspecialchars($loginError); ?>
          </div>
        <?php endif; ?>

        <form method="POST" action="admin.php" class="space-y-4">
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-white/70 block">Contraseña de acceso:</label>
            <div class="relative">
              <input type="password" name="login_password" required placeholder="Ingresa tu contraseña" class="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand">
            </div>
            <span class="text-[10px] text-white/40 block mt-1">Por defecto: <code class="text-yellow-400 font-mono">admin123</code></span>
          </div>

          <button type="submit" class="w-full py-2.5 rounded-xl font-black text-xs text-black transition active:scale-95 shadow-lg flex items-center justify-center gap-1.5" style="background-color: <?php echo $primaryColor; ?>;">
            <i data-lucide="lock" class="w-4 h-4"></i>
            <span>Iniciar Sesión</span>
          </button>
        </form>

        <div class="text-center pt-2 border-t border-white/5">
          <a href="index.php" class="text-xs text-white/50 hover:text-white transition">
            &larr; Volver a la Tienda Pública
          </a>
        </div>
      </div>
    </div>

  <?php else: ?>
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  PANEL DE ADMINISTRACIÓN PRINCIPAL                         -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <header class="sticky top-0 z-40 backdrop-blur-md bg-[#0b0f17]/90 border-b border-white/10 px-4 py-3">
      <div class="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center bg-brand/20 border border-brand/40 text-brand">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
          </div>
          <div>
            <h1 class="text-sm font-black text-white leading-tight">Admin SMS • <?php echo htmlspecialchars($storeName); ?></h1>
            <p class="text-[10px] text-white/50">Gestión de activaciones, ganancias y margen comercial</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <a href="index.php" target="_blank" class="px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition flex items-center gap-1.5">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Ver Tienda</span>
          </a>
          <a href="admin.php?logout=1" class="px-3 py-1.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-300 transition flex items-center gap-1.5">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
            <span>Salir</span>
          </a>
        </div>
      </div>
    </header>

    <main class="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1 space-y-6">

      <!-- TARJETAS DE ESTADÍSTICAS Y SALDO -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <!-- 1. Saldo Mayorista Francho Shop -->
        <div class="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 relative overflow-hidden shadow-lg">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black uppercase text-emerald-400">Saldo Mayorista</span>
            <button onclick="refreshBalance()" title="Actualizar Saldo" class="text-white/40 hover:text-white transition">
              <i data-lucide="refresh-cw" id="iconRefreshBal" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span id="statBalance" class="text-2xl font-mono font-black text-emerald-300">Consultando...</span>
            <span class="text-xs text-emerald-400 font-bold">USDT</span>
          </div>
          <p class="text-[10px] text-white/50">Tu balance disponible en Francho Shop</p>
        </div>

        <!-- 2. Ganancias Netas Totales -->
        <div class="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 space-y-2 relative overflow-hidden shadow-lg">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black uppercase text-yellow-400">Ganancia Neta Total</span>
            <i data-lucide="trending-up" class="w-4 h-4 text-yellow-400"></i>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span id="statProfit" class="text-2xl font-mono font-black text-yellow-300">$0.00</span>
            <span class="text-xs text-yellow-400 font-bold">USDT</span>
          </div>
          <p class="text-[10px] text-white/50">Tu margen comercial acumulado</p>
        </div>

        <!-- 3. Total Activaciones Entregadas -->
        <div class="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 space-y-2 relative overflow-hidden shadow-lg">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black uppercase text-cyan-400">SMS Completados</span>
            <i data-lucide="check-check" class="w-4 h-4 text-cyan-400"></i>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span id="statCompletedOrders" class="text-2xl font-mono font-black text-cyan-300">0</span>
            <span class="text-xs text-cyan-400 font-bold">números</span>
          </div>
          <p class="text-[10px] text-white/50">Activaciones con código recibido</p>
        </div>

        <!-- 4. Total Pedidos Registrados -->
        <div class="p-4 rounded-2xl border border-white/10 bg-cardBg space-y-2 relative overflow-hidden shadow-lg">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black uppercase text-white/40">Total Solicitudes</span>
            <i data-lucide="smartphone" class="w-4 h-4 text-white/40"></i>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span id="statTotalOrders" class="text-2xl font-mono font-black text-white">0</span>
            <span class="text-xs text-white/40 font-bold">pedidos</span>
          </div>
          <p class="text-[10px] text-white/50">Historial completo en SQLite</p>
        </div>
      </section>

      <!-- CONFIGURACIÓN DEL SISTEMA Y MARGEN -->
      <section class="p-5 rounded-3xl border border-white/10 bg-cardBg space-y-4 shadow-xl">
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="sliders" class="w-4 h-4 text-brand"></i>
            <h3 class="text-sm font-black text-white">Configuración del Negocio y Ganancias</h3>
          </div>
          <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30">
            Ajustes en Vivo
          </span>
        </div>

        <form id="formSettings" onsubmit="saveSettings(event)" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Margen de Ganancia -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-white/80 flex items-center justify-between">
              <span>Margen de Ganancia (%):</span>
              <span id="displayMarkupBadge" class="text-brand font-mono font-bold">+<?php echo $markupPercent; ?>%</span>
            </label>
            <div class="flex items-center gap-2">
              <input type="number" id="cfgMarkup" step="1" min="0" max="200" value="<?php echo $markupPercent; ?>" class="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-brand">
              <span class="text-xs font-bold text-white/50">%</span>
            </div>
            <!-- Preset rápido -->
            <div class="flex items-center gap-1.5 pt-1">
              <button type="button" onclick="setMarkupPreset(15)" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white">+15%</button>
              <button type="button" onclick="setMarkupPreset(25)" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white">+25%</button>
              <button type="button" onclick="setMarkupPreset(35)" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white">+35%</button>
              <button type="button" onclick="setMarkupPreset(50)" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white">+50%</button>
            </div>
          </div>

          <!-- Nombre de la Tienda -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-white/80">Nombre de la Tienda:</label>
            <input type="text" id="cfgStoreName" value="<?php echo htmlspecialchars($storeName); ?>" class="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand">
            <p class="text-[10px] text-white/40">Visible para tus clientes en la cabecera</p>
          </div>

          <!-- Francho Shop API Key -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-white/80">API Key de Francho Shop:</label>
            <input type="password" id="cfgApiKey" value="<?php echo htmlspecialchars($apiKey); ?>" placeholder="Pega tu token B2B" class="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-brand">
            <p class="text-[10px] text-white/40">Obtenla en tu cuenta de Francho Shop</p>
          </div>

          <!-- Color y Contraseña -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-white/80">Color Primario Hex:</label>
            <div class="flex items-center gap-2">
              <input type="color" id="cfgColorPicker" value="<?php echo htmlspecialchars($primaryColor); ?>" onchange="document.getElementById('cfgColorText').value = this.value" class="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0">
              <input type="text" id="cfgColorText" value="<?php echo htmlspecialchars($primaryColor); ?>" class="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-brand">
            </div>
          </div>

          <div class="space-y-1.5 md:col-span-2">
            <label class="text-xs font-bold text-white/80">Cambiar Contraseña de Admin (opcional):</label>
            <div class="flex items-center gap-3">
              <input type="password" id="cfgNewPass" placeholder="Dejar en blanco para mantener la actual" class="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand">
              <button type="submit" id="btnSaveCfg" class="px-5 py-2 rounded-xl font-black text-xs text-black transition active:scale-95 shadow flex items-center gap-1.5 shrink-0" style="background-color: <?php echo $primaryColor; ?>;">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Guardar Ajustes</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      <!-- TABLA DE PEDIDOS Y EXPORTACIÓN A EXCEL -->
      <section class="p-5 rounded-3xl border border-white/10 bg-cardBg space-y-4 shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="history" class="w-4 h-4 text-brand"></i>
            <h3 class="text-sm font-black text-white">Historial de Activaciones y Códigos</h3>
          </div>

          <!-- Botón de Exportar a Excel / CSV -->
          <div class="flex items-center gap-2">
            <button onclick="loadOrders()" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition" title="Refrescar tabla">
              <i data-lucide="rotate-cw" id="iconRefreshOrders" class="w-3.5 h-3.5"></i>
            </button>
            <a href="api.php?action=admin_export_csv" class="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
              <span>Exportar a Excel / CSV</span>
            </a>
          </div>
        </div>

        <!-- Tabla -->
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-white/10 text-white/40 uppercase text-[10px] font-black">
                <th class="py-2.5 px-3">Fecha</th>
                <th class="py-2.5 px-3">Servicio</th>
                <th class="py-2.5 px-3">País</th>
                <th class="py-2.5 px-3">Teléfono</th>
                <th class="py-2.5 px-3">Costo ($)</th>
                <th class="py-2.5 px-3">Venta ($)</th>
                <th class="py-2.5 px-3">Ganancia ($)</th>
                <th class="py-2.5 px-3">Código SMS</th>
                <th class="py-2.5 px-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody id="ordersTableBody" class="divide-y divide-white/5 text-white/80">
              <tr>
                <td colspan="9" class="py-8 text-center text-white/40 font-bold">Cargando activaciones...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </main>

    <!-- TOAST NOTIFICACIÓN ADMIN -->
    <div id="adminToast" class="fixed bottom-5 right-5 z-50 bg-[#161f2e] border border-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 transition-all opacity-0 pointer-events-none duration-200">
      <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
      <span id="adminToastMsg">Configuración guardada</span>
    </div>

    <script>
      function showAdminToast(msg) {
        const t = document.getElementById('adminToast');
        document.getElementById('adminToastMsg').innerText = msg;
        t.classList.remove('opacity-0', 'pointer-events-none');
        t.classList.add('opacity-100');
        setTimeout(() => {
          t.classList.remove('opacity-100');
          t.classList.add('opacity-0', 'pointer-events-none');
        }, 3000);
      }

      function setMarkupPreset(val) {
        document.getElementById('cfgMarkup').value = val;
        document.getElementById('displayMarkupBadge').innerText = `+${val}%`;
      }

      async function refreshBalance() {
        const icon = document.getElementById('iconRefreshBal');
        if (icon) icon.classList.add('animate-spin');
        try {
          const res = await fetch('api.php?action=admin_balance');
          const data = await res.json();
          if (data.ok && data.balance) {
            document.getElementById('statBalance').innerText = `$${data.balance}`;
          } else {
            document.getElementById('statBalance').innerText = 'No config.';
          }
        } catch(e) {
          document.getElementById('statBalance').innerText = 'Error';
        } finally {
          if (icon) icon.classList.remove('animate-spin');
        }
      }

      async function saveSettings(e) {
        e.preventDefault();
        const btn = document.getElementById('btnSaveCfg');
        btn.disabled = true;

        const payload = {
          markup_percent: document.getElementById('cfgMarkup').value,
          store_name: document.getElementById('cfgStoreName').value,
          api_key: document.getElementById('cfgApiKey').value,
          primary_color: document.getElementById('cfgColorText').value,
          new_password: document.getElementById('cfgNewPass').value
        };

        try {
          const res = await fetch('api.php?action=admin_save_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.ok) {
            showAdminToast('¡Ajustes guardados exitosamente!');
            document.getElementById('cfgNewPass').value = '';
            refreshBalance();
          } else {
            alert(data.error || 'Error al guardar');
          }
        } catch(err) {
          alert('Error de conexión');
        } finally {
          btn.disabled = false;
        }
      }

      async function loadOrders() {
        const icon = document.getElementById('iconRefreshOrders');
        if (icon) icon.classList.add('animate-spin');
        try {
          const res = await fetch('api.php?action=admin_orders');
          const data = await res.json();
          if (data.ok) {
            document.getElementById('statProfit').innerText = `$${data.stats?.total_profit || '0.00'}`;
            document.getElementById('statCompletedOrders').innerText = data.stats?.completed_orders || 0;
            document.getElementById('statTotalOrders').innerText = data.stats?.total_orders || 0;

            const tbody = document.getElementById('ordersTableBody');
            if (!data.orders || data.orders.length === 0) {
              tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-white/40 font-bold">No hay pedidos registrados aún</td></tr>';
              return;
            }

            tbody.innerHTML = data.orders.map(o => {
              const d = new Date(o.created_at * 1000);
              const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              let statusBadge = '<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">Pendiente</span>';
              if (o.status === 'completed') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Completado</span>';
              } else if (o.status === 'cancelled') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/30">Cancelado</span>';
              }

              return `
                <tr class="hover:bg-white/[0.02] transition">
                  <td class="py-2.5 px-3 text-white/50 text-[11px] whitespace-nowrap">${dateStr}</td>
                  <td class="py-2.5 px-3 font-bold text-white capitalize">${o.service}</td>
                  <td class="py-2.5 px-3 text-white/70 uppercase text-[11px] font-mono">${o.country}</td>
                  <td class="py-2.5 px-3 font-mono font-bold text-white select-all">${o.phone}</td>
                  <td class="py-2.5 px-3 font-mono text-white/60">$${Number(o.cost_price).toFixed(2)}</td>
                  <td class="py-2.5 px-3 font-mono font-bold text-white">$${Number(o.sell_price).toFixed(2)}</td>
                  <td class="py-2.5 px-3 font-mono font-bold text-emerald-400">+$${Number(o.profit).toFixed(2)}</td>
                  <td class="py-2.5 px-3 font-mono font-black text-brand text-sm select-all">${o.sms_code || '<span class="text-white/20">—</span>'}</td>
                  <td class="py-2.5 px-3 text-right">${statusBadge}</td>
                </tr>
              `;
            }).join('');
          }
        } catch(e) {
          console.error(e);
        } finally {
          if (icon) icon.classList.remove('animate-spin');
        }
      }

      document.addEventListener('DOMContentLoaded', () => {
        refreshBalance();
        loadOrders();
        lucide.createIcons();
      });
    </script>
  <?php endif; ?>

  <footer class="border-t border-white/5 py-4 text-center text-xs text-white/30">
    <p>Francho Shop B2B Standalone Engine &copy; <?php echo date('Y'); ?></p>
  </footer>

  <script>
    lucide.createIcons();
  </script>
</body>
</html>
