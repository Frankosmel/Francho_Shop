const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE_URL = 'https://franchoshop.reenvioplusbot.xyz';
const OUTPUT_DIR = path.resolve(__dirname, '../audit_screenshots_android');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Emulación de Android Móvil (Pixel 7 / Galaxy S21)
const ANDROID_DEVICE = {
  name: 'Android Mobile (Pixel 7 / Galaxy S21)',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  viewport: {
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    isLandscape: false
  }
};

async function auditLayout(page, sectionName) {
  return await page.evaluate((name) => {
    const issues = [];
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;

    if (scrollWidth > docWidth + 3) {
      issues.push({
        type: 'HORIZONTAL_OVERFLOW',
        severity: 'HIGH',
        message: `La página tiene desbordamiento horizontal: scrollWidth=${scrollWidth}px > clientWidth=${docWidth}px (causa scroll lateral en móvil)`
      });
    }

    const allElements = document.querySelectorAll('*');
    const overflowingElements = [];

    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
        if (rect.right > docWidth + 5) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
          const id = el.id ? `#${el.id}` : '';
          const desc = `${tag}${id}${cls ? '.' + cls : ''}`;
          if (!overflowingElements.some(e => e.desc === desc)) {
            overflowingElements.push({
              desc,
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              overflowPx: Math.round(rect.right - docWidth)
            });
          }
        }
      }
    }

    if (overflowingElements.length > 0) {
      issues.push({
        type: 'ELEMENTS_EXCEEDING_VIEWPORT',
        severity: 'MEDIUM',
        message: `${overflowingElements.length} elementos exceden el ancho visible de la pantalla móvil (412px)`,
        elements: overflowingElements.slice(0, 5)
      });
    }

    return {
      section: name,
      docWidth,
      scrollWidth,
      issuesCount: issues.length,
      issues
    };
  }, sectionName);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runAuditPhase2(adminToken, userToken) {
  console.log('🚀 Iniciando Auditoría Visual Android FASE 2 (100% Cobertura) en Francho Shop...');
  console.log(`📱 Dispositivo: ${ANDROID_DEVICE.name} (${ANDROID_DEVICE.viewport.width}x${ANDROID_DEVICE.viewport.height})`);
  console.log(`📁 Directorio de capturas: ${OUTPUT_DIR}\n`);

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--window-size=412,915'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent(ANDROID_DEVICE.userAgent);
  await page.setViewport(ANDROID_DEVICE.viewport);

  const report = [];

  async function capture(fileName, title, setupFn) {
    process.stdout.write(`📸 [${fileName}] ${title}... `);
    try {
      if (setupFn) await setupFn(page);
      await sleep(1800); // Esperar renderizado y animaciones
      const filePath = path.join(OUTPUT_DIR, `${fileName}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      const audit = await auditLayout(page, title);
      report.push({ fileName: `${fileName}.png`, title, audit });
      if (audit.issuesCount > 0) {
        console.log(`⚠️ (${audit.issuesCount} advertencias detectadas)`);
      } else {
        console.log(`✅ OK`);
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      report.push({ fileName: `${fileName}.png`, title, error: err.message });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // A. PANTALLAS DE AUTENTICACIÓN SECUNDARIAS (INVITADO)
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- A. AUTENTICACIÓN SECUNDARIA Y 2FA ---');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());

  await capture('52_auth_verify_2fa', 'Pantalla de Verificación / Código 2FA', async (p) => {
    await p.goto(`${BASE_URL}/?auth=verify`, { waitUntil: 'networkidle2' });
  });

  await capture('53_auth_reset_password', 'Pantalla de Restablecer Contraseña', async (p) => {
    await p.goto(`${BASE_URL}/?auth=reset`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // B. TRANSACCIONES, COMPRA Y CASOS (AUTENTICADO COMO CLIENTE)
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- B. TRANSACCIONES Y FLUJO DE COMPRA ---');
  await page.evaluate((tok) => {
    localStorage.clear();
    localStorage.setItem('fs_token', tok);
  }, userToken);

  await capture('48_checkout_confirm_screen', 'Pantalla de Confirmación de Compra (Checkout)', async (p) => {
    await p.goto(`${BASE_URL}/?screen=confirm`, { waitUntil: 'networkidle2' });
  });

  await capture('49_purchase_result_screen', 'Pantalla de Resultado de Orden / Polling de Entrega', async (p) => {
    await p.goto(`${BASE_URL}/?screen=result`, { waitUntil: 'networkidle2' });
  });

  await capture('51_order_review_modal', 'Modal de Calificación y Reseña de Pedido', async (p) => {
    await p.goto(`${BASE_URL}/?case=10&review=1`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // C. MODALES DE PERFIL Y SEGURIDAD DEL CLIENTE
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- C. MODALES DE PERFIL Y SEGURIDAD ---');

  await capture('54_customer_edit_profile_modal', 'Modal de Edición de Perfil de Usuario', async (p) => {
    await p.goto(`${BASE_URL}/?screen=profile&modal=edit`, { waitUntil: 'networkidle2' });
  });

  await capture('55_customer_change_password_modal', 'Modal de Cambio de Contraseña Web', async (p) => {
    await p.goto(`${BASE_URL}/?screen=profile&modal=pwd`, { waitUntil: 'networkidle2' });
  });

  await capture('56_customer_linked_accounts_modal', 'Modal de Cuentas Vinculadas (Telegram & Email)', async (p) => {
    await p.goto(`${BASE_URL}/?screen=profile&modal=linked`, { waitUntil: 'networkidle2' });
  });

  await capture('91_catalog_game_regions', 'Pantalla de Selección de Servidor / Regiones de un Juego', async (p) => {
    await p.goto(`${BASE_URL}/?screen=regions&game=Free%20Fire`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // D. CASO DE DISPUTA POSVENTA (ADMIN / USUARIO)
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- D. DISPUTA Y POSVENTA ---');
  await page.evaluate((tok) => {
    localStorage.clear();
    localStorage.setItem('fs_token', tok);
  }, adminToken);

  await capture('50_order_dispute_case_chat', 'Sala de Chat Posventa y Disputa de Garantía', async (p) => {
    await p.goto(`${BASE_URL}/?case=10&admin=true`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // E. PESTAÑAS DEL PANEL DE VENDEDOR COMUNITARIO
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- E. SUB-PESTAÑAS DEL PANEL DE VENDEDOR ---');

  await capture('57_seller_tab_store', 'Panel Vendedor: Configuración de Tienda', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=store`, { waitUntil: 'networkidle2' });
  });

  await capture('58_seller_tab_withdrawals', 'Panel Vendedor: Billetera y Retiros', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=withdrawals`, { waitUntil: 'networkidle2' });
  });

  await capture('59_seller_tab_tiers', 'Panel Vendedor: Categorías y Nivel de Reputación', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=seller-tiers`, { waitUntil: 'networkidle2' });
  });

  await capture('60_seller_tab_channels', 'Panel Vendedor: Canales Oficiales y Notificaciones', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=seller-channels`, { waitUntil: 'networkidle2' });
  });

  await capture('61_seller_tab_manager_chat', 'Panel Vendedor: Seller Manager (Ben)', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=seller-manager`, { waitUntil: 'networkidle2' });
  });

  await capture('62_seller_tab_auto_reply', 'Panel Vendedor: Respuesta Automática de Posventa', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=auto-reply`, { waitUntil: 'networkidle2' });
  });

  await capture('63_seller_tab_new_offer', 'Panel Vendedor: Publicación de Nueva Oferta', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=new-offer`, { waitUntil: 'networkidle2' });
  });

  await capture('64_seller_tab_recharges', 'Panel Vendedor: Gestión y Encolado de Recargas', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=recharges`, { waitUntil: 'networkidle2' });
  });

  await capture('64b_seller_tab_cases', 'Panel Vendedor: Casos y Posventa de Clientes', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=cases`, { waitUntil: 'networkidle2' });
  });

  await capture('64c_seller_tab_chat', 'Panel Vendedor: Mensajería de Chat', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=seller&tab=chat-messages`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // F. PESTAÑAS DEL PANEL DE ADMINISTRACIÓN GLOBAL
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- F. SUB-PESTAÑAS DEL PANEL DE ADMINISTRACIÓN ---');

  await capture('65_admin_tab_dashboard', 'Panel Admin: Tablero de Resumen y KPIs', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=dashboard`, { waitUntil: 'networkidle2' });
  });

  await capture('66_admin_tab_products', 'Panel Admin: Catálogo de Productos y Ofertas Activas', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=products`, { waitUntil: 'networkidle2' });
  });

  await capture('67_admin_tab_master_catalog', 'Panel Admin: Catálogo Maestro & IA BuffPin', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=master-catalog`, { waitUntil: 'networkidle2' });
  });

  await capture('68_admin_tab_orders', 'Panel Admin: Listado Global de Pedidos', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=orders`, { waitUntil: 'networkidle2' });
  });

  await capture('69_admin_tab_cases', 'Panel Admin: Mediación y Casos de Disputa', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=cases`, { waitUntil: 'networkidle2' });
  });

  await capture('70_admin_tab_recharges', 'Panel Admin: Recargas Manuales en Espera', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=recharges`, { waitUntil: 'networkidle2' });
  });

  await capture('71_admin_tab_pricing', 'Panel Admin: Reglas de Precios y Ganancias', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=pricing`, { waitUntil: 'networkidle2' });
  });

  await capture('72_admin_tab_sms', 'Panel Admin: Proveedores y Precios SMS', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=sms`, { waitUntil: 'networkidle2' });
  });

  await capture('73_admin_tab_smm', 'Panel Admin: Servicios y Tarifas SMM', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=smm`, { waitUntil: 'networkidle2' });
  });

  await capture('74_admin_tab_fzr', 'Panel Admin: Códigos e Inventario Gift Cards FZR', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=fzr`, { waitUntil: 'networkidle2' });
  });

  await capture('75_admin_tab_b2b_api', 'Panel Admin: Llaves API B2B y Webhooks', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=b2b-api`, { waitUntil: 'networkidle2' });
  });

  await capture('76_admin_tab_sellers', 'Panel Admin: Moderación y Aprobación de Vendedores', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=sellers`, { waitUntil: 'networkidle2' });
  });

  await capture('77_admin_tab_withdrawals', 'Panel Admin: Solicitudes de Retiro de Billeteras', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=withdrawals`, { waitUntil: 'networkidle2' });
  });

  await capture('78_admin_tab_users', 'Panel Admin: Base de Clientes Registrados', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=users`, { waitUntil: 'networkidle2' });
  });

  await capture('79_admin_tab_reviews', 'Panel Admin: Moderación de Reseñas y Calificaciones', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=reviews`, { waitUntil: 'networkidle2' });
  });

  await capture('80_admin_tab_audit', 'Panel Admin: Registro de Auditoría de Acciones', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=audit`, { waitUntil: 'networkidle2' });
  });

  await capture('81_admin_tab_seller_permissions', 'Panel Admin: Permisos Categorías GG Vendedores', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=seller-permissions`, { waitUntil: 'networkidle2' });
  });

  await capture('82_admin_tab_promotions', 'Panel Admin: Banners y Promociones', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=admin&tab=promotions`, { waitUntil: 'networkidle2' });
  });

  await capture('83_admin_screen_edit_product', 'Pantalla Completa: Edición de Producto / Oferta', async (p) => {
    await p.goto(`${BASE_URL}/?screen=admin-edit`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // G. PESTAÑAS DEL PANEL DE REVENDEDOR B2B
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- G. SUB-PESTAÑAS DEL PANEL DE REVENDEDOR B2B ---');

  await capture('84_reseller_b2b_dashboard', 'Panel B2B: Resumen y Métricas Revendedor', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=reseller&tab=res-b2b-dashboard`, { waitUntil: 'networkidle2' });
  });

  await capture('85_reseller_b2b_catalog', 'Panel B2B: Catálogo Mayorista y Precios VIP', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=reseller&tab=res-b2b-catalog`, { waitUntil: 'networkidle2' });
  });

  await capture('86_reseller_b2b_orders', 'Panel B2B: Pedidos Realizados por API', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=reseller&tab=res-b2b-orders`, { waitUntil: 'networkidle2' });
  });

  await capture('87_reseller_b2b_wallet', 'Panel B2B: Saldo Mayorista y Transacciones', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=reseller&tab=res-b2b-wallet`, { waitUntil: 'networkidle2' });
  });

  await capture('88_reseller_b2b_api', 'Panel B2B: Credenciales API y Documentación', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=reseller&tab=res-b2b-api`, { waitUntil: 'networkidle2' });
  });

  await capture('89_reseller_b2b_settings', 'Panel B2B: Configuración de Cuenta Reseller', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=reseller&tab=res-b2b-settings`, { waitUntil: 'networkidle2' });
  });

  await capture('90_reseller_b2b_support', 'Panel B2B: Canal de Soporte VIP y SLA', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel&role=reseller&tab=res-b2b-support`, { waitUntil: 'networkidle2' });
  });

  await browser.close();

  // Guardar y combinar reporte JSON
  const reportJsonPath = path.join(OUTPUT_DIR, 'audit_report.json');
  let combinedReport = [];
  if (fs.existsSync(reportJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
      // Eliminar capturas viejas si se volvieron a tomar
      const newFileNames = new Set(report.map(r => r.fileName));
      combinedReport = existing.filter(r => !newFileNames.has(r.fileName)).concat(report);
    } catch (e) {
      combinedReport = report;
    }
  } else {
    combinedReport = report;
  }

  // Ordenar por nombre de archivo
  combinedReport.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }));

  fs.writeFileSync(reportJsonPath, JSON.stringify(combinedReport, null, 2), 'utf8');

  console.log(`\n🎉 ¡Fase 2 de Auditoría completada exitosamente!`);
  console.log(`📸 Nuevas capturas en esta fase: ${report.length}`);
  console.log(`📊 Gran Total de capturas en la suite de auditoría: ${combinedReport.length}`);
  console.log(`📝 Reporte JSON actualizado en: ${reportJsonPath}`);
}

const adminTok = process.argv[2] || '';
const userTok = process.argv[3] || '';

runAuditPhase2(adminTok, userTok).catch(err => {
  console.error('Fatal error en auditoría Fase 2:', err);
  process.exit(1);
});
