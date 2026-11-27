'use client'

import { useEffect, useState } from 'react'
import type { PayoutListItem } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { DocumentUpload } from '@/components/forms/DocumentUpload'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { PayoutUpiQr } from '@/components/forms/PayoutUpiQr'
import { PayoutWithdrawSummary } from '@/components/forms/PayoutWithdrawSummary'
import { Modal } from '@/components/ui/Modal'
import { apiRequest, ApiClientError } from '@/lib/api'

/* ─── PayoutActionDialogs ────────────────────────────────────────────────────
   Shared Accept / Reject modals for list and detail screens.
   Accept settles against the assigned Banker — no source-bank picker.
──────────────────────────────────────────────────────────────────────────── */
export function PayoutActionDialogs({
  acceptFor,
  rejectFor,
  accessToken,
  onCloseAccept,
  onCloseReject,
  onAccepted,
  onRejected,
}: {
  acceptFor: PayoutListItem | null
  rejectFor: PayoutListItem | null
  accessToken: string
  onCloseAccept: () => void
  onCloseReject: () => void
  onAccepted: () => void | Promise<void>
  onRejected: () => void | Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectFile, setRejectFile] = useState<File | null>(null)
  const [utr, setUtr] = useState('')
  const [acceptFile, setAcceptFile] = useState<File | null>(null)

  useEffect(() => {
    if (!acceptFor) return
    setUtr('')
    setAcceptFile(null)
    setSubmitting(false)
  }, [acceptFor])

  useEffect(() => {
    if (!rejectFor) return
    setRejectReason('')
    setRejectFile(null)
    setSubmitting(false)
  }, [rejectFor])

  const handleReject = async () => {
    if (!rejectFor || !accessToken || submitting) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('Enter a reject reason')
      return
    }
    setSubmitting(true)
    try {
      if (rejectFile) {
        const form = new FormData()
        form.append('reason', reason)
        form.append('attachment', rejectFile)
        await apiRequest(`/api/v1/payout/${rejectFor.id}/reject`, {
          method: 'POST',
          token: accessToken,
          body: form,
        })
      } else {
        await apiRequest(`/api/v1/payout/${rejectFor.id}/reject`, {
          method: 'POST',
          token: accessToken,
          body: { reason },
        })
      }
      toast.success('Pay-out rejected')
      onCloseReject()
      await onRejected()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not reject pay-out')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAccept = async () => {
    if (!acceptFor || !accessToken || submitting) return
    if (utr.trim().length < 6) {
      toast.error('UTR must be at least 6 characters')
      return
    }
    setSubmitting(true)
    // Stable per pay-out so Accept retries / double-clicks replay instead of colliding.
    const successIdempotencyKey = `payout-success:${acceptFor.id}`
    try {
      if (acceptFile) {
        const form = new FormData()
        form.append('utr', utr.trim())
        form.append('attachment', acceptFile)
        await apiRequest(`/api/v1/payout/${acceptFor.id}/success`, {
          method: 'POST',
          token: accessToken,
          body: form,
          headers: { 'Idempotency-Key': successIdempotencyKey },
        })
      } else {
        await apiRequest(`/api/v1/payout/${acceptFor.id}/success`, {
          method: 'POST',
          token: accessToken,
          body: { utr: utr.trim() },
          headers: { 'Idempotency-Key': successIdempotencyKey },
        })
      }
      toast.success('Pay-out accepted')
      onCloseAccept()
      await onAccepted()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not accept pay-out')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {rejectFor ? (
        <Modal
          title="Reject pay-out"
          ariaLabel="Reject pay-out"
          footer={
            <>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium"
                style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
                onClick={onCloseReject}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--qp-danger)' }}
                onClick={() => void handleReject()}
              >
                {submitting ? 'Saving…' : 'Confirm Reject'}
              </button>
            </>
          }
        >
          <PayoutWithdrawSummary row={rejectFor} />
          <FormField label="Reason" required>
            <textarea
              id="payout-reject-reason"
              className="min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--qp-border)',
                backgroundColor: '#ffffff',
                color: 'var(--qp-text-primary)',
              }}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              aria-label="Reject reason"
            />
          </FormField>
          <FormField label="Attachment" hint="Optional reject proof">
            <DocumentUpload
              value={rejectFile}
              onChange={setRejectFile}
              aria-label="Reject proof attachment"
            />
          </FormField>
        </Modal>
      ) : null}
      {acceptFor ? (
        <Modal
          title="Accept pay-out"
          ariaLabel="Accept pay-out"
          size="xl"
          footer={
            <>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium"
                style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
                onClick={onCloseAccept}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--qp-primary)' }}
                onClick={() => void handleAccept()}
              >
                {submitting ? 'Saving…' : 'Confirm Accept'}
              </button>
            </>
          }
        >
          <div
            className={
              acceptFor.beneficiary_upi?.trim()
                ? 'mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start'
                : 'mb-4'
            }
          >
            <PayoutWithdrawSummary row={acceptFor} className="mb-0" />
            {acceptFor.beneficiary_upi?.trim() ? <PayoutUpiQr row={acceptFor} className="mb-0" /> : null}
          </div>
          <div className="flex flex-col gap-3">
            <FormField label="UTR" required>
              <Input
                id="payout-utr"
                value={utr}
                onChange={(event) => setUtr(event.target.value)}
                aria-label="UTR"
              />
            </FormField>
            <FormField label="Attachment" hint="Optional payment proof">
              <DocumentUpload
                value={acceptFile}
                onChange={setAcceptFile}
                aria-label="Payment proof attachment"
              />
            </FormField>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
