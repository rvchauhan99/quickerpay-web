'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { PayinListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function PayinDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYIN')
  const [row, setRow] = useState<PayinListItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      setRow(await apiRequest<PayinListItem>(`/api/v1/payin/${params.id}`, { token: accessToken }))
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
    <AppShell title="Pay-In Detail" role={user.role} menus={menus}>
      <PageHeader title="Pay-In Detail" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {!row ? (
        <TableSkeleton />
      ) : (
        <FormShell>
          <FormSection title="Transaction Details" description="Gateway reference and transaction status.">
            <FormGrid>
              <FormField label="Gateway Ref. No">
                <Input value={row.reference} readOnly />
              </FormField>
              <FormField label="UTR">
                <Input value={row.utr ?? '—'} readOnly />
              </FormField>
              <FormField label="Amount">
                <div className="flex h-10 items-center px-3 font-medium">
                  <MoneyDisplay amountMinor={row.amount_minor} />
                </div>
              </FormField>
              <FormField label="Status">
                <div className="flex h-10 items-center px-3">
                  <StatusBadge status={row.status} />
                </div>
              </FormField>
              <FormField label="Created At">
                <Input value={new Date(row.created_at).toLocaleString()} readOnly />
              </FormField>
            </FormGrid>
          </FormSection>
        </FormShell>
      )}
    </AppShell>
  )
}
