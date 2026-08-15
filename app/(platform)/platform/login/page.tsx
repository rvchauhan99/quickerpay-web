'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, ApiClientError } from '@/lib/api'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { FormShell } from '@/components/forms/FormShell'

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
    <main className="mx-auto mt-20 max-w-sm p-6">
      <FormShell submitLabel="Sign in" onSubmit={() => void handleSubmit()}>
        <FormField label="Email" required>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
        <FormField label="Password" required>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </FormField>
        <FormField label="TOTP" required>
          <Input value={totp} onChange={(event) => setTotp(event.target.value)} />
        </FormField>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      </FormShell>
    </main>
  )
}
