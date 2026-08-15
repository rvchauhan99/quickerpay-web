'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { BankAccountListItem, Pagination } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, FilterBar, StatusBadge, TableSkeleton, EmptyState, Toast, ExportButton } from '@/components/ui/FilterBar'
import { IconButton } from '@/components/ui/IconButton'
import { Eye } from 'lucide-react'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { Input } from '@/components/forms/Input'
import { FormField } from '@/components/forms/FormField'
import { FormShell } from '@/components/forms/FormShell'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function BanksPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('BANKS')
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    owner_user_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<BankAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [upiAddress, setUpiAddress] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.q) query.set('q', filters.q)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    try {
      const result = await apiListRequest<BankAccountListItem>(`/api/v1/bank-accounts?${query}`, { token: accessToken })
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [accessToken, filters])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleCreate = async () => {
    if (!accessToken) return
    setError(null)
    try {
      await apiRequest('/api/v1/bank-accounts', {
        method: 'POST',
        token: accessToken,
        body: { upi_address: upiAddress, display_name: displayName },
      })
      setCreating(false)
      setToast('Success')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not create')
    }
  }

  const handleReveal = async (id: string) => {
    if (!accessToken) return
    setError(null)
    try {
      const result = await apiRequest<{ account_number: string }>(`/api/v1/bank-accounts/${id}/reveal`, {
        method: 'POST',
        token: accessToken,
      })
      setRevealed((current) => ({ ...current, [id]: result.account_number }))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not reveal')
    }
  }

  return (
    <AppShell title="Bank Details" role={user.role} menus={menus}>
      <PageHeader
        title="Bank Details"
        action={
          hasMenu(menus, 'BANKS', 'can_create') ? (
            <PrimaryButton onClick={() => setCreating(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Bank
            </PrimaryButton>
          ) : null
        }
      />
      <Toast message={toast} />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ q: '', owner_user_id: '', page: 1 })} onReload={() => void load()}>
        <FormField label="Search">
          <Input placeholder="Search" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={merchants}
            adminId={filters.owner_user_id}
            onAdminChange={(value) => void setFilters({ owner_user_id: value, page: 1 })}
            showMerchant={false}
          />
        ) : null}
        <div>
          <ExportButton disabled={rows.length === 0} />
        </div>
      </FilterBar>

      {creating ? (
        <div className="mb-4">
          <FormShell submitLabel="Add" onCancel={() => setCreating(false)} onSubmit={() => void handleCreate()}>
            <FormSection title="Add UPI-First Bank" description="Register a new UPI ID as a target for payouts or collections.">
              <FormGrid>
                <FormField label="UPI Address" required>
                  <Input value={upiAddress} onChange={(event) => setUpiAddress(event.target.value)} />
                </FormField>
                <FormField label="Display Name">
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'owner', heading: 'OWNER' },
            { key: 'label', heading: 'LABEL' },
            { key: 'masked', heading: 'ACCOUNT' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            owner: row.owner_username,
            label: row.label,
            masked: revealed[row.id] ?? row.account_number_masked ?? '—',
            status: <StatusBadge status={row.status} />,
            actions: row.account_number_masked ? (
              <span className="flex items-center gap-1">
                <IconButton icon={<Eye size={15} strokeWidth={1.75} />} tooltip="Reveal account number" onClick={() => void handleReveal(row.id)} />
              </span>
            ) : (
              '—'
            ),
          }))}
          empty={<EmptyState message="No bank accounts found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
    </AppShell>
  )
}
