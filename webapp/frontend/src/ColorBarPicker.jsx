import React, { useState, useEffect, useMemo } from 'react'

export function hslToHex(h, s, l) {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase()
}

export function hexToHsl(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return { h: 25, s: 100, l: 50 }
  }
  let r = 0, g = 0, b = 0
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) / 255
    g = parseInt(clean[1] + clean[1], 16) / 255
    b = parseInt(clean[2] + clean[2], 16) / 255
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2), 16) / 255
    g = parseInt(clean.slice(2, 4), 16) / 255
    b = parseInt(clean.slice(4, 6), 16) / 255
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h = Math.round(h * 60)
    s = Math.round(s * 100)
    l = Math.round(l * 100)
  }
  return { h, s, l }
}

export const DEFAULT_PRESET_COLORS = [
  { name: 'Naranja Fuego', hex: '#FF7A00' },
  { name: 'Verde Esmeralda', hex: '#00C26F' },
  { name: 'Cyan Eléctrico', hex: '#00E5FF' },
  { name: 'Púrpura Gaming', hex: '#A855F7' },
  { name: 'Rosa Neón', hex: '#EC4899' },
  { name: 'Dorado VIP', hex: '#EAB308' },
  { name: 'Azul Royale', hex: '#3B82F6' },
  { name: 'Rojo Carmesí', hex: '#EF4444' },
]

export default function ColorBarPicker({
  value = '#FF7A00',
  onChange,
  label = 'Color Primario de la Tienda',
  presetColors = DEFAULT_PRESET_COLORS,
  compact = false
}) {
  const initialHsl = useMemo(() => hexToHsl(value), [value])
  const [hue, setHue] = useState(initialHsl.h)
  const [lightness, setLightness] = useState(initialHsl.l || 50)

  useEffect(() => {
    const nextHsl = hexToHsl(value)
    setHue(nextHsl.h)
    setLightness(nextHsl.l || 50)
  }, [value])

  const handleHueChange = (newHue) => {
    setHue(newHue)
    const effectiveL = lightness > 75 ? 55 : (lightness < 25 ? 50 : lightness)
    const newHex = hslToHex(newHue, 95, effectiveL)
    onChange(newHex)
  }

  const handleLightnessChange = (newL) => {
    setLightness(newL)
    const newHex = hslToHex(hue, 95, newL)
    onChange(newHex)
  }

  return (
    <div className="space-y-3">
      {/* Encabezado con muestra del color */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-white/80 block">
          {label}:
        </label>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full border border-white/40 shadow-sm shrink-0"
            style={{ backgroundColor: value }}
          />
          <span className="text-xs font-mono font-black text-white px-2 py-0.5 rounded-lg bg-black/60 border border-white/20 shadow-inner">
            {value}
          </span>
        </div>
      </div>

      {/* 🌈 BARRA DESLIZANTE DE ESPECTRO (HUE RAINBOW SLIDER) */}
      <div className="space-y-2 p-3.5 rounded-2xl bg-black/50 border border-white/10 shadow-lg">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-white/80 flex items-center gap-1.5">
            <span>🌈 Desliza la barra para elegir tu color:</span>
          </span>
          <span className="text-[10px] font-mono text-white/50">{hue}°</span>
        </div>

        {/* Barra de arcoíris deslizante */}
        <div className="relative py-1">
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(e) => handleHueChange(Number(e.target.value))}
            className="color-hue-slider w-full h-8 rounded-xl appearance-none cursor-pointer outline-none shadow-md border border-white/25 transition active:scale-[0.99]"
            style={{
              background: 'linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)'
            }}
          />
        </div>

        {/* Barra de Tono / Brillo (Pastel vs Intenso vs Profundo) */}
        <div className="pt-2 border-t border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-white/50">
            <span>✨ Pastel / Claro</span>
            <span className="font-bold text-white/70">⚡ Neón</span>
            <span>🌑 Intenso</span>
          </div>
          <input
            type="range"
            min="30"
            max="70"
            value={lightness}
            onChange={(e) => handleLightnessChange(Number(e.target.value))}
            className="w-full h-4 rounded-lg appearance-none cursor-pointer outline-none border border-white/20 shadow-inner"
            style={{
              background: `linear-gradient(to right, ${hslToHex(hue, 90, 70)}, ${hslToHex(hue, 95, 50)}, ${hslToHex(hue, 95, 30)})`
            }}
          />
        </div>
      </div>

      {/* Accesos rápidos de 1 Clic y Manual */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">
          Colores Populares de 1 Clic:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {presetColors.map((c) => {
            const hex = c.hex
            const isSel = (value || '').toUpperCase() === hex.toUpperCase()
            return (
              <button
                key={hex}
                type="button"
                onClick={() => onChange(hex)}
                className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition active:scale-95 ${
                  isSel
                    ? 'border-white ring-2 ring-white/50 bg-white/20 text-white shadow-md'
                    : 'border-white/10 bg-black/40 hover:bg-black/60 text-white/75'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/30" style={{ backgroundColor: hex }} />
                <span className="text-[11px]">{c.name || c.label}</span>
              </button>
            )
          })}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/50 border border-white/15">
            <span className="text-[10px] text-white/40">Manual:</span>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-6 w-7 rounded-md bg-transparent border-0 cursor-pointer p-0"
              title="Selector visual de sistema"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
