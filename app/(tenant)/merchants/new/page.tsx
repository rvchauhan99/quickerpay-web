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
import { RateInput } from '@/components/forms/RateInput'
import { BankAdminsFormSection } from '@/components/forms/BankAdminsFormSection'
import { toast } from 'sonner'
import { apiRequest, formError } from '@/lib/api'
import { useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

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
  const [supagoUsername, setSupagoUsername] = useState('')
  const [supagoPassword, setSupagoPassword] = useState('')
  const [supagoTransactionCode, setSupagoTransactionCode] = useState('')
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

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})

    if (bankAdminMode === 'SELECTED' && bankAdminIds.length === 0) {
      setFieldErrors({ admin_user_ids: 'Select at least one Admin, or choose All Admins.' })
      setError('Select at least one Admin, or choose All Admins.')
      return
    }

    const trimmedUsername = supagoUsername.trim()
    const trimmedPassword = supagoPassword.trim()
    const trimmedTransactionCode = supagoTransactionCode.trim()
    const hasAnySupago =
      trimmedUsername.length > 0 || trimmedPassword.length > 0 || trimmedTransactionCode.length > 0
    const wantsSupagoConnect =
      trimmedUsername.length > 0 && trimmedPassword.length > 0 && trimmedTransactionCode.length > 0

    if (hasAnySupago && !wantsSupagoConnect) {
      const nextErrors: Record<string, string> = {}
      if (!trimmedUsername) nextErrors.supago_username = 'Required when connecting Supago'
      if (!trimmedPassword) nextErrors.supago_password = 'Required when connecting Supago'
      if (!trimmedTransactionCode) nextErrors.supago_transaction_code = 'Required when connecting Supago'
      setFieldErrors(nextErrors)
      setError('Supago username, password, and transaction code are all required to connect')
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
          bank_admin_mode: bankAdminMode,
          admin_user_ids: bankAdminMode === 'SELECTED' ? bankAdminIds : [],
        },
      })
      if (wantsSupagoConnect) {
        await apiRequest(`/api/v1/merchants/${created.id}/supago`, {
          method: 'PATCH',
          token: accessToken,
          body: {
            supago_username: trimmedUsername,
            supago_password: trimmedPassword,
            supago_transaction_code: trimmedTransactionCode,
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
      <PageHeader title="Create Merchant" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      <FormShell submitLabel={submitting ? 'Creating…' : 'Create'} onSubmit={() => void handleSubmit()}>
        <FormSection title="Merchant Information" description="Legal and contact details.">
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

        {isSuperAdmin ? (
          <BankAdminsFormSection
            mode={bankAdminMode}
            selectedIds={bankAdminIds}
            admins={activeAdmins}
            onModeChange={setBankAdminMode}
            onToggleAdmin={handleToggleAdmin}
            disabled={submitting}
          />
        ) : null}

        <FormSection title="Supago Integration" description="Optional. Connect to the Supago platform at creation time. Leave blank to skip and connect later from the merchant detail page. If connecting, username, password, and transaction code are all required.">
          <FormGrid>
            <FormField label="Supago Username" error={fieldErrors.supago_username}>
              <Input
                value={supagoUsername}
                onChange={(event) => setSupagoUsername(event.target.value)}
                placeholder="Supago username (optional)"
                aria-label="Supago username"
              />
            </FormField>
            <FormField label="Supago Password" error={fieldErrors.supago_password}>
              <Input
                type="password"
                value={supagoPassword}
                onChange={(event) => setSupagoPassword(event.target.value)}
                placeholder="Supago password (optional)"
                aria-label="Supago password"
              />
            </FormField>
            <FormField label="Transaction Code" error={fieldErrors.supago_transaction_code}>
              <Input
                value={supagoTransactionCode}
                onChange={(event) => setSupagoTransactionCode(event.target.value)}
                placeholder="e.g. 643795"
                aria-label="Supago transaction code"
              />
            </FormField>
          </FormGrid>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
