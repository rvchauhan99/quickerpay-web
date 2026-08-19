'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { MerchantListItem, Pagination, SupagoBankListItem } from '@quickerpay/shared-types'
import { Ban, CircleCheck } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { IconButton } from '@/components/ui/IconButton'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function SupagoBanksPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('SUPAGO_BANKS')
  const [filters, setFilters] = useQueryStates({
    merchant_id: parseAsString.withDefault(''),
    owner_user_id: parseAsString.withDefault(''),
    active: parseAsString.withDefault(''),
    linked: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(25),
  })
  const [rows, setRows] = useState<SupagoBankListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resyncing, setResyncing] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)

  const canEdit = hasMenu(menus, 'SUPAGO_BANKS', 'can_edit')
  const { isSuperAdmin, admins } = useSuperAdminDirectory(accessToken, user?.role)

  const loadMerchants = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiListRequest<MerchantListItem>('/api/v1/merchants?page=1&page_size=100')
      setMerchants(result.items)
    } catch {
      setMerchants([])
    }
  }, [accessToken])

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    if (filters.active) query.set('active', filters.active)
    if (filters.linked) query.set('linked', filters.linked)
    try {
      const result = await apiListRequest<SupagoBankListItem>(`/api/v1/supago/banks?${query}`, { token: accessToken })
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [
    accessToken,
    filters.page,
    filters.page_size,
    filters.merchant_id,
    filters.owner_user_id,
    filters.active,
    filters.linked,
  ])

  useEffect(() => {
    if (ready && allowed) void loadMerchants()
  }, [ready, allowed, loadMerchants])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  const handleResyncAll = async () => {
    if (!accessToken || resyncing) return
    setResyncing(true)
    try {
      const body = filters.merchant_id ? { merchant_id: filters.merchant_id } : {}
      const result = await apiRequest<{ merchants_synced: number; rows_upserted: number; rows_linked: number }>(
        '/api/v1/supago/banks/resync',
        { method: 'POST', token: accessToken, body },
      )
      toast.success(
        `Synced ${result.merchants_synced} merchant(s): ${result.rows_upserted} rows, ${result.rows_linked} linked`,
      )
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Resync failed')
    } finally {
      setResyncing(false)
    }
  }

  const handleStatus = async (id: string, active: boolean) => {
    if (!accessToken || submitting) return
    setSubmitting(id)
    try {
      await apiRequest(`/api/v1/supago/banks/${id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { active },
      })
      toast.success(active ? 'Payment method enabled' : 'Payment method disabled')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update status')
    } finally {
      setSubmitting(null)
    }
  }

  const handleOwnerChange = async (id: string, ownerUserId: string) => {
    if (!accessToken || submitting) return
    setSubmitting(`owner-${id}`)
    try {
      await apiRequest(`/api/v1/supago/banks/${id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { owner_user_id: ownerUserId || null },
      })
      toast.success('Owner updated')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not assign owner')
    } finally {
      setSubmitting(null)
    }
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="Supago Banks" role={user.role} menus={menus}>
      <PageHeader
        title="Supago Banks"
        action={
          canEdit ? (
            <PrimaryButton disabled={resyncing} onClick={() => void handleResyncAll()}>
              {resyncing ? 'Syncing…' : filters.merchant_id ? 'Resync Merchant' : 'Resync All'}
            </PrimaryButton>
          ) : null
        }
      />

      <FilterBar
        onApply={() => void setFilters({ page: 1 })}
        onClear={() => void setFilters({ merchant_id: '', owner_user_id: '', active: '', linked: '', page: 1 })}
        onReload={() => void load()}
      >
        <FormField label="Merchant">
          <Select
            value={filters.merchant_id}
            onChange={(e) => void setFilters({ merchant_id: e.target.value, page: 1 })}
          >
            <option value="">All merchants</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.merchant_code} — {m.display_name}
              </option>
            ))}
          </Select>
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={[]}
            showMerchant={false}
            adminId={filters.owner_user_id}
            onAdminChange={(value) => void setFilters({ owner_user_id: value, page: 1 })}
          />
        ) : null}
        <FormField label="Status">
          <Select value={filters.active} onChange={(e) => void setFilters({ active: e.target.value, page: 1 })}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormField>
        <FormField label="Linked">
          <Select value={filters.linked} onChange={(e) => void setFilters({ linked: e.target.value, page: 1 })}>
            <option value="">All</option>
            <option value="true">Linked</option>
            <option value="false">Unlinked</option>
          </Select>
        </FormField>
      </FilterBar>

      {error ? <p className="mb-3 text-xs text-red-600">{error}</p> : null}

      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={[
            { key: 'merchant', heading: 'MERCHANT' },
            { key: 'method', heading: 'METHOD ID' },
            { key: 'upi', heading: 'UPI ID' },
            { key: 'name', heading: 'NAME' },
            { key: 'type', heading: 'TYPE' },
            { key: 'active', heading: 'ACTIVE' },
            { key: 'owner', heading: 'OWNER' },
            { key: 'linked', heading: 'LINKED UPI' },
            { key: 'synced', heading: 'LAST SYNCED' },
            ...(canEdit ? [{ key: 'actions', heading: 'ACTIONS' }] : []),
          ]}
          rows={rows.map((row) => ({
            merchant: row.merchant_code,
            method: String(row.supago_payment_method_id),
            upi: row.upi_address,
            name: row.display_name,
            type: `${row.pname} / ${row.ptype}`,
            active: <StatusBadge status={row.active ? 'ACTIVE' : 'DISABLED'} />,
            owner: canEdit ? (
              <Select
                aria-label={`Owner for ${row.upi_address}`}
                className="min-w-[8rem]"
                disabled={submitting === `owner-${row.id}`}
                value={row.owner_user_id ?? ''}
                onChange={(event) => void handleOwnerChange(row.id, event.target.value)}
              >
                <option value="">Unassigned</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.username}
                  </option>
                ))}
              </Select>
            ) : (
              (row.owner_username ?? '—')
            ),
            linked: row.linked_upi_address ?? '—',
            synced: new Date(row.synced_at).toLocaleString(),
            ...(canEdit
              ? {
                  actions: (
                    <div className="flex gap-1">
                      {row.active ? (
                        <IconButton
                          disabled={submitting === row.id}
                          icon={<Ban size={15} strokeWidth={1.75} />}
                          tooltip="Disable"
                          onClick={() => void handleStatus(row.id, false)}
                        />
                      ) : (
                        <IconButton
                          disabled={submitting === row.id}
                          icon={<CircleCheck size={15} strokeWidth={1.75} />}
                          tooltip="Enable"
                          variant="primary"
                          onClick={() => void handleStatus(row.id, true)}
                        />
                      )}
                    </div>
                  ),
                }
              : {}),
          }))}
          empty={<EmptyState message="No Supago banks synced yet. Run Resync All after connecting merchants." />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
        />
      )}
    </AppShell>
  )
}
