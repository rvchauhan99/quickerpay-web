'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { DataTable, EmptyState, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { Input } from '@/components/forms/Input'
import { FormField } from '@/components/forms/FormField'
import { PrimaryButton } from '@/components/ui/PageHeader'
import { IconButton } from '@/components/ui/IconButton'
import { Ban, Play } from 'lucide-react'
import { toast } from 'sonner'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'

interface PlatformTenantRow {
  id: string
  slug: string
  display_name: string
  status: string
  schema_version: string | null
  health_status: string | null
  last_backup_at: string | null
  created_at: string
}

export default function PlatformTenantsPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('owner@quickerpay.local')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [rows, setRows] = useState<PlatformTenantRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async (accessToken: string) => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (q) query.set('q', q)
      const result = await apiListRequest<PlatformTenantRow>(`/api/v1/platform/tenants?${query}`, { token: accessToken })
      setRows(result.items)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    if (token) void load(token)
  }, [token, load])

  const handleLogin = async () => {
    setSubmitting('login')
    try {
      const payload = await apiRequest<{ access_token: string }>('/api/v1/platform/auth/login', {
        method: 'POST',
        body: { email, password, totp },
      })
      setToken(payload.access_token)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Sign-in failed')
    } finally {
      setSubmitting(null)
    }
  }

  const handleStatus = async (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    if (!token || submitting) return
    setSubmitting(id)
    try {
      await apiRequest(`/api/v1/platform/tenants/${id}/status`, {
        method: 'POST',
        token,
        body: { status, reason: status === 'SUSPENDED' ? 'platform suspend' : 'platform resume' },
      })
      toast.success(status === 'SUSPENDED' ? 'Tenant suspended' : 'Tenant resumed')
      await load(token)
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Could not update status')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <main className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Tenants</h1>
        <Link className="text-xs underline" href="/platform/health">
          Database health
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
          <PrimaryButton type="submit" disabled={submitting === 'login'}>
            {submitting === 'login' ? 'Signing in…' : 'Sign in'}
          </PrimaryButton>
        </form>
      ) : null}
      <FilterBar onApply={() => token && void load(token)} onClear={() => setQ('')} onReload={() => token && void load(token)}>
        <FormField label="Search">
          <Input placeholder="name or slug" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search" />
        </FormField>
        <Link className="h-7 rounded border border-zinc-300 px-2 text-xs leading-7" href="/platform/tenants/new">
          Create tenant
        </Link>
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={[
            { key: 'name', heading: 'NAME' },
            { key: 'slug', heading: 'SLUG' },
            { key: 'status', heading: 'STATUS' },
            { key: 'schema', heading: 'SCHEMA' },
            { key: 'health', heading: 'HEALTH' },
            { key: 'backup', heading: 'LAST BACKUP' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            name: row.display_name,
            slug: row.slug,
            status: <StatusBadge status={row.status} />,
            schema: row.schema_version ?? '—',
            health: row.health_status ?? '—',
            backup: row.last_backup_at ? new Date(row.last_backup_at).toLocaleString() : '—',
            actions: (
              <span className="flex items-center gap-1">
                {row.status === 'ACTIVE' ? (
                  <IconButton variant="danger" icon={<Ban size={15} strokeWidth={1.75} />} tooltip="Suspend" onClick={() => void handleStatus(row.id, 'SUSPENDED')} />
                ) : (
                  <IconButton variant="primary" icon={<Play size={15} strokeWidth={1.75} />} tooltip="Resume" onClick={() => void handleStatus(row.id, 'ACTIVE')} />
                )}
              </span>
            ),
          }))}
          empty={<EmptyState message="No tenants" />}
        />
      )}
    </main>
  )
}
