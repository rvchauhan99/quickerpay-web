'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { PayinDetail, PayinProofView } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert, PrimaryButton } from '@/components/ui/PageHeader'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { apiRequest, ApiClientError } from '@/lib/api'
import { merchantLabel } from '@/lib/labels'
import { canSeeMerchants } from '@/lib/merchant-visibility'
import { MoneyDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function PayinDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYIN')
  const [row, setRow] = useState<PayinDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    try {
      setRow(await apiRequest<PayinDetail>(`/api/v1/payin/${params.id}`, { token: accessToken }))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    }
  }, [accessToken, params.id])

  const handleViewProof = async () => {
    if (!accessToken || !params.id || !row?.has_utr_proof) return
    try {
      const view = await apiRequest<PayinProofView>(`/api/v1/payin/${params.id}/proof`, { token: accessToken })
      window.open(view.url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not open attachment')
    }
  }

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="Pending Deposit Detail" role={user.role} menus={menus}>
      <PageHeader title="Pending Deposit Detail" />
      <div className="mb-qp-gap">
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
              <FormField label="UPI">
                <Input value={row.assigned_upi_address ?? '—'} readOnly />
              </FormField>
              {canSeeMerchants(user.role) ? (
                <FormField label={merchantLabel()}>
                  <Input value={row.merchant_display_name?.trim() || '—'} readOnly />
                </FormField>
              ) : null}
              <FormField label="Amount">
                <div className="flex min-h-8 items-center px-qp-ctl-x font-medium">
                  <MoneyDisplay amountMinor={row.amount_minor} />
                </div>
              </FormField>
              <FormField label="Status">
                <div className="flex min-h-8 items-center px-qp-ctl-x">
                  <StatusBadge status={row.status} />
                </div>
              </FormField>
              <FormField label="Created At">
                <Input value={new Date(row.created_at).toLocaleString()} readOnly />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormSection title="Attachment" description="UTR proof image sent with the deposit, when one was uploaded.">
            <FormField label="File">
              <div className="flex min-h-10 flex-wrap items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--qp-text-primary)' }}>
                  {row.has_utr_proof ? 'Proof image' : 'No attachment'}
                </span>
                {row.has_utr_proof ? (
                  <PrimaryButton type="button" onClick={() => void handleViewProof()}>
                    View
                  </PrimaryButton>
                ) : null}
              </div>
            </FormField>
          </FormSection>
        </FormShell>
      )}
    </AppShell>
  )
}
