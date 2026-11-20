import React, { forwardRef } from 'react'
import { useFieldContext } from './Field'

/**
 * Universal Textarea component for Francho Shop.
 * Compatible with Field context for automatic accessible IDs and aria attributes.
 *
 * @param {string} id
 * @param {string} name
 * @param {number} rows Number of visible text lines (default 3)
 * @param {string|number} value
 * @param {string|number} defaultValue
 * @param {function} onChange
 * @param {boolean} disabled
 * @param {boolean} invalid Highlights error state
 * @param {string} className
 */
export const Textarea = forwardRef(function Textarea(
  {
    id,
    name,
    rows = 3,
    value,
    defaultValue,
    onChange,
    disabled,
    invalid,
    className = '',
    'aria-invalid': ariaInvalidProp,
    'aria-describedby': ariaDescribedByProp,
    ...props
  },
  ref
) {
  const field = useFieldContext()

  const resolvedId = id || field?.id
  const resolvedDisabled = disabled ?? field?.disabled ?? false
  const resolvedInvalid = invalid ?? field?.isInvalid ?? false
  const resolvedDescribedBy = ariaDescribedByProp || field?.describedBy
  const resolvedAriaInvalid = ariaInvalidProp || (resolvedInvalid ? 'true' : undefined)

  const baseStyles =
    'w-full px-3.5 py-2.5 text-sm rounded-xl transition-all duration-200 outline-none select-text resize-y min-h-[72px]'

  const stateStyles = resolvedInvalid
    ? 'bg-black/25 text-white placeholder:text-white/35 border border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
    : 'bg-black/25 text-white placeholder:text-white/35 border border-white/10 focus:border-accent focus:ring-2 focus:ring-accent/20'

  const disabledStyles = resolvedDisabled
    ? 'opacity-50 cursor-not-allowed bg-white/5 pointer-events-none'
    : ''

  return (
    <textarea
      ref={ref}
      id={resolvedId}
      name={name}
      rows={rows}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={resolvedDisabled}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={resolvedDescribedBy}
      className={`${baseStyles} ${stateStyles} ${disabledStyles} ${className}`}
      {...props}
    />
  )
})
