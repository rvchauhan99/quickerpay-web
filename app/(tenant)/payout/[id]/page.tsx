'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type {
  BankAccountListItem,
  PayoutAttachmentView,
  PayoutListItem,
} from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { DangerButton, ErrorAlert, OutlineButton, PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { CopyButton } from '@/components/ui/CopyButton'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { PayoutActionDialogs } from '@/components/forms/PayoutActionDialogs'
import {
  copyPayoutBankDetails,
  payoutAccountNumber,
} from '@/components/forms/PayoutBankDetailsCell'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

function FieldWithCopy({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel: string
}) {
  return (
    <FormField label={label}>
      <div className="flex gap-2">
        <Input value={value} readOnly className="flex-1" />
        <CopyButton value={value} label={copyLabel} />
      </div>
    </FormField>
  )
}

export default function PayoutDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYOUT')
  const [row, setRow] = useState<PayoutListItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [acceptFor, setAcceptFor] = useState<PayoutListItem | null>(null)
  const [rejectFor, setRejectFor] = useState<PayoutListItem | null>(null)

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

  useEffect(() => {
    if (!accessToken || !allowed) return
    if (!hasMenu(menus, 'PAYOUT', 'can_edit')) return
    void apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100', { token: accessToken })
      .then((result) => setBanks(result.items.filter((bank) => bank.status === 'ACTIVE')))
      .catch(() => {
        /* banks only needed for Accept */
      })
  }, [accessToken, allowed, menus])

  const handleViewAttachment = async () => {
    if (!accessToken || !params.id || !row?.has_attachment) return
    try {
      const view = await apiRequest<PayoutAttachmentView>(`/api/v1/payout/${params.id}/attachment`, {
        token: accessToken,
      })
      window.open(view.url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not open attachment')
    }
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const isPending = row?.status === 'INITIATE'
  const canAccept = Boolean(isPending && hasMenu(menus, 'PAYOUT', 'can_edit'))
  const canReject = Boolean(isPending && hasMenu(menus, 'PAYOUT', 'can_edit'))
  const showActions = Boolean(row && (canAccept || canReject))

  const accountDisplay = row ? payoutAccountNumber(row) || '—' : '—'
  const ifscDisplay = row?.beneficiary_ifsc?.trim() || '—'
  const beneficiaryDisplay = row?.beneficiary_name?.trim() || '—'
  const bankDisplay = row?.beneficiary_bank_name?.trim() || '—'

  return (
    <AppShell title="Pay-Out Detail" role={user.role} menus={menus}>
      <PageHeader title="Pay-Out Detail" backHref="/payout" backLabel="Pay-Out" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {!row ? (
        <TableSkeleton />
      ) : (
        <FormShell
          title="Withdrawal"
          actions={
            showActions ? (
              <>
                {canReject ? (
                  <DangerButton type="button" onClick={() => setRejectFor(row)}>
                    Reject
                  </DangerButton>
                ) : null}
                {canAccept ? (
                  <PrimaryButton type="button" onClick={() => setAcceptFor(row)}>
                    Accept
                  </PrimaryButton>
                ) : null}
              </>
            ) : undefined
          }
        >
          <FormSection title="Overview" description="Amount, status, and gateway references.">
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: 'var(--qp-border)',
                backgroundColor: 'var(--qp-primary-light)',
              }}
            >
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--qp-text-muted)' }}
                >
                  Amount
                </p>
                <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--qp-text-primary)' }}>
                  <MoneyDisplay amountMinor={row.amount_minor} />
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--qp-text-muted)' }}
                >
                  Status
                </p>
                <StatusBadge status={row.status} />
              </div>
            </div>
            <FormGrid>
              <FormField label="Created">
                <Input value={new Date(row.created_at).toLocaleString()} readOnly />
              </FormField>
              <FormField label="Username">
                <Input value={row.supago_username ?? '—'} readOnly />
              </FormField>
              <FormField label="Order id">
                <Input value={row.merchant_order_id ?? '—'} readOnly />
              </FormField>
              <FormField label="Gateway Ref. No">
                <Input value={row.reference} readOnly />
              </FormField>
              <FormField label="UTR">
                <Input value={row.utr ?? '—'} readOnly />
              </FormField>
              <FormField label="Failure reason">
                <Input value={row.failure_reason ?? '—'} readOnly />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Bank details" description="Full payee details for transfer. Copy each field or all at once.">
            <div
              className="mb-3 rounded-xl border p-3"
              style={{
                borderColor: 'var(--qp-border)',
                backgroundColor: 'var(--qp-card)',
                boxShadow: 'var(--qp-shadow-sm)',
              }}
            >
              <FormGrid>
                <FieldWithCopy label="Beneficiary name" value={beneficiaryDisplay} copyLabel="Copy Beneficiary" />
                <FieldWithCopy label="Account number" value={accountDisplay} copyLabel="Copy Account" />
                <FieldWithCopy label="IFSC" value={ifscDisplay} copyLabel="Copy IFSC" />
                <FieldWithCopy label="Bank name" value={bankDisplay} copyLabel="Copy Bank" />
              </FormGrid>
              <div className="mt-3 flex justify-end">
                <OutlineButton type="button" onClick={() => void copyPayoutBankDetails(row)}>
                  Copy all bank details
                </OutlineButton>
              </div>
            </div>
          </FormSection>

          <FormSection title="Attachment" description="Optional payment proof on file.">
            <FormField label="File">
              <div className="flex min-h-10 flex-wrap items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--qp-text-primary)' }}>
                  {row.attachment_filename ?? 'No attachment'}
                </span>
                {row.has_attachment ? (
                  <PrimaryButton type="button" onClick={() => void handleViewAttachment()}>
                    View
                  </PrimaryButton>
                ) : null}
              </div>
            </FormField>
          </FormSection>
        </FormShell>
      )}
      {accessToken ? (
        <PayoutActionDialogs
          acceptFor={acceptFor}
          rejectFor={rejectFor}
          banks={banks}
          accessToken={accessToken}
          onCloseAccept={() => setAcceptFor(null)}
          onCloseReject={() => setRejectFor(null)}
          onAccepted={async () => {
            setAcceptFor(null)
            await load()
          }}
          onRejected={async () => {
            setRejectFor(null)
            await load()
          }}
        />
      ) : null}
    </AppShell>
  )
}
