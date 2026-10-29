/**
 * FranchoShop — Browser & Deep Links Utilities
 * 
 * Opción 5: In-App Browser (Navegador Interno) para enlaces de pago, WhatsApp, Telegram.
 * Opción 7: Deep Links (Enlaces Profundos) para abrir la APK directamente al tocar links franchoshop.
 */

import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

/**
 * Inicializa los controladores de navegador interno y Deep Links.
 */
export function initBrowserAndDeepLinks() {
  if (!window.Capacitor?.isNativePlatform?.()) return;

  // 1. In-App Browser: Sobrescribir window.open para abrir links externos en pestaña nativa dentro de la app
  const originalWindowOpen = window.open;
  window.open = (url, target, features) => {
    if (url && typeof url === 'string' && isExternalUrl(url)) {
      openInAppBrowser(url);
      return null;
    }
    return originalWindowOpen.call(window, url, target, features);
  };

  // Interceptar clicks globales en <a> con URLs externas
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest?.('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (href && isExternalUrl(href)) {
      e.preventDefault();
      openInAppBrowser(href);
    }
  }, true);

  // 2. Deep Links: Escuchar cuando el usuario toca un link https://franchoshop.com o franchoshop://
  const handleAppUrl = (event) => {
    const rawUrl = event?.url
    if (!rawUrl) return
    console.log('[DeepLink] App abriendo con URL:', rawUrl)

    // React puede estar inicializando tras un retorno desde Google. Conservamos el
    // enlace hasta que la pantalla de autenticación haya instalado su listener.
    window.__franchoshopPendingDeepLink = rawUrl
    Browser.close().catch(() => {})
    try {
      const urlObj = new URL(rawUrl)
      window.dispatchEvent(new CustomEvent('franchoshop:navigate', {
        detail: { path: urlObj.pathname || '/', search: urlObj.search || '', rawUrl }
      }))
    } catch (err) {
      console.warn('[DeepLink] Error procesando URL:', err)
    }
  }

  App.addListener('appUrlOpen', handleAppUrl)
  App.getLaunchUrl().then((result) => {
    if (result?.url) handleAppUrl({ url: result.url })
  }).catch(() => {})

  console.log('[Capacitor] In-App Browser y Deep Links inicializados ✅');
}

/**
 * Abre una URL externa dentro del navegador nativo In-App Browser.
 */
export async function openInAppBrowser(url) {
  try {
    if (window.Capacitor?.isNativePlatform?.()) {
      await Browser.open({
        url: url,
        windowName: '_blank',
        toolbarColor: '#0f172a', // Coincide con el tema oscuro de Francho Shop
        presentationStyle: 'popover'
      });
    } else {
      window.open(url, '_blank');
    }
  } catch (err) {
    console.error('[Browser] Error abriendo In-App Browser:', err);
    window.open(url, '_blank');
  }
}

/**
 * Determina si una URL es externa (WhatsApp, Telegram, OxaPay, dominios fuera de franchoshop).
 */
function isExternalUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('whatsapp:')) return true;
  if (url.includes('wa.me') || url.includes('t.me') || url.includes('telegram.me')) return true;
  if (url.includes('oxapay.com') || url.includes('checkout')) return true;
  
  try {
    const parsed = new URL(url, window.location.href);
    // Si la URL apunta a otro dominio diferente de franchoshop, es externa
    return parsed.hostname !== window.location.hostname && !parsed.hostname.includes('franchoshop');
  } catch {
    return false;
  }
}
