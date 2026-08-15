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

  const handleSubmit = async () => {
    setError(null)
    try {
      await login({
        username,
        password,
        ...(totp ? { totp } : {}),
      })
      router.replace('/dashboard')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Invalid credentials')
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-lg font-semibold text-zinc-900">Sign in</h1>
      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <label className="block text-xs text-zinc-600" htmlFor="username">
          Username
          <input
            id="username"
            className="mt-0.5 h-8 w-full rounded border border-zinc-300 px-2 text-sm"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="block text-xs text-zinc-600" htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            className="mt-0.5 h-8 w-full rounded border border-zinc-300 px-2 text-sm"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="block text-xs text-zinc-600" htmlFor="totp">
          Authenticator code
          <input
            id="totp"
            className="mt-0.5 h-8 w-full rounded border border-zinc-300 px-2 text-sm"
            value={totp}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(event) => setTotp(event.target.value)}
          />
        </label>
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <button type="submit" className="h-8 w-full rounded bg-zinc-900 text-sm text-white">
          Continue
        </button>
      </form>
    </main>
  )
}
