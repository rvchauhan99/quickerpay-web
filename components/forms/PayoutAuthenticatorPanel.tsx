'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { GatewaySecretReveal } from '@quickerpay/shared-types'
import { PayoutAuthenticatorReveal } from '@/components/forms/PayoutAuthenticatorReveal'
import { FormSection } from '@/components/forms/FormSection'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert, OutlineButton, PrimaryButton } from '@/components/ui/PageHeader'
import { ApiClientError, apiRequest } from '@/lib/api'

interface PayoutAuthenticatorPanelProps {
  merchantId: string
  gatewayEnabled: boolean
  issued: boolean
  canEdit: boolean
  onChanged: () => void
}

export function PayoutAuthenticatorPanel({
  merchantId,
  gatewayEnabled,
  issued,
  canEdit,
  onChanged,
}: PayoutAuthenticatorPanelProps) {
  const [reveal, setReveal] = useState<GatewaySecretReveal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [busy, setBusy] = useState(false)

  const base = `/api/v1/merchants/${merchantId}/gateway`

  const load = useCallback(async () => {
    if (!gatewayEnabled || !issued) {
      setReveal(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setReveal(await apiRequest<GatewaySecretReveal>(`${base}/authenticator`))
    } catch (caught) {
      setReveal(null)
      setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load the pay-out authenticator')
    } finally {
      setLoading(false)
    }
  }, [base, gatewayEnabled, issued])

  useEffect(() => {
    void load()
  }, [load])

  async function rotate(issue: boolean) {
    setBusy(true)
    setError(null)
    try {
      const next = await apiRequest<GatewaySecretReveal>(`${base}/authenticator/regenerate`, { method: 'POST' })
      setReveal(next)
      setConfirmRotate(false)
      toast.success(issue ? 'Pay-out authenticator issued' : 'Pay-out authenticator rotated')
      onChanged()
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not rotate the pay-out authenticator')
    } finally {
      setBusy(false)
    }
  }

  if (!gatewayEnabled) {
    return (
      <FormSection title="Authenticator">
        <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
          Enable Gateway first. The pay-out authenticator is issued with the Gateway API.
        </p>
      </FormSection>
    )
  }

  return (
    <FormSection title="Authenticator">
      <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
        Exchange staff enter this 6-digit code on the hosted pay-out page. Rotate replaces it at once.
      </p>
      <div className="mt-3">
        <ErrorAlert message={error} />
      </div>
      {loading ? <p className="mt-3 text-sm" style={{ color: 'var(--qp-text-muted)' }}>Loading…</p> : null}
      {reveal ? <PayoutAuthenticatorReveal reveal={reveal} /> : null}
      {canEdit ? (
        <div className="mt-3">
          {issued || reveal ? (
            <OutlineButton onClick={() => setConfirmRotate(true)} disabled={busy}>
              Rotate
            </OutlineButton>
          ) : (
            <PrimaryButton onClick={() => void rotate(true)} loading={busy}>
              Issue
            </PrimaryButton>
          )}
        </div>
      ) : null}
      {confirmRotate ? (
        <ConfirmDialog
          title="Rotate pay-out authenticator?"
          subtitle="The old authenticator stops working at once. Open pay-out links need the new code."
          confirmLabel="Rotate"
          variant="primary"
          loading={busy}
          onConfirm={() => void rotate(false)}
          onCancel={() => setConfirmRotate(false)}
        />
      ) : null}
    </FormSection>
  )
}
