'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { RateInput } from '@/components/forms/RateInput'
import { apiRequest, ApiClientError } from '@/lib/api'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function NewMerchantPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('MERCHANTS')
  const [legalName, setLegalName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [payinBp, setPayinBp] = useState(400)
  const [payoutBp, setPayoutBp] = useState(200)
  const [error, setError] = useState<string | null>(null)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSubmit = async () => {
    if (!accessToken) return
    setError(null)
    try {
      await apiRequest('/api/v1/merchants', {
        method: 'POST',
        token: accessToken,
        body: {
          legal_name: legalName,
          display_name: displayName || legalName,
          merchant_code: code,
          contact_email: email || undefined,
          contact_mobile: mobile || undefined,
          rates: [
            { rate_kind: 'PAYIN', rate_bp: payinBp },
            { rate_kind: 'PAYOUT', rate_bp: payoutBp },
          ],
        },
      })
      router.replace('/merchants')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not create')
    }
  }

  return (
    <AppShell title="Create merchant" role={user.role} menus={menus}>
      <FormShell submitLabel="Create" error={error} onSubmit={() => void handleSubmit()}>
        <label className="block text-xs">Legal name<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label>
        <label className="block text-xs">Display name<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="block text-xs">Merchant code<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <label className="block text-xs">Contact email<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="block text-xs">Contact mobile<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={mobile} onChange={(event) => setMobile(event.target.value)} /></label>
        <RateInput id="m-payin" label="Merchant PAY-IN rate" valueBp={payinBp} onChangeBp={setPayinBp} />
        <RateInput id="m-payout" label="Merchant PAY-OUT rate" valueBp={payoutBp} onChangeBp={setPayoutBp} />
      </FormShell>
    </AppShell>
  )
}
