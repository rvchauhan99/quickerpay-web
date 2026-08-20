'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { MerchantListItem, UserDetail } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { apiListRequest, apiRequest, ApiClientError, formError } from '@/lib/api'
import { RateDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [merchantId, setMerchantId] = useState('')

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      const next = await apiRequest<UserDetail>(`/api/v1/users/${params.id}`, { token: accessToken })
      setDetail(next)
      setMerchantId(next.merchant_id ?? '')
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

  const handleBindMerchant = async () => {
    if (!accessToken || !params.id || !merchantId) return
    try {
      setDetail(await apiRequest<UserDetail>(`/api/v1/users/${params.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { merchant_id: merchantId },
      }))
    } catch (caught) {
      const next = formError(caught, 'Could not bind merchant')
      setError(next.banner)
      setFieldErrors(next.fields)
    }
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="User Detail" role={user.role} menus={menus}>
      <PageHeader title="User Detail" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {!detail ? (
        <TableSkeleton />
      ) : (
        <FormShell>
          <FormSection title="Account Information" description="Basic account details and current status.">
            <FormGrid>
              <FormField label="Username">
                <Input value={detail.username} readOnly />
              </FormField>
              <FormField label="Role">
                <Input value={detail.role} readOnly />
              </FormField>
              <FormField label="Status">
                <div className="flex h-10 items-center px-3">
                  <StatusBadge status={detail.status} />
                </div>
              </FormField>
              <FormField label="Operational State">
                <Input value={detail.operational_state} readOnly />
              </FormField>
              <FormField label="Two-Factor Auth">
                <Input value={detail.two_fa_enabled ? 'Enabled' : 'Disabled'} readOnly />
              </FormField>
              {user.role === 'SUPER_ADMIN' && detail.role === 'ADMIN' ? (
                <FormField label="Bound merchant" required error={fieldErrors.merchant_id}>
                  <div className="flex gap-2">
                    <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} aria-label="Bound merchant">
                      <option value="">Select merchant</option>
                      {merchants.map((merchant) => (
                        <option key={merchant.id} value={merchant.id}>
                          {merchant.merchant_code} — {merchant.display_name}
                        </option>
                      ))}
                    </Select>
                    <button type="button" className="underline" onClick={() => void handleBindMerchant()}>Save</button>
                  </div>
                </FormField>
              ) : null}
            </FormGrid>
          </FormSection>

          <FormSection title="Permissions & Scopes" description="Assigned menus and banking scopes.">
            <FormGrid>
              <div className="md:col-span-2">
                <FormField label="Assigned Menus">
                  <Input value={detail.menus.filter((grant) => grant.can_view).map((grant) => grant.menu_code).join(', ') || 'None'} readOnly />
                </FormField>
              </div>
              <FormField label="Scope (Banks)">
                <Input value={String(detail.scope?.bank_account_ids.length ?? 0)} readOnly />
              </FormField>
              <FormField label="Scope (UPI)">
                <Input value={String(detail.scope?.upi_account_ids.length ?? 0)} readOnly />
              </FormField>
            </FormGrid>
          </FormSection>

          {detail.rates.length > 0 && (
            <FormSection title="Assigned Rates" description="Commission rates assigned to this user.">
              <FormGrid>
                {detail.rates.map((rate) => (
                  <FormField key={rate.rate_kind} label={`${rate.rate_kind} Rate`}>
                    <div className="flex h-10 items-center px-3 text-sm font-medium">
                      <RateDisplay rateBp={rate.rate_bp} />
                    </div>
                  </FormField>
                ))}
              </FormGrid>
            </FormSection>
          )}
        </FormShell>
      )}
    </AppShell>
  )
}
