'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MENU_CODES, PHASE_1_ADMIN_MENUS } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { RateInput } from '@/components/forms/RateInput'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { apiRequest, ApiClientError } from '@/lib/api'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function NewUserPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | 'AUDITOR'>('ADMIN')
  const [payinBp, setPayinBp] = useState(350)
  const [payoutBp, setPayoutBp] = useState(150)
  const [dailyDepositLimitMinor, setDailyDepositLimitMinor] = useState(0)
  const [selected, setSelected] = useState<string[]>([...PHASE_1_ADMIN_MENUS])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})

    if (role === 'ADMIN') {
      const nextErrors: Record<string, string> = {}
      if (!mobile.trim()) nextErrors.mobile = 'Required when creating an Admin'
      if (!dailyDepositLimitMinor || dailyDepositLimitMinor <= 0) {
        nextErrors.daily_deposit_limit_minor = 'Required when creating an Admin'
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors)
        setError('Contact number and daily deposit limit are required for an Admin')
        return
      }
    }

    setSubmitting(true)
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
          mobile: mobile.trim() || undefined,
          daily_deposit_limit_minor: role === 'ADMIN' ? dailyDepositLimitMinor : undefined,
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
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="Create user" role={user.role} menus={menus}>
      <FormShell submitLabel={submitting ? 'Creating…' : 'Create'} error={error} onSubmit={() => void handleSubmit()}>
        <FormSection title="Account Information" description="Set up the user's basic login credentials.">
          <FormGrid>
            <FormField label="Username" required error={fieldErrors.username}>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} aria-label="Username" />
            </FormField>
            <FormField label="Display name" required error={fieldErrors.display_name}>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-label="Display name"
              />
            </FormField>
            <FormField
              label="Contact number"
              required={role === 'ADMIN'}
              error={fieldErrors.mobile}
              hint={role === 'ADMIN' ? 'Required for Admin' : 'Optional'}
            >
              <Input
                type="tel"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                aria-label="Contact number"
                placeholder="98XXXXXXXX"
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField
                label="Temporary password"
                required
                hint="6-20 chars, include uppercase + number + special character"
                error={fieldErrors.temporary_password}
              >
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-label="Temporary password"
                />
              </FormField>
            </div>
          </FormGrid>
        </FormSection>

        <FormSection title="Role & Rates" description="Assign the user's operational role and corresponding rates. Merchant is chosen per Pay-In / Pay-Out.">
          <FormGrid>
            <div className="md:col-span-2">
              <FormField label="Role" required>
                <Select value={role} onChange={(event) => setRole(event.target.value as typeof role)} aria-label="Role">
                  <option value="ADMIN">ADMIN</option>
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="AUDITOR">AUDITOR</option>
                </Select>
              </FormField>
            </div>
            {role === 'ADMIN' ? (
              <>
                <FormField label="PAYIN rate (bp)" error={fieldErrors.rates ?? fieldErrors['rates.0.rate_bp']}>
                  <RateInput id="payin" valueBp={payinBp} onChangeBp={setPayinBp} />
                </FormField>
                <FormField label="PAYOUT rate (bp)" error={fieldErrors['rates.1.rate_bp']}>
                  <RateInput id="payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
                </FormField>
                <FormField
                  label="Daily deposit limit"
                  required
                  error={fieldErrors.daily_deposit_limit_minor}
                  hint="Maximum COMPLETED Pay-In volume per IST day for this Admin"
                >
                  <MoneyInput
                    id="daily-deposit-limit"
                    valueMinor={dailyDepositLimitMinor}
                    onChangeMinor={setDailyDepositLimitMinor}
                  />
                </FormField>
              </>
            ) : null}
          </FormGrid>
        </FormSection>

        <FormSection title="Menus" description="Menus this user can open.">
          <div className="flex flex-wrap gap-2">
            {MENU_CODES.map((code) => {
              const on = selected.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  className={`rounded px-2 py-1 text-xs ${on ? 'bg-zinc-900 text-white' : 'bg-zinc-100'}`}
                  onClick={() =>
                    setSelected((prev) => (on ? prev.filter((row) => row !== code) : [...prev, code]))
                  }
                >
                  {code}
                </button>
              )
            })}
          </div>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
