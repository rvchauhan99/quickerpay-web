'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { UserDetail } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { apiRequest, ApiClientError } from '@/lib/api'
import { RateDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      setDetail(await apiRequest<UserDetail>(`/api/v1/users/${params.id}`, { token: accessToken }))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    }
  }, [accessToken, params.id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="User" role={user.role} menus={menus}>
      <p className="mb-2 text-xs">
        <Link className="underline" href="/users">
          Back to list
        </Link>
      </p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {!detail ? (
        <TableSkeleton />
      ) : (
        <dl className="grid max-w-lg grid-cols-2 gap-1 text-xs">
          <dt>Username</dt>
          <dd>{detail.username}</dd>
          <dt>Role</dt>
          <dd>{detail.role}</dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={detail.status} />
          </dd>
          <dt>Online</dt>
          <dd>{detail.operational_state}</dd>
          <dt>2FA</dt>
          <dd>{detail.two_fa_enabled ? 'on' : 'off'}</dd>
          <dt>Menus</dt>
          <dd>{detail.menus.filter((grant) => grant.can_view).map((grant) => grant.menu_code).join(', ') || '—'}</dd>
          <dt>Scope banks</dt>
          <dd>{detail.scope?.bank_account_ids.length ?? 0}</dd>
          <dt>Scope UPI</dt>
          <dd>{detail.scope?.upi_account_ids.length ?? 0}</dd>
          {detail.rates.map((rate) => (
            <span key={rate.rate_kind} className="contents">
              <dt>{rate.rate_kind} rate</dt>
              <dd>
                <RateDisplay rateBp={rate.rate_bp} />
              </dd>
            </span>
          ))}
        </dl>
      )}
    </AppShell>
  )
}
