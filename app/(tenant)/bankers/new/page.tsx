'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { menusForRole, PHASE_1_BANKER_MENUS, preferredGrantForMenu } from '@quickerpay/shared-types'
import type { MenuCode } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { RateInput } from '@/components/forms/RateInput'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { PhoneInput, splitE164 } from '@/components/forms/PhoneInput'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiRequest, ApiClientError } from '@/lib/api'
import { bankerLabel } from '@/lib/labels'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function NewBankerPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [payinBp, setPayinBp] = useState(350)
  const [payoutBp, setPayoutBp] = useState(150)
  const [dailyDepositLimitMinor, setDailyDepositLimitMinor] = useState(0)
  const [minDepositMinor, setMinDepositMinor] = useState(0)
  const [maxDepositMinor, setMaxDepositMinor] = useState(0)
  const [minWithdrawalMinor, setMinWithdrawalMinor] = useState(0)
  const [maxWithdrawalMinor, setMaxWithdrawalMinor] = useState(0)
  const offerableMenus = menusForRole('BANKER')
  const [selected, setSelected] = useState<MenuCode[]>(
    PHASE_1_BANKER_MENUS.filter((code) => offerableMenus.includes(code)),
  )
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!ready || !user) return <p className="p-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>Loading</p>
  if (!allowed) return Forbidden
  if (user.role !== 'SUPER_ADMIN') return <ForbiddenPage permission="Banker Master (Super Admin only)" />
  if (!menus.some((grant) => grant.menu_code === 'USERS' && grant.can_create)) {
    return <ForbiddenPage permission="USERS.can_create" />
  }

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})

    const nextErrors: Record<string, string> = {}
    const national = splitE164(mobile).national
    if (!national) nextErrors.mobile = `Required when creating a ${bankerLabel()}`
    if (!dailyDepositLimitMinor || dailyDepositLimitMinor <= 0) {
      nextErrors.daily_deposit_limit_minor = `Required when creating a ${bankerLabel()}`
    }
    if (!minDepositMinor || minDepositMinor <= 0) {
      nextErrors.min_deposit_minor = `Required when creating a ${bankerLabel()}`
    }
    if (!maxDepositMinor || maxDepositMinor <= 0) {
      nextErrors.max_deposit_minor = `Required when creating a ${bankerLabel()}`
    } else if (minDepositMinor > 0 && maxDepositMinor < minDepositMinor) {
      nextErrors.max_deposit_minor = 'Must be greater than or equal to min deposit'
    }
    if (!minWithdrawalMinor || minWithdrawalMinor <= 0) {
      nextErrors.min_withdrawal_minor = `Required when creating a ${bankerLabel()}`
    }
    if (!maxWithdrawalMinor || maxWithdrawalMinor <= 0) {
      nextErrors.max_withdrawal_minor = `Required when creating a ${bankerLabel()}`
    } else if (minWithdrawalMinor > 0 && maxWithdrawalMinor < minWithdrawalMinor) {
      nextErrors.max_withdrawal_minor = 'Must be greater than or equal to min withdrawal'
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setError(`Contact number, daily deposit limit, and per-transaction limits are required for a ${bankerLabel()}`)
      return
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
          role: 'BANKER',
          mobile: mobile.trim(),
          daily_deposit_limit_minor: dailyDepositLimitMinor,
          min_deposit_minor: minDepositMinor,
          max_deposit_minor: maxDepositMinor,
          min_withdrawal_minor: minWithdrawalMinor,
          max_withdrawal_minor: maxWithdrawalMinor,
          rates: [
            { rate_kind: 'PAYIN', rate_bp: payinBp },
            { rate_kind: 'PAYOUT', rate_bp: payoutBp },
          ],
          menus: selected.map((code) => ({
            menu_code: code,
            ...preferredGrantForMenu('BANKER', code),
          })),
        },
      })
      router.replace('/bankers')
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
    <AppShell title="Create Banker" role={user.role} menus={menus}>
      <FormShell
        title={`Create ${bankerLabel()}`}
        wide
        compact
        submitLabel={submitting ? 'Creating…' : 'Create'}
        error={error}
        onSubmit={() => void handleSubmit()}
        onCancel={() => router.back()}
      >
        <FormSection title="Account">
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
              required
              error={fieldErrors.mobile}
              hint="Used for bank OTP."
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
            <FormField label="Role">
              <Input value={bankerLabel()} disabled aria-label="Role" />
            </FormField>
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
            <FormField
              label="Min deposit (per txn)"
              required
              error={fieldErrors.min_deposit_minor}
              hint="Gateway Pay-In: Banker instruments only for amounts ≥ this"
            >
              <MoneyInput
                id="min-deposit"
                valueMinor={minDepositMinor}
                onChangeMinor={setMinDepositMinor}
              />
            </FormField>
            <FormField
              label="Max deposit (per txn)"
              required
              error={fieldErrors.max_deposit_minor}
              hint="Gateway Pay-In: Banker instruments only for amounts ≤ this"
            >
              <MoneyInput
                id="max-deposit"
                valueMinor={maxDepositMinor}
                onChangeMinor={setMaxDepositMinor}
              />
            </FormField>
            <FormField
              label="Min withdrawal (per txn)"
              required
              error={fieldErrors.min_withdrawal_minor}
              hint="Gateway Pay-Out: default Banker only when amount ≥ this"
            >
              <MoneyInput
                id="min-withdrawal"
                valueMinor={minWithdrawalMinor}
                onChangeMinor={setMinWithdrawalMinor}
              />
            </FormField>
            <FormField
              label="Max withdrawal (per txn)"
              required
              error={fieldErrors.max_withdrawal_minor}
              hint="Gateway Pay-Out: out of range → Super Admin queue"
            >
              <MoneyInput
                id="max-withdrawal"
                valueMinor={maxWithdrawalMinor}
                onChangeMinor={setMaxWithdrawalMinor}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Menus" description="Menus follow the Banker role ceiling.">
          <div className="flex flex-wrap gap-2">
            {offerableMenus.map((code) => {
              const on = selected.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  data-on={on ? 'true' : 'false'}
                  className="qp-menu-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
                  style={{
                    backgroundColor: on ? 'var(--qp-primary)' : 'var(--qp-card)',
                    color: on ? '#ffffff' : 'var(--qp-text-secondary)',
                    border: `1px solid ${on ? 'var(--qp-primary)' : 'var(--qp-border)'}`,
                    boxShadow: on ? '0 1px 3px 0 rgba(37, 99, 235, 0.2)' : 'none',
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
