import React, { forwardRef } from 'react'

/**
 * Universal Card component for Francho Shop.
 * Composable and presentation-only with zero hardcoded data.
 */

export const Card = forwardRef(function Card(
  {
    children,
    variant = 'default',
    interactive = false,
    className = '',
    as: Component = 'div',
    ...props
  },
  ref
) {
  const baseStyles = 'rounded-2xl transition-all duration-200 overflow-hidden'

  const variantStyles = {
    // Default Francho Shop dark card with subtle blur & border
    default:
      'bg-card/90 backdrop-blur-md border border-white/10 shadow-lg shadow-black/20 text-white',

    // Frosted glass card
    glass:
      'bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-md text-white',

    // Solid dark surface
    solid:
      'bg-card border border-white/10 text-white',

    // Highlighted card with accent glow
    glow:
      'bg-card/90 backdrop-blur-md border border-accent/40 shadow-lg shadow-accent/10 text-white',
  }[variant] || 'bg-card/90 border border-white/10 text-white'

  const interactiveStyles = interactive
    ? 'hover:border-white/25 hover:bg-cardHover cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
    : ''

  return (
    <Component
      ref={ref}
      className={`${baseStyles} ${variantStyles} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
})

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`p-4 md:p-5 flex flex-col gap-1.5 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '', as: Component = 'h3', ...props }) {
  return (
    <Component
      className={`text-base md:text-lg font-bold text-white tracking-tight ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs text-white/55 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-4 md:p-5 pt-0 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={`p-4 md:p-5 pt-0 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
