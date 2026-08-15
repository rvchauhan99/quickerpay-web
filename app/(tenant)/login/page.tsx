'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiClientError } from '@/lib/api'
import { useSession } from '@/lib/session'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      await login({
        username,
        password,
        ...(totp ? { totp } : {}),
      })
      router.replace('/dashboard')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen qp-auth-page">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10"
        style={{
          background: 'linear-gradient(145deg, #022c22 0%, #065f46 50%, #047857 100%)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-white">QuickerPay</p>
            <p className="text-[11px] uppercase tracking-widest" style={{ color: '#6ee7b7' }}>Console</p>
          </div>
        </div>

        {/* Hero text */}
        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Secure Payment<br />Operations Platform
          </h1>
          <p className="mt-4 text-base leading-relaxed" style={{ color: '#a7f3d0' }}>
            Multi-tenant payment gateway management with real-time UTR verification and commission tracking.
          </p>

          {/* Feature bullets */}
          <ul className="mt-8 space-y-3">
            {[
              'Real-time Pay-In & Pay-Out management',
              'Multi-tenant architecture with role-based access',
              'Automated commission engine with audit trail',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span className="text-sm" style={{ color: '#d1fae5' }}>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6ee7b7' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span className="text-xs" style={{ color: '#6ee7b7' }}>Enterprise-grade security & compliance</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12" style={{ backgroundColor: '#f8fafc' }}>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--qp-primary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--qp-text-primary)' }}>QuickerPay</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--qp-text-primary)' }}>Sign in</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--qp-text-muted)' }}>Enter your credentials to access the console</p>
          </div>

          {/* Form */}
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubmit()
            }}
          >
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--qp-text-secondary)' }}
              >
                Username
              </label>
              <input
                id="username"
                className="h-10 w-full rounded-lg border px-3 text-sm transition-colors"
                style={{
                  borderColor: 'var(--qp-border)',
                  backgroundColor: '#fff',
                  color: 'var(--qp-text-primary)',
                }}
                value={username}
                autoComplete="username"
                autoFocus
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--qp-text-secondary)' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                className="h-10 w-full rounded-lg border px-3 text-sm transition-colors"
                style={{
                  borderColor: 'var(--qp-border)',
                  backgroundColor: '#fff',
                  color: 'var(--qp-text-primary)',
                }}
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* TOTP */}
            <div>
              <label
                htmlFor="totp"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--qp-text-secondary)' }}
              >
                Authenticator Code <span className="font-normal" style={{ color: 'var(--qp-text-muted)' }}>(if required)</span>
              </label>
              <input
                id="totp"
                className="h-10 w-full rounded-lg border px-3 text-sm tracking-widest transition-colors"
                style={{
                  borderColor: 'var(--qp-border)',
                  backgroundColor: '#fff',
                  color: 'var(--qp-text-primary)',
                }}
                value={totp}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                onChange={(e) => setTotp(e.target.value)}
              />
            </div>

            {/* Error */}
            {error ? (
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--qp-danger-bg)', borderColor: 'var(--qp-danger-border)', color: 'var(--qp-danger)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-70"
              style={{ backgroundColor: loading ? 'var(--qp-primary-dark)' : 'var(--qp-primary)' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--qp-primary-dark)' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--qp-primary)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Continue
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Security footer */}
          <div className="mt-8 flex items-center justify-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--qp-text-muted)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>
              Secured by QuickerPay · All sessions are encrypted
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}

