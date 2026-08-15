'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { PayoutListItem } from '@quickerpay/shared-types'
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

export default function PayoutDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYOUT')
  const [row, setRow] = useState<PayoutListItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      setRow(await apiRequest<PayoutListItem>(`/api/v1/payout/${params.id}`, { token: accessToken }))
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
    <AppShell title="Pay-Out Detail" role={user.role} menus={menus}>
      <PageHeader title="Pay-Out Detail" />
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
              <FormField label="Beneficiary">
                <Input value={`${row.beneficiary_name} ${row.beneficiary_account_masked}`} readOnly />
              </FormField>
              <FormField label="Status">
                <div className="flex h-10 items-center px-3">
                  <StatusBadge status={row.status} />
                </div>
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Failure Reason">
                  <Input value={row.failure_reason ?? '—'} readOnly />
                </FormField>
              </div>
            </FormGrid>
          </FormSection>
        </FormShell>
      )}
    </AppShell>
  )
}
