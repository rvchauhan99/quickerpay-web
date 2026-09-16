'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { BankAdminMode } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { RateInput } from '@/components/forms/RateInput'
import { BankAdminsFormSection } from '@/components/forms/BankAdminsFormSection'
import { toast } from 'sonner'
import { apiRequest, formError } from '@/lib/api'
import { useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

type PanelIntegrationType = 'none' | 'supago' | 'crici'

export default function NewMerchantPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('MERCHANTS')
  const { isSuperAdmin, admins } = useSuperAdminDirectory(accessToken, user?.role)
  const [legalName, setLegalName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [payinBp, setPayinBp] = useState(400)
  const [payoutBp, setPayoutBp] = useState(200)
  const [panelType, setPanelType] = useState<PanelIntegrationType>('none')
  const [supagoUsername, setSupagoUsername] = useState('')
  const [supagoPassword, setSupagoPassword] = useState('')
  const [supagoTransactionCode, setSupagoTransactionCode] = useState('')
  const [criciUsername, setCriciUsername] = useState('')
  const [criciPassword, setCriciPassword] = useState('')
  const [bankAdminMode, setBankAdminMode] = useState<BankAdminMode>('ALL')
  const [bankAdminIds, setBankAdminIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const activeAdmins = admins.filter((row) => row.role === 'ADMIN' && row.status === 'ACTIVE')

  const handleToggleAdmin = (adminId: string) => {
    setBankAdminIds((prev) =>
      prev.includes(adminId) ? prev.filter((id) => id !== adminId) : [...prev, adminId],
    )
  }

  const handlePanelTypeChange = (next: PanelIntegrationType) => {
    setPanelType(next)
    setFieldErrors({})
    setError(null)
    if (next !== 'supago') {
      setSupagoUsername('')
      setSupagoPassword('')
      setSupagoTransactionCode('')
    }
    if (next !== 'crici') {
      setCriciUsername('')
      setCriciPassword('')
    }
  }

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})

    if (bankAdminMode === 'SELECTED' && bankAdminIds.length === 0) {
      setFieldErrors({ admin_user_ids: 'Select at least one Admin, or choose All Admins.' })
      setError('Select at least one Admin, or choose All Admins.')
      return
    }

    const trimmedSupagoUsername = supagoUsername.trim()
    const trimmedSupagoPassword = supagoPassword.trim()
    const trimmedTransactionCode = supagoTransactionCode.trim()
    const trimmedCriciUsername = criciUsername.trim()
    const trimmedCriciPassword = criciPassword.trim()

    if (panelType === 'supago') {
      if (!trimmedSupagoUsername || !trimmedSupagoPassword || !trimmedTransactionCode) {
        const nextErrors: Record<string, string> = {}
        if (!trimmedSupagoUsername) nextErrors.supago_username = 'Required when connecting Supago'
        if (!trimmedSupagoPassword) nextErrors.supago_password = 'Required when connecting Supago'
        if (!trimmedTransactionCode) nextErrors.supago_transaction_code = 'Required when connecting Supago'
        setFieldErrors(nextErrors)
        setError('Supago username, password, and transaction code are all required to connect')
        return
      }
    }

    if (panelType === 'crici') {
      if (!trimmedCriciUsername || !trimmedCriciPassword) {
        const nextErrors: Record<string, string> = {}
        if (!trimmedCriciUsername) nextErrors.crici_username = 'Required when connecting Crici'
        if (!trimmedCriciPassword) nextErrors.crici_password = 'Required when connecting Crici'
        setFieldErrors(nextErrors)
        setError('Crici username and password are required to connect')
        return
      }
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
          bank_admin_mode: bankAdminMode,
          admin_user_ids: bankAdminMode === 'SELECTED' ? bankAdminIds : [],
        },
      })
      if (panelType === 'supago') {
        await apiRequest(`/api/v1/merchants/${created.id}/supago`, {
          method: 'PATCH',
          token: accessToken,
          body: {
            supago_username: trimmedSupagoUsername,
            supago_password: trimmedSupagoPassword,
            supago_transaction_code: trimmedTransactionCode,
          },
        })
      }
      if (panelType === 'crici') {
        await apiRequest(`/api/v1/merchants/${created.id}/crici`, {
          method: 'PATCH',
          token: accessToken,
          body: {
            crici_username: trimmedCriciUsername,
            crici_password: trimmedCriciPassword,
          },
        })
      }
      toast.success('Merchant created')
      router.replace('/merchants')
    } catch (caught) {
      const next = formError(caught, 'Could not create')
      setError(next.banner)
      setFieldErrors(next.fields)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="Create merchant" role={user.role} menus={menus}>
      <PageHeader title="Create Merchant" backHref="/merchants" backLabel="Merchants" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      <FormShell
        wide
        compact
        submitLabel={submitting ? 'Creating…' : 'Create'}
        onSubmit={() => void handleSubmit()}
      >
        <FormSection title="Merchant">
          <FormGrid>
            <FormField label="Legal Name" required error={fieldErrors.legal_name}>
              <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
            </FormField>
            <FormField label="Display Name" error={fieldErrors.display_name}>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </FormField>
            <FormField label="Merchant Code" required error={fieldErrors.merchant_code}>
              <Input value={code} onChange={(event) => setCode(event.target.value)} />
            </FormField>
            <FormField label="Contact Email" error={fieldErrors.contact_email}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
            <FormField label="Contact Mobile" error={fieldErrors.contact_mobile}>
              <Input type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} />
            </FormField>
            <FormField label="PAY-IN Rate">
              <RateInput id="m-payin" valueBp={payinBp} onChangeBp={setPayinBp} />
            </FormField>
            <FormField label="PAY-OUT Rate">
              <RateInput id="m-payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
            </FormField>
          </FormGrid>
        </FormSection>

        {isSuperAdmin ? (
          <BankAdminsFormSection
            compact
            mode={bankAdminMode}
            selectedIds={bankAdminIds}
            admins={activeAdmins}
            onModeChange={setBankAdminMode}
            onToggleAdmin={handleToggleAdmin}
            disabled={submitting}
          />
        ) : null}

        <FormSection
          title="Panel integration"
          description="Optional. One panel per merchant — pick Supago or Crici to connect on create."
        >
          <FormGrid>
            <FormField label="Integration">
              <Select
                id="create-panel-integration"
                value={panelType}
                onChange={(event) => handlePanelTypeChange(event.target.value as PanelIntegrationType)}
                aria-label="Panel integration type"
                disabled={submitting}
              >
                <option value="none">None</option>
                <option value="supago">Supago</option>
                <option value="crici">Crici</option>
              </Select>
            </FormField>
          </FormGrid>

          {panelType === 'supago' ? (
            <div className="mt-4">
              <FormGrid>
                <FormField label="Supago Username" required error={fieldErrors.supago_username}>
                  <Input
                    value={supagoUsername}
                    onChange={(event) => setSupagoUsername(event.target.value)}
                    placeholder="Supago username"
                    aria-label="Supago username"
                  />
                </FormField>
                <FormField label="Supago Password" required error={fieldErrors.supago_password}>
                  <Input
                    type="password"
                    value={supagoPassword}
                    onChange={(event) => setSupagoPassword(event.target.value)}
                    placeholder="Supago password"
                    aria-label="Supago password"
                  />
                </FormField>
                <FormField label="Transaction Code" required error={fieldErrors.supago_transaction_code}>
                  <Input
                    value={supagoTransactionCode}
                    onChange={(event) => setSupagoTransactionCode(event.target.value)}
                    placeholder="e.g. 643795"
                    aria-label="Supago transaction code"
                  />
                </FormField>
              </FormGrid>
            </div>
          ) : null}

          {panelType === 'crici' ? (
            <div className="mt-4">
              <FormGrid>
                <FormField label="Crici Username" required error={fieldErrors.crici_username}>
                  <Input
                    value={criciUsername}
                    onChange={(event) => setCriciUsername(event.target.value)}
                    placeholder="Crici username"
                    aria-label="Crici username"
                    autoComplete="off"
                  />
                </FormField>
                <FormField label="Crici Password" required error={fieldErrors.crici_password}>
                  <Input
                    type="password"
                    value={criciPassword}
                    onChange={(event) => setCriciPassword(event.target.value)}
                    placeholder="Crici password"
                    aria-label="Crici password"
                    autoComplete="new-password"
                  />
                </FormField>
              </FormGrid>
              <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                Password is write-only after connect.
              </p>
            </div>
          ) : null}
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
