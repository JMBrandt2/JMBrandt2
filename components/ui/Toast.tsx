import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { cn } from '../../lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void
  error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void
  warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void
  info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    }

    setToasts(prev => [...prev, newToast])

    // Auto remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message: string, options: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) => {
    addToast({ ...options, type: 'success', message })
  }, [addToast])

  const error = useCallback((message: string, options: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) => {
    addToast({ ...options, type: 'error', message })
  }, [addToast])

  const warning = useCallback((message: string, options: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) => {
    addToast({ ...options, type: 'warning', message })
  }, [addToast])

  const info = useCallback((message: string, options: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) => {
    addToast({ ...options, type: 'info', message })
  }, [addToast])

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  
  return context
}

function ToastContainer() {
  const { toasts } = useToast()
  
  if (typeof window === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast()

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-danger-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-warning-500" />
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-primary-500" />
    }
  }

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-success-50 border-success-200'
      case 'error':
        return 'bg-danger-50 border-danger-200'
      case 'warning':
        return 'bg-warning-50 border-warning-200'
      case 'info':
        return 'bg-primary-50 border-primary-200'
    }
  }

  return (
    <div
      className={cn(
        'min-w-80 max-w-md p-4 rounded-lg border shadow-lg animate-slide-down',
        getBackgroundColor()
      )}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          {toast.title && (
            <p className="text-sm font-medium text-gray-900 mb-1">
              {toast.title}
            </p>
          )}
          <p className="text-sm text-gray-700">
            {toast.message}
          </p>
          {toast.action && (
            <div className="mt-2">
              <button
                onClick={toast.action.onClick}
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={() => removeToast(toast.id)}
            className="inline-flex rounded-md p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}