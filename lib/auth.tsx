import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { useApi } from './api'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: 'admin' | 'user'
  organizationId: string
  githubUsername?: string
  createdAt: string
  lastLoginAt: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (code: string, state: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const api = useApi()

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token')
      const refreshToken = localStorage.getItem('refresh_token')
      
      if (!token) {
        setLoading(false)
        return
      }

      try {
        api.setAuthToken(token)
        const userData = await api.get('/users/me')
        setUser(userData.data)
      } catch (error) {
        console.error('Auth initialization error:', error)
        
        // Try to refresh token if we have a refresh token
        if (refreshToken) {
          try {
            await refreshTokenInternal(refreshToken)
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
            clearAuthData()
          }
        } else {
          clearAuthData()
        }
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = async (code: string, state: string) => {
    try {
      setLoading(true)
      
      const response = await api.post('/auth/callback', { code, state })
      const { user, token, refreshToken } = response.data
      
      // Store tokens
      localStorage.setItem('auth_token', token)
      localStorage.setItem('refresh_token', refreshToken)
      
      // Set API auth token
      api.setAuthToken(token)
      
      // Set user state
      setUser(user)
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token')
      
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuthData()
      router.push('/login')
    }
  }

  const refreshToken = async () => {
    const refreshTokenValue = localStorage.getItem('refresh_token')
    
    if (!refreshTokenValue) {
      throw new Error('No refresh token available')
    }
    
    await refreshTokenInternal(refreshTokenValue)
  }

  const refreshTokenInternal = async (refreshTokenValue: string) => {
    const response = await api.post('/auth/refresh', { 
      refreshToken: refreshTokenValue 
    })
    
    const { token } = response.data
    
    // Update stored token
    localStorage.setItem('auth_token', token)
    
    // Set API auth token
    api.setAuthToken(token)
    
    // Refresh user data
    const userData = await api.get('/users/me')
    setUser(userData.data)
  }

  const clearAuthData = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    api.setAuthToken(null)
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: { redirectTo?: string; requiredRole?: 'admin' | 'user' } = {}
) {
  const { redirectTo = '/login', requiredRole } = options
  
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading) {
        if (!user) {
          router.push(redirectTo)
          return
        }
        
        if (requiredRole && user.role !== requiredRole) {
          router.push('/unauthorized')
          return
        }
      }
    }, [user, loading, router])

    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      )
    }

    if (!user || (requiredRole && user.role !== requiredRole)) {
      return null
    }

    return <Component {...props} />
  }
}

// Hook for checking permissions
export function usePermissions() {
  const { user } = useAuth()
  
  return {
    isAdmin: user?.role === 'admin',
    isUser: user?.role === 'user',
    canManageOrganization: user?.role === 'admin',
    canCreatePlaybooks: user?.role === 'admin',
    canInviteUsers: user?.role === 'admin',
    canManageSecrets: user?.role === 'admin',
    canViewAnalytics: user?.role === 'admin'
  }
}