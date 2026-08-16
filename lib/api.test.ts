import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoginResponse } from '@quickerpay/shared-types'
import { ApiClientError, apiRequest, bindApiSession, refreshSession } from './api'

const loginPayload = (accessToken: string): LoginResponse => ({
  access_token: accessToken,
  expires_in: 900,
  user: {
    id: 'user-1',
    username: 'superadmin',
    display_name: 'Super Admin',
    role: 'SUPER_ADMIN',
    supervisor_admin_id: null,
    operational_state: 'ONLINE',
    auto_accept_enabled: false,
    two_fa_enabled: false,
  },
  tenant: { id: 'tenant-1', slug: 'demo', display_name: 'Demo Tenant' },
  menus: [],
  scope: { bank_account_ids: [], upi_account_ids: [] },
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('apiRequest 401 refresh', () => {
  afterEach(() => {
    bindApiSession(null)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retries once after a live refresh cookie issues a new access token', async () => {
    const applyLogin = vi.fn()
    const clearSession = vi.fn()
    bindApiSession({ getAccessToken: () => 'expired-token', applyLogin, clearSession })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      const auth = headers.authorization ?? ''
      if (path === '/api/v1/utr' && auth === 'Bearer expired-token') {
        return jsonResponse(401, { success: false, code: 'UNAUTHENTICATED', message: 'Invalid credentials' })
      }
      if (path === '/api/v1/auth/refresh') {
        return jsonResponse(200, { success: true, data: loginPayload('fresh-token') })
      }
      if (path === '/api/v1/utr' && auth === 'Bearer fresh-token') {
        return jsonResponse(200, { success: true, data: { ok: true } })
      }
      return jsonResponse(500, { success: false, code: 'INTERNAL_ERROR', message: path })
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await apiRequest<{ ok: boolean }>('/api/v1/utr', { token: 'expired-token' })

    expect(data).toEqual({ ok: true })
    expect(applyLogin).toHaveBeenCalledOnce()
    expect(applyLogin.mock.calls[0]?.[0].access_token).toBe('fresh-token')
    expect(clearSession).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not loop when refresh fails, and sends the user to login', async () => {
    const applyLogin = vi.fn()
    const clearSession = vi.fn()
    bindApiSession({ getAccessToken: () => 'expired-token', applyLogin, clearSession })

    const replace = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/utr', replace } })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path === '/api/v1/utr') {
        return jsonResponse(401, { success: false, code: 'UNAUTHENTICATED', message: 'Invalid credentials' })
      }
      if (path === '/api/v1/auth/refresh') {
        return jsonResponse(401, { success: false, code: 'UNAUTHENTICATED', message: 'Invalid credentials' })
      }
      return jsonResponse(500, { success: false, code: 'INTERNAL_ERROR', message: path })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/v1/utr', { token: 'expired-token' })).rejects.toBeInstanceOf(ApiClientError)
    expect(applyLogin).not.toHaveBeenCalled()
    expect(clearSession).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledWith('/login')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one refresh across concurrent 401s', async () => {
    const applyLogin = vi.fn()
    bindApiSession({ getAccessToken: () => 'expired-token', applyLogin, clearSession: vi.fn() })

    let refreshCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      const auth = headers.authorization ?? ''
      if (path.startsWith('/api/v1/payin') && auth === 'Bearer expired-token') {
        return jsonResponse(401, { success: false, code: 'UNAUTHENTICATED', message: 'Invalid credentials' })
      }
      if (path === '/api/v1/auth/refresh') {
        refreshCalls += 1
        return jsonResponse(200, { success: true, data: loginPayload('fresh-token') })
      }
      if (auth === 'Bearer fresh-token') {
        return jsonResponse(200, { success: true, data: { path } })
      }
      return jsonResponse(500, { success: false, code: 'INTERNAL_ERROR', message: path })
    })
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([
      apiRequest('/api/v1/payin', { token: 'expired-token' }),
      apiRequest('/api/v1/payin/queue', { token: 'expired-token' }),
    ])

    expect(first).toEqual({ path: '/api/v1/payin' })
    expect(second).toEqual({ path: '/api/v1/payin/queue' })
    expect(refreshCalls).toBe(1)
  })

  it('does not refresh on a failed login', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { success: false, code: 'UNAUTHENTICATED', message: 'Invalid credentials' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiRequest('/api/v1/auth/login', { method: 'POST', body: { username: 'x', password: 'y' } }),
    ).rejects.toBeInstanceOf(ApiClientError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refreshSession does not retry itself', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { success: false, code: 'UNAUTHENTICATED', message: 'Invalid credentials' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
