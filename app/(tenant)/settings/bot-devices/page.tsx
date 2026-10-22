'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { IconButton } from '@/components/ui/IconButton'
import { Ban } from 'lucide-react'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiRequest, ApiClientError } from '@/lib/api'
import { formatDateTimeIst } from '@/lib/datetime'
import { hasMenu, useSession } from '@/lib/session'
import { useRouter } from 'next/navigation'

interface BotDeviceRow {
  id: string
  label: string
  token_prefix: string
  status: string
  last_seen_at: string | Date | null
  created_at: string | Date
}

export default function BotDevicesPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const allowed = hasMenu(menus, 'SETTINGS') && user?.role === 'SUPER_ADMIN'
  const canRevoke = hasMenu(menus, 'SETTINGS', 'can_edit')
  const [rows, setRows] = useState<BotDeviceRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoke, setRevoke] = useState<BotDeviceRow | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<{ items: BotDeviceRow[] }>('/api/v1/telegram/devices', { token: accessToken })
      setRows(data.items)
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

  const handleRevoke = async () => {
    if (!accessToken || !revoke) return
    await apiRequest(`/api/v1/telegram/devices/${revoke.id}/revoke`, { method: 'POST', token: accessToken, body: {} })
    setRevoke(null)
    await load()
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return <ForbiddenPage permission="SETTINGS.can_view" />

  return (
    <AppShell title="Ops bot devices" role={user.role} menus={menus}>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={[
            { key: 'label', heading: 'label' },
            { key: 'token_prefix', heading: 'token_prefix' },
            { key: 'status', heading: 'STATUS' },
            { key: 'last_seen', heading: 'LAST SEEN' },
            { key: 'actions', heading: 'Actions' },
          ]}
          empty={<EmptyState message="No ops bot devices" />}
          rows={rows.map((row) => ({
            label: row.label,
            token_prefix: row.token_prefix,
            status: <StatusBadge status={row.status} />,
            last_seen: row.last_seen_at ? formatDateTimeIst(String(row.last_seen_at)) : '—',
            actions:
              canRevoke && row.status !== 'REVOKED' ? (
                <IconButton
                  variant="danger"
                  icon={<Ban size={15} strokeWidth={1.75} />}
                  tooltip="Revoke"
                  onClick={() => setRevoke(row)}
                />
              ) : null,
          }))}
        />
      )}
      {revoke ? (
        <ConfirmDialog
          title={`Revoke ${revoke.label}?`}
          confirmLabel="Revoke"
          onCancel={() => setRevoke(null)}
          onConfirm={() => void handleRevoke()}
        />
      ) : null}
    </AppShell>
  )
}
