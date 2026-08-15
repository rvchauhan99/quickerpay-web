'use client'

import { useState, type ReactNode } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import type { ReportRun, ReportType } from '@quickerpay/shared-types'
import { REPORT_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, EmptyState, ExportButton, FilterBar, TableSkeleton } from '@/components/ui/FilterBar'
import { apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function ReportsPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('REPORTS')
  const [filters, setFilters] = useQueryStates({
    type: parseAsString.withDefault('commission'),
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    owner_user_id: parseAsString.withDefault(''),
    bank_account_id: parseAsString.withDefault(''),
  })
  const [run, setRun] = useState<ReportRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const queryString = () => {
    const query = new URLSearchParams()
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    if (filters.bank_account_id) query.set('bank_account_id', filters.bank_account_id)
    return query.toString()
  }

  const handleRun = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const suffix = queryString()
    try {
      setRun(await apiRequest<ReportRun>(`/api/v1/reports/${filters.type}${suffix ? `?${suffix}` : ''}`, { token: accessToken }))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not run report')
      setRun(null)
    } finally {
      setLoading(false)
    }
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="Reports" role={user.role} menus={menus}>
      <FilterBar onApply={() => void handleRun()} onClear={() => void setFilters({ type: 'commission', date_from: '', date_to: '', owner_user_id: '', bank_account_id: '' })} onReload={() => void handleRun()}>
        <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.type} onChange={(event) => void setFilters({ type: event.target.value })} aria-label="Report type">
          {REPORT_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        {filters.type === 'ledger' ? (
          <>
            <input className="h-7 rounded border border-zinc-300 px-1 text-xs" placeholder="Admin user id" value={filters.owner_user_id} onChange={(event) => void setFilters({ owner_user_id: event.target.value, bank_account_id: '' })} aria-label="Admin" />
            <input className="h-7 rounded border border-zinc-300 px-1 text-xs" placeholder="Bank account id" value={filters.bank_account_id} onChange={(event) => void setFilters({ bank_account_id: event.target.value, owner_user_id: '' })} aria-label="Bank" />
          </>
        ) : null}
        <ExportButton
          disabled={!run || run.rows.length === 0}
          canExport={hasMenu(menus, 'REPORTS', 'can_export')}
          onExport={() => downloadExport(`/api/v1/reports/${filters.type as ReportType}/export?${queryString()}`, accessToken)}
        />
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={(run?.columns ?? []).map((column) => ({ key: column.key, heading: column.heading }))}
          rows={(run?.rows ?? []).map((row) => {
            const cells: Record<string, ReactNode> = {}
            for (const column of run?.columns ?? []) {
              const value = row[column.key]
              cells[column.key] = column.key.endsWith('_minor') && typeof value === 'number' ? <MoneyDisplay amountMinor={value} /> : (value ?? '—')
            }
            return cells
          })}
          empty={<EmptyState message="Run a report" />}
        />
      )}
    </AppShell>
  )
}
