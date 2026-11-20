import React, { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Universal Button component for Francho Shop.
 *
 * @param {'primary' | 'accent' | 'emerald' | 'secondary' | 'ghost' | 'danger' | 'outline'} variant
 * @param {'xs' | 'sm' | 'md' | 'lg'} size
 * @param {boolean} loading Shows loading spinner and disables interactions
 * @param {boolean} disabled Disables button interactions and styles
 * @param {boolean} fullWidth Stretches button to 100% of parent container
 * @param {React.ReactNode} icon Optional left icon
 * @param {React.ReactNode} rightIcon Optional right icon
 * @param {string} className Additional CSS classes
 * @param {'button' | 'submit' | 'reset'} type HTML button type
 * @param {function} onClick Click event handler
 */
export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon = null,
    rightIcon = null,
    className = '',
    type = 'button',
    onClick,
    ...props
  },
  ref
) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-bold select-none transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]'

  const sizeStyles = {
    xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5',
    sm: 'px-3.5 py-2 text-xs rounded-xl gap-2',
    md: 'px-4 py-3 text-sm rounded-xl gap-2.5',
    lg: 'px-6 py-3.5 text-base rounded-2xl gap-3',
  }[size] || 'px-4 py-3 text-sm rounded-xl gap-2.5'

  const variantStyles = {
    // 3D Glossy Francho emerald (used for purchases, conversions, CTA)
    primary:
      'bg-[#00c26f] text-white shadow-[inset_0_2px_1px_rgba(255,255,255,0.36),0_5px_0_#057544,0_12px_20px_rgba(0,194,111,0.24)] hover:brightness-105 active:translate-y-[2px] active:shadow-[inset_0_2px_1px_rgba(255,255,255,0.18),0_2px_0_#057544]',

    // Gradient accent (blue to purple)
    accent:
      'bg-gradient-to-r from-accent to-accent2 text-white shadow-lg shadow-accent/25 hover:brightness-110 active:shadow-md',

    // Flat modern emerald
    emerald:
      'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:bg-emerald-600',

    // Secondary / Glass card
    secondary:
      'bg-white/10 hover:bg-white/15 text-white border border-white/10 shadow-sm active:bg-white/20',

    // Ghost minimal
    ghost:
      'bg-transparent hover:bg-white/10 text-white/80 hover:text-white',

    // Danger / destructive
    danger:
      'bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 shadow-sm shadow-red-500/10 active:bg-red-500/40',

    // Outline
    outline:
      'bg-transparent hover:bg-white/5 text-white border border-white/20 active:bg-white/10',
  }[variant] || 'bg-white/10 text-white'

  const widthStyle = fullWidth ? 'w-full' : ''

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" aria-hidden="true" />
      ) : icon ? (
        <span className="shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}

      <span className={loading ? 'opacity-80' : ''}>{children}</span>

      {!loading && rightIcon ? (
        <span className="shrink-0 flex items-center justify-center">{rightIcon}</span>
      ) : null}
    </button>
  )
})
