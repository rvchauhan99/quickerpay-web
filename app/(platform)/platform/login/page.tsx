'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, ApiClientError } from '@/lib/api'

export default function PlatformLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('owner@quickerpay.local')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    try {
      await apiRequest('/api/v1/platform/auth/login', {
        method: 'POST',
        body: { email, password, totp },
      })
      router.replace('/platform/tenants')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Sign-in failed')
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-3 text-sm font-semibold">Platform sign-in</h1>
      <form
        className="space-y-2 text-xs"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <label className="block">
          Email
          <input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block">
          Password
          <input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="block">
          TOTP
          <input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={totp} onChange={(event) => setTotp(event.target.value)} />
        </label>
        {error ? <p className="text-red-700">{error}</p> : null}
        <button type="submit" className="h-7 rounded bg-zinc-900 px-3 text-white">
          Sign in
        </button>
      </form>
    </main>
  )
}
