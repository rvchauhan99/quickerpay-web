'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { PartyListItem } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { Input } from '@/components/forms/Input'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function PartiesPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PARTIES')
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(25),
  })
  const [rows, setRows] = useState<PartyListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [partyCode, setPartyCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<PartyListItem>(`/api/v1/parties?${query}`)
      setRows(result.items)
      setTotal(result.pagination.total)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load parties')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.q])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleCreate = async () => {
    if (!accessToken || submitting) return
    setSubmitting(true)
    try {
      await apiRequest('/api/v1/parties', {
        method: 'POST',
        token: accessToken,
        body: { party_code: partyCode, display_name: displayName },
      })
      toast.success('Party created')
      setShowCreate(false)
      setPartyCode('')
      setDisplayName('')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="Party Master" role={user.role} menus={menus}>
      <PageHeader
        title="Party Master"
        action={
          hasMenu(menus, 'PARTIES', 'can_create') ? (
            <PrimaryButton type="button" onClick={() => setShowCreate(true)}>
              Create Party
            </PrimaryButton>
          ) : null
        }
      />
      <ErrorAlert message={error} />
      <FilterBar
        onApply={() => void setFilters({ page: 1 })}
        onClear={() => void setFilters({ q: '', page: 1 })}
        onReload={() => void load()}
      >
        <FormField label="Search">
          <Input
            value={filters.q}
            onChange={(event) => void setFilters({ q: event.target.value })}
            placeholder="Code or name"
            aria-label="Search parties"
          />
        </FormField>
      </FilterBar>
      {showCreate ? (
        <div className="mb-4">
          <FormShell
            title="Create Party"
            submitLabel={submitting ? 'Saving…' : 'Save'}
            loading={submitting}
            onCancel={() => setShowCreate(false)}
            onSubmit={() => void handleCreate()}
          >
            <FormSection title="Party">
              <FormGrid>
                <FormField label="Party code" required>
                  <Input value={partyCode} onChange={(event) => setPartyCode(event.target.value)} aria-label="Party code" />
                </FormField>
                <FormField label="Display name" required>
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} aria-label="Display name" />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={[
            { key: 'party_code', heading: 'CODE' },
            { key: 'display_name', heading: 'NAME' },
            { key: 'balance', heading: 'CLOSING BALANCE' },
            { key: 'status', heading: 'STATUS' },
            { key: 'ledger', heading: 'LEDGER' },
          ]}
          rows={rows.map((row) => ({
            _rowKey: row.id,
            party_code: row.party_code,
            display_name: row.display_name,
            balance: <MoneyDisplay amountMinor={row.balance_minor} />,
            status: <StatusBadge status={row.status} />,
            ledger: (
              <Link className="text-sm underline" style={{ color: 'var(--qp-primary)' }} href={`/ledger?q=${encodeURIComponent(row.party_code)}`}>
                Ledger
              </Link>
            ),
          }))}
          empty={<EmptyState message="No parties — create a Party to use on Hawala debit or credit." />}
          pagination={{ page: filters.page, page_size: filters.page_size, total }}
          onPage={(page) => void setFilters({ page })}
        />
      )}
    </AppShell>
  )
}
