'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { TenantHealthRow } from '@quickerpay/shared-types'
import { DataTable, EmptyState, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { Input } from '@/components/forms/Input'
import { PrimaryButton } from '@/components/ui/PageHeader'
import { IconButton } from '@/components/ui/IconButton'
import { RefreshCw } from 'lucide-react'
import { apiRequest, ApiClientError } from '@/lib/api'

export default function PlatformHealthPage() {
  const [email, setEmail] = useState('owner@quickerpay.local')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [rows, setRows] = useState<TenantHealthRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (accessToken: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<TenantHealthRow[]>('/api/v1/platform/health', { token: accessToken })
      setRows(data)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) void load(token)
  }, [token, load])

  const handleLogin = async () => {
    setError(null)
    try {
      const payload = await apiRequest<{ access_token: string }>('/api/v1/platform/auth/login', {
        method: 'POST',
        body: { email, password, totp },
      })
      setToken(payload.access_token)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Sign-in failed')
    }
  }

  const handleRecheck = async (tenantId: string) => {
    if (!token) return
    try {
      await apiRequest(`/api/v1/platform/health/${tenantId}/recheck`, { method: 'POST', token })
      await load(token)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Recheck failed')
    }
  }

  return (
    <main className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Database health</h1>
        <Link className="text-xs underline" href="/platform/tenants">
          Tenants
        </Link>
      </div>
      {!token ? (
        <form
          className="mb-3 flex flex-wrap items-end gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            void handleLogin()
          }}
        >
          <div className="w-48"><Input placeholder="Email" aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="w-48"><Input placeholder="Password" aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <div className="w-24"><Input placeholder="TOTP" aria-label="TOTP" value={totp} onChange={(event) => setTotp(event.target.value)} /></div>
          <PrimaryButton type="submit">Sign in</PrimaryButton>
        </form>
      ) : null}
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? <TableSkeleton /> : null}
      {!loading && token ? (
        <DataTable
          columns={[
            { key: 'tenant', heading: 'tenant' },
            { key: 'db_name', heading: 'db_name' },
            { key: 'health_status', heading: 'health_status' },
            { key: 'schema_version', heading: 'schema_version' },
            { key: 'expected_version', heading: 'expected_version' },
            { key: 'pool', heading: 'pool in use / max' },
            { key: 'last_health_check_at', heading: 'last_health_check_at' },
            { key: 'last_backup_at', heading: 'last_backup_at' },
            { key: 'actions', heading: 'Actions' },
          ]}
          empty={<EmptyState message="No tenant databases" />}
          rows={rows.map((row) => ({
            _rowClass: row.mismatch || row.health_status === 'DOWN' || row.health_status === 'DEGRADED' ? 'bg-red-50' : '',
            tenant: row.slug,
            db_name: row.db_name,
            health_status: <StatusBadge status={row.health_status} />,
            schema_version: row.schema_version,
            expected_version: row.expected_version,
            pool: `${row.pool_in_use ?? '—'} / ${row.pool_max}`,
            last_health_check_at: row.last_health_check_at ?? '—',
            last_backup_at: row.last_backup_at ?? '—',
            actions: (
              <span className="flex items-center gap-1">
                <IconButton icon={<RefreshCw size={15} strokeWidth={1.75} />} tooltip="Re-check" onClick={() => void handleRecheck(row.tenant_id)} />
              </span>
            ),
          }))}
        />
      ) : null}
      <p className="mt-2 text-[11px] text-zinc-500">
        Run migration stays `pnpm migrate:tenants`. This screen does not POST migrate.
      </p>
    </main>
  )
}
