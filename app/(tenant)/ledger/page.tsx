'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import type { BankAccountListItem, LedgerAdjustment, LedgerStatement, UserListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function LedgerPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('LEDGER')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    owner_user_id: parseAsString.withDefault(''),
    bank_account_id: parseAsString.withDefault(''),
  })
  const [admins, setAdmins] = useState<UserListItem[]>([])
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [statement, setStatement] = useState<LedgerStatement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [amountMinor, setAmountMinor] = useState(0)
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<LedgerAdjustment | null>(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const load = useCallback(async () => {
    if (!accessToken) return
    if (isSuperAdmin && !filters.owner_user_id && !filters.bank_account_id) {
      setStatement(null)
      setError('Pick an Admin or a bank account')
      return
    }
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    if (filters.bank_account_id) query.set('bank_account_id', filters.bank_account_id)
    try {
      setStatement(await apiRequest<LedgerStatement>(`/api/v1/ledger?${query}`, { token: accessToken }))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load ledger')
    } finally {
      setLoading(false)
    }
  }, [accessToken, filters, isSuperAdmin])

  useEffect(() => {
    if (!ready || !allowed || !accessToken) return
    if (isSuperAdmin) {
      void apiListRequest<UserListItem>('/api/v1/users?role=ADMIN&page_size=100', { token: accessToken }).then((result) =>
        setAdmins(result.items),
      )
      void apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100', { token: accessToken }).then((result) =>
        setBanks(result.items),
      )
    } else {
      void load()
    }
  }, [ready, allowed, accessToken, isSuperAdmin, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const title = statement
    ? `Ledger - ${statement.owner_display_name ?? user.display_name} - (${user.username})`
    : 'Ledger'

  const handleCreate = async () => {
    if (!accessToken || !filters.owner_user_id) return
    const created = await apiRequest<LedgerAdjustment>('/api/v1/ledger/adjustments', {
      method: 'POST',
      token: accessToken,
      body: { owner_user_id: filters.owner_user_id, amount_minor: amountMinor, direction, reason },
    })
    setAdjustOpen(false)
    setPending(created)
  }

  const handleApprove = async () => {
    if (!accessToken || !pending) return
    await apiRequest(`/api/v1/ledger/adjustments/${pending.id}/approve`, {
      method: 'POST',
      token: accessToken,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    setPending(null)
    await load()
  }

  return (
    <AppShell title={title} role={user.role} menus={menus}>
      <FilterBar onApply={() => void load()} onClear={() => { void setFilters({ date_from: '', date_to: '', owner_user_id: '', bank_account_id: '' }); void (!isSuperAdmin && load()) }} onReload={() => void load()}>
        {isSuperAdmin ? (
          <>
            <label className="text-xs text-zinc-600">
              Admin
              <select className="ml-1 h-7 rounded border border-zinc-300" value={filters.owner_user_id} onChange={(event) => void setFilters({ owner_user_id: event.target.value, bank_account_id: '' })}>
                <option value="">Pick an Admin</option>
                {admins.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.display_name} ({row.username})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600">
              Bank
              <select className="ml-1 h-7 rounded border border-zinc-300" value={filters.bank_account_id} onChange={(event) => void setFilters({ bank_account_id: event.target.value, owner_user_id: '' })}>
                <option value="">Pick a bank</option>
                {banks.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <label className="text-xs text-zinc-600">
          Start Date
          <input className="ml-1 h-7 rounded border border-zinc-300 px-1" type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} />
        </label>
        <label className="text-xs text-zinc-600">
          End Date
          <input className="ml-1 h-7 rounded border border-zinc-300 px-1" type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} />
        </label>
        <ExportButton
          disabled={!statement || statement.lines.length === 0}
          canExport={hasMenu(menus, 'LEDGER', 'can_export')}
          onExport={() => {
            const query = new URLSearchParams()
            if (filters.date_from) query.set('date_from', filters.date_from)
            if (filters.date_to) query.set('date_to', filters.date_to)
            if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
            if (filters.bank_account_id) query.set('bank_account_id', filters.bank_account_id)
            return downloadExport(`/api/v1/ledger/export?${query}`, accessToken)
          }}
        />
        {isSuperAdmin && hasMenu(menus, 'LEDGER', 'can_create') ? (
          <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => setAdjustOpen(true)}>
            Adjustment
          </button>
        ) : null}
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? <TableSkeleton /> : null}
      <DataTable
        columns={[
          { key: 'when', heading: 'DATE & TIME' },
          { key: 'credit', heading: 'CREDIT' },
          { key: 'debit', heading: 'DEBIT' },
          { key: 'balance', heading: 'BALANCE' },
          { key: 'remark', heading: 'REMARK' },
          { key: 'ref', heading: 'Gateway Ref. No' },
          { key: 'utr', heading: 'UTR' },
        ]}
        rows={(statement?.lines ?? []).map((row) => ({
          when: new Date(row.created_at).toLocaleString(),
          credit: <MoneyDisplay amountMinor={row.credit_minor} />,
          debit: <MoneyDisplay amountMinor={row.debit_minor} />,
          balance: <MoneyDisplay amountMinor={row.balance_after_minor} />,
          remark: row.remark ?? '—',
          ref: row.reference ?? '—',
          utr: row.utr ?? '—',
        }))}
        empty={<EmptyState message="No ledger entries" />}
      />
      {adjustOpen ? (
        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
          <FormShell submitLabel="Create adjustment" onSubmit={() => void handleCreate()}>
            <MoneyInput id="adj" label="Amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
            <label className="text-xs">
              Direction
              <select className="ml-1 h-7 rounded border border-zinc-300" value={direction} onChange={(event) => setDirection(event.target.value as 'CREDIT' | 'DEBIT')}>
                <option value="CREDIT">CREDIT</option>
                <option value="DEBIT">DEBIT</option>
              </select>
            </label>
            <label className="text-xs">
              Reason
              <input className="ml-1 h-7 rounded border border-zinc-300 px-1" value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
          </FormShell>
        </div>
      ) : null}
      {pending ? (
        <ConfirmDialog title="Approve this adjustment as a different user after signing in as checker. Approve now only if you are the checker." confirmLabel="Approve" onCancel={() => setPending(null)} onConfirm={() => void handleApprove()} />
      ) : null}
    </AppShell>
  )
}
