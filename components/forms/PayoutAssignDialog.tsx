'use client'

import { useEffect, useState } from 'react'
import type { PayoutListItem, UserListItem } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import { Modal } from '@/components/ui/Modal'
import { apiRequest, ApiClientError } from '@/lib/api'
import { bankerLabel } from '@/lib/labels'
import { MoneyDisplay } from '@/lib/money'

/* ─── PayoutAssignDialog ──────────────────────────────────────────────────────
   Super Admin / Admin: put a Banker on an UNASSIGNED INITIATE pay-out.

   Two modes, one dialog, so the rules are stated once:
     row    → POST /payout/:id/assign           (one row)
     multi  → POST /payout/bulk-assign-rows     (exactly the ticked rows, all-or-nothing)

   `PayoutReassignDialog` stays separate: reassign moves an already-assigned row and
   is refused by the API when banker_user_id is null.
──────────────────────────────────────────────────────────────────────────── */
export function PayoutAssignDialog({
  row,
  rows,
  assignees,
  accessToken,
  defaultAssigneeId,
  onClose,
  onAssigned,
}: {
  /** Row mode: the one pay-out to assign. */
  row?: PayoutListItem | null
  /** Multi mode: every selected pay-out. Takes precedence when non-empty. */
  rows?: PayoutListItem[]
  assignees: UserListItem[]
  accessToken: string
  /** Prefill from the queue toolbar's Banker select; still changeable here. */
  defaultAssigneeId?: string | undefined
  onClose: () => void
  onAssigned: () => void | Promise<void>
}) {
  const selected = rows ?? (row ? [row] : [])
  const multi = selected.length > 1
  /**
   * The props are rebuilt on every parent render, so the reset keys on the ids
   * themselves. A live event that re-renders the queue must not wipe the Banker
   * the operator just picked.
   */
  const selectionKey = selected.map((item) => item.id).join(',')
  const [assigneeId, setAssigneeId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAssigneeId(defaultAssigneeId ?? '')
    setSubmitting(false)
    setError(null)
  }, [selectionKey, defaultAssigneeId])

  const open = selected.length > 0
  if (!open) return null

  const candidates = assignees.filter((admin) => admin.role === 'BANKER' && admin.status === 'ACTIVE')
  const totalMinor = selected.reduce((sum, item) => sum + item.amount_minor, 0)
  const target = multi ? `${selected.length} pay-outs` : 'this withdrawal'

  const handleConfirm = async () => {
    if (!accessToken || submitting) return
    if (!assigneeId) {
      toast.error(`Select a ${bankerLabel()}`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (multi) {
        await apiRequest<{ assigned_ids: string[]; assigned_amount_minor: number }>(
          '/api/v1/payout/bulk-assign-rows',
          {
            method: 'POST',
            token: accessToken,
            body: { banker_user_id: assigneeId, payout_ids: selected.map((item) => item.id) },
          },
        )
        toast.success(`Assigned ${selected.length} pay-outs to ${bankerLabel()}`)
      } else {
        await apiRequest<PayoutListItem>(`/api/v1/payout/${selected[0]!.id}/assign`, {
          method: 'POST',
          token: accessToken,
          body: { banker_user_id: assigneeId },
        })
        toast.success(`Assigned to ${bankerLabel()}`)
      }
      onClose()
      await onAssigned()
    } catch (caught) {
      const message = caught instanceof ApiClientError ? caught.displayMessage() : 'Could not assign'
      // The dialog stays open on refusal: a bulk batch is all-or-nothing, so the
      // operator needs the named rows to re-pick rather than lose the selection.
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Assign ${bankerLabel()}`}
      ariaLabel={`Assign ${bankerLabel()}`}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium"
            style={{
              borderColor: 'var(--qp-border)',
              color: 'var(--qp-text-secondary)',
              backgroundColor: 'var(--qp-card)',
            }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || candidates.length === 0 || !assigneeId}
            className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--qp-primary)' }}
            onClick={() => void handleConfirm()}
          >
            {submitting ? 'Saving…' : multi ? `Assign ${selected.length}` : 'Assign'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        Put a {bankerLabel()} on {target}. Status stays INITIATE.
      </p>
      <div
        className="mb-3 rounded border px-3 py-2 text-xs"
        style={{ borderColor: 'var(--qp-border)', backgroundColor: 'var(--qp-surface)' }}
      >
        <span style={{ color: 'var(--qp-text-muted)' }}>Total amount </span>
        <span className="font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
          <MoneyDisplay amountMinor={totalMinor} />
        </span>
        {multi ? (
          <>
            <span className="mx-1" style={{ color: 'var(--qp-text-muted)' }} aria-hidden="true">
              ·
            </span>
            <span style={{ color: 'var(--qp-text-muted)' }}>
              every selected row must pass the window and allowlist, or none is assigned
            </span>
          </>
        ) : null}
      </div>
      <FormField label={bankerLabel()} required>
        <Select
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          aria-label={`Assign ${bankerLabel()}`}
        >
          <option value="">Select {bankerLabel()}</option>
          {candidates.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.username}
            </option>
          ))}
        </Select>
      </FormField>
      {error ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--qp-danger)' }}>
          {error}
        </p>
      ) : null}
      {candidates.length === 0 ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--qp-danger)' }}>
          No ACTIVE {bankerLabel({ plural: true })} available.
        </p>
      ) : null}
    </Modal>
  )
}
