import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Universal Modal / Dialog component for Francho Shop.
 * Handles accessible focus management, Escape key, scroll lock, and portal mounting.
 *
 * @param {boolean} isOpen Controls visibility
 * @param {function} onClose Callback invoked to close modal
 * @param {string|React.ReactNode} title Optional header title
 * @param {string|React.ReactNode} description Optional subtitle/description
 * @param {'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'} size Max width size
 * @param {boolean} closeOnBackdrop Closes modal on backdrop click (default true)
 * @param {boolean} showCloseButton Shows top-right close button (default true)
 * @param {string} className Additional classes for modal card
 */
export function Modal({
  isOpen,
  onClose,
  title = null,
  description = null,
  size = 'md',
  closeOnBackdrop = true,
  showCloseButton = true,
  children,
  footer = null,
  className = '',
}) {
  const generatedId = useId()
  const titleId = title ? `modal-title-${generatedId}` : undefined
  const descriptionId = description ? `modal-desc-${generatedId}` : undefined

  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const previousActiveElementRef = useRef(null)

  // 1. Bloqueo de scroll en body (Scroll Lock)
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isOpen])

  // 2. Gestion de foco inicial y restauracion al cerrar/desmontar
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    // Guardar elemento enfocado antes de abrir
    previousActiveElementRef.current = document.activeElement

    const timer = requestAnimationFrame(() => {
      if (!dialogRef.current) return

      // Enfocar boton de cierre si existe
      if (closeButtonRef.current) {
        closeButtonRef.current.focus()
        return
      }

      // O el primer elemento enfocable del dialogo
      const focusables = Array.from(
        dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

      if (focusables.length > 0) {
        focusables[0].focus()
      } else {
        // O el contenedor con tabIndex={-1}
        dialogRef.current.focus()
      }
    })

    return () => {
      cancelAnimationFrame(timer)
      // Restaurar foco anterior
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        previousActiveElementRef.current.focus()
      }
    }
  }, [isOpen])

  // 3. Manejo de teclado: Escape y Focus Trap (Tab y Shift+Tab)
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event) {
      // Escape
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }

      // Focus Trap
      if (event.key === 'Tab') {
        if (!dialogRef.current) return

        const focusables = Array.from(
          dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

        if (focusables.length === 0) {
          event.preventDefault()
          dialogRef.current.focus()
          return
        }

        const firstElement = focusables[0]
        const lastElement = focusables[focusables.length - 1]

        if (event.shiftKey) {
          // Shift + Tab
          if (
            document.activeElement === firstElement ||
            document.activeElement === dialogRef.current
          ) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-none h-full rounded-none',
  }[size] || 'max-w-md'

  const modalNode = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      role="presentation"
    >
      {/* Backdrop con blur */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={() => {
          if (closeOnBackdrop) onClose?.()
        }}
      />

      {/* Tarjeta del Dialogo accesible */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${sizeStyles} bg-card/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col my-auto transition-transform outline-none text-white animate-slide-up ${className}`}
      >
        {/* Cabecera integrada si se paso title o showCloseButton */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-4 sm:p-5 pb-3 border-b border-white/5 gap-3">
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id={titleId}
                  className="text-base sm:text-lg font-bold text-white tracking-tight truncate"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descriptionId}
                  className="text-xs text-white/55 mt-0.5 leading-relaxed"
                >
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <IconButton
                ref={closeButtonRef}
                aria-label="Cerrar modal"
                variant="ghost"
                size="sm"
                rounded="xl"
                onClick={onClose}
                className="shrink-0 -mr-1 -mt-1 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )}

        {/* Cuerpo del modal con scroll interno seguro */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[78vh] flex-1">
          {children}
        </div>

        {/* Footer opcional */}
        {footer && (
          <div className="p-4 sm:p-5 pt-3 border-t border-white/5 flex items-center justify-end gap-2 bg-black/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalNode, document.body)
}

export function ModalHeader({ children, className = '', ...props }) {
  return (
    <div
      className={`p-4 sm:p-5 pb-3 border-b border-white/5 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function ModalTitle({ children, className = '', as: Component = 'h2', ...props }) {
  return (
    <Component
      className={`text-base sm:text-lg font-bold text-white tracking-tight ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}

export function ModalDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs text-white/55 mt-0.5 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  )
}

export function ModalContent({ children, className = '', ...props }) {
  return (
    <div className={`p-4 sm:p-5 overflow-y-auto max-h-[78vh] ${className}`} {...props}>
      {children}
    </div>
  )
}

export function ModalFooter({ children, className = '', ...props }) {
  return (
    <div
      className={`p-4 sm:p-5 pt-3 border-t border-white/5 flex items-center justify-end gap-2 bg-black/20 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
