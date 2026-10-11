'use client'

import { useEffect, useState } from 'react'
import type { PayoutListItem, UserListItem } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import { Modal } from '@/components/ui/Modal'
import { apiRequest, ApiClientError } from '@/lib/api'
import { bankerLabel } from '@/lib/labels'

/* ─── PayoutReassignDialog ────────────────────────────────────────────────────
   Super Admin: move an already-assigned INITIATE pay-out to another assignee.
──────────────────────────────────────────────────────────────────────────── */
export function PayoutReassignDialog({
  row,
  assignees,
  accessToken,
  onClose,
  onReassigned,
}: {
  row: PayoutListItem | null
  assignees: UserListItem[]
  accessToken: string
  onClose: () => void
  onReassigned: () => void | Promise<void>
}) {
  const [assigneeId, setAssigneeId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!row) return
    setAssigneeId('')
    setSubmitting(false)
  }, [row])

  if (!row) return null

  const candidates = assignees.filter(
    (admin) =>
      admin.role === 'BANKER' &&
      admin.status === 'ACTIVE' &&
      admin.id !== row.banker_user_id,
  )

  const handleConfirm = async () => {
    if (!accessToken || submitting) return
    if (!assigneeId) {
      toast.error(`Select a ${bankerLabel()}`)
      return
    }
    setSubmitting(true)
    try {
      await apiRequest<PayoutListItem>(`/api/v1/payout/${row.id}/reassign`, {
        method: 'POST',
        token: accessToken,
        body: { banker_user_id: assigneeId },
      })
      toast.success(`Reassigned to ${bankerLabel()}`)
      onClose()
      await onReassigned()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not reassign')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Reassign ${bankerLabel()}`}
      ariaLabel={`Reassign ${bankerLabel()}`}
      size="sm"
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
            disabled={submitting || candidates.length === 0}
            className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--qp-primary)' }}
            onClick={() => void handleConfirm()}
          >
            {submitting ? 'Saving…' : 'Reassign'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        Move this INITIATE withdrawal to another {bankerLabel()}. Status stays INITIATE.
      </p>
      <FormField label={bankerLabel()} required>
        <Select
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          aria-label={`Reassign ${bankerLabel()}`}
        >
          <option value="">Select {bankerLabel()}</option>
          {candidates.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.username}
            </option>
          ))}
        </Select>
      </FormField>
      {candidates.length === 0 ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--qp-danger)' }}>
          No other ACTIVE {bankerLabel({ plural: true })} available.
        </p>
      ) : null}
    </Modal>
  )
}
