import React, { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useFieldContext } from './Field'

/**
 * Universal Select component for Francho Shop.
 * Compatible with Field context for automatic accessible IDs and aria attributes.
 *
 * @param {string} id
 * @param {string} name
 * @param {string|number} value
 * @param {string|number} defaultValue
 * @param {function} onChange
 * @param {boolean} disabled
 * @param {boolean} invalid Highlights error state
 * @param {string} placeholder Optional default disabled placeholder option
 * @param {string} className
 */
export const Select = forwardRef(function Select(
  {
    id,
    name,
    value,
    defaultValue,
    onChange,
    disabled,
    invalid,
    placeholder = null,
    children,
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
    'w-full appearance-none pl-3.5 pr-10 py-2.5 text-sm rounded-xl transition-all duration-200 outline-none select-none cursor-pointer'

  const stateStyles = resolvedInvalid
    ? 'bg-black/25 text-white border border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
    : 'bg-black/25 text-white border border-white/10 focus:border-accent focus:ring-2 focus:ring-accent/20'

  const disabledStyles = resolvedDisabled
    ? 'opacity-50 cursor-not-allowed bg-white/5 pointer-events-none'
    : ''

  return (
    <div className="relative w-full">
      <select
        ref={ref}
        id={resolvedId}
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={resolvedDisabled}
        aria-invalid={resolvedAriaInvalid}
        aria-describedby={resolvedDescribedBy}
        className={`${baseStyles} ${stateStyles} ${disabledStyles} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="bg-[#0e1422] text-white/50">
            {placeholder}
          </option>
        )}
        {children}
      </select>

      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-white/40 shrink-0">
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
  )
})
