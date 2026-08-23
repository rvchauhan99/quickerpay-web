'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import type { ExtensionDeviceListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { IconButton } from '@/components/ui/IconButton'
import { List, Ban } from 'lucide-react'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiRequest, ApiClientError } from '@/lib/api'
import { isLabConsole } from '@/lib/lab'
import { hasMenu, useSession } from '@/lib/session'
import { useRouter } from 'next/navigation'

export default function ExtensionDevicesPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const allowed = hasMenu(menus, 'SETTINGS') || hasMenu(menus, 'UTR')
  const canRevoke = hasMenu(menus, 'SETTINGS', 'can_edit') || hasMenu(menus, 'UTR', 'can_edit')
  const [filters, setFilters] = useQueryStates({
    owner: parseAsString.withDefault(''),
    upi: parseAsString.withDefault(''),
    status: parseAsString.withDefault(''),
    last_seen: parseAsString.withDefault(''),
  })
  const [rows, setRows] = useState<ExtensionDeviceListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoke, setRevoke] = useState<ExtensionDeviceListItem | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<ExtensionDeviceListItem[]>('/api/v1/extension/devices', { token: accessToken })
      setRows(data)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  const shown = useMemo(
    () =>
      rows.filter((row) => {
        if (filters.owner && !`${row.admin_name} ${row.admin_username}`.toLowerCase().includes(filters.owner.toLowerCase())) {
          return false
        }
        if (filters.upi && !row.upi_address.toLowerCase().includes(filters.upi.toLowerCase())) return false
        if (filters.status && row.status !== filters.status) return false
        if (filters.last_seen && row.presence !== filters.last_seen) return false
        return true
      }),
    [rows, filters],
  )

  const handleRevoke = async () => {
    if (!accessToken || !revoke) return
    await apiRequest(`/api/v1/extension/devices/${revoke.id}/revoke`, {
      method: 'POST',
      token: accessToken,
      body: { reason: 'revoked from settings' },
    })
    setRevoke(null)
    await load()
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return <ForbiddenPage permission="SETTINGS.can_view or UTR.can_view" />

  return (
    <AppShell title="Extension devices" role={user.role} menus={menus}>
      <p className="mb-2 text-xs text-zinc-600">
        Enrol a device from the Chrome extension popup. The device token is shown once there and is never stored in this screen.
        {isLabConsole() ? (
          <>
            {' '}
            For local testing without the live Google Pay dashboard, open{' '}
            <a className="underline" href="/mock/gpay">
              /mock/gpay
            </a>{' '}
            in this Chrome profile.
          </>
        ) : null}
      </p>
      <FilterBar
        onApply={() => undefined}
        onClear={() => void setFilters({ owner: '', upi: '', status: '', last_seen: '' })}
        onReload={() => void load()}
      >
        <FormField label="Owner">
          <Input placeholder="owner" value={filters.owner} onChange={(event) => void setFilters({ owner: event.target.value })} aria-label="owner" />
        </FormField>
        <FormField label="UPI">
          <Input placeholder="UPI" value={filters.upi} onChange={(event) => void setFilters({ upi: event.target.value })} aria-label="UPI" />
        </FormField>
        <FormField label="Status">
          <Select value={filters.status} onChange={(event) => void setFilters({ status: event.target.value })} aria-label="status">
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="REVOKED">REVOKED</option>
          </Select>
        </FormField>
        <FormField label="Last Seen">
          <Select value={filters.last_seen} onChange={(event) => void setFilters({ last_seen: event.target.value })} aria-label="last seen">
            <option value="">Last seen</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
          </Select>
        </FormField>
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={[
            { key: 'label', heading: 'label' },
            { key: 'token_prefix', heading: 'token_prefix' },
            { key: 'admin', heading: 'ADMIN NAME' },
            { key: 'upi', heading: 'UPI' },
            { key: 'status', heading: 'STATUS' },
            { key: 'last_seen', heading: 'LAST SEEN' },
            { key: 'scraper', heading: 'SCRAPER VERSION' },
            { key: 'rows_seen', heading: 'ROWS SEEN' },
            { key: 'posted', heading: 'ENTRIES POSTED' },
            { key: 'enrolled_by', heading: 'enrolled_by' },
            { key: 'created_at', heading: 'created_at' },
            { key: 'actions', heading: 'Actions' },
          ]}
          empty={<EmptyState message="No extension devices" />}
          rows={shown.map((row) => ({
            label: row.label,
            token_prefix: row.token_prefix,
            admin: row.admin_name,
            upi: row.upi_address,
            status: (
              <span className="flex gap-1">
                <StatusBadge status={row.status} />
                <StatusBadge status={row.presence} />
              </span>
            ),
            last_seen: row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : '—',
            scraper: row.scraper_version ?? '—',
            rows_seen: String(row.rows_seen),
            posted: String(row.entries_posted),
            enrolled_by: row.enrolled_by,
            created_at: new Date(row.created_at).toLocaleString(),
            actions: (
              <span className="flex items-center gap-1">
                <IconButton href={`/utr?status=PENDING&extension_device_id=${row.id}`} icon={<List size={15} strokeWidth={1.75} />} tooltip="View posted entries" />
                {canRevoke && row.status !== 'REVOKED' ? (
                  <IconButton variant="danger" icon={<Ban size={15} strokeWidth={1.75} />} tooltip="Revoke" onClick={() => setRevoke(row)} />
                ) : null}
              </span>
            ),
          }))}
        />
      )}
      {revoke ? (
        <ConfirmDialog
          title={`Revoke ${revoke.label} (${revoke.upi_address})?`}
          confirmLabel="Revoke"
          onCancel={() => setRevoke(null)}
          onConfirm={() => void handleRevoke()}
        />
      ) : null}
    </AppShell>
  )
}
