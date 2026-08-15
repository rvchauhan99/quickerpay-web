'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { PayinListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function PayinDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYIN')
  const [row, setRow] = useState<PayinListItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      setRow(await apiRequest<PayinListItem>(`/api/v1/payin/${params.id}`, { token: accessToken }))
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
    <AppShell title="Pay-In" role={user.role} menus={menus}>
      <p className="mb-2 text-xs">
        <Link className="underline" href="/payin">
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
          <dt>Status</dt>
          <dd>
            <StatusBadge status={row.status} />
          </dd>
          <dt>Created</dt>
          <dd>{new Date(row.created_at).toLocaleString()}</dd>
        </dl>
      )}
    </AppShell>
  )
}
