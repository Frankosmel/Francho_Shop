import React, { createContext, useContext, useId } from 'react'

/**
 * Context for linking labels, controls, descriptions, and errors
 */
const FieldContext = createContext(null)

export function useFieldContext() {
  return useContext(FieldContext)
}

/**
 * Universal Field container for Francho Shop forms.
 * Binds label, description, error, and control without unstable IDs.
 *
 * @param {string} id Optional explicit control ID
 * @param {string|React.ReactNode} label Optional direct label prop
 * @param {string|React.ReactNode} description Optional direct description prop
 * @param {string|React.ReactNode} error Optional direct error prop
 * @param {boolean} disabled Disables field context
 * @param {boolean} invalid Overrides field error state
 * @param {string} className Additional container classes
 */
export function Field({
  id: customId,
  label = null,
  description = null,
  error = null,
  disabled = false,
  invalid = false,
  children,
  className = '',
  ...props
}) {
  const generatedId = useId()
  const fieldId = customId || `field-${generatedId}`
  const descriptionId = `${fieldId}-desc`
  const errorId = `${fieldId}-error`

  const hasDescription = Boolean(description)
  const hasError = Boolean(error)
  const isInvalid = Boolean(invalid || hasError)

  const describedByParts = []
  if (hasDescription) describedByParts.push(descriptionId)
  if (hasError) describedByParts.push(errorId)
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined

  const contextValue = {
    id: fieldId,
    descriptionId,
    errorId,
    hasDescription,
    hasError,
    isInvalid,
    disabled: Boolean(disabled),
    describedBy,
  }

  return (
    <FieldContext.Provider value={contextValue}>
      <div className={`flex flex-col gap-1.5 w-full ${className}`} {...props}>
        {label && <FieldLabel>{label}</FieldLabel>}
        {children}
        {hasDescription && (
          <FieldDescription id={descriptionId}>{description}</FieldDescription>
        )}
        {hasError && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    </FieldContext.Provider>
  )
}

export function FieldLabel({ children, htmlFor, className = '', ...props }) {
  const field = useFieldContext()
  const targetId = htmlFor || field?.id

  return (
    <label
      htmlFor={targetId}
      className={`text-xs font-bold text-white/80 select-none ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}

export function FieldDescription({ children, id, className = '', ...props }) {
  const field = useFieldContext()
  const resolvedId = id || field?.descriptionId

  return (
    <p
      id={resolvedId}
      className={`text-[11px] text-white/50 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  )
}

export function FieldError({ children, id, className = '', ...props }) {
  const field = useFieldContext()
  const resolvedId = id || field?.errorId

  if (!children) return null

  return (
    <p
      id={resolvedId}
      role="alert"
      className={`text-xs font-semibold text-rose-400 flex items-center gap-1 ${className}`}
      {...props}
    >
      {children}
    </p>
  )
}
