'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FormField } from '@/components/forms/FormField'
import { Modal } from '@/components/ui/Modal'
import { apiRequest, ApiClientError } from '@/lib/api'

const REASON_MAX = 500

/**
 * Required free-text reject for Pay-In list actions.
 * Persists as `payin_requests.review_reason` via POST /payin/:id/reject.
 */
export function PayinRejectDialog({
  payinId,
  accessToken,
  onClose,
  onRejected,
}: {
  payinId: string | null
  accessToken: string
  onClose: () => void
  onRejected: () => void | Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!payinId) return
    setReason('')
    setSubmitting(false)
  }, [payinId])

  if (!payinId) return null

  const handleReject = async () => {
    if (submitting) return
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error('Enter a reject reason')
      return
    }
    if (trimmed.length > REASON_MAX) {
      toast.error(`Reason must be at most ${REASON_MAX} characters`)
      return
    }
    setSubmitting(true)
    try {
      await apiRequest(`/api/v1/payin/${payinId}/reject`, {
        method: 'POST',
        token: accessToken,
        body: { reason: trimmed },
      })
      toast.success('Pay-in rejected')
      onClose()
      await onRejected()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not reject pay-in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Reject this pay-in?"
      ariaLabel="Reject pay-in"
      footer={
        <>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium"
            style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !reason.trim()}
            className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--qp-danger)' }}
            onClick={() => void handleReject()}
          >
            {submitting ? 'Saving…' : 'Confirm Reject'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        Clears the UTR pin and unlinks open UTR rows. The reason is stored on the pay-in and shown in the REASON column.
      </p>
      <FormField label="Reason" required>
        <textarea
          id="payin-reject-reason"
          className="min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--qp-border)',
            backgroundColor: '#ffffff',
            color: 'var(--qp-text-primary)',
          }}
          value={reason}
          maxLength={REASON_MAX}
          onChange={(event) => setReason(event.target.value)}
          aria-label="Reject reason"
        />
      </FormField>
    </Modal>
  )
}
