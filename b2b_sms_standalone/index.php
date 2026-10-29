<?php
/**
 * Frontend de Números Virtuales (SMS Storefront)
 * Francho Shop B2B Standalone Script
 */

define('SMS_SYSTEM', true);
require_once __DIR__ . '/db.php';

$storeName = get_setting('store_name', DEFAULT_STORE_NAME);
$primaryColor = get_setting('primary_color', DEFAULT_PRIMARY_COLOR);
?>
<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title><?php echo htmlspecialchars($storeName); ?> | Números Virtuales SMS</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: '<?php echo $primaryColor; ?>',
            darkBg: '#0b0f17',
            cardBg: '#131926',
            cardBorder: 'rgba(255, 255, 255, 0.08)'
          }
        }
      }
    }
  </script>

  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #0b0f17;
      color: #f1f5f9;
      -webkit-tap-highlight-color: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 9999px;
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 0.3; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .animate-pulse-ring {
      animation: pulse-ring 2s infinite ease-in-out;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between selection:bg-brand selection:text-black">

  <!-- TOP HEADER -->
  <header class="sticky top-0 z-40 backdrop-blur-md bg-[#0b0f17]/85 border-b border-white/10 px-4 py-3">
    <div class="max-w-4xl mx-auto flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center border border-brand/40 shadow-sm" style="background-color: <?php echo $primaryColor; ?>20; color: <?php echo $primaryColor; ?>;">
          <i data-lucide="smartphone" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-sm sm:text-base font-black text-white leading-tight">
              <?php echo htmlspecialchars($storeName); ?>
            </h1>
            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-brand/40" style="background-color: <?php echo $primaryColor; ?>15; color: <?php echo $primaryColor; ?>;">
              5sim Oficial
            </span>
          </div>
          <p class="text-[10px] text-white/50 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Servicio Activo 24/7 • Entrega Inmediata</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button id="btnActiveOrders" onclick="toggleActiveOrdersDrawer()" class="hidden relative px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition active:scale-95 flex items-center gap-1.5">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-yellow-400"></i>
          <span>Mis Pedidos</span>
          <span id="activeOrdersBadge" class="w-2 h-2 rounded-full bg-yellow-400"></span>
        </button>

        <a href="admin.php" class="p-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition active:scale-95" title="Panel de Administración">
          <i data-lucide="settings" class="w-4 h-4"></i>
        </a>
      </div>
    </div>
  </header>

  <!-- CONTENIDO PRINCIPAL -->
  <main class="max-w-4xl w-full mx-auto p-4 sm:p-5 flex-1 space-y-4">

    <!-- BANNER DE GARANTÍA ESTILO FRANCHO SHOP -->
    <section class="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-cardBg via-[#101726] to-cardBg p-4 sm:p-5 relative shadow-xl">
      <div class="relative z-10 max-w-xl space-y-2">
        <div class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
          <i data-lucide="shield-check" class="w-3 h-3 text-emerald-400"></i>
          <span>Activaciones 100% Garantizadas</span>
        </div>
        <h2 class="text-base sm:text-lg font-black text-white leading-tight">
          Recibe códigos de verificación SMS al instante
        </h2>
        <p class="text-xs text-white/70 leading-relaxed">
          Compra números virtuales para WhatsApp, Telegram, OpenAI (ChatGPT), Google, TikTok y más de 500 apps. 
          <b>Reembolso 100% automático</b> a tu cuenta si el SMS no llega dentro del tiempo límite o si decides cancelar.
        </p>
      </div>
      <div class="absolute -right-8 -bottom-8 w-44 h-44 rounded-full opacity-10 pointer-events-none blur-2xl" style="background-color: <?php echo $primaryColor; ?>;"></div>
    </section>

    <!-- SELECTOR DE DOS PÍLDORAS: [PAÍS] Y [APP] -->
    <section class="grid grid-cols-2 gap-2.5">
      <!-- Botón País -->
      <button type="button" onclick="openPicker('country')" id="pillCountry" class="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-cardBg hover:border-white/20 p-3 text-left transition active:scale-[0.99] shadow-sm">
        <span id="pillCountryFlag" class="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-xl shrink-0">
          🌐
        </span>
        <div class="min-w-0 flex-1">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-white/40">1. País</span>
          <span id="pillCountryName" class="block truncate text-xs font-black text-white">Escoger país</span>
        </div>
        <i data-lucide="chevron-down" class="w-4 h-4 text-white/40 shrink-0"></i>
      </button>

      <!-- Botón App -->
      <button type="button" onclick="openPicker('service')" id="pillService" class="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-cardBg hover:border-white/20 p-3 text-left transition active:scale-[0.99] shadow-sm">
        <span id="pillServiceIcon" class="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-xl shrink-0 text-cyan-400">
          <i data-lucide="smartphone" class="w-5 h-5"></i>
        </span>
        <div class="min-w-0 flex-1">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-white/40">2. Aplicación</span>
          <span id="pillServiceName" class="block truncate text-xs font-black text-white">Escoger app</span>
        </div>
        <i data-lucide="chevron-down" class="w-4 h-4 text-white/40 shrink-0"></i>
      </button>
    </section>

    <!-- VISTA 1: SELECTOR DE PAÍSES -->
    <section id="viewCountries" class="rounded-2xl border border-white/10 bg-cardBg overflow-hidden shadow-2xl transition">
      <div class="p-3.5 border-b border-white/10 space-y-2.5 bg-black/20">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black text-white uppercase tracking-wider">Selecciona el país de la línea</p>
          <span id="countryCountBadge" class="text-[10px] font-bold text-white/40">Cargando...</span>
        </div>
        <div class="relative">
          <i data-lucide="search" class="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input type="text" id="inputSearchCountry" oninput="filterCountries()" placeholder="Buscar país (ej: Estados Unidos, España, Colombia...)" class="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-brand">
        </div>
      </div>

      <div id="countriesList" class="p-3 max-h-[380px] overflow-y-auto custom-scrollbar grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <div class="col-span-full py-12 text-center text-xs text-white/40 font-bold">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-brand"></i>
          Cargando países disponibles...
        </div>
      </div>
    </section>

    <!-- VISTA 2: SELECTOR DE APLICACIONES -->
    <section id="viewServices" class="hidden rounded-2xl border border-white/10 bg-cardBg overflow-hidden shadow-2xl transition">
      <div class="p-3.5 border-b border-white/10 space-y-2.5 bg-black/20">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-black text-white uppercase tracking-wider">Selecciona la aplicación o servicio</p>
            <p id="serviceCountrySub" class="text-[11px] text-white/50">País: No seleccionado</p>
          </div>
          <span id="serviceCountBadge" class="text-[10px] font-bold text-white/40">0 apps</span>
        </div>
        <div class="relative">
          <i data-lucide="search" class="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input type="text" id="inputSearchService" oninput="filterServices()" placeholder="Buscar app (WhatsApp, Telegram, ChatGPT, Google...)" class="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-brand">
        </div>
      </div>

      <div id="servicesList" class="p-3 max-h-[380px] overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        <!-- Renderizado dinámico -->
      </div>
    </section>

    <!-- VISTA 3: NÚMERO ACTIVO / RECEPCIÓN DE SMS EN VIVO -->
    <section id="activeOrderCard" class="hidden rounded-3xl border border-white/10 bg-gradient-to-b from-cardBg to-[#0d121c] p-5 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-2.5">
          <span id="activeOrderFlag" class="text-2xl">🌐</span>
          <div>
            <div class="flex items-center gap-2">
              <h3 id="activeOrderService" class="text-sm font-black text-white">WhatsApp</h3>
              <span id="activeOrderStatusBadge" class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                Esperando SMS...
              </span>
            </div>
            <p id="activeOrderCountry" class="text-[11px] text-white/50">Línea temporal</p>
          </div>
        </div>

        <!-- Temporizador regresivo -->
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono font-black text-yellow-400">
          <i data-lucide="timer" class="w-3.5 h-3.5"></i>
          <span id="activeOrderTimer">15:00</span>
        </div>
      </div>

      <!-- Número de Teléfono con Botón de Copia -->
      <div class="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3">
        <div>
          <span class="text-[10px] uppercase font-bold text-white/40 block">Número Asignado</span>
          <span id="activeOrderPhone" class="text-lg sm:text-xl font-mono font-black text-white tracking-wider">+000 000 0000</span>
        </div>
        <button type="button" onclick="copyText(currentOrder.phone, 'Número copiado al portapapeles')" class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          <span>Copiar</span>
        </button>
      </div>

      <!-- Caja de Espera de Código SMS -->
      <div id="smsBoxWaiting" class="p-6 rounded-2xl border border-dashed border-white/15 bg-black/20 text-center space-y-3">
        <div class="relative w-12 h-12 mx-auto">
          <div class="absolute inset-0 rounded-full border border-yellow-400/40 animate-pulse-ring"></div>
          <div class="w-12 h-12 rounded-full bg-yellow-400/15 text-yellow-400 flex items-center justify-center">
            <i data-lucide="radio" class="w-6 h-6"></i>
          </div>
        </div>
        <div>
          <p class="text-xs font-black text-white">Esperando mensaje de texto (SMS)...</p>
          <p class="text-[11px] text-white/50">Ingresa este número en la app y solicita el código. Aparecerá aquí al instante.</p>
        </div>
      </div>

      <!-- Caja de Código SMS Recibido -->
      <div id="smsBoxReceived" class="hidden p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black">
          <i data-lucide="check-circle-2" class="w-4 h-4"></i>
          <span>¡Código SMS Recibido con Éxito!</span>
        </div>

        <div class="py-2">
          <span id="displaySmsCode" class="text-3xl sm:text-4xl font-mono font-black text-emerald-400 tracking-widest block select-all">123456</span>
          <p id="displaySmsFull" class="text-xs text-white/60 font-mono mt-1 max-w-md mx-auto line-clamp-2"></p>
        </div>

        <button type="button" onclick="copyText(currentOrder.sms_code, '¡Código SMS copiado!')" class="w-full py-3 rounded-xl font-black text-xs text-black flex items-center justify-center gap-2 shadow-xl transition active:scale-95" style="background-color: <?php echo $primaryColor; ?>;">
          <i data-lucide="copy" class="w-4 h-4"></i>
          <span>Copiar Código</span>
        </button>
      </div>

      <!-- Botón Cancelar Número -->
      <div class="flex items-center justify-between pt-2 text-xs">
        <button type="button" id="btnCancelNumber" onclick="cancelCurrentOrder()" disabled class="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
          Cancelar y recuperar saldo
        </button>
        <span id="cancelNotice" class="text-[11px] text-white/40">Disponible en 2 min</span>
      </div>
    </section>

  </main>

  <!-- MODAL DE SELECCIÓN DE OPERADOR / PRECIO -->
  <div id="modalOperator" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="bg-cardBg border border-white/10 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h3 class="text-sm font-black text-white">Confirmar Línea Virtual</h3>
          <p id="modalOperatorSub" class="text-[11px] text-white/50">WhatsApp • Estados Unidos</p>
        </div>
        <button onclick="closeModal('modalOperator')" class="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-bold text-white/60 block">Operador móvil disponible:</label>
        <div id="operatorsContainer" class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
          <!-- Operadores dinámicos -->
        </div>
      </div>

      <div class="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
        <span class="text-xs text-white/70 font-bold">Precio total:</span>
        <span id="modalSelectedPrice" class="text-base font-black text-brand font-mono">$0.00 USDT</span>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button type="button" onclick="closeModal('modalOperator')" class="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 font-bold text-xs transition">
          Cancelar
        </button>
        <button type="button" id="btnConfirmBuy" onclick="executeBuyNumber()" class="flex-1 py-2.5 rounded-xl font-black text-xs text-black transition active:scale-95 shadow flex items-center justify-center gap-1.5" style="background-color: <?php echo $primaryColor; ?>;">
          <span>Comprar Número</span>
        </button>
      </div>
    </div>
  </div>

  <!-- TOAST NOTIFICACIÓN -->
  <div id="toast" class="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#161f2e] border border-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 transition-all opacity-0 pointer-events-none duration-200">
    <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
    <span id="toastMsg">Mensaje</span>
  </div>

  <!-- FOOTER -->
  <footer class="border-t border-white/5 py-4 text-center text-xs text-white/40">
    <p><?php echo htmlspecialchars($storeName); ?> &copy; <?php echo date('Y'); ?> • Activaciones SMS Conectadas a Francho Shop</p>
  </footer>

  <!-- LÓGICA JAVASCRIPT DEL CLIENTE -->
  <script>
    // Variables de estado
    let countries = [];
    let services = [];
    let selectedCountry = null;
    let selectedService = null;
    let selectedOperator = 'any';
    let selectedPrice = '0.00';
    let currentOrder = null;
    let checkInterval = null;
    let countdownInterval = null;

    // Sonido de notificación de SMS recibido (Web Audio API sintético sin archivos externos)
    function playSmsSound() {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } catch(e) {}
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      document.getElementById('toastMsg').innerText = msg;
      t.classList.remove('opacity-0', 'pointer-events-none');
      t.classList.add('opacity-100');
      setTimeout(() => {
        t.classList.remove('opacity-100');
        t.classList.add('opacity-0', 'pointer-events-none');
      }, 3000);
    }

    function copyText(txt, successMsg = 'Copiado al portapapeles') {
      if (!txt) return;
      navigator.clipboard.writeText(txt).then(() => {
        showToast(successMsg);
      }).catch(() => {
        const input = document.createElement('input');
        input.value = txt;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast(successMsg);
      });
    }

    function openModal(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
      }
    }

    function closeModal(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
      }
    }

    function openPicker(tab) {
      if (tab === 'country') {
        document.getElementById('viewCountries').classList.remove('hidden');
        document.getElementById('viewServices').classList.add('hidden');
      } else {
        if (!selectedCountry) {
          showToast('Primero selecciona un país');
          return;
        }
        document.getElementById('viewCountries').classList.add('hidden');
        document.getElementById('viewServices').classList.remove('hidden');
      }
    }

    // 1. Cargar Países
    async function loadCountries() {
      try {
        const res = await fetch('api.php?action=countries');
        const data = await res.json();
        if (data.ok && Array.isArray(data.items)) {
          countries = data.items;
          document.getElementById('countryCountBadge').innerText = `${countries.length} disponibles`;
          renderCountries(countries);
        } else {
          document.getElementById('countriesList').innerHTML = `<div class="col-span-full py-8 text-center text-red-400 text-xs font-bold">${data.error || 'Error cargando países'}</div>`;
        }
      } catch (err) {
        document.getElementById('countriesList').innerHTML = `<div class="col-span-full py-8 text-center text-red-400 text-xs font-bold">Error de conexión al servidor</div>`;
      }
    }

    function renderCountries(list) {
      const container = document.getElementById('countriesList');
      if (list.length === 0) {
        container.innerHTML = '<div class="col-span-full py-8 text-center text-white/40 text-xs font-bold">No se encontraron países</div>';
        return;
      }
      container.innerHTML = list.map(c => `
        <button type="button" onclick="selectCountry('${c.country}', '${c.name.replace(/'/g, "\\'")}', '${c.flag_emoji || '🌐'}')" class="flex items-center gap-2 p-2 rounded-xl border border-white/10 bg-black/30 hover:border-white/20 text-left transition active:scale-[0.98] ${selectedCountry === c.country ? 'ring-1 ring-brand bg-brand/10 border-brand' : ''}">
          <span class="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center text-lg shrink-0 border border-white/5">${c.flag_emoji || '🌐'}</span>
          <div class="min-w-0 flex-1">
            <span class="block truncate text-xs font-black text-white">${c.name}</span>
            <span class="block text-[9px] uppercase font-bold text-white/40">${c.country}</span>
          </div>
        </button>
      `).join('');
    }

    function filterCountries() {
      const q = document.getElementById('inputSearchCountry').value.toLowerCase().trim();
      const filtered = countries.filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q));
      renderCountries(filtered);
    }

    // 2. Seleccionar País y Cargar Servicios
    async function selectCountry(code, name, flag) {
      selectedCountry = code;
      document.getElementById('pillCountryFlag').innerText = flag;
      document.getElementById('pillCountryName').innerText = name;
      document.getElementById('serviceCountrySub').innerText = `País: ${name}`;

      // Resetear servicio
      selectedService = null;
      document.getElementById('pillServiceName').innerText = 'Escoger app';

      // Cambiar a vista de servicios
      openPicker('service');

      // Cargar servicios
      const container = document.getElementById('servicesList');
      container.innerHTML = '<div class="col-span-full py-12 text-center text-xs text-white/40 font-bold"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-brand"></i>Cargando aplicaciones para ' + name + '...</div>';
      lucide.createIcons();

      try {
        const res = await fetch(`api.php?action=services&country=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.items)) {
          services = data.items;
          document.getElementById('serviceCountBadge').innerText = `${services.length} apps`;
          renderServices(services);
        } else {
          container.innerHTML = `<div class="col-span-full py-8 text-center text-white/40 text-xs font-bold">${data.error || 'No hay servicios disponibles para este país'}</div>`;
        }
      } catch (e) {
        container.innerHTML = '<div class="col-span-full py-8 text-center text-red-400 text-xs font-bold">Error consultando aplicaciones</div>';
      }
    }

    function renderServices(list) {
      const container = document.getElementById('servicesList');
      if (list.length === 0) {
        container.innerHTML = '<div class="col-span-full py-8 text-center text-white/40 text-xs font-bold">No hay aplicaciones disponibles</div>';
        return;
      }
      container.innerHTML = list.map(s => `
        <button type="button" onclick="selectService('${s.service}', '${s.name.replace(/'/g, "\\'")}', '${s.price}')" class="flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-black/30 hover:border-white/20 text-left transition active:scale-[0.98]">
          <div class="flex items-center gap-2.5 min-w-0 pr-2">
            <span class="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center shrink-0 border border-white/10 overflow-hidden">
              ${s.icon_url ? `<img src="${s.icon_url}" class="w-5 h-5 object-contain" alt="">` : `<i data-lucide="smartphone" class="w-4 h-4 text-cyan-400"></i>`}
            </span>
            <div class="min-w-0">
              <span class="block truncate text-xs font-black text-white">${s.name}</span>
              <span class="block text-[10px] text-white/40">${s.qty || 0} disponibles</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="block text-xs font-mono font-black text-brand">$${s.price} USDT</span>
          </div>
        </button>
      `).join('');
      lucide.createIcons();
    }

    function filterServices() {
      const q = document.getElementById('inputSearchService').value.toLowerCase().trim();
      const filtered = services.filter(s => s.name.toLowerCase().includes(q) || s.service.toLowerCase().includes(q));
      renderServices(filtered);
    }

    // 3. Abrir Modal de Compra y Cargar Operadores
    async function selectService(serviceCode, serviceName, basePrice) {
      selectedService = serviceCode;
      selectedPrice = basePrice;
      selectedOperator = 'any';

      document.getElementById('pillServiceName').innerText = serviceName;
      document.getElementById('modalOperatorSub').innerText = `${serviceName} • ${document.getElementById('pillCountryName').innerText}`;
      document.getElementById('modalSelectedPrice').innerText = `$${basePrice} USDT`;

      openModal('modalOperator');

      const opContainer = document.getElementById('operatorsContainer');
      opContainer.innerHTML = '<div class="py-4 text-center text-xs text-white/40 font-bold"><i data-lucide="loader-2" class="w-4 h-4 animate-spin mx-auto mb-1 text-brand"></i>Consultando stock y operadores...</div>';
      lucide.createIcons();

      try {
        const res = await fetch(`api.php?action=operators&country=${encodeURIComponent(selectedCountry)}&service=${encodeURIComponent(serviceCode)}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
          opContainer.innerHTML = `
            <label class="flex items-center justify-between p-2 rounded-xl border border-white/10 bg-black/40 cursor-pointer">
              <div class="flex items-center gap-2">
                <input type="radio" name="rad_op" value="any" checked onchange="updateSelectedOp('any', '${basePrice}')" class="accent-brand">
                <span class="text-xs font-bold text-white">Cualquier Operador (Mejor Precio)</span>
              </div>
              <span class="text-xs font-mono font-black text-brand">$${basePrice}</span>
            </label>
          ` + data.items.map(op => `
            <label class="flex items-center justify-between p-2 rounded-xl border border-white/10 bg-black/40 cursor-pointer">
              <div class="flex items-center gap-2">
                <input type="radio" name="rad_op" value="${op.operator}" onchange="updateSelectedOp('${op.operator}', '${op.price}')" class="accent-brand">
                <span class="text-xs font-bold text-white capitalize">${op.operator} (${op.qty} disp.)</span>
              </div>
              <span class="text-xs font-mono font-black text-brand">$${op.price}</span>
            </label>
          `).join('');
        } else {
          opContainer.innerHTML = `
            <label class="flex items-center justify-between p-2 rounded-xl border border-white/10 bg-black/40">
              <span class="text-xs font-bold text-white">Operador Automático</span>
              <span class="text-xs font-mono font-black text-brand">$${basePrice}</span>
            </label>
          `;
        }
      } catch (e) {
        opContainer.innerHTML = '<div class="text-xs text-white/40">Operador estándar asignado.</div>';
      }
    }

    function updateSelectedOp(opName, opPrice) {
      selectedOperator = opName;
      selectedPrice = opPrice;
      document.getElementById('modalSelectedPrice').innerText = `$${opPrice} USDT`;
    }

    // 4. Ejecutar Compra del Número
    async function executeBuyNumber() {
      const btn = document.getElementById('btnConfirmBuy');
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Procesando...</span>';
      lucide.createIcons();

      try {
        const res = await fetch('api.php?action=buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: selectedCountry,
            service: selectedService,
            operator: selectedOperator
          })
        });

        const data = await res.json();
        if (data.ok && data.phone) {
          closeModal('modalOperator');
          showToast('¡Número virtual asignado con éxito!');
          startActiveOrder(data);
        } else {
          showToast(data.error || 'No se pudo comprar el número');
        }
      } catch (err) {
        showToast('Error de comunicación con la pasarela');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Comprar Número</span>';
      }
    }

    // 5. Iniciar Vista de Orden Activa y Polling de SMS
    function startActiveOrder(orderData) {
      currentOrder = orderData;
      currentOrder.flag = document.getElementById('pillCountryFlag').innerText;

      document.getElementById('activeOrderCard').classList.remove('hidden');
      document.getElementById('activeOrderService').innerText = (orderData.service || '').toUpperCase();
      document.getElementById('activeOrderCountry').innerText = `Línea: ${orderData.country?.toUpperCase()} (${orderData.operator || 'Cualquiera'})`;
      document.getElementById('activeOrderFlag').innerText = currentOrder.flag || '🌐';
      document.getElementById('activeOrderPhone').innerText = orderData.phone;
      
      document.getElementById('smsBoxWaiting').classList.remove('hidden');
      document.getElementById('smsBoxReceived').classList.add('hidden');
      document.getElementById('activeOrderStatusBadge').innerText = 'Esperando SMS...';
      document.getElementById('activeOrderStatusBadge').className = 'px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';

      // Scroll hacia la tarjeta
      document.getElementById('activeOrderCard').scrollIntoView({ behavior: 'smooth' });

      // Temporizador de 15 a 20 minutos
      if (countdownInterval) clearInterval(countdownInterval);
      let timeLeft = orderData.expires_in_seconds || 1200;
      let cancelIn = orderData.can_cancel_after_seconds || 120;

      countdownInterval = setInterval(() => {
        timeLeft--;
        cancelIn--;

        const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const secs = (timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('activeOrderTimer').innerText = `${mins}:${secs}`;

        const cancelBtn = document.getElementById('btnCancelNumber');
        const cancelNot = document.getElementById('cancelNotice');
        if (cancelIn <= 0) {
          cancelBtn.disabled = false;
          cancelNot.innerText = 'Puedes cancelar sin costo';
        } else {
          cancelBtn.disabled = true;
          cancelNot.innerText = `Disponible en ${cancelIn}s`;
        }

        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          clearInterval(checkInterval);
          document.getElementById('activeOrderStatusBadge').innerText = 'Expirado';
        }
      }, 1000);

      // Polling cada 3.5 segundos para chequear si llegó el SMS
      if (checkInterval) clearInterval(checkInterval);
      checkInterval = setInterval(async () => {
        try {
          const res = await fetch(`api.php?action=check&order_id=${encodeURIComponent(orderData.order_id)}`);
          const data = await res.json();
          if (data.ok && data.sms_code) {
            clearInterval(checkInterval);
            clearInterval(countdownInterval);
            currentOrder.sms_code = data.sms_code;

            document.getElementById('smsBoxWaiting').classList.add('hidden');
            document.getElementById('smsBoxReceived').classList.remove('hidden');
            document.getElementById('displaySmsCode').innerText = data.sms_code;
            document.getElementById('displaySmsFull').innerText = data.full_sms || '';
            document.getElementById('activeOrderStatusBadge').innerText = 'Completado';
            document.getElementById('activeOrderStatusBadge').className = 'px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            document.getElementById('btnCancelNumber').classList.add('hidden');
            document.getElementById('cancelNotice').classList.add('hidden');

            playSmsSound();
            showToast('¡Código SMS recibido con éxito!');
          }
        } catch(e) {}
      }, 3500);

      lucide.createIcons();
    }

    // 6. Cancelar Pedido Activo
    async function cancelCurrentOrder() {
      if (!currentOrder || !confirm('¿Estás seguro de cancelar este número? El saldo será reembolsado a tu cuenta.')) return;
      const btn = document.getElementById('btnCancelNumber');
      btn.disabled = true;
      btn.innerText = 'Cancelando...';

      try {
        const res = await fetch('api.php?action=cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: currentOrder.order_id })
        });
        const data = await res.json();
        if (data.ok) {
          clearInterval(checkInterval);
          clearInterval(countdownInterval);
          showToast('Número cancelado exitosamente');
          document.getElementById('activeOrderCard').classList.add('hidden');
        } else {
          showToast(data.error || 'Error al cancelar');
          btn.disabled = false;
          btn.innerText = 'Cancelar y recuperar saldo';
        }
      } catch(e) {
        showToast('Error de conexión');
        btn.disabled = false;
        btn.innerText = 'Cancelar y recuperar saldo';
      }
    }

    // Inicializar al cargar la página
    document.addEventListener('DOMContentLoaded', () => {
      loadCountries();
      lucide.createIcons();
    });
  </script>
</body>
</html>
