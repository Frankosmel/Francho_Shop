import React, { useState, useEffect } from 'react'
import api from './api/client'
import {
  Mail, Key, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  Save, Send, ExternalLink, HelpCircle, Eye, EyeOff, Loader2,
  Lock, Server, Check, Info, Bell, Sparkles
} from 'lucide-react'

export function AdminGmailSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [testResult, setTestResult] = useState(null)

  // Form State
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [senderName, setSenderName] = useState('Francho Shop')
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpEnabled, setSmtpEnabled] = useState(true)

  // UI helpers
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const [testEmail, setTestEmail] = useState('')

  async function loadSettings() {
    setLoading(true)
    setErr(null)
    try {
      const res = await api.getAdminSmtpSettings()
      if (res && res.ok) {
        setSmtpUser(res.smtp_user || '')
        setSenderName(res.smtp_sender_name || 'Francho Shop')
        setSmtpHost(res.smtp_host || 'smtp.gmail.com')
        setSmtpPort(res.smtp_port || 587)
        setSmtpEnabled(Boolean(res.smtp_enabled))
        setHasPassword(Boolean(res.has_password))
        setSmtpPassword('') // Don't prefill with plain text
      }
    } catch (e) {
      setErr(e.message || 'Error al cargar la configuración SMTP de Gmail')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  async function handleSave(e) {
    e?.preventDefault()
    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      const payload = {
        smtp_user: smtpUser.trim(),
        smtp_sender_name: senderName.trim() || 'Francho Shop',
        smtp_host: smtpHost.trim() || 'smtp.gmail.com',
        smtp_port: parseInt(smtpPort) || 587,
        smtp_enabled: smtpEnabled
      }
      if (smtpPassword.trim()) {
        payload.smtp_password = smtpPassword.trim()
      }
      const res = await api.saveAdminSmtpSettings(payload)
      if (res && res.ok) {
        setMsg('¡Configuración de Gmail guardada exitosamente!')
        setSmtpPassword('')
        if (payload.smtp_password) setHasPassword(true)
        setTimeout(() => setMsg(null), 6000)
      } else {
        setErr(res?.error || 'No se pudo guardar la configuración.')
      }
    } catch (e) {
      setErr(e.message || 'Error al guardar la configuración SMTP.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(e) {
    e?.preventDefault()
    if (!testEmail.trim()) {
      setErr('Ingresa un correo electrónico de destino para la prueba.')
      return
    }
    setTesting(true)
    setTestResult(null)
    setErr(null)
    try {
      const payload = {
        test_email: testEmail.trim(),
        smtp_user: smtpUser.trim(),
        smtp_sender_name: senderName.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: parseInt(smtpPort) || 587,
      }
      if (smtpPassword.trim()) {
        payload.smtp_password = smtpPassword.trim()
      }
      const res = await api.testAdminSmtpSettings(payload)
      if (res && res.ok) {
        setTestResult({ ok: true, message: res.message || 'Correo de prueba enviado con éxito.' })
      } else {
        setTestResult({ ok: false, message: res?.error || 'Error desconocido al enviar la prueba.' })
      }
    } catch (e) {
      setTestResult({ ok: false, message: e.message || 'No se pudo conectar con el servidor de Gmail.' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs font-bold text-white/50">Cargando configuración de Gmail...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* Cabecera Principal */}
      <div className="p-6 rounded-3xl bg-card border border-white/10 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-500/20 to-amber-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Gmail & Notificaciones a Clientes</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                  Google SMTP
                </span>
              </div>
              <p className="text-xs text-white/60">
                Configura tu cuenta de Gmail con una <b>Contraseña de Aplicación de Google</b> para enviar correos automáticos de entregas, depósitos y avisos a tus clientes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
              smtpEnabled && hasPassword && smtpUser
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${smtpEnabled && hasPassword && smtpUser ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{smtpEnabled && hasPassword && smtpUser ? 'Gmail Activo' : 'Incompleto / Inactivo'}</span>
            </span>
          </div>
        </div>

        {/* Mensajes de Alerta */}
        {msg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{msg}</span>
          </div>
        )}
        {err && (
          <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{err}</span>
          </div>
        )}
      </div>

      {/* Tutorial / Guía de Google Paso a Paso */}
      <div className="p-5 rounded-3xl bg-black/40 border border-white/10 space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              ¿Cómo obtener tu Contraseña de Aplicación de Google? (5 Pasos Rápidos)
            </h3>
          </div>
          <span className="text-xs text-sky-400 font-bold hover:underline">
            {showGuide ? 'Ocultar Guía ▲' : 'Ver Guía Paso a Paso ▼'}
          </span>
        </div>

        {showGuide && (
          <div className="pt-2 border-t border-white/5 space-y-3 text-xs text-white/70">
            <p className="text-[11px] text-white/50">
              Google requiere usar una <b>Contraseña de Aplicación de 16 letras</b> en lugar de tu contraseña normal de Gmail para garantizar la seguridad.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 font-black text-[11px] flex items-center justify-center">1</span>
                <strong className="block text-white text-[11px]">Abre Seguridad</strong>
                <p className="text-[10px] text-white/50">
                  Entra a tu cuenta en{' '}
                  <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-sky-400 underline inline-flex items-center gap-0.5">
                    myaccount.google.com <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 font-black text-[11px] flex items-center justify-center">2</span>
                <strong className="block text-white text-[11px]">2 Pasos Activo</strong>
                <p className="text-[10px] text-white/50">
                  Asegúrate de que la <b>Verificación en dos pasos</b> esté activada en tu cuenta de Google.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 font-black text-[11px] flex items-center justify-center">3</span>
                <strong className="block text-white text-[11px]">Contraseñas de App</strong>
                <p className="text-[10px] text-white/50">
                  Haz clic en{' '}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-sky-400 underline inline-flex items-center gap-0.5">
                    Contraseñas de aplicaciones <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 font-black text-[11px] flex items-center justify-center">4</span>
                <strong className="block text-white text-[11px]">Crear Contraseña</strong>
                <p className="text-[10px] text-white/50">
                  Escribe de nombre <b>"Francho Shop"</b> y haz clic en el botón <b>"Crear"</b>.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 font-black text-[11px] flex items-center justify-center">5</span>
                <strong className="block text-emerald-300 text-[11px]">Copiar 16 Letras</strong>
                <p className="text-[10px] text-emerald-200/70">
                  Copia el código amarillo de 16 caracteres (ej: <code>abcd efgh ijkl mnop</code>) y pégalo abajo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Formulario de Configuración */}
      <form onSubmit={handleSave} className="p-6 rounded-3xl bg-card border border-white/10 shadow-xl space-y-5">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-accent" />
          <span>Credenciales y Parámetros del Remitente</span>
        </h3>

        {/* Switch Principal */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black text-white block">Habilitar envíos de correo por Gmail</span>
            <span className="text-[11px] text-white/50 block">
              Al estar activo, el sistema enviará correos automáticos de entregas de productos, compras, depósitos y avisos.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={smtpEnabled}
              onChange={e => setSmtpEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Correo Gmail */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/80 block">
              Correo de Gmail Remitente:
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
                placeholder="ejemplo@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-accent"
              />
            </div>
            <span className="text-[10px] text-white/40 block">La dirección de correo de Gmail desde la que se enviarán las notificaciones.</span>
          </div>

          {/* Nombre Remitente */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/80 block">
              Nombre a Mostrar del Remitente:
            </label>
            <input
              type="text"
              required
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="Francho Shop"
              className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-accent"
            />
            <span className="text-[10px] text-white/40 block">El nombre que el cliente verá en su bandeja de entrada (ej: Francho Shop).</span>
          </div>
        </div>

        {/* Contraseña de Aplicación de Google */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-accent" />
              <span>Contraseña de Aplicación de Google (16 caracteres):</span>
            </label>
            {hasPassword && (
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                ✓ Contraseña actual guardada
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={smtpPassword}
              onChange={e => setSmtpPassword(e.target.value)}
              placeholder={hasPassword ? '•••••••••••••••• (Dejar en blanco para conservar la actual)' : 'Pega las 16 letras de Google aquí'}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-accent font-mono tracking-wider"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-white/40">
            {hasPassword
              ? 'Hay una contraseña guardada. Si deseas reemplazarla, escribe la nueva contraseña de 16 caracteres aquí. Los espacios se eliminan automáticamente.'
              : 'Pega la contraseña de aplicación de 16 letras obtenida de Google. Los espacios se eliminan automáticamente.'}
          </p>
        </div>

        {/* Opciones Avanzadas Colapsables */}
        <div className="pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-white/50 hover:text-white font-bold flex items-center gap-1.5 transition"
          >
            <Server className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Ocultar Opciones de Servidor ▲' : 'Ajustes Avanzados de Servidor (smtp.gmail.com:587) ▼'}</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-4 rounded-2xl bg-black/40 border border-white/5 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-xs text-white/70 block">Servidor SMTP:</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={e => setSmtpHost(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/70 block">Puerto SMTP:</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={e => setSmtpPort(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white outline-none"
                />
                <span className="text-[10px] text-white/40 block">587 con STARTTLS / TLS es el estándar recomendado para Gmail.</span>
              </div>
            </div>
          )}
        </div>

        {/* Botón Guardar */}
        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl font-black text-xs text-black bg-accent hover:opacity-90 transition active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-accent/20 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
          </button>
        </div>
      </form>

      {/* Sección de Prueba en Vivo */}
      <div className="p-6 rounded-3xl bg-card border border-white/10 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <span>Enviar Correo de Prueba a Gmail</span>
          </h3>
          <p className="text-xs text-white/50">
            Verifica que la conexión con Gmail y la Contraseña de Aplicación de Google funcionen al 100% antes de habilitar los envíos a clientes.
          </p>
        </div>

        <form onSubmit={handleTest} className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="Escribe tu correo de prueba (ej: tuemail@gmail.com)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            disabled={testing}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs text-black bg-emerald-400 hover:bg-emerald-300 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{testing ? 'Enviando Prueba...' : 'Enviar Prueba Ahora'}</span>
          </button>
        </form>

        {testResult && (
          <div className={`p-4 rounded-2xl border text-xs font-bold space-y-1 animate-in fade-in ${
            testResult.ok
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              <span className="font-black text-white">{testResult.ok ? '¡Prueba Exitosa!' : 'Fallo en la Prueba:'}</span>
            </div>
            <p className="text-[11px] leading-relaxed pl-6">{testResult.message}</p>
          </div>
        )}
      </div>

      {/* Tarjeta Informativa: Eventos de Notificaciones */}
      <div className="p-5 rounded-3xl bg-black/30 border border-white/10 space-y-3">
        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span>Notificaciones Automáticas que recibirán tus Clientes vía Gmail</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="font-bold text-white block">📦 Entregas & Cuentas</span>
            <p className="text-[11px] text-white/50">
              Datos de entrega, cuentas de streaming, pines de gift cards y recargas manuales directamente a su bandeja.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="font-bold text-white block">⚡ Estado de Pedidos</span>
            <p className="text-[11px] text-white/50">
              Avisos inmediatos al completar, procesar o cancelar un pedido en la tienda.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="font-bold text-white block">💰 Saldo y Pagos</span>
            <p className="text-[11px] text-white/50">
              Confirmación de depósitos acreditados, verificación de cuenta y recuperación de contraseña.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
