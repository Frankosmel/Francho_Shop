import React, { createContext, useContext, useId, useState, useRef } from 'react'

const TabsContext = createContext(null)

export function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs compound components must be rendered within a <Tabs> container.')
  }
  return context
}

/**
 * Universal WAI-ARIA compliant Tabs component for Francho Shop.
 * Supports controlled/uncontrolled selection, keyboard arrows, Home, End, and focus loop.
 *
 * @param {string} value Controlled active tab value
 * @param {string} defaultValue Initial active tab value for uncontrolled usage
 * @param {function} onChange Callback when tab changes: (value) => void
 * @param {'horizontal' | 'vertical'} orientation Tabs orientation
 * @param {string} className
 */
export function Tabs({
  value: controlledValue,
  defaultValue = '',
  onChange = null,
  orientation = 'horizontal',
  children,
  className = '',
  ...props
}) {
  const baseId = useId()
  const [internalValue, setInternalValue] = useState(defaultValue)

  const isControlled = controlledValue !== undefined && controlledValue !== null
  const activeTab = isControlled ? controlledValue : internalValue

  function setActiveTab(newValue) {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const contextValue = {
    activeTab,
    setActiveTab,
    orientation,
    getTabId: (val) => `tab-${baseId}-${val}`,
    getPanelId: (val) => `panel-${baseId}-${val}`,
  }

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={`w-full flex ${orientation === 'vertical' ? 'flex-row gap-4' : 'flex-col gap-3'} ${className}`}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabList({ children, className = '', ...props }) {
  const { orientation } = useTabsContext()
  const listRef = useRef(null)

  function handleKeyDown(event) {
    if (!listRef.current) return

    const tabs = Array.from(
      listRef.current.querySelectorAll('[role="tab"]:not([disabled])')
    )
    if (!tabs.length) return

    const currentIndex = tabs.indexOf(document.activeElement)
    if (currentIndex === -1) return

    let targetIndex = currentIndex
    const isHorizontal = orientation === 'horizontal'

    if (isHorizontal) {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        targetIndex = (currentIndex + 1) % tabs.length
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        targetIndex = (currentIndex - 1 + tabs.length) % tabs.length
      } else if (event.key === 'Home') {
        event.preventDefault()
        targetIndex = 0
      } else if (event.key === 'End') {
        event.preventDefault()
        targetIndex = tabs.length - 1
      } else {
        return
      }
    } else {
      // Vertical orientation
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        targetIndex = (currentIndex + 1) % tabs.length
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        targetIndex = (currentIndex - 1 + tabs.length) % tabs.length
      } else if (event.key === 'Home') {
        event.preventDefault()
        targetIndex = 0
      } else if (event.key === 'End') {
        event.preventDefault()
        targetIndex = tabs.length - 1
      } else {
        return
      }
    }

    tabs[targetIndex]?.focus()
    tabs[targetIndex]?.click()
  }

  const defaultListStyles = orientation === 'vertical'
    ? 'flex flex-col gap-1 p-1 bg-black/20 border border-white/10 rounded-2xl shrink-0'
    : 'flex items-center gap-1.5 p-1 bg-black/20 border border-white/10 rounded-xl overflow-x-auto no-scrollbar'

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={`${defaultListStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function Tab({
  value,
  disabled = false,
  onClick = null,
  children,
  className = '',
  ...props
}) {
  const { activeTab, setActiveTab, getTabId, getPanelId } = useTabsContext()
  const isActive = activeTab === value

  const tabId = getTabId(value)
  const panelId = getPanelId(value)

  const baseStyles =
    'relative px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0'

  const stateStyles = isActive
    ? 'bg-white/15 text-white shadow-sm shadow-black/20'
    : 'text-white/60 hover:text-white hover:bg-white/5'

  const disabledStyles = disabled
    ? 'opacity-40 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer active:scale-95'

  function handleClick(event) {
    if (disabled) return
    setActiveTab(value)
    onClick?.(event)
  }

  return (
    <button
      id={tabId}
      type="button"
      role="tab"
      disabled={disabled}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={handleClick}
      className={`${baseStyles} ${stateStyles} ${disabledStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabPanel({
  value,
  keepMounted = false,
  children,
  className = '',
  ...props
}) {
  const { activeTab, getTabId, getPanelId } = useTabsContext()
  const isActive = activeTab === value

  const tabId = getTabId(value)
  const panelId = getPanelId(value)

  if (!isActive && !keepMounted) {
    return null
  }

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      hidden={!isActive}
      tabIndex={0}
      className={`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
