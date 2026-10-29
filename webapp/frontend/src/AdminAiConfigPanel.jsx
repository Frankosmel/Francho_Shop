import React, { useState, useEffect } from 'react'
import api from './api/client'
import {
  Bot, Sparkles, Server, Key, Globe, Cpu, Check, AlertTriangle,
  Play, RefreshCw, ExternalLink, ShieldCheck, Zap, ArrowRight,
  Sliders, Eye, EyeOff, Loader2, MessageSquare
} from 'lucide-react'

export function AdminAiConfigPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  // Settings State
  const [enabled, setEnabled] = useState(true)
  const [provider, setProvider] = useState('auto') // 'auto' | 'vibi' | 'gemini'
  const [vibiApiKey, setVibiApiKey] = useState('')
  const [vibiBaseUrl, setVibiBaseUrl] = useState('https://vibi.top/v1')
  const [vibiModel, setVibiModel] = useState('gpt-4o-mini')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash-lite')

  // Password visibility
  const [showVibiKey, setShowVibiKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  // Testing State
  const [testProvider, setTestProvider] = useState('vibi')
  const [testPrompt, setTestPrompt] = useState('Hola, confirma si la conexión con Francho Shop funciona correctamente.')
  const [testResult, setTestResult] = useState(null)

  const VIBI_PRESET_MODELS = [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Rápido, económico y preciso' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Gran contexto y velocidad' },
    { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)', desc: 'Excelente razonamiento' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', desc: 'Respuestas concisas' },
    { id: 'gpt-4o', label: 'GPT-4o', desc: 'Máxima capacidad cognitiva' },
  ]

  const GEMINI_PRESET_MODELS = [
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Recomendado)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  ]

  async function loadSettings() {
    setLoading(true)
    setErr(null)
    try {
      const data = await api.aiAdminSettingsGet()
      if (data && data.ok) {
        setEnabled(Boolean(data.ai_chat_enabled))
        setProvider(data.ai_provider || 'auto')
        setVibiApiKey(data.vibi_api_key || '')
        setVibiBaseUrl(data.vibi_base_url || 'https://vibi.top/v1')
        setVibiModel(data.vibi_model || 'gpt-4o-mini')
        setGeminiApiKey(data.gemini_api_key || '')
        setGeminiModel(data.ai_chat_model || 'gemini-2.0-flash-lite')
      }
    } catch (e) {
      setErr(e.message || 'Error al cargar ajustes de IA')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSettings()
  }, [])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      const payload = {
        ai_chat_enabled: enabled,
        ai_provider: provider,
        vibi_api_key: vibiApiKey.trim(),
        vibi_base_url: vibiBaseUrl.trim() || 'https://vibi.top/v1',
        vibi_model: vibiModel.trim() || 'gpt-4o-mini',
        gemini_api_key: geminiApiKey.trim(),
        ai_chat_model: geminiModel.trim() || 'gemini-2.0-flash-lite',
      }
      const res = await api.aiAdminSettingsSet(payload)
      if (res && res.ok) {
        setMsg('Configuración de IA y proveedores guardada exitosamente.')
        setTimeout(() => setMsg(null), 5000)
      } else {
        setErr(res?.error || 'No se pudo guardar la configuración.')
      }
    } catch (e) {
      setErr(e.message || 'Error al guardar configuración de IA')
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const payload = {
        provider: testProvider,
        prompt: testPrompt.trim(),
        vibi_api_key: vibiApiKey.trim() || null,
        vibi_base_url: vibiBaseUrl.trim() || null,
        vibi_model: vibiModel.trim() || null,
        gemini_api_key: geminiApiKey.trim() || null,
        gemini_model: geminiModel.trim() || null,
      }
      const res = await api.aiAdminTest(payload)
      setTestResult(res)
    } catch (e) {
      setTestResult({ ok: false, error: e.message || 'Fallo de conexión' })
    }
    setTesting(false)
  }

  if (loading) {
    return (
      <div className="card p-12 text-center text-white/50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
        <span className="text-sm">Cargando configuración de proveedores de IA...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header de Configuración IA */}
      <div className="card p-5 sm:p-6 rounded-3xl bg-card border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Bot className="h-6 w-6" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Proveedores de IA & Gateway
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                vibi.top + Gemini
              </span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-white/60">
            Administra los modelos y credenciales del Asistente IA de Francho Shop con soporte para el Gateway Unificado <strong className="text-white">vibi.top</strong> (compatible con OpenAI) y Google Gemini.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://vibi.top/dashboard/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4 text-accent" />
            Panel vibi.top
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-2xl bg-accent text-black font-bold text-xs sm:text-sm hover:bg-accent/90 transition shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar Ajustes
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-3 animate-fade-in">
          <Check className="h-5 w-5 flex-shrink-0 text-emerald-400" />
          <span>{msg}</span>
        </div>
      )}

      {err && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-center gap-3 animate-fade-in">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <span>{err}</span>
        </div>
      )}

      {/* Switch Maestro: Habilitar Asistente */}
      <div className="card p-4 sm:p-5 rounded-2xl bg-card border border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Estado del Asistente Inteligente en Chat</div>
            <div className="text-xs text-white/50">Activa o desactiva las respuestas automáticas de IA en la tienda y atención al cliente.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`w-14 h-8 flex items-center rounded-full p-1 transition duration-300 ${enabled ? 'bg-accent' : 'bg-white/10'}`}
        >
          <div className={`bg-black w-6 h-6 rounded-full shadow-md transform transition duration-300 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Selector de Modo de Proveedor */}
      <div className="card p-5 sm:p-6 rounded-3xl bg-card border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Modo de Enrutamiento IA</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Opción 1: Auto */}
          <div
            onClick={() => setProvider('auto')}
            className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-2 ${
              provider === 'auto'
                ? 'bg-accent/15 border-accent text-white shadow-lg shadow-accent/10'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-accent" /> Conmutación Auto
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                Recomendado
              </span>
            </div>
            <p className="text-xs text-white/60">
              Usa vibi.top por defecto y, si falla o agota saldo, salta automáticamente a Google Gemini sin interrupciones.
            </p>
          </div>

          {/* Opción 2: Solo Vibi.top */}
          <div
            onClick={() => setProvider('vibi')}
            className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-2 ${
              provider === 'vibi'
                ? 'bg-indigo-500/20 border-indigo-400 text-white shadow-lg shadow-indigo-500/10'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-indigo-400" /> vibi.top Gateway
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                New API
              </span>
            </div>
            <p className="text-xs text-white/60">
              Enruta exclusivamente hacia vibi.top (/v1/chat/completions) con el modelo que elijas (GPT-4o, DeepSeek, etc.).
            </p>
          </div>

          {/* Opción 3: Solo Gemini */}
          <div
            onClick={() => setProvider('gemini')}
            className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-2 ${
              provider === 'gemini'
                ? 'bg-blue-500/20 border-blue-400 text-white shadow-lg shadow-blue-500/10'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-blue-400" /> Google Gemini
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                Directo
              </span>
            </div>
            <p className="text-xs text-white/60">
              Utiliza directamente los endpoints oficiales de Google Gemini (2.0 Flash Lite o 2.5 Flash).
            </p>
          </div>
        </div>
      </div>

      {/* Tarjeta de Configuración: vibi.top */}
      <div className="card p-5 sm:p-6 rounded-3xl bg-card border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm">
              V
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Configuración vibi.top Gateway
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/80">OpenAI API Compatible</span>
              </h3>
              <p className="text-xs text-white/50">Gateway de IA unificado alojado en vibi.top</p>
            </div>
          </div>
          <a
            href="https://vibi.top/dashboard/token"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-300 hover:text-indigo-200 underline flex items-center gap-1 self-start sm:self-auto"
          >
            Obtener Token / API Key en vibi.top <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-indigo-400" /> API Key (Token vibi.top)
            </label>
            <div className="relative">
              <input
                type={showVibiKey ? 'text' : 'password'}
                value={vibiApiKey}
                onChange={e => setVibiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400 font-mono transition"
              />
              <button
                type="button"
                onClick={() => setShowVibiKey(!showVibiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
              >
                {showVibiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-white/40">Tokens generados en tu panel de vibi.top (formato estándar sk-...)</p>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-indigo-400" /> Base URL del Gateway
            </label>
            <input
              type="text"
              value={vibiBaseUrl}
              onChange={e => setVibiBaseUrl(e.target.value)}
              placeholder="https://vibi.top/v1"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400 font-mono transition"
            />
            <p className="text-[11px] text-white/40">Por defecto: https://vibi.top/v1 (endpoint /chat/completions)</p>
          </div>
        </div>

        {/* Modelo vibi.top */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" /> Modelo activo en vibi.top
          </label>
          <div className="flex flex-wrap gap-2">
            {VIBI_PRESET_MODELS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setVibiModel(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  vibiModel === m.id
                    ? 'bg-indigo-500/30 border-indigo-400 text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={vibiModel}
            onChange={e => setVibiModel(e.target.value)}
            placeholder="Escribe o selecciona el nombre exacto del modelo (ej: gpt-4o-mini)"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400 font-mono transition"
          />
        </div>
      </div>

      {/* Tarjeta de Configuración: Google Gemini */}
      <div className="card p-5 sm:p-6 rounded-3xl bg-card border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-sm">
              G
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Configuración Google Gemini
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/80">Google AI Studio</span>
              </h3>
              <p className="text-xs text-white/50">API oficial directa de Google</p>
            </div>
          </div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-300 hover:text-blue-200 underline flex items-center gap-1 self-start sm:self-auto"
          >
            Obtener clave en Google AI Studio <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-blue-400" /> API Key de Gemini
            </label>
            <div className="relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={e => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-blue-400 font-mono transition"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
              >
                {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Modelo Gemini */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-blue-400" /> Modelo Gemini
            </label>
            <div className="flex flex-wrap gap-2 pb-1">
              {GEMINI_PRESET_MODELS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGeminiModel(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                    geminiModel === m.id
                      ? 'bg-blue-500/30 border-blue-400 text-white shadow-sm'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={geminiModel}
              onChange={e => setGeminiModel(e.target.value)}
              placeholder="gemini-2.0-flash-lite"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-blue-400 font-mono transition"
            />
          </div>
        </div>
      </div>

      {/* Consola de Pruebas en Vivo */}
      <div className="card p-5 sm:p-6 rounded-3xl bg-card border border-accent/20 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/20 text-accent">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Consola de Prueba de Conexión en Vivo</h3>
              <p className="text-xs text-white/50">Verifica la respuesta, latencia y autenticación del proveedor seleccionado en tiempo real.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={testProvider}
              onChange={e => setTestProvider(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-accent"
            >
              <option value="vibi" className="bg-[#1a1a24] text-white">Probar vibi.top</option>
              <option value="gemini" className="bg-[#1a1a24] text-white">Probar Gemini</option>
              <option value="auto" className="bg-[#1a1a24] text-white">Probar Modo Auto</option>
            </select>

            <button
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 rounded-xl bg-accent text-black font-bold text-xs hover:bg-accent/90 transition flex items-center gap-2 disabled:opacity-50 shadow-md shadow-accent/20"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {testing ? 'Probando...' : 'Ejecutar Prueba'}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/70">Mensaje de prueba a enviar:</label>
          <input
            type="text"
            value={testPrompt}
            onChange={e => setTestPrompt(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-accent transition"
          />
        </div>

        {/* Resultado del Test */}
        {testResult && (
          <div className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-2 animate-fade-in ${
            testResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-red-500/10 border-red-500/30 text-white'
          }`}>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                {testResult.ok ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Check className="h-4 w-4" /> Conexión Exitosa (200 OK)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400 font-bold">
                    <AlertTriangle className="h-4 w-4" /> Error de Conexión
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-white/60">
                {testResult.provider && (
                  <span>Proveedor: <strong className="text-white">{testResult.provider}</strong></span>
                )}
                {testResult.model && (
                  <span>Modelo: <strong className="text-white">{testResult.model}</strong></span>
                )}
                {testResult.latency_ms !== undefined && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono">
                    {testResult.latency_ms} ms
                  </span>
                )}
              </div>
            </div>

            {testResult.ok ? (
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-emerald-400/90 mb-1 flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> Respuesta recibida del modelo:
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-white/90 leading-relaxed font-sans">
                  {testResult.reply}
                </div>
              </div>
            ) : (
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-red-400/90 mb-1">Detalle del error:</div>
                <div className="bg-black/40 p-3 rounded-xl border border-red-500/20 text-red-300 font-mono text-xs">
                  {testResult.error || 'No se recibió respuesta válida del servidor.'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
export default AdminAiConfigPanel