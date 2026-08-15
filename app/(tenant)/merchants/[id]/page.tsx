'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { MerchantDetail, MerchantRate } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { RateInput } from '@/components/forms/RateInput'
import { DataTable, EmptyState, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { apiRequest, ApiClientError } from '@/lib/api'
import { RateDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function MerchantDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('MERCHANTS')
  const [merchant, setMerchant] = useState<MerchantDetail | null>(null)
  const [history, setHistory] = useState<MerchantRate[]>([])
  const [payinBp, setPayinBp] = useState(0)
  const [payoutBp, setPayoutBp] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    setLoading(true)
    setError(null)
    try {
      const detail = await apiRequest<MerchantDetail>(`/api/v1/merchants/${params.id}`, { token: accessToken })
      const rates = await apiRequest<MerchantRate[]>(`/api/v1/merchants/${params.id}/rates`, { token: accessToken })
      setMerchant(detail)
      setHistory(rates)
      setPayinBp(detail.rates.find((row) => row.rate_kind === 'PAYIN')?.rate_bp ?? 0)
      setPayoutBp(detail.rates.find((row) => row.rate_kind === 'PAYOUT')?.rate_bp ?? 0)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [accessToken, params.id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSaveKind = async (kind: 'PAYIN' | 'PAYOUT') => {
    if (!accessToken || !params.id) return
    setError(null)
    try {
      await apiRequest(`/api/v1/merchants/${params.id}/rates`, {
        method: 'POST',
        token: accessToken,
        body: { rate_kind: kind, rate_bp: kind === 'PAYIN' ? payinBp : payoutBp },
      })
      await load()
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Save failed')
    }
  }

  return (
    <AppShell title="Merchant Detail" role={user.role} menus={menus}>
      <PageHeader title="Merchant Detail" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading || !merchant ? (
        <TableSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <FormShell>
            <FormSection title="Merchant Information" description="Legal name and status of the merchant.">
              <FormGrid>
                <FormField label="Legal Name">
                  <Input value={merchant.legal_name} readOnly />
                </FormField>
                <FormField label="Merchant Code">
                  <Input value={merchant.merchant_code} readOnly />
                </FormField>
                <FormField label="Status">
                  <div className="flex h-10 items-center px-3">
                    <StatusBadge status={merchant.status} />
                  </div>
                </FormField>
                <FormField label="Contact Email">
                  <Input value={merchant.contact_email ?? 'N/A'} readOnly />
                </FormField>
              </FormGrid>
            </FormSection>

            {hasMenu(menus, 'MERCHANTS', 'can_edit') ? (
              <FormSection title="Manage Rates" description="Update PAY-IN and PAY-OUT commission rates.">
                <FormGrid>
                  <FormField label="PAY-IN Rate">
                    <div className="flex items-center gap-2">
                      <RateInput id="edit-payin" valueBp={payinBp} onChangeBp={setPayinBp} />
                      <PrimaryButton onClick={() => void handleSaveKind('PAYIN')}>Update</PrimaryButton>
                    </div>
                  </FormField>
                  <FormField label="PAY-OUT Rate">
                    <div className="flex items-center gap-2">
                      <RateInput id="edit-payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
                      <PrimaryButton onClick={() => void handleSaveKind('PAYOUT')}>Update</PrimaryButton>
                    </div>
                  </FormField>
                </FormGrid>
              </FormSection>
            ) : null}
          </FormShell>

          <FormShell>
            <FormSection title="Rate History" description="Historical log of rate changes.">
              <DataTable
                columns={[
                  { key: 'kind', heading: 'KIND' },
                  { key: 'rate', heading: 'RATE' },
                  { key: 'from', heading: 'EFFECTIVE FROM' },
                ]}
                rows={history.map((row) => ({
                  kind: row.rate_kind,
                  rate: <RateDisplay rateBp={row.rate_bp} />,
                  from: new Date(row.effective_from).toLocaleString(),
                }))}
                empty={<EmptyState message="No rate history" />}
              />
            </FormSection>
          </FormShell>
        </div>
      )}
    </AppShell>
  )
}
