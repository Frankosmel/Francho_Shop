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

async function runAudit(adminToken, userToken) {
  console.log('🚀 Iniciando Auditoría Visual Android Completa en Francho Shop...');
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
      await sleep(1800); // Esperar renderizado completo y animaciones
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
  // 1. AUTENTICACIÓN
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 1. SECCIONES DE AUTENTICACIÓN ---');

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
  });

  await capture('01_auth_login', 'Pantalla de Iniciar Sesión (Login)', async (p) => {
    await p.goto(`${BASE_URL}/?screen=login`, { waitUntil: 'networkidle2' });
  });

  await capture('02_auth_register', 'Pantalla de Registro de Cuenta', async (p) => {
    await p.goto(`${BASE_URL}/?screen=register`, { waitUntil: 'networkidle2' });
  });

  await capture('03_auth_forgot_password', 'Pantalla de Recuperar Contraseña', async (p) => {
    await p.goto(`${BASE_URL}/?screen=login`, { waitUntil: 'networkidle2' });
    await sleep(500);
    await p.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Olvidé'));
      if (btn) btn.click();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. HOME Y MODALES
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 2. HOME, CATEGORÍAS Y MODALES ---');

  await capture('04_home_guest', 'Home / Catálogo Principal (Invitado)', async (p) => {
    await p.evaluate(() => localStorage.clear());
    await p.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  });

  await capture('05_home_community_stores', 'Sección Tiendas de la Comunidad (#community-stores-section)', async (p) => {
    await p.evaluate(() => {
      const el = document.getElementById('community-stores-section');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
  });

  await capture('06_modal_leaderboard', 'Modal de Ranking Mensual de Tiendas (Leaderboard)', async (p) => {
    await p.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Ranking del Mes'));
      if (btn) btn.click();
    });
  });

  // Iniciar sesión como Cliente
  console.log('\n--- INICIANDO SESIÓN COMO CLIENTE ---');
  await page.evaluate((tok) => {
    localStorage.clear();
    localStorage.setItem('fs_token', tok);
  }, userToken);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  await capture('07_home_authenticated', 'Home / Catálogo (Cliente con Saldo y Perfil)', async () => {});

  await capture('08_modal_topup_usdt', 'Modal Recarga de Saldo - Pestaña USDT (OxaPay)', async (p) => {
    await p.evaluate(() => {
      window.dispatchEvent(new CustomEvent('open-deposit'));
    });
  });

  await capture('09_modal_topup_coupon', 'Modal Recarga de Saldo - Pestaña Cupón', async (p) => {
    await p.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Cupón'));
      if (tab) tab.click();
    });
  });

  await capture('10_modal_topup_transfer', 'Modal Recarga de Saldo - Pestaña Tarjeta / CUP', async (p) => {
    await p.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Transferencia') || b.innerText.includes('CUP') || b.innerText.includes('Tarjeta')));
      if (tab) tab.click();
    });
  });

  // Cerrar modal de recarga y recargar Home limpia
  await page.evaluate(() => {
    localStorage.removeItem('fs_last_nav_v1');
  });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await sleep(1000);

  await capture('11_notifications_dropdown', 'Menú Desplegable de Notificaciones', async (p) => {
    await p.evaluate(() => {
      const notifBtn = document.querySelector('button[aria-label*="Notificac"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerHTML.includes('lucide-bell'));
      if (notifBtn) notifBtn.click();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. FILTROS Y CATEGORÍAS DEL CATÁLOGO
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 3. FILTROS DE CATEGORÍA ---');

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await sleep(1000);

  await capture('12_catalog_games', 'Filtro Catálogo: Juegos', async (p) => {
    await p.evaluate(() => {
      const catBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim() === 'Juegos');
      if (catBtn) catBtn.click();
    });
  });

  await capture('13_catalog_streaming', 'Filtro Catálogo: Streaming', async (p) => {
    await p.evaluate(() => {
      const catBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim() === 'Streaming');
      if (catBtn) catBtn.click();
    });
  });

  await capture('14_catalog_ai', 'Filtro Catálogo: IA y Software', async (p) => {
    await p.evaluate(() => {
      const catBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('IA') || b.innerText.includes('Software')));
      if (catBtn) catBtn.click();
    });
  });

  await capture('15_catalog_recharges', 'Filtro Catálogo: Recargas Directas', async (p) => {
    await p.evaluate(() => {
      const catBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim() === 'Recargas');
      if (catBtn) catBtn.click();
    });
  });

  await capture('16_catalog_accounts', 'Filtro Catálogo: Cuentas de Juegos', async (p) => {
    await p.evaluate(() => {
      const catBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim() === 'Cuentas');
      if (catBtn) catBtn.click();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. DETALLE DE PRODUCTO Y COMPARADOR MULTI-TIENDA
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 4. PRODUCTO Y COMPARADOR MULTI-TIENDA ---');

  await capture('17_product_detail_manual', 'Detalle de Producto Manual (Free Fire / Cuentas)', async (p) => {
    await p.goto(`${BASE_URL}/?manual_product=25`, { waitUntil: 'networkidle2' });
  });

  await capture('18_multistore_comparison', 'Comparador Multi-Tienda (G2A style) con Badges SLA y Ranking', async (p) => {
    await p.evaluate(() => {
      const comparisonHeader = Array.from(document.querySelectorAll('h4')).find(h => h.innerText && h.innerText.includes('Ofertas de otras tiendas'));
      if (comparisonHeader) comparisonHeader.scrollIntoView({ behavior: 'instant' });
      else window.scrollBy(0, 450);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. SERVICIOS ESPECIALIZADOS
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 5. SERVICIOS ESPECIALIZADOS ---');

  await capture('19_service_sms', 'Módulo de Números Virtuales SMS', async (p) => {
    await p.goto(`${BASE_URL}/?screen=sms`, { waitUntil: 'networkidle2' });
  });

  await capture('20_service_smm', 'Módulo de Redes Sociales SMM', async (p) => {
    await p.goto(`${BASE_URL}/?screen=smm`, { waitUntil: 'networkidle2' });
  });

  await capture('21_service_telegram', 'Módulo de Telegram Stars y Telegram Premium', async (p) => {
    await p.goto(`${BASE_URL}/?screen=telegram`, { waitUntil: 'networkidle2' });
  });

  await capture('22_service_capcut', 'Módulo de CapCut Pro', async (p) => {
    await p.goto(`${BASE_URL}/?screen=capcut`, { waitUntil: 'networkidle2' });
  });

  await capture('23_service_fzr_catalog', 'Catálogo Global de Proveedores FZR (Juegos)', async (p) => {
    await p.goto(`${BASE_URL}/?screen=fzr-catalog&fzr_cat=1&fzr_type=topup`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // 6. TIENDA PÚBLICA DE VENDEDOR COMUNITARIO
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 6. TIENDA PÚBLICA DE VENDEDOR ---');

  await capture('24_seller_public_store_top', 'Tienda Pública (Ana Shop) - Cabecera, Podio 🥇, Horario y Trust', async (p) => {
    await p.goto(`${BASE_URL}/seller/anashop`, { waitUntil: 'networkidle2' });
  });

  await capture('25_seller_public_store_catalog', 'Tienda Pública (Ana Shop) - Catálogo de Productos', async (p) => {
    await p.evaluate(() => window.scrollBy(0, 450));
  });

  // ════════════════════════════════════════════════════════════════
  // 7. ÁREA DE CLIENTE (PERFIL, PEDIDOS, REFERIDOS)
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 7. ÁREA DEL CLIENTE ---');

  await capture('26_customer_profile', 'Pantalla de Perfil de Usuario (Datos, saldo, seguridad)', async (p) => {
    await p.evaluate(() => localStorage.removeItem('fs_last_nav_v1'));
    await p.goto(`${BASE_URL}/?screen=profile`, { waitUntil: 'networkidle2' });
  });

  await capture('27_customer_orders', 'Historial de Pedidos del Cliente con Badges SLA', async (p) => {
    await p.evaluate(() => localStorage.removeItem('fs_last_nav_v1'));
    await p.goto(`${BASE_URL}/?screen=orders`, { waitUntil: 'networkidle2' });
  });

  await capture('28_customer_order_detail', 'Modal de Detalle de Pedido (SLA Tracker y Entrega)', async (p) => {
    await p.evaluate(() => {
      const orderCard = document.querySelector('button[aria-label*="Detalle"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Detalles') || b.innerText.includes('Ver pedido')));
      if (orderCard) orderCard.click();
    });
  });

  await capture('29_customer_referrals', 'Pantalla de Sistema de Referidos y Recompensas', async (p) => {
    await p.evaluate(() => localStorage.removeItem('fs_last_nav_v1'));
    await p.goto(`${BASE_URL}/?screen=referrals`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // 8. PANEL DE VENDEDOR COMUNITARIO (AUTENTICADO COMO SELLER)
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 8. PANEL DE VENDEDOR COMUNITARIO ---');

  await page.evaluate((tok) => {
    localStorage.clear();
    localStorage.setItem('fs_token', tok);
  }, adminToken);

  await capture('30_seller_dashboard', 'Dashboard de Vendedor (Métricas SLA, Ranking Mensual y Ventas)', async (p) => {
    await p.goto(`${BASE_URL}/?screen=seller`, { waitUntil: 'networkidle2' });
  });

  await capture('31_seller_score_breakdown_modal', 'Modal de Desglose de Puntos Auditable del Vendedor', async (p) => {
    await p.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Desglose de Puntos'));
      if (btn) btn.click();
    });
  });

  await capture('32_seller_schedule_config', 'Configuración de Horarios de Atención del Vendedor', async (p) => {
    // Cerrar modal si estaba abierto
    await p.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Cerrar'));
      if (closeBtn) closeBtn.click();
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Horario') || b.innerText.includes('Atención')));
      if (tab) tab.click();
      else {
        const scheduleSection = document.getElementById('seller-schedule-card');
        if (scheduleSection) scheduleSection.scrollIntoView();
      }
    });
  });

  await capture('33_seller_products_manager', 'Gestión de Productos del Vendedor Comunitario', async (p) => {
    await p.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Productos'));
      if (tab) tab.click();
    });
  });

  await capture('34_seller_orders_manager', 'Gestión de Pedidos Recibidos por el Vendedor', async (p) => {
    await p.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Pedidos') || b.innerText.includes('Ventas')));
      if (tab) tab.click();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 9. PÁGINAS INFORMATIVAS, LEGALES Y SOPORTE
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 9. PÁGINAS INFORMATIVAS Y LEGALES ---');

  await capture('35_help_center', 'Centro de Ayuda y Preguntas Frecuentes', async (p) => {
    await p.evaluate(() => localStorage.removeItem('fs_last_nav_v1'));
    await p.goto(`${BASE_URL}/?screen=help`, { waitUntil: 'networkidle2' });
  });

  await capture('36_contact', 'Pantalla de Contacto y Canales Oficiales', async (p) => {
    await p.evaluate(() => localStorage.removeItem('fs_last_nav_v1'));
    await p.goto(`${BASE_URL}/?screen=contact`, { waitUntil: 'networkidle2' });
  });

  await capture('37_guides_directory', 'Directorio de Guías y Tutoriales', async (p) => {
    await p.goto(`${BASE_URL}/guias`, { waitUntil: 'networkidle2' });
  });

  await capture('38_guide_article_detail', 'Detalle de Artículo de Guía Paso a Paso', async (p) => {
    await p.goto(`${BASE_URL}/guias/como-recargar-free-fire`, { waitUntil: 'networkidle2' });
  });

  await capture('39_terms_conditions', 'Términos y Condiciones de Servicio', async (p) => {
    await p.goto(`${BASE_URL}/terms-conditions`, { waitUntil: 'networkidle2' });
  });

  await capture('40_privacy_policy', 'Política de Privacidad y Protección de Datos', async (p) => {
    await p.goto(`${BASE_URL}/privacy-policy`, { waitUntil: 'networkidle2' });
  });

  await capture('41_faq', 'Sección de Preguntas Frecuentes (FAQ)', async (p) => {
    await p.goto(`${BASE_URL}/faq`, { waitUntil: 'networkidle2' });
  });

  await capture('42_cookies_policy', 'Política de Cookies', async (p) => {
    await p.goto(`${BASE_URL}/cookies-policy`, { waitUntil: 'networkidle2' });
  });

  await capture('43_partner_help', 'Pantalla de Ayuda para Socios / B2B', async (p) => {
    await p.evaluate(() => localStorage.removeItem('fs_last_nav_v1'));
    await p.goto(`${BASE_URL}/?screen=partner-help`, { waitUntil: 'networkidle2' });
  });

  await capture('44_api_docs', 'Documentación Técnica de la API Reseller / B2B', async (p) => {
    await p.goto(`${BASE_URL}/?screen=api-docs`, { waitUntil: 'networkidle2' });
  });

  // ════════════════════════════════════════════════════════════════
  // 10. PANELES DE ADMINISTRACIÓN EN MÓVIL
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- 10. PANELES DE ADMINISTRACIÓN EN MÓVIL ---');

  await capture('45_admin_panel_integrated', 'Panel de Administración Integrado en App (?screen=panel)', async (p) => {
    await p.goto(`${BASE_URL}/?screen=panel`, { waitUntil: 'networkidle2' });
  });

  await capture('46_admin_portal_independent', 'Portal Administrativo Independiente (admin.html)', async (p) => {
    await p.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle2' });
  });

  await capture('47_ai_support_widget_opened', 'Widget Flotante de Soporte IA / Copilot Desplegado', async (p) => {
    await p.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await p.evaluate(() => {
      const widgetBtn = document.querySelector('button[aria-label*="IA"]') || document.querySelector('button[aria-label*="Soporte"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Asistente') || b.innerText.includes('Soporte')));
      if (widgetBtn) widgetBtn.click();
    });
  });

  await browser.close();

  const reportJsonPath = path.join(OUTPUT_DIR, 'audit_report.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n🎉 ¡Auditoría completada exitosamente!`);
  console.log(`📊 Total de capturas tomadas: ${report.length}`);
  console.log(`📝 Reporte JSON guardado en: ${reportJsonPath}`);
}

const adminTok = process.argv[2] || '';
const userTok = process.argv[3] || '';

runAudit(adminTok, userTok).catch(err => {
  console.error('Fatal error en auditoría:', err);
  process.exit(1);
});
