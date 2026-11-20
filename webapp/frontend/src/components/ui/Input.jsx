import React, { forwardRef } from 'react'
import { useFieldContext } from './Field'

/**
 * Universal Input component for Francho Shop.
 * Compatible with Field context for automatic accessible IDs and aria attributes.
 *
 * @param {string} id
 * @param {string} name
 * @param {string} type HTML input type (default 'text')
 * @param {string|number} value
 * @param {string|number} defaultValue
 * @param {function} onChange
 * @param {boolean} disabled
 * @param {boolean} invalid Highlights error state
 * @param {React.ReactNode} icon Optional leading icon
 * @param {React.ReactNode} rightIcon Optional trailing icon
 * @param {string} className
 */
export const Input = forwardRef(function Input(
  {
    id,
    name,
    type = 'text',
    value,
    defaultValue,
    onChange,
    disabled,
    invalid,
    icon = null,
    rightIcon = null,
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
    'w-full text-sm rounded-xl transition-all duration-200 outline-none select-text'

  const paddingStyles = icon && rightIcon
    ? 'pl-10 pr-10 py-2.5'
    : icon
    ? 'pl-10 pr-3.5 py-2.5'
    : rightIcon
    ? 'pl-3.5 pr-10 py-2.5'
    : 'px-3.5 py-2.5'

  const stateStyles = resolvedInvalid
    ? 'bg-black/25 text-white placeholder:text-white/35 border border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
    : 'bg-black/25 text-white placeholder:text-white/35 border border-white/10 focus:border-accent focus:ring-2 focus:ring-accent/20'

  const disabledStyles = resolvedDisabled
    ? 'opacity-50 cursor-not-allowed bg-white/5 pointer-events-none'
    : ''

  const inputNode = (
    <input
      ref={ref}
      id={resolvedId}
      name={name}
      type={type}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={resolvedDisabled}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={resolvedDescribedBy}
      className={`${baseStyles} ${paddingStyles} ${stateStyles} ${disabledStyles} ${className}`}
      {...props}
    />
  )

  if (!icon && !rightIcon) {
    return inputNode
  }

  return (
    <div className="relative w-full flex items-center">
      {icon && (
        <span className="absolute left-3.5 flex items-center justify-center text-white/40 pointer-events-none shrink-0">
          {icon}
        </span>
      )}
      {inputNode}
      {rightIcon && (
        <span className="absolute right-3.5 flex items-center justify-center text-white/40 shrink-0">
          {rightIcon}
        </span>
      )}
    </div>
  )
})
