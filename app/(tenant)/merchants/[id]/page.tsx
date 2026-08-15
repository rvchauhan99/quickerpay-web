'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { MerchantDetail, MerchantRate } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { RateInput } from '@/components/forms/RateInput'
import { DataTable, EmptyState, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
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
    <AppShell title="Merchant" role={user.role} menus={menus}>
      <p className="mb-2 text-xs">
        <Link className="underline" href="/merchants">
          Back to list
        </Link>
      </p>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading || !merchant ? (
        <TableSkeleton />
      ) : (
        <>
          <p className="text-sm font-medium">
            {merchant.legal_name} <StatusBadge status={merchant.status} />
          </p>
          <p className="mb-3 text-xs text-zinc-600">
            {merchant.merchant_code} · {merchant.contact_email ?? 'no email'}
          </p>
          {hasMenu(menus, 'MERCHANTS', 'can_edit') ? (
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <RateInput id="edit-payin" label="PAY-IN" valueBp={payinBp} onChangeBp={setPayinBp} />
              <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => void handleSaveKind('PAYIN')}>
                Change PAYIN rate
              </button>
              <RateInput id="edit-payout" label="PAY-OUT" valueBp={payoutBp} onChangeBp={setPayoutBp} />
              <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => void handleSaveKind('PAYOUT')}>
                Change PAYOUT rate
              </button>
            </div>
          ) : null}
          <p className="mb-1 text-[10px] uppercase text-zinc-500">Rate history</p>
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
        </>
      )}
    </AppShell>
  )
}
