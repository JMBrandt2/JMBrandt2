import React, { createContext, useContext, ReactNode } from 'react'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasMore?: boolean
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public status?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

class ApiClient {
  private baseUrl: string
  private authToken: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      let data: ApiResponse<T>
      
      try {
        data = await response.json()
      } catch (error) {
        throw new ApiError(
          'PARSE_ERROR',
          'Failed to parse response JSON',
          undefined,
          response.status
        )
      }

      if (!response.ok) {
        throw new ApiError(
          data.error?.code || 'HTTP_ERROR',
          data.error?.message || `HTTP ${response.status}`,
          data.error?.details,
          response.status
        )
      }

      return data
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(
          'NETWORK_ERROR',
          'Network request failed. Please check your connection.',
          { originalError: error.message }
        )
      }
      
      throw new ApiError(
        'UNKNOWN_ERROR',
        'An unexpected error occurred',
        { originalError: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let url = endpoint
    
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }
    
    return this.request<T>(url, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // File upload method
  async upload<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    const headers: HeadersInit = {}
    
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new ApiError(
          data.error?.code || 'HTTP_ERROR',
          data.error?.message || `HTTP ${response.status}`,
          data.error?.details,
          response.status
        )
      }

      return data
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      throw new ApiError(
        'UPLOAD_ERROR',
        'File upload failed',
        { originalError: error instanceof Error ? error.message : String(error) }
      )
    }
  }
}

const ApiContext = createContext<ApiClient | undefined>(undefined)

interface ApiProviderProps {
  children: ReactNode
}

export function ApiProvider({ children }: ApiProviderProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
  const client = new ApiClient(apiUrl)

  return (
    <ApiContext.Provider value={client}>
      {children}
    </ApiContext.Provider>
  )
}

export function useApi(): ApiClient {
  const context = useContext(ApiContext)
  
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider')
  }
  
  return context
}

// Utility hook for handling async API calls with loading states
export function useAsyncOperation<T>() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<ApiError | null>(null)
  const [data, setData] = React.useState<T | null>(null)

  const execute = React.useCallback(async (operation: () => Promise<ApiResponse<T>>) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await operation()
      setData(response.data || null)
      
      return response
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(
        'UNKNOWN_ERROR',
        'An unexpected error occurred',
        { originalError: error instanceof Error ? error.message : String(error) }
      )
      
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = React.useCallback(() => {
    setLoading(false)
    setError(null)
    setData(null)
  }, [])

  return {
    loading,
    error,
    data,
    execute,
    reset
  }
}

// Hook for paginated data
export function usePaginatedData<T>(
  fetcher: (page: number, limit: number) => Promise<ApiResponse<T[]>>,
  initialPage: number = 1,
  initialLimit: number = 10
) {
  const [items, setItems] = React.useState<T[]>([])
  const [page, setPage] = React.useState(initialPage)
  const [limit, setLimit] = React.useState(initialLimit)
  const [total, setTotal] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const { loading, error, execute } = useAsyncOperation<T[]>()

  const loadPage = React.useCallback(async (pageNum: number, replace: boolean = false) => {
    const response = await execute(() => fetcher(pageNum, limit))
    
    if (response.data) {
      setItems(prev => replace ? response.data! : [...prev, ...response.data!])
      setPage(pageNum)
      setTotal(response.meta?.total || 0)
      setHasMore(response.meta?.hasMore || false)
    }
    
    return response
  }, [execute, fetcher, limit])

  const loadMore = React.useCallback(() => {
    if (!loading && hasMore) {
      return loadPage(page + 1, false)
    }
  }, [loading, hasMore, loadPage, page])

  const refresh = React.useCallback(() => {
    setItems([])
    return loadPage(1, true)
  }, [loadPage])

  // Load initial data
  React.useEffect(() => {
    loadPage(1, true)
  }, [limit])

  return {
    items,
    loading,
    error,
    page,
    limit,
    total,
    hasMore,
    setLimit,
    loadMore,
    refresh
  }
}