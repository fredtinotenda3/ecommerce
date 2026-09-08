'use client'

// src/app/_providers/Toast/index.tsx
//
// Transient notifications, shared by the storefront and the admin.
//
// One implementation rather than per-screen banners: a toast is how a user
// learns that an action they took actually happened, and inconsistent
// feedback is how they learn not to trust it.
//
// Accessibility: the container is a live region, so a screen reader
// announces a toast without moving focus. Errors are `assertive` (they
// interrupt) while successes are `polite` (they wait for a pause), which
// matches how urgent each actually is.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import classes from './index.module.scss'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  /** Milliseconds before auto-dismiss. Errors default to staying longer,
   * since they usually carry something the user has to read. */
  duration?: number
}

interface Toast extends Required<Omit<ToastInput, 'description'>> {
  id: number
  description?: string
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
  dismissToast: () => undefined,
})

let nextId = 0

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.5 12.5 2.4 2.4 4.6-5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1.1" fill="currentColor" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.9" r="1.1" fill="currentColor" />
    </svg>
  ),
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const variant = input.variant ?? 'info'
    const toast: Toast = {
      id: (nextId += 1),
      title: input.title,
      description: input.description,
      variant,
      duration: input.duration ?? (variant === 'error' ? 8000 : 5000),
    }

    // Cap the stack. A burst of results from a bulk action should not
    // cover the page it is reporting on.
    setToasts(current => [...current.slice(-3), toast])
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={classes.viewport}>
        <div className={classes.region} role="status" aria-live="polite">
          {toasts
            .filter(toast => toast.variant !== 'error')
            .map(toast => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
            ))}
        </div>
        <div className={classes.region} role="alert" aria-live="assertive">
          {toasts
            .filter(toast => toast.variant === 'error')
            .map(toast => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <div className={[classes.toast, classes[toast.variant]].join(' ')}>
      <span className={classes.icon}>{ICONS[toast.variant]}</span>
      <div className={classes.body}>
        <p className={classes.title}>{toast.title}</p>
        {toast.description && <p className={classes.description}>{toast.description}</p>}
      </div>
      <button
        type="button"
        className={classes.close}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

export const useToast = (): ToastContextValue => useContext(ToastContext)
