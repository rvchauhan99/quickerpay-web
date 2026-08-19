'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { RateInput } from '@/components/forms/RateInput'
import { toast } from 'sonner'
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
  const [supagoUsername, setSupagoUsername] = useState('')
  const [supagoPassword, setSupagoPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const created = await apiRequest<{ id: string }>('/api/v1/merchants', {
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
      if (supagoUsername && supagoPassword) {
        await apiRequest(`/api/v1/merchants/${created.id}/supago`, {
          method: 'PATCH',
          token: accessToken,
          body: { supago_username: supagoUsername, supago_password: supagoPassword },
        })
      }
      toast.success('Merchant created')
      router.replace('/merchants')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not create')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="Create merchant" role={user.role} menus={menus}>
      <PageHeader title="Create Merchant" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      <FormShell submitLabel={submitting ? 'Creating…' : 'Create'} onSubmit={() => void handleSubmit()}>
        <FormSection title="Merchant Information" description="Legal and contact details.">
          <FormGrid>
            <FormField label="Legal Name" required>
              <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
            </FormField>
            <FormField label="Display Name">
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </FormField>
            <FormField label="Merchant Code" required>
              <Input value={code} onChange={(event) => setCode(event.target.value)} />
            </FormField>
            <FormField label="Contact Email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
            <FormField label="Contact Mobile">
              <Input type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Initial Rates" description="Set the default commission rates for this merchant.">
          <FormGrid>
            <FormField label="PAY-IN Rate">
              <RateInput id="m-payin" valueBp={payinBp} onChangeBp={setPayinBp} />
            </FormField>
            <FormField label="PAY-OUT Rate">
              <RateInput id="m-payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Supago Integration" description="Optional. Connect to the Supago platform at creation time. Leave blank to skip and connect later from the merchant detail page.">
          <FormGrid>
            <FormField label="Supago Username">
              <Input
                value={supagoUsername}
                onChange={(event) => setSupagoUsername(event.target.value)}
                placeholder="Supago username (optional)"
              />
            </FormField>
            <FormField label="Supago Password">
              <Input
                type="password"
                value={supagoPassword}
                onChange={(event) => setSupagoPassword(event.target.value)}
                placeholder="Supago password (optional)"
              />
            </FormField>
          </FormGrid>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
