'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { AuditLogItem, Pagination } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, ExportButton, FilterBar, TableSkeleton } from '@/components/ui/FilterBar'
import { Input } from '@/components/forms/Input'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function AuditPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('AUDIT')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    actor: parseAsString.withDefault(''),
    action: parseAsString.withDefault(''),
    entity_type: parseAsString.withDefault(''),
    ip: parseAsString.withDefault(''),
    request_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<AuditLogItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AuditLogItem | null>(null)

  const queryString = () => {
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.actor) query.set('actor', filters.actor)
    if (filters.action) query.set('action', filters.action)
    if (filters.entity_type) query.set('entity_type', filters.entity_type)
    if (filters.ip) query.set('ip', filters.ip)
    if (filters.request_id) query.set('request_id', filters.request_id)
    return query.toString()
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiListRequest<AuditLogItem>(`/api/v1/audit?${queryString()}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.date_from, filters.date_to, filters.actor, filters.action, filters.entity_type, filters.ip, filters.request_id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="Audit" role={user.role} menus={menus}>
      <PageHeader
        title="Audit"
      />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', actor: '', action: '', entity_type: '', ip: '', request_id: '', page: 1 })} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value, page: 1 })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value, page: 1 })} aria-label="End Date" />
        </FormField>
        <FormField label="Actor">
          <Input placeholder="Actor" value={filters.actor} onChange={(event) => void setFilters({ actor: event.target.value, page: 1 })} aria-label="Actor" />
        </FormField>
        <FormField label="Action">
          <Input placeholder="Action" value={filters.action} onChange={(event) => void setFilters({ action: event.target.value, page: 1 })} aria-label="Action" />
        </FormField>
        <FormField label="Entity">
          <Input placeholder="Entity" value={filters.entity_type} onChange={(event) => void setFilters({ entity_type: event.target.value, page: 1 })} aria-label="Entity type" />
        </FormField>
        <FormField label="IP">
          <Input placeholder="IP" value={filters.ip} onChange={(event) => void setFilters({ ip: event.target.value, page: 1 })} aria-label="IP" />
        </FormField>
        <FormField label="Request ID">
          <Input placeholder="Request id" value={filters.request_id} onChange={(event) => void setFilters({ request_id: event.target.value, page: 1 })} aria-label="Request id" />
        </FormField>
        <div>
          <ExportButton
            disabled={rows.length === 0}
            canExport={hasMenu(menus, 'AUDIT', 'can_export')}
            onExport={() => downloadExport(`/api/v1/audit/export?${queryString()}`, 'audit.csv', accessToken!)}
          />
        </div>
      </FilterBar>
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'created_at', heading: 'created_at' },
            { key: 'actor', heading: 'actor' },
            { key: 'role', heading: 'role' },
            { key: 'action', heading: 'action' },
            { key: 'entity', heading: 'entity' },
            { key: 'before', heading: 'before' },
            { key: 'after', heading: 'after' },
            { key: 'ip', heading: 'IP' },
            { key: 'request_id', heading: 'request_id' },
          ]}
          rows={rows.map((row) => ({
            created_at: new Date(row.created_at).toLocaleString(),
            actor: (
              <button type="button" className="underline" onClick={() => setDetail(row)}>
                {row.actor ?? row.actor_id ?? '—'}
              </button>
            ),
            role: row.role ?? '—',
            action: row.action,
            entity: row.entity_type ?? '—',
            before: row.before ? 'view' : '—',
            after: row.after ? 'view' : '—',
            ip: row.ip ?? '—',
            request_id: row.request_id ?? '—',
          }))}
          empty={<EmptyState message="No audit rows" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(page_size) => void setFilters({ page_size, page: 1 })}
        />
      )}
      {detail ? (
        <aside className="mt-2 rounded border border-zinc-200 bg-white p-2 text-xs">
          <p className="mb-1 font-medium">{detail.action}</p>
          <pre className="overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify({ before: detail.before, after: detail.after }, null, 2)}</pre>
          <button type="button" className="mt-1 h-7 rounded border border-zinc-300 px-2" onClick={() => setDetail(null)}>Close</button>
        </aside>
      ) : null}
    </AppShell>
  )
}
