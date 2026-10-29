/**
 * FranchoShop — Push Notifications Manager
 * Gestiona tokens FCM, permisos y recepción de notificaciones push en Android.
 * Solo se activa cuando la app corre dentro de Capacitor (APK nativa).
 */

const API_BASE = window.Capacitor?.isNativePlatform?.()
  ? 'https://franchoshop.com/api'
  : '/api';
let listenersInstalled = false;

/** Install notification listeners early so a tap is not lost on cold start. */
export async function setupPushNotificationListeners() {
  if (!window.Capacitor?.isNativePlatform?.() || listenersInstalled) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Crear el canal de notificaciones requerido por Android 8.0+
    try {
      await PushNotifications.createChannel({
        id: 'franchoshop_orders',
        name: 'Pedidos y Saldo Francho Shop',
        description: 'Notificaciones sobre depósitos, pedidos y soporte',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    } catch (chErr) {
      console.warn('[Push] Channel error:', chErr);
    }

    await PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Registration token received:', token.value?.substring(0, 15) + '...');
      localStorage.setItem('fcm_token', token.value);
      await registerTokenOnServer(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[Push] Registration error:', err?.error || err);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received in foreground:', notification);
      showInAppNotification(notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped:', action);
      handleNotificationTap(action.notification);
    });

    listenersInstalled = true;
  } catch (err) { console.warn('[Push] Listener error:', err); }
}

/** Request permission and register the FCM token after login. */
export async function initPushNotifications() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    await setupPushNotificationListeners();
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const status = await PushNotifications.checkPermissions();
    if (status.receive === 'prompt') {
      const granted = await PushNotifications.requestPermissions();
      if (granted.receive !== 'granted') return;
    } else if (status.receive === 'denied') {
      return;
    }
    await PushNotifications.register();

    // Re-sincronizar el token con el servidor si ya lo tenemos guardado
    const cachedToken = localStorage.getItem('fcm_token');
    if (cachedToken) {
      await registerTokenOnServer(cachedToken);
    }
  } catch (err) { console.warn('[Push] Push inactive:', err?.message || err); }
}

/**
 * Registra o actualiza el token FCM en el backend.
 */
export async function registerTokenOnServer(token) {
  if (!token) return;
  try {
    localStorage.setItem('fcm_token', token);
    const fsToken = localStorage.getItem('fs_token');
    const headers = { 'Content-Type': 'application/json' };
    if (fsToken) headers['Authorization'] = `Bearer ${fsToken}`;

    const res = await fetch(`${API_BASE}/notifications/register-fcm-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token,
        platform: 'android',
        app_version: '2.3.0'
      })
    });

    if (res.ok) {
      console.log('[Push] Token registrado en servidor ✅');
    } else {
      console.warn('[Push] Error registrando token:', res.status);
    }
  } catch (e) {
    console.error('[Push] No se pudo registrar token:', e);
  }
}

/**
 * Muestra una notificación visual cuando la app está abierta en primer plano.
 */
function showInAppNotification(notification) {
  const { title, body, data } = notification;

  // Banner visual en la UI
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    background: #1e293b; color: white; border-left: 4px solid #22c55e;
    padding: 14px 20px; border-radius: 12px; z-index: 99999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5); max-width: 90vw;
    font-family: system-ui; animation: slideDown 0.3s ease;
    cursor: pointer;
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = `@keyframes slideDown { from { top: -60px; opacity: 0; } to { top: 16px; opacity: 1; } }`;
  document.head.appendChild(styleEl);

  banner.innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">🔔 ${title || 'Francho Shop'}</div>
    <div style="font-size:13px;opacity:0.85">${body || ''}</div>
  `;

  banner.onclick = () => {
    banner.remove();
    handleNotificationTap({ data });
  };

  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 5000);
}

/**
 * Navega a la pantalla correcta al tocar una notificación.
 */
function handleNotificationTap(notification) {
  const data = notification?.data || {};
  const screen = data.screen || data.url || '';

  // Emitir evento custom para que App.jsx lo maneje
  window.dispatchEvent(new CustomEvent('franchoshop:navigate', {
    detail: { screen, data }
  }));
}

/**
 * Eliminar el token FCM al cerrar sesión.
 */
export async function unregisterPushToken() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const token = localStorage.getItem('fcm_token');
  if (!token) return;

  try {
    const fsToken = localStorage.getItem('fs_token');
    const headers = { 'Content-Type': 'application/json' };
    if (fsToken) headers['Authorization'] = `Bearer ${fsToken}`;

    await fetch(`${API_BASE}/notifications/unregister-fcm-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token })
    });
    localStorage.removeItem('fcm_token');
    console.log('[Push] Token eliminado del servidor');
  } catch (e) {
    console.error('[Push] Error eliminando token:', e);
  }
}
