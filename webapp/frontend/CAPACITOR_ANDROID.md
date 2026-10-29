# 📱 CAPACITOR_ANDROID.md — Francho Shop Android

Guía completa para compilar, mantener y publicar la app Android de **Francho Shop**.

---

## ✅ Requisitos

| Herramienta | Versión mínima | Estado |
|---|---|---|
| Node.js | 18+ | ✅ instalado |
| npm | 9+ | ✅ instalado |
| Java JDK | 17+ (se usa 21) | ✅ instalado |
| Android SDK | API 34 | ✅ instalado en `/home/ubuntu/android-sdk` |
| Capacitor CLI | 8.5.0 | ✅ instalado |
| Gradle | (incluido en wrapper) | ✅ automático |

---

## 📦 Versiones utilizadas

- `@capacitor/core`: 8.5.0
- `@capacitor/cli`: 8.5.0
- `@capacitor/android`: 8.5.0
- `@capacitor/app`: 8.1.1
- `@capacitor/browser`: 8.0.4
- `@capacitor/keyboard`: 8.0.5
- `@capacitor/network`: 8.0.1
- `@capacitor/splash-screen`: 8.0.2
- `@capacitor/status-bar`: 8.0.3

---

## 🔧 Instalación desde cero

```bash
cd /home/ubuntu/gamestore/webapp/frontend

# Instalar dependencias
npm install

# Variables de entorno de Android SDK
export ANDROID_HOME=/home/ubuntu/android-sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

---

## 🏗️ Flujo de trabajo habitual

### 1. Compilar la web (modo Capacitor)

```bash
cd /home/ubuntu/gamestore/webapp/frontend
npm run build:capacitor
```

> Usa `VITE_APP_ENV=capacitor` para que los assets usen rutas relativas (`./`)
> y el cliente API apunta automáticamente a `https://franchoshop.reenvioplusbot.xyz/api`

### 2. Sincronizar con Android

```bash
export ANDROID_HOME=/home/ubuntu/android-sdk
npx cap sync android
```

### 3. Abrir en Android Studio

```bash
npx cap open android
```

---

## 🔨 Generar APK debug (pruebas)

```bash
cd /home/ubuntu/gamestore/webapp/frontend/android
export ANDROID_HOME=/home/ubuntu/android-sdk
./gradlew assembleDebug --no-daemon
```

**Ruta del APK debug:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔑 Generar keystore (firma para release)

> ⚠️ Haz esto UNA VEZ y guarda el archivo en lugar seguro. Nunca lo subas a Git.

```bash
keytool -genkey -v \
  -keystore francho-release-key.jks \
  -alias franchoshop \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Te pedirá:
- Contraseña del keystore
- Nombre, organización, ciudad, país
- Contraseña del alias (puede ser la misma)

**Agrega al `.gitignore`:**
```
*.jks
*.keystore
```

---

## 📦 Generar APK / AAB release (Google Play)

### Opción A — APK release firmado

```bash
cd android
./gradlew assembleRelease
```

Luego firma manualmente:
```bash
$ANDROID_HOME/build-tools/34.0.0/apksigner sign \
  --ks francho-release-key.jks \
  --ks-key-alias franchoshop \
  --out app-release-signed.apk \
  app/build/outputs/apk/release/app-release-unsigned.apk
```

### Opción B — AAB para Google Play (recomendado)

```bash
cd android
./gradlew bundleRelease
```

**Ruta del AAB:**
```
android/app/build/outputs/bundle/release/app-release.aab
```

Firma el AAB en Android Studio o usa `jarsigner`.

---

## 🖼️ Cambiar ícono y splash

### Ícono (reemplaza todos estos archivos):

| Carpeta | Tamaño |
|---|---|
| `mipmap-mdpi/ic_launcher.png` | 48×48 |
| `mipmap-hdpi/ic_launcher.png` | 72×72 |
| `mipmap-xhdpi/ic_launcher.png` | 96×96 |
| `mipmap-xxhdpi/ic_launcher.png` | 144×144 |
| `mipmap-xxxhdpi/ic_launcher.png` | 192×192 |

Para el **ícono adaptativo** también reemplaza `ic_launcher_foreground.png` (432×432 en xxxhdpi).

### Splash screen:

Reemplaza `drawable/splash.png` (1080×1920 px, fondo `#0f172a`).

**Después de cambiar imágenes, siempre ejecuta:**
```bash
npx cap sync android
```

---

## ➕ Agregar plugins nativos

```bash
npm install @capacitor/NOMBRE-PLUGIN
npx cap sync android
```

Ejemplo — notificaciones push:
```bash
npm install @capacitor/push-notifications
npx cap sync android
```

Luego registra el plugin en `MainActivity.java` si es necesario.

---

## 🔍 Errores comunes

### `ANDROID_HOME not set`
```bash
export ANDROID_HOME=/home/ubuntu/android-sdk
```

### `SDK location not found`
```bash
echo "sdk.dir=/home/ubuntu/android-sdk" > android/local.properties
```

### `Could not find TypeScript` con capacitor.config.ts
El proyecto usa `"type": "module"`. Se usa `capacitor.config.json` en su lugar.

### `Cleartext HTTP not permitted`
La app usa solo HTTPS. Si ves este error, verifica que `androidScheme: 'https'` esté en `capacitor.config.json`.

### Build lento primera vez
Gradle descarga dependencias (~200MB). La segunda compilación es mucho más rápida.

---

## 📁 Archivos modificados / creados

### Creados
- `capacitor.config.json` — configuración principal de Capacitor
- `android/` — proyecto Android nativo generado por Capacitor
- `android/local.properties` — ruta del Android SDK
- `public/icon-512.jpg` — ícono fuente para assets Android
- `CAPACITOR_ANDROID.md` — esta documentación

### Modificados
- `src/api/client.js` — `API_BASE` ahora detecta Capacitor y usa URL completa
- `vite.config.js` — soporte para `VITE_APP_ENV=capacitor` (base `./`)
- `package.json` — nuevos scripts `build:capacitor`, `cap:sync`, `cap:open`
- `android/app/src/main/AndroidManifest.xml` — permisos y orientación portrait
- `android/app/src/main/java/com/franchoshop/app/MainActivity.java` — botón Atrás

---

## 🔒 Seguridad

- ✅ No hay claves secretas en el frontend
- ✅ `cleartext: false` en capacitor.config.json
- ✅ `android:usesCleartextTraffic` NO habilitado
- ✅ `webContentsDebuggingEnabled: false` en producción
- ✅ JWT guardado en `localStorage` (isolado por WebView)
- ✅ Keystore excluido de Git
- ✅ `android/local.properties` excluido de Git

---

## 📡 App ID y dominio

```
App ID:   com.franchoshop.app
App Name: Francho Shop
Dominio:  https://franchoshop.reenvioplusbot.xyz
```
