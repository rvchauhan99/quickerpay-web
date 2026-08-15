'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { TransactionDetail } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay, RateDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('TRANSACTIONS')
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !allowed) return
    void apiRequest<TransactionDetail>(`/api/v1/transactions/${params.id}`, { token: accessToken })
      .then(setDetail)
      .catch((caught) => setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Not found'))
  }, [accessToken, allowed, params.id])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title={detail ? `Transaction ${detail.reference}` : 'Transaction'} role={user.role} menus={menus}>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {!detail && !error ? <TableSkeleton /> : null}
      {detail ? (
        <div className="space-y-3">
          <p className="text-xs">
            {detail.type} <StatusBadge status={detail.status} /> <MoneyDisplay amountMinor={detail.amount_minor} /> UTR {detail.utr ?? '—'}
          </p>
          <section>
            <h2 className="mb-1 text-[10px] uppercase text-zinc-500">Events</h2>
            <DataTable
              columns={[
                { key: 'when', heading: 'TIME' },
                { key: 'event', heading: 'EVENT' },
                { key: 'from', heading: 'FROM' },
                { key: 'to', heading: 'TO' },
                { key: 'reason', heading: 'REASON' },
              ]}
              rows={detail.events.map((row) => ({
                when: new Date(row.created_at).toLocaleString(),
                event: row.event_type,
                from: row.from_status ?? '—',
                to: row.to_status,
                reason: row.reason ?? '—',
              }))}
              empty={<p className="text-xs text-zinc-500">No events</p>}
            />
          </section>
          <section>
            <h2 className="mb-1 text-[10px] uppercase text-zinc-500">Ledger</h2>
            <DataTable
              columns={[
                { key: 'when', heading: 'DATE & TIME' },
                { key: 'credit', heading: 'CREDIT' },
                { key: 'debit', heading: 'DEBIT' },
                { key: 'balance', heading: 'BALANCE' },
                { key: 'remark', heading: 'REMARK' },
              ]}
              rows={detail.ledger.map((row) => ({
                when: new Date(row.created_at).toLocaleString(),
                credit: <MoneyDisplay amountMinor={row.credit_minor} />,
                debit: <MoneyDisplay amountMinor={row.debit_minor} />,
                balance: <MoneyDisplay amountMinor={row.balance_after_minor} />,
                remark: row.remark ?? '—',
              }))}
              empty={<p className="text-xs text-zinc-500">No ledger lines</p>}
            />
          </section>
          <section>
            <h2 className="mb-1 text-[10px] uppercase text-zinc-500">Commission</h2>
            {detail.commission ? (
              <p className="text-xs">
                {detail.commission.rate_kind} merchant <RateDisplay rateBp={detail.commission.merchant_rate_bp} /> admin{' '}
                <RateDisplay rateBp={detail.commission.admin_rate_bp} /> amount{' '}
                <MoneyDisplay amountMinor={detail.commission.admin_commission_minor} />
              </p>
            ) : (
              <p className="text-xs text-zinc-500">No snapshot</p>
            )}
          </section>
          <section>
            <h2 className="mb-1 text-[10px] uppercase text-zinc-500">Audit</h2>
            <DataTable
              columns={[
                { key: 'when', heading: 'TIME' },
                { key: 'action', heading: 'ACTION' },
                { key: 'actor', heading: 'ACTOR' },
              ]}
              rows={detail.audit.map((row) => ({
                when: new Date(row.created_at).toLocaleString(),
                action: row.action,
                actor: row.actor_id ?? '—',
              }))}
              empty={<p className="text-xs text-zinc-500">No audit rows</p>}
            />
          </section>
        </div>
      ) : null}
    </AppShell>
  )
}
