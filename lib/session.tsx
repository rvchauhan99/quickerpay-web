'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LoginResponse, MenuGrant, SessionUser, TwoFaChallengeResponse } from '@quickerpay/shared-types'
import { apiRequest, bindApiSession, refreshSession } from './api'

interface SessionState {
  accessToken: string | null
  user: SessionUser | null
  menus: MenuGrant[]
  ready: boolean
  login: (body: { username: string; password: string; totp?: string }) => Promise<'ok' | 'two_fa_required'>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [menus, setMenus] = useState<MenuGrant[]>([])
  const [ready, setReady] = useState(false)

  const applyLogin = useCallback((payload: LoginResponse) => {
    setAccessToken(payload.access_token)
    setUser(payload.user)
    setMenus(payload.menus)
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setMenus([])
  }, [])

  const tokenRef = useRef<string | null>(null)
  tokenRef.current = accessToken

  useEffect(() => {
    bindApiSession({
      getAccessToken: () => tokenRef.current,
      applyLogin,
      clearSession,
    })
    return () => bindApiSession(null)
  }, [applyLogin, clearSession])

  useEffect(() => {
    const restore = async () => {
      try {
        const payload = await refreshSession()
        applyLogin(payload)
      } catch {
        clearSession()
      } finally {
        setReady(true)
      }
    }
    void restore()
  }, [applyLogin, clearSession])

  const login = useCallback(
    async (body: { username: string; password: string; totp?: string }) => {
      const payload = await apiRequest<LoginResponse | TwoFaChallengeResponse>('/api/v1/auth/login', {
        method: 'POST',
        body,
      })
      if ('two_fa_required' in payload && payload.two_fa_required) return 'two_fa_required'
      applyLogin(payload as LoginResponse)
      return 'ok' as const
    },
    [applyLogin],
  )

  const logout = useCallback(async () => {
    if (accessToken) {
      await apiRequest('/api/v1/auth/logout', { method: 'POST', token: accessToken }).catch(() => undefined)
    }
    clearSession()
  }, [accessToken, clearSession])

  const refreshUser = useCallback(async () => {
    if (!accessToken) return
    const payload = await apiRequest<{ user: SessionUser; menus: MenuGrant[] }>('/api/v1/auth/me', {
      token: accessToken,
    })
    setUser(payload.user)
    setMenus(payload.menus)
  }, [accessToken])

  const value = useMemo(
    () => ({ accessToken, user, menus, ready, login, logout, refreshUser }),
    [accessToken, user, menus, ready, login, logout, refreshUser],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionState {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

export function hasMenu(
  menus: MenuGrant[],
  code: string,
  action: 'can_view' | 'can_create' | 'can_edit' | 'can_approve' | 'can_export' = 'can_view',
): boolean {
  const row = menus.find((item) => item.menu_code === code)
  if (!row) return false
  return Boolean(row[action])
}
