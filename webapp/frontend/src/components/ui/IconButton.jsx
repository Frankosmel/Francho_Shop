import React, { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Universal IconButton component for Francho Shop.
 * Requires an accessible `aria-label`.
 *
 * @param {string} aria-label Mandatory accessible label describing the action
 * @param {'ghost' | 'secondary' | 'primary' | 'accent' | 'emerald' | 'danger' | 'outline'} variant
 * @param {'xs' | 'sm' | 'md' | 'lg'} size
 * @param {'xl' | '2xl' | 'full' | 'lg'} rounded
 * @param {boolean} loading
 * @param {boolean} disabled
 * @param {string} className
 * @param {'button' | 'submit' | 'reset'} type
 * @param {function} onClick
 */
export const IconButton = forwardRef(function IconButton(
  {
    children,
    icon = null,
    variant = 'ghost',
    size = 'md',
    rounded = 'xl',
    loading = false,
    disabled = false,
    className = '',
    type = 'button',
    onClick,
    'aria-label': ariaLabel,
    ...props
  },
  ref
) {
  // Strict requirement: aria-label is mandatory for accessible icon buttons
  const resolvedAriaLabel = ariaLabel || props.title || 'Boton de accion'

  if (Boolean(import.meta.env?.DEV) && !ariaLabel && !props.title) {
    console.warn('IconButton: La propiedad "aria-label" es obligatoria para garantizar la accesibilidad.')
  }

  const baseStyles =
    'relative inline-flex items-center justify-center shrink-0 aspect-square select-none transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none active:scale-95'

  const sizeStyles = {
    xs: 'h-7 w-7 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
  }[size] || 'h-10 w-10 text-base'

  const roundedStyles = {
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  }[rounded] || 'rounded-xl'

  const variantStyles = {
    // Ghost (default for header/modal buttons like 'X')
    ghost:
      'bg-transparent hover:bg-white/10 text-white/70 hover:text-white active:bg-white/15',

    // Secondary / Glass
    secondary:
      'bg-white/10 hover:bg-white/15 text-white border border-white/10 shadow-sm active:bg-white/20',

    // Glossy 3D primary emerald
    primary:
      'bg-[#00c26f] text-white shadow-[inset_0_2px_1px_rgba(255,255,255,0.36),0_3px_0_#057544] hover:brightness-105 active:translate-y-[1px]',

    // Modern emerald
    emerald:
      'bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20 active:bg-emerald-600',

    // Accent gradient
    accent:
      'bg-gradient-to-r from-accent to-accent2 text-white shadow-md shadow-accent/20 hover:brightness-110 active:shadow-sm',

    // Danger
    danger:
      'bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 active:bg-red-500/40',

    // Outline
    outline:
      'bg-transparent hover:bg-white/5 text-white/80 hover:text-white border border-white/20 active:bg-white/10',
  }[variant] || 'bg-transparent text-white'

  return (
    <button
      ref={ref}
      type={type}
      aria-label={resolvedAriaLabel}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles} ${roundedStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-current" aria-hidden="true" />
      ) : (
        icon || children
      )}
    </button>
  )
})
