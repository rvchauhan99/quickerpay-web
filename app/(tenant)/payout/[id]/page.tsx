'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { PayoutListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function PayoutDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYOUT')
  const [row, setRow] = useState<PayoutListItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      setRow(await apiRequest<PayoutListItem>(`/api/v1/payout/${params.id}`, { token: accessToken }))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    }
  }, [accessToken, params.id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="Pay-Out" role={user.role} menus={menus}>
      <p className="mb-2 text-xs">
        <Link className="underline" href="/payout">
          Back to list
        </Link>
      </p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {!row ? (
        <TableSkeleton />
      ) : (
        <dl className="grid max-w-lg grid-cols-2 gap-1 text-xs">
          <dt>Gateway Ref. No</dt>
          <dd>{row.reference}</dd>
          <dt>UTR</dt>
          <dd>{row.utr ?? '—'}</dd>
          <dt>Amount</dt>
          <dd>
            <MoneyDisplay amountMinor={row.amount_minor} />
          </dd>
          <dt>Beneficiary</dt>
          <dd>
            {row.beneficiary_name} {row.beneficiary_account_masked}
          </dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={row.status} />
          </dd>
          <dt>Failure</dt>
          <dd>{row.failure_reason ?? '—'}</dd>
        </dl>
      )}
    </AppShell>
  )
}
