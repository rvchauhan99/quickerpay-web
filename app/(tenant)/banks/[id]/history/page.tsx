'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { BankAccountDetail, LedgerStatement } from '@quickerpay/shared-types'
import { LEDGER_DIRECTIONS, LEDGER_EVENT_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, ExportButton, FilterBar, TableSkeleton } from '@/components/ui/FilterBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

const EVENT_FILTERS = LEDGER_EVENT_TYPES.filter((value) => value !== 'OPENING')

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function filterQuery(filters: Record<string, string>, bankAccountId: string): string {
  const query = new URLSearchParams()
  query.set('bank_account_id', bankAccountId)
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value)
  }
  return query.toString()
}

export default function BankTransactionsHistoryPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('BANKS')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(todayIso()),
    date_to: parseAsString.withDefault(todayIso()),
    q: parseAsString.withDefault(''),
    event_type: parseAsString.withDefault(''),
    direction: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(100),
  })
  const [bank, setBank] = useState<BankAccountDetail | null>(null)
  const [statement, setStatement] = useState<LedgerStatement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    setLoading(true)
    setError(null)
    try {
      const detail = await apiRequest<BankAccountDetail>(`/api/v1/bank-accounts/${params.id}`, {
        token: accessToken,
      })
      setBank(detail)
      const query = new URLSearchParams(
        filterQuery(
          {
            date_from: filters.date_from,
            date_to: filters.date_to,
            q: filters.q,
            event_type: filters.event_type,
            direction: filters.direction,
          },
          params.id,
        ),
      )
      query.set('page', String(filters.page))
      query.set('page_size', String(filters.page_size))
      setStatement(await apiRequest<LedgerStatement>(`/api/v1/ledger?${query}`, { token: accessToken }))
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}`
          : 'Could not load history',
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken, filters, params.id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const title = bank ? `Ledger - ${bank.label}` : 'Ledger'

  return (
    <AppShell title={title} role={user.role} menus={menus}>
      <PageHeader
        title={title}
        action={
          <Link href="/banks" className="text-xs underline" style={{ color: 'var(--qp-text-secondary)' }}>
            Back to Bank Details
          </Link>
        }
      />
      <FilterBar
        onApply={() => void setFilters({ page: 1 }).then(() => load())}
        onClear={() =>
          void setFilters({
            date_from: todayIso(),
            date_to: todayIso(),
            q: '',
            event_type: '',
            direction: '',
            page: 1,
            page_size: 100,
          })
        }
        onReload={() => void load()}
      >
        <FormField label="From Date">
          <Input
            type="date"
            value={filters.date_from}
            onChange={(event) => void setFilters({ date_from: event.target.value })}
            aria-label="Start Date"
          />
        </FormField>
        <FormField label="To Date">
          <Input
            type="date"
            value={filters.date_to}
            onChange={(event) => void setFilters({ date_to: event.target.value })}
            aria-label="End Date"
          />
        </FormField>
        <FormField label="Search">
          <Input
            placeholder="Gateway Ref. No or UTR"
            value={filters.q}
            onChange={(event) => void setFilters({ q: event.target.value })}
            aria-label="Search"
          />
        </FormField>
        <FormField label="Event type">
          <Select
            value={filters.event_type}
            onChange={(event) => void setFilters({ event_type: event.target.value })}
            aria-label="Event type"
          >
            <option value="">All</option>
            {EVENT_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Direction">
          <Select
            value={filters.direction}
            onChange={(event) => void setFilters({ direction: event.target.value })}
            aria-label="Direction"
          >
            <option value="">All</option>
            {LEDGER_DIRECTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FormField>
        <div>
          <ExportButton
            disabled={
              !statement ||
              statement.pagination.total === 0 ||
              !(hasMenu(menus, 'BANKS', 'can_export') || hasMenu(menus, 'LEDGER', 'can_export'))
            }
            onExport={() =>
              void downloadExport(
                `/api/v1/ledger/export?${filterQuery(
                  {
                    date_from: filters.date_from,
                    date_to: filters.date_to,
                    q: filters.q,
                    event_type: filters.event_type,
                    direction: filters.direction,
                  },
                  params.id,
                )}`,
                accessToken,
                'ledger.csv',
              )
            }
          />
        </div>
      </FilterBar>
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : (
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
          pagination={statement?.pagination}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
    </AppShell>
  )
}
