import React from 'react'
import { Info, CircleCheck, AlertTriangle, AlertCircle, X } from 'lucide-react'

/**
 * Universal Alert component for Francho Shop.
 * Accessible notification box with multiple severity variants and optional dismiss.
 *
 * @param {'info' | 'success' | 'warning' | 'danger'} variant
 * @param {string|React.ReactNode} title Optional header title
 * @param {React.ReactNode} icon Optional custom icon
 * @param {function} onClose Optional callback when dismissed
 * @param {string} closeAriaLabel Accessible label for close button
 * @param {string} className
 */
export function Alert({
  variant = 'info',
  title = null,
  icon = null,
  onClose = null,
  closeAriaLabel = 'Cerrar alerta',
  children,
  className = '',
  ...props
}) {
  const variantStyles = {
    info: 'bg-sky-500/10 border-sky-500/25 text-sky-200',
    success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
    warning: 'bg-amber-500/10 border-amber-500/25 text-amber-200',
    danger: 'bg-rose-500/10 border-rose-500/25 text-rose-200',
  }[variant] || 'bg-sky-500/10 border-sky-500/25 text-sky-200'

  const iconColorStyles = {
    info: 'text-sky-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  }[variant] || 'text-sky-400'

  const DefaultIcon = {
    info: Info,
    success: CircleCheck,
    warning: AlertTriangle,
    danger: AlertCircle,
  }[variant] || Info

  const resolvedIcon = icon !== undefined && icon !== null
    ? icon
    : <DefaultIcon className={`h-5 w-5 shrink-0 ${iconColorStyles}`} aria-hidden="true" />

  return (
    <div
      role="alert"
      className={`relative w-full p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 transition-colors ${variantStyles} ${className}`}
      {...props}
    >
      {resolvedIcon && (
        <span className="shrink-0 flex items-center justify-center mt-0.5">
          {resolvedIcon}
        </span>
      )}

      <div className="flex-1 min-w-0 text-xs sm:text-sm leading-relaxed">
        {title && (
          <h4 className="font-bold mb-1 tracking-tight text-white">
            {title}
          </h4>
        )}
        <div className="text-white/85">
          {children}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          aria-label={closeAriaLabel}
          onClick={onClose}
          className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
