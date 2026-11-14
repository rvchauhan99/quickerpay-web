'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { FormField } from '@/components/forms/FormField'
import { PasswordInput } from '@/components/forms/PasswordInput'
import { Button } from '@/components/ui/Button'
import { apiRequest, ApiClientError, formError } from '@/lib/api'

const PASSWORD_HINT = 'At least 6 characters'

/**
 * Admin / Super Admin sets a temporary password on another user via
 * POST /users/:id/reset-password. Used by Banker Master and Exchange Master portal.
 */
export function ResetTemporaryPasswordDialog({
  userId,
  accessToken,
  title,
  subtitle,
  confirmLabel = 'Reset password',
  onClose,
  onDone,
}: {
  userId: string
  accessToken: string
  title: string
  subtitle?: string
  confirmLabel?: string
  onClose: () => void
  onDone: (temporaryPassword: string) => void | Promise<void>
}) {
  const [mounted, setMounted] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setPassword('')
    setConfirm('')
    setFieldErrors({})
    setBanner(null)
    setSubmitting(false)
  }, [userId])

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    const nextErrors: Record<string, string> = {}
    const temp = password.trim()
    if (temp.length < 6) nextErrors.temporary_password = 'Password must be at least 6 characters'
    if (temp !== confirm.trim()) nextErrors.confirm_password = 'Passwords do not match'
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setBanner(null)
      return
    }

    setSubmitting(true)
    setFieldErrors({})
    setBanner(null)
    try {
      await apiRequest(`/api/v1/users/${userId}/reset-password`, {
        method: 'POST',
        token: accessToken,
        body: { temporary_password: temp, require_password_change: true },
      })
      await onDone(temp)
      onClose()
    } catch (caught) {
      const mapped = formError(caught, 'Could not reset password')
      setFieldErrors(mapped.fields)
      setBanner(mapped.banner)
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not reset password')
    } finally {
      setSubmitting(false)
    }
  }

  const dialog = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-qp-card border p-4"
        style={{
          backgroundColor: 'var(--qp-card)',
          borderColor: 'var(--qp-border)',
          boxShadow: 'var(--qp-shadow-lg)',
        }}
      >
        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
          {title}
        </h3>
        {subtitle ? (
          <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
            {subtitle}
          </p>
        ) : (
          <div className="mb-3" />
        )}

        {banner ? (
          <p
            className="mb-3 rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: 'var(--qp-danger)', color: 'var(--qp-danger)', backgroundColor: 'var(--qp-danger-bg)' }}
            role="alert"
          >
            {banner}
          </p>
        ) : null}

        <div className="mb-4 space-y-3">
          <FormField
            label="Temporary password"
            required
            hint={PASSWORD_HINT}
            error={fieldErrors.temporary_password}
          >
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              aria-label="Temporary password"
              aria-invalid={Boolean(fieldErrors.temporary_password)}
            />
          </FormField>
          <FormField label="Confirm password" required error={fieldErrors.confirm_password}>
            <PasswordInput
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              aria-label="Confirm temporary password"
              aria-invalid={Boolean(fieldErrors.confirm_password)}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} loading={submitting}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(dialog, document.body)
}
