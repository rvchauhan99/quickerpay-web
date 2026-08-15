'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MENU_CODES, PHASE_1_ADMIN_MENUS } from '@quickerpay/shared-types'
import type { MerchantListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { RateInput } from '@/components/forms/RateInput'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function NewUserPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | 'AUDITOR'>('ADMIN')
  const [payinBp, setPayinBp] = useState(350)
  const [payoutBp, setPayoutBp] = useState(150)
  const [merchantId, setMerchantId] = useState('')
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [selected, setSelected] = useState<string[]>([...PHASE_1_ADMIN_MENUS])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!accessToken || user?.role !== 'SUPER_ADMIN') return
    void apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken })
      .then((result) => setMerchants(result.items.filter((row) => row.status === 'ACTIVE')))
      .catch(() => undefined)
  }, [accessToken, user?.role])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSubmit = async () => {
    if (!accessToken) return
    setError(null)
    setFieldErrors({})
    try {
      await apiRequest('/api/v1/users', {
        method: 'POST',
        token: accessToken,
        body: {
          username,
          display_name: displayName || username,
          temporary_password: password,
          require_password_change: true,
          role,
          merchant_id: role === 'ADMIN' ? merchantId : undefined,
          rates:
            role === 'ADMIN'
              ? [
                  { rate_kind: 'PAYIN', rate_bp: payinBp },
                  { rate_kind: 'PAYOUT', rate_bp: payoutBp },
                ]
              : undefined,
          menus: selected.map((code) => ({
            menu_code: code,
            can_view: true,
            can_create: code === 'PAYIN' || code === 'PAYOUT' || code === 'UTR' || code === 'BANKS' || code === 'USERS',
            can_edit: code === 'PAYIN' || code === 'PAYOUT' || code === 'UTR' || code === 'BANKS',
            can_approve: code === 'PAYIN',
            can_export: false,
          })),
        },
      })
      router.replace('/users')
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setFieldErrors(caught.fieldErrors())
        setError(caught.displayMessage())
        return
      }
      setError('Could not create')
    }
  }

  return (
    <AppShell title="Create user" role={user.role} menus={menus}>
      <FormShell submitLabel="Create" error={error} onSubmit={() => void handleSubmit()}>
        <FormSection title="Account Information" description="Set up the user's basic login credentials.">
          <FormGrid>
            <FormField label="Username" required error={fieldErrors.username}>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} />
            </FormField>
            <FormField label="Display name" required error={fieldErrors.display_name}>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </FormField>
            <div className="md:col-span-2">
              <FormField
                label="Temporary password"
                required
                hint="At least 12 characters"
                error={fieldErrors.temporary_password}
              >
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </FormField>
            </div>
          </FormGrid>
        </FormSection>

        <FormSection title="Role & Rates" description="Assign the user's operational role and corresponding rates.">
          <FormGrid>
            <div className="md:col-span-2">
              <FormField label="Role" required>
                <Select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="AUDITOR">AUDITOR</option>
                </Select>
              </FormField>
            </div>
            {role === 'ADMIN' ? (
              <>
                <FormField label="Merchant" required error={fieldErrors.merchant_id}>
                  <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} aria-label="Merchant">
                    <option value="">Select merchant</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.merchant_code} — {merchant.display_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="PAYIN rate (bp)" error={fieldErrors.rates ?? fieldErrors['rates.0.rate_bp']}>
                  <RateInput id="payin" valueBp={payinBp} onChangeBp={setPayinBp} />
                </FormField>
                <FormField label="PAYOUT rate (bp)" error={fieldErrors['rates.1.rate_bp']}>
                  <RateInput id="payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
                </FormField>
              </>
            ) : null}
          </FormGrid>
        </FormSection>

        <FormSection title="Permissions" description="Select the operational menus this user can access.">
          <div className="rounded-lg border bg-white p-4" style={{ borderColor: 'var(--qp-border)' }}>
            <div className="flex flex-wrap gap-4">
              {MENU_CODES.map((code) => (
                <label key={code} className="flex cursor-pointer items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80" style={{ color: 'var(--qp-text-primary)' }}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-[var(--qp-primary)] transition duration-150 ease-in-out focus:ring-[var(--qp-primary-light)]"
                    checked={selected.includes(code)}
                    onChange={(event) =>
                      setSelected(event.target.checked ? [...selected, code] : selected.filter((item) => item !== code))
                    }
                  />
                  {code.replaceAll('_', ' ')}
                </label>
              ))}
            </div>
            {fieldErrors.menus ? (
              <p className="mt-3 text-[11px] font-medium" style={{ color: 'var(--qp-danger)' }}>{fieldErrors.menus}</p>
            ) : null}
          </div>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
