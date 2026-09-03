'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { MerchantListItem, UserDetail } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { PhoneInput, splitE164 } from '@/components/forms/PhoneInput'
import { apiListRequest, apiRequest, ApiClientError, formError } from '@/lib/api'
import { MoneyDisplay, RateDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [merchantId, setMerchantId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [dailyDepositLimitMinor, setDailyDepositLimitMinor] = useState(0)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState<'ACTIVE' | 'DISABLED' | null>(null)
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  const canEdit = hasMenu(menus, 'USERS', 'can_edit')
  const canEditDepositLimit = user?.role === 'SUPER_ADMIN'

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      const next = await apiRequest<UserDetail>(`/api/v1/users/${params.id}`, { token: accessToken })
      setDetail(next)
      setMerchantId(next.merchant_id ?? '')
      setDisplayName(next.display_name)
      setEmail(next.email ?? '')
      setMobile(next.mobile ?? '')
      setDailyDepositLimitMinor(next.daily_deposit_limit_minor ?? 0)
      setError(null)
      setFieldErrors({})
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    }
  }, [accessToken, params.id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  useEffect(() => {
    if (!accessToken || user?.role !== 'SUPER_ADMIN') return
    void apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken })
      .then((result) => setMerchants(result.items.filter((row) => row.status === 'ACTIVE')))
      .catch(() => undefined)
  }, [accessToken, user?.role])

  const handleSaveIdentity = async () => {
    if (!accessToken || !params.id || !canEdit || savingIdentity) return
    setSavingIdentity(true)
    setError(null)
    setFieldErrors({})

    if (detail?.role === 'ADMIN' && !splitE164(mobile).national) {
      setFieldErrors({ mobile: 'An Admin must keep a mobile number with country code' })
      setError('Mobile is required for an Admin')
      setSavingIdentity(false)
      return
    }

    try {
      const next = await apiRequest<UserDetail>(`/api/v1/users/${params.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          display_name: displayName,
          email: email.trim() ? email.trim() : null,
          mobile: splitE164(mobile).national ? mobile.trim() : null,
          ...(canEditDepositLimit && detail?.role === 'ADMIN'
            ? { daily_deposit_limit_minor: dailyDepositLimitMinor }
            : {}),
        },
      })
      setDetail(next)
      setDailyDepositLimitMinor(next.daily_deposit_limit_minor ?? 0)
      toast.success('User updated')
    } catch (caught) {
      const next = formError(caught, 'Could not update user')
      setError(next.banner)
      setFieldErrors(next.fields)
    } finally {
      setSavingIdentity(false)
    }
  }

  const handleSaveMerchantBind = async () => {
    if (!accessToken || !params.id) return
    try {
      setDetail(await apiRequest<UserDetail>(`/api/v1/users/${params.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { merchant_id: merchantId || null },
      }))
      toast.success(merchantId ? 'Merchant bind saved' : 'Merchant bind cleared')
    } catch (caught) {
      const next = formError(caught, 'Could not update merchant bind')
      setError(next.banner)
      setFieldErrors(next.fields)
    }
  }

  const handleConfirmStatus = async () => {
    if (!accessToken || !params.id || !statusConfirm || statusSubmitting) return
    setStatusSubmitting(true)
    try {
      const next = await apiRequest<UserDetail>(`/api/v1/users/${params.id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { status: statusConfirm },
      })
      setDetail(next)
      setDisplayName(next.display_name)
      setEmail(next.email ?? '')
      setMobile(next.mobile ?? '')
      toast.success(statusConfirm === 'DISABLED' ? 'User deactivated' : 'User activated')
      setStatusConfirm(null)
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not change status')
    } finally {
      setStatusSubmitting(false)
    }
  }

  if (!ready || !user) return <p className="p-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>Loading</p>
  if (!allowed) return Forbidden

  const statusActions = canEdit && detail ? (
    <span className="flex items-center gap-2">
      {detail.status === 'ACTIVE' ? (
        <PrimaryButton onClick={() => setStatusConfirm('DISABLED')}>Deactivate</PrimaryButton>
      ) : null}
      {detail.status === 'DISABLED' ? (
        <PrimaryButton onClick={() => setStatusConfirm('ACTIVE')}>Activate</PrimaryButton>
      ) : null}
    </span>
  ) : null

  return (
    <AppShell title="User Detail" role={user.role} menus={menus}>
      <PageHeader
        title={detail ? `${detail.display_name}` : 'User Detail'}
        {...(detail ? { subtitle: `@${detail.username} · ${detail.role.replaceAll('_', ' ')}` } : {})}
        backHref="/users"
        backLabel="Users"
        action={statusActions}
      />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {!detail ? (
        <TableSkeleton />
      ) : (
        <FormShell
          wide
          compact
          submitLabel={canEdit ? 'Save' : undefined}
          loading={savingIdentity}
          onSubmit={canEdit ? () => void handleSaveIdentity() : undefined}
          onCancel={canEdit ? () => {
            setDisplayName(detail.display_name)
            setEmail(detail.email ?? '')
            setMobile(detail.mobile ?? '')
            setDailyDepositLimitMinor(detail.daily_deposit_limit_minor ?? 0)
            setFieldErrors({})
            setError(null)
          } : undefined}
        >
          <FormSection title="Account">
            <FormGrid>
              <FormField label="Username">
                <Input value={detail.username} readOnly />
              </FormField>
              <FormField label="Display name" required={canEdit} error={fieldErrors.display_name}>
                <Input
                  value={displayName}
                  readOnly={!canEdit}
                  aria-label="Display name"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </FormField>
              <FormField label="Email" error={fieldErrors.email}>
                <Input
                  type="email"
                  value={email}
                  readOnly={!canEdit}
                  aria-label="Email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>
              <FormField
                label="Mobile"
                required={detail.role === 'ADMIN'}
                error={fieldErrors.mobile}
                hint="Used for bank OTP."
              >
                <PhoneInput
                  value={mobile}
                  readOnly={!canEdit}
                  aria-label="Mobile"
                  onChange={setMobile}
                />
              </FormField>
              {detail.role === 'ADMIN' ? (
                <FormField
                  label="Daily deposit limit"
                  required={canEditDepositLimit}
                  error={fieldErrors.daily_deposit_limit_minor}
                  hint="IST day COMPLETED Pay-In cap."
                >
                  {canEditDepositLimit ? (
                    <MoneyInput
                      id="user-daily-deposit-limit"
                      valueMinor={dailyDepositLimitMinor}
                      onChangeMinor={setDailyDepositLimitMinor}
                      aria-label="Daily deposit limit"
                    />
                  ) : (
                    <div className="flex h-9 items-center rounded-lg px-3 text-sm font-medium" style={{ backgroundColor: 'var(--qp-primary-light)', color: 'var(--qp-primary-dark)' }}>
                      {typeof detail.daily_deposit_limit_minor === 'number' ? (
                        <MoneyDisplay amountMinor={detail.daily_deposit_limit_minor} />
                      ) : (
                        '—'
                      )}
                    </div>
                  )}
                </FormField>
              ) : null}
              {user.role === 'SUPER_ADMIN' && detail.role === 'ADMIN' ? (
                <FormField
                  label="Legacy merchant bind"
                  error={fieldErrors.merchant_id}
                  hint="Optional; Pay-In/Out pick merchant per request."
                >
                  <div className="flex gap-2">
                    <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} aria-label="Legacy merchant bind">
                      <option value="">None</option>
                      {merchants.map((merchant) => (
                        <option key={merchant.id} value={merchant.id}>
                          {merchant.merchant_code} — {merchant.display_name}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      className="inline-flex h-9 shrink-0 items-center rounded-lg px-4 text-sm font-semibold text-white transition-all duration-150"
                      style={{ backgroundColor: 'var(--qp-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--qp-primary-dark)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--qp-primary)' }}
                      onClick={() => void handleSaveMerchantBind()}
                    >Save</button>
                  </div>
                </FormField>
              ) : null}
            </FormGrid>

            <div
              className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--qp-border)', backgroundColor: '#f8fafc' }}
              aria-label="Account status"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>
                Status
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold"
                style={{ backgroundColor: 'var(--qp-primary-light)', color: 'var(--qp-primary-dark)' }}
              >
                {detail.role.replaceAll('_', ' ')}
              </span>
              <StatusBadge status={detail.status} />
              <StatusBadge status={detail.operational_state} />
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: detail.two_fa_enabled ? 'var(--qp-success-bg)' : '#fff',
                  color: detail.two_fa_enabled ? 'var(--qp-success)' : 'var(--qp-text-muted)',
                  border: `1px solid ${detail.two_fa_enabled ? 'var(--qp-success-border)' : 'var(--qp-border)'}`,
                }}
              >
                2FA {detail.two_fa_enabled ? 'on' : 'off'}
              </span>
            </div>
          </FormSection>

          <FormSection title="Permissions & rates">
            <FormGrid>
              <div className="col-span-full">
                <FormField label="Assigned Menus">
                  <div className="flex flex-wrap gap-1.5">
                    {detail.menus.filter((grant) => grant.can_view).length === 0 ? (
                      <span className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>None</span>
                    ) : (
                      detail.menus.filter((grant) => grant.can_view).map((grant) => (
                        <span
                          key={grant.menu_code}
                          className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                          style={{ backgroundColor: 'var(--qp-primary-light)', color: 'var(--qp-primary-dark)' }}
                        >
                          {grant.menu_code.replaceAll('_', ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </FormField>
              </div>
              <FormField label="Scope (Banks)">
                <div className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium" style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}>
                  {detail.scope?.bank_account_ids.length ?? 0} accounts
                </div>
              </FormField>
              <FormField label="Scope (UPI)">
                <div className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium" style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}>
                  {detail.scope?.upi_account_ids.length ?? 0} accounts
                </div>
              </FormField>
              {detail.rates.map((rate) => (
                <FormField key={rate.rate_kind} label={`${rate.rate_kind} rate`}>
                  <div className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold" style={{ backgroundColor: 'var(--qp-primary-light)', color: 'var(--qp-primary-dark)' }}>
                    <RateDisplay rateBp={rate.rate_bp} />
                  </div>
                </FormField>
              ))}
            </FormGrid>
          </FormSection>
        </FormShell>
      )}
      {statusConfirm && detail ? (
        <ConfirmDialog
          title={statusConfirm === 'DISABLED' ? `Deactivate ${detail.username}?` : `Activate ${detail.username}?`}
          subtitle={
            statusConfirm === 'DISABLED'
              ? 'Their sessions end, they are forced Offline, and every ACTIVE bank they own is disabled. They cannot go Online until you activate them again.'
              : 'They can sign in again. Banks stay disabled until enabled by hand, same as coming back Online after Offline.'
          }
          confirmLabel={statusConfirm === 'DISABLED' ? 'Deactivate' : 'Activate'}
          variant={statusConfirm === 'DISABLED' ? 'danger' : 'primary'}
          loading={statusSubmitting || savingIdentity}
          onCancel={() => setStatusConfirm(null)}
          onConfirm={() => void handleConfirmStatus()}
        />
      ) : null}
    </AppShell>
  )
}
