'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { BankAdminMode, GatewaySecretReveal } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert, PrimaryButton } from '@/components/ui/PageHeader'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { RateInput } from '@/components/forms/RateInput'
import { CopyButton } from '@/components/ui/CopyButton'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import { apiRequest, formError } from '@/lib/api'
import { bankerLabel, merchantLabel } from '@/lib/labels'
import { useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function NewMerchantPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('MERCHANTS')
  const { admins } = useSuperAdminDirectory(accessToken, user?.role)
  const [legalName, setLegalName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [payinBp, setPayinBp] = useState(400)
  const [payoutBp, setPayoutBp] = useState(200)
  const [bankAdminMode, setBankAdminMode] = useState<BankAdminMode>('ALL')
  const [bankAdminIds, setBankAdminIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [reveal, setReveal] = useState<GatewaySecretReveal | null>(null)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const activeAdmins = admins.filter((row) => row.role === 'BANKER' && row.status === 'ACTIVE')
  const label = merchantLabel()

  const handleToggleAdmin = (adminId: string) => {
    setBankAdminIds((prev) =>
      prev.includes(adminId) ? prev.filter((id) => id !== adminId) : [...prev, adminId],
    )
  }

  const goToDetail = (id: string) => {
    router.replace(`/merchants/${id}`)
  }

  const handleRevealDone = () => {
    const id = createdId
    setReveal(null)
    if (id) goToDetail(id)
    else router.replace('/merchants')
  }

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})

    if (bankAdminMode === 'SELECTED' && bankAdminIds.length === 0) {
      setFieldErrors({
        banker_user_ids: `Select at least one ${bankerLabel()}, or choose All ${bankerLabel({ plural: true })}.`,
      })
      setError(`Select at least one ${bankerLabel()}, or choose All ${bankerLabel({ plural: true })}.`)
      return
    }

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
          bank_banker_mode: bankAdminMode,
          banker_user_ids: bankAdminMode === 'SELECTED' ? bankAdminIds : [],
        },
      })
      
      const enabled = await apiRequest<GatewaySecretReveal>(`/api/v1/merchants/${created.id}/gateway/enable`, {
        method: 'POST',
        token: accessToken,
      })
      setCreatedId(created.id)
      setReveal({
        ...(enabled.api_key ? { api_key: enabled.api_key } : {}),
        ...(enabled.webhook_secret ? { webhook_secret: enabled.webhook_secret } : {}),
      })
      toast.success(`${label} created with Gateway API`)
      return
    } catch (caught) {
      const next = formError(caught, 'Could not create')
      setError(next.banner)
      setFieldErrors(next.fields)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title={`Create ${label}`} role={user.role} menus={menus}>
      <PageHeader title={`Create ${label}`} backHref="/merchants" backLabel={merchantLabel({ plural: true })} />
      <div className="mb-qp-gap">
        <ErrorAlert message={error} />
      </div>
      <FormShell
        compact
        width="full"
        submitLabel={submitting ? 'Creating…' : 'Create'}
        onSubmit={() => void handleSubmit()}
      >
        <FormSection title={label}>
          <FormGrid cols={5}>
            <FormField label={`${label} Code`} required error={fieldErrors.merchant_code}>
              <Input value={code} onChange={(event) => setCode(event.target.value)} />
            </FormField>
            <FormField label="Exchange Name" required error={fieldErrors.legal_name}>
              <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
            </FormField>
            <FormField label="Deposit Charge (%)">
              <RateInput id="m-payin" valueBp={payinBp} onChangeBp={setPayinBp} />
            </FormField>
            <FormField label="Withdrawal Charge (%)">
              <RateInput id="m-payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
            </FormField>
            <FormField label="Display Name" error={fieldErrors.display_name}>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </FormField>

            <FormField label="Contact Email" error={fieldErrors.contact_email}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
            <FormField label="Contact Mobile" error={fieldErrors.contact_mobile}>
              <Input type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} />
            </FormField>
            <FormField label="URL (Webhook)">
              <Input value="" readOnly placeholder="Available after create" className="font-mono text-xs" />
            </FormField>
            <FormField label="Payout URL (API path)">
              <Input value="" readOnly placeholder="Available after create" className="font-mono text-xs" />
            </FormField>
            <FormField label="Password">
              <Input value="" readOnly placeholder="Enable on detail → Advanced Settings" />
            </FormField>

            <div className="col-span-1 md:col-span-2">
              <FormField
                label={`Assigned Bankers (Deposit Managed By)`}
                error={fieldErrors.banker_user_ids}
              >
                <Select
                  value={bankAdminMode}
                  onChange={(e) => setBankAdminMode(e.target.value as BankAdminMode)}
                >
                  <option value="ALL">All {bankerLabel({ plural: true })}</option>
                  <option value="SELECTED">Selected {bankerLabel({ plural: true })}</option>
                </Select>
                {bankAdminMode === 'SELECTED' && (
                  <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto border rounded p-2">
                    {activeAdmins.map((admin) => (
                      <label key={admin.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={bankAdminIds.includes(admin.id)}
                          onChange={() => handleToggleAdmin(admin.id)}
                        />
                        {admin.username}
                      </label>
                    ))}
                  </div>
                )}
              </FormField>
            </div>
            <div className="col-span-1 md:col-span-3">
              <FormField label="API Key">
                <Input value="" readOnly placeholder="Generated after save — shown once" className="font-mono" />
              </FormField>
            </div>
          </FormGrid>
        </FormSection>
      </FormShell>

      {reveal ? (
        <Modal
          title="Copy these now"
          size="lg"
          footer={
            <div className="flex justify-end">
              <PrimaryButton onClick={handleRevealDone}>I have stored them</PrimaryButton>
            </div>
          }
        >
          <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
            These values are shown once and cannot be read again. Store them in the panel&apos;s secret store.
          </p>
          {reveal.api_key ? (
            <FormField label="API key (x-api-key header)">
              <div className="flex items-center gap-1">
                <Input value={reveal.api_key} readOnly className="font-mono" aria-label="API key" />
                <CopyButton value={reveal.api_key} label="Copy API key" />
              </div>
            </FormField>
          ) : null}
          {reveal.webhook_secret ? (
            <div className="mt-3">
              <FormField label="Webhook secret (verifies x-sp-signature)">
                <div className="flex items-center gap-1">
                  <Input value={reveal.webhook_secret} readOnly className="font-mono" aria-label="Webhook secret" />
                  <CopyButton value={reveal.webhook_secret} label="Copy webhook secret" />
                </div>
              </FormField>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </AppShell>
  )
}
