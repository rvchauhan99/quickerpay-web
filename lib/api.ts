import type { LoginResponse, Pagination } from '@quickerpay/shared-types'

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string
  readonly details: Record<string, unknown> | undefined

  constructor(
    status: number,
    body: {
      code?: string | undefined
      message?: string | undefined
      request_id?: string | undefined
      details?: Record<string, unknown> | undefined
    },
  ) {
    super(body.message ?? 'Request failed')
    this.status = status
    this.code = body.code ?? 'INTERNAL_ERROR'
    this.requestId = body.request_id ?? ''
    this.details = body.details
  }

  fieldErrors(): Record<string, string> {
    const fields = this.details?.fields
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {}
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'string' && value.length > 0) next[key] = value
    }
    return next
  }

  displayMessage(): string {
    const fields = this.fieldErrors()
    const entries = Object.entries(fields)
    if (entries.length === 0) return this.message
    const parts = entries.map(([field, text]) => `${humanizeFieldName(field)}: ${text}`)
    if (entries.length === 1 && entries[0]?.[1] === this.message) return this.message
    return parts.join('; ')
  }
}

function humanizeFieldName(field: string): string {
  return field
    .split('.')
    .map((segment) =>
      segment
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(' — ')
}

export interface FormErrorState {
  banner: string
  fields: Record<string, string>
}

/** Maps an API error to a banner message and per-field errors for mutation forms. */
export function formError(caught: unknown, fallback: string): FormErrorState {
  if (caught instanceof ApiClientError) {
    return { banner: caught.displayMessage(), fields: caught.fieldErrors() }
  }
  return { banner: fallback, fields: {} }
}

interface Parsed {
  success?: boolean
  data?: unknown
  pagination?: Pagination
  code?: string
  message?: string
  request_id?: string
  details?: Record<string, unknown>
}

interface RequestOptions {
  method?: string | undefined
  token?: string | null | undefined
  body?: unknown
  headers?: Record<string, string> | undefined
}

export interface ApiSessionBinder {
  getAccessToken: () => string | null
  applyLogin: (payload: LoginResponse) => void
  clearSession: () => void
}

const AUTH_BOOTSTRAP_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
])

let sessionBinder: ApiSessionBinder | null = null
let refreshInFlight: Promise<string> | null = null
// Set to true the moment a redirect to /login is triggered. Any in-flight or
// subsequent request silently hangs so React components never see a rejection
// after navigation has started.
let isRedirecting = false

export function bindApiSession(binder: ApiSessionBinder | null): void {
  sessionBinder = binder
}

export function refreshSession() {
  return request('/api/v1/auth/refresh', { method: 'POST' }).then((parsed) => parsed.data as LoginResponse)
}

async function request(path: string, options: RequestOptions): Promise<Parsed> {
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers }
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !isFormData) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
  }
  if (options.body !== undefined) {
    init.body = isFormData ? (options.body as FormData) : JSON.stringify(options.body)
  }
  const response = await fetch(path, init)
  const parsed = (await response.json().catch(() => ({}))) as Parsed
  if (!response.ok || parsed.success === false) {
    throw new ApiClientError(response.status, {
      code: parsed.code,
      message: parsed.message,
      request_id: parsed.request_id,
      details: parsed.details,
    })
  }
  return parsed
}

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.code === 'UNAUTHENTICATED')
}

function isAuthBootstrapPath(path: string): boolean {
  return AUTH_BOOTSTRAP_PATHS.has(path) || path.startsWith('/api/v1/platform/auth/')
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/login') return
  isRedirecting = true
  window.location.replace('/login')
}

// Called by the login page on mount so that any previous redirect flag is cleared
// and the login POST can proceed normally.
export function resetRedirectingFlag(): void {
  isRedirecting = false
}

function recoverAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = refreshSession()
    .then((payload) => {
      sessionBinder?.applyLogin(payload)
      return payload.access_token
    })
    .catch((error: unknown) => {
      sessionBinder?.clearSession()
      redirectToLogin()
      throw error
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

const SILENT: Promise<Parsed> = new Promise(() => {
  /* intentionally never settles — caller is redirecting away */
})

async function requestWithRefresh(path: string, options: RequestOptions): Promise<Parsed> {
  if (isRedirecting) return SILENT
  // Auto-inject the current access token when the caller did not supply one.
  // This keeps page-level load() callbacks free of accessToken as a dep.
  const opts =
    (options.token === undefined || options.token === null) && !isAuthBootstrapPath(path)
      ? { ...options, token: sessionBinder?.getAccessToken() }
      : options
  try {
    return await request(path, opts)
  } catch (error) {
    if (isRedirecting) return SILENT
    if (isAuthBootstrapPath(path) || !isUnauthenticated(error)) throw error
    const freshToken = await recoverAccessToken()
    return request(path, { ...opts, token: freshToken })
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const parsed = await requestWithRefresh(path, options)
  return parsed.data as T
}

export async function apiListRequest<T>(
  path: string,
  options: { token?: string | null } = {},
): Promise<{ items: T[]; pagination: Pagination }> {
  const parsed = await requestWithRefresh(path, options)
  return {
    items: (parsed.data as T[]) ?? [],
    pagination: parsed.pagination ?? {
      page: 1,
      page_size: 10,
      total: Array.isArray(parsed.data) ? parsed.data.length : 0,
      total_is_estimate: false,
      has_next: false,
    },
  }
}
