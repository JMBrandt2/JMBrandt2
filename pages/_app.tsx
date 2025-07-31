import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import '../styles/globals.css'
import { AuthProvider } from '../lib/auth'
import { ApiProvider } from '../lib/api'
import { ToastProvider } from '../components/ui/Toast'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <ApiProvider>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-screen bg-gray-50">
            <Component {...pageProps} />
          </div>
        </ToastProvider>
      </AuthProvider>
    </ApiProvider>
  )
}