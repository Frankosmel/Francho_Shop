import React from 'react'

/**
 * Universal Badge component for Francho Shop.
 * Presentation-only component with zero hardcoded texts or static business logic.
 *
 * @param {'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'outline'} variant
 * @param {'sm' | 'md' | 'lg'} size
 * @param {boolean} dot Renders a small colored indicator circle
 * @param {React.ReactNode} icon Optional icon element
 * @param {string} className Additional CSS classes
 */
export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon = null,
  className = '',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center font-bold tracking-wide select-none transition-colors border'

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-md gap-1 leading-tight',
    md: 'text-xs px-2.5 py-1 rounded-lg gap-1.5 leading-tight',
    lg: 'text-sm px-3 py-1.5 rounded-xl gap-2 leading-tight',
  }[size] || 'text-xs px-2.5 py-1 rounded-lg gap-1.5'

  const variantStyles = {
    // Green (for completed, active, delivered, verified)
    success:
      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/5',

    // Amber / Yellow (for pending, processing, review)
    warning:
      'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-sm shadow-amber-500/5',

    // Red / Rose (for failed, cancelled, out of stock, danger)
    danger:
      'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-sm shadow-rose-500/5',

    // Blue / Cyan (for info, link, transit)
    info:
      'bg-sky-500/15 text-sky-300 border-sky-500/30 shadow-sm shadow-sky-500/5',

    // Purple (for VIP, loyalty, special)
    purple:
      'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-sm shadow-purple-500/5',

    // Neutral / Gray
    neutral:
      'bg-white/10 text-white/80 border-white/10',

    // Outline transparent
    outline:
      'bg-transparent text-white/80 border-white/20',
  }[variant] || 'bg-white/10 text-white/80 border-white/10'

  const dotColorStyles = {
    success: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
    warning: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
    danger: 'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]',
    info: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]',
    purple: 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]',
    neutral: 'bg-white/60',
    outline: 'bg-white/60',
  }[variant] || 'bg-white/60'

  return (
    <span
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColorStyles}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      {children}
    </span>
  )
}
