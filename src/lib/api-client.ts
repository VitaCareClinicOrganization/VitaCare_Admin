import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

export const API_BASE_PATH = '/api/v1'
export const MEDIA_PATHS = ['/uploads', '/imageapi'] as const

const backendUrl = process.env.NEXT_PUBLIC_API_URL
if (!backendUrl) throw new Error('Missing NEXT_PUBLIC_API_URL')

function getOrigin(url: string): string {
  const parsed = new URL(url.trim())
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
    throw new Error('Backend URL must use HTTP(S) or WS(S)')
  }
  return parsed.origin
}

export const BACKEND_ORIGIN = getOrigin(backendUrl)

export function getSocketBaseUrl(url = process.env.NEXT_PUBLIC_WS_URL || backendUrl): string {
  return getOrigin(url)
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return ''
  if (/^(data:|blob:|\/\/)/.test(url)) return url
  if (/^https?:\/\//.test(url)) {
    const parsed = new URL(url)
    if (parsed.origin === BACKEND_ORIGIN
      && MEDIA_PATHS.some(path => parsed.pathname.startsWith(`${path}/`))) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return url
  }
  return url.startsWith('/') ? url : `/${url}`
}

export const apiClient = axios.create({
  baseURL: API_BASE_PATH,
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean }
let refreshPromise: Promise<void> | null = null

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryableRequest | undefined
    const isRefresh = request?.url?.includes('/auth/refresh')
    if (error.response?.status === 401 && request && !request._retry && !isRefresh) {
      request._retry = true
      try {
        refreshPromise ??= apiClient.post('/auth/refresh', {}).then(() => undefined).finally(() => { refreshPromise = null })
        await refreshPromise
        return apiClient(request)
      } catch (refreshError) {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth-session-expired'))
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  },
)

export function unwrapApiData<T = any>(payload: any): T {
  return payload?.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')
    ? payload.data as T
    : payload as T
}

export async function apiRequest<T = any>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.request(config)
  return unwrapApiData<T>(response.data)
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as any
    return String(payload?.message || payload?.data?.message || error.message || fallback)
  }
  return error instanceof Error ? error.message : fallback
}
