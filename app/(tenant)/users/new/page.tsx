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
import { PhoneInput, splitE164 } from '@/components/forms/PhoneInput'
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

  if (!ready || !user) return <p className="p-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>Loading</p>
  if (!allowed) return Forbidden

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})

    if (role === 'ADMIN') {
      const nextErrors: Record<string, string> = {}
      const national = splitE164(mobile).national
      if (!national) nextErrors.mobile = 'Required when creating an Admin'
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
          mobile: splitE164(mobile).national ? mobile.trim() : undefined,
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
      <FormShell
        title="Create User"
        wide
        compact
        submitLabel={submitting ? 'Creating…' : 'Create'}
        error={error}
        onSubmit={() => void handleSubmit()}
        onCancel={() => router.back()}
      >
        <FormSection title="Account & Role">
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
              hint={role === 'ADMIN' ? 'Used for bank OTP.' : 'Optional.'}
            >
              <PhoneInput
                value={mobile}
                onChange={setMobile}
                aria-label="Contact number"
              />
            </FormField>
            <FormField
              label="Temporary password"
              required
              hint="6-20 chars, uppercase + number + special"
              error={fieldErrors.temporary_password}
            >
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-label="Temporary password"
              />
            </FormField>
            <FormField label="Role" required>
              <Select value={role} onChange={(event) => setRole(event.target.value as typeof role)} aria-label="Role">
                <option value="ADMIN">ADMIN</option>
                <option value="OPERATOR">OPERATOR</option>
                <option value="AUDITOR">AUDITOR</option>
              </Select>
            </FormField>
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
                  hint="Max COMPLETED Pay-In volume per IST day"
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

        <FormSection title="Menus">
          <div className="flex flex-wrap gap-2">
            {MENU_CODES.map((code) => {
              const on = selected.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
                  style={{
                    backgroundColor: on ? 'var(--qp-primary)' : '#fff',
                    color: on ? '#ffffff' : 'var(--qp-text-secondary)',
                    border: `1px solid ${on ? 'var(--qp-primary)' : 'var(--qp-border)'}`,
                    boxShadow: on ? '0 1px 3px 0 rgba(37, 99, 235, 0.2)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!on) {
                      e.currentTarget.style.borderColor = 'var(--qp-primary)'
                      e.currentTarget.style.color = 'var(--qp-primary-dark)'
                      e.currentTarget.style.backgroundColor = 'var(--qp-primary-light)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!on) {
                      e.currentTarget.style.borderColor = 'var(--qp-border)'
                      e.currentTarget.style.color = 'var(--qp-text-secondary)'
                      e.currentTarget.style.backgroundColor = '#fff'
                    }
                  }}
                  onClick={() =>
                    setSelected((prev) => (on ? prev.filter((row) => row !== code) : [...prev, code]))
                  }
                >
                  {on ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : null}
                  {code.replaceAll('_', ' ')}
                </button>
              )
            })}
          </div>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
