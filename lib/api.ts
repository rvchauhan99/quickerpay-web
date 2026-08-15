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
    const parts = Object.entries(this.fieldErrors()).map(([field, text]) => `${field}: ${text}`)
    if (parts.length === 0) return this.message
    return `${this.message}. ${parts.join('; ')}`
  }
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

async function request(path: string, options: RequestOptions): Promise<Parsed> {
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
  }
  if (options.body !== undefined) init.body = JSON.stringify(options.body)
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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const parsed = await request(path, options)
  return parsed.data as T
}

export async function apiListRequest<T>(
  path: string,
  options: { token?: string | null } = {},
): Promise<{ items: T[]; pagination: Pagination }> {
  const parsed = await request(path, options)
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

export async function refreshSession() {
  return apiRequest<LoginResponse>('/api/v1/auth/refresh', { method: 'POST' })
}
