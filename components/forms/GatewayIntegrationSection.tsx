'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type {
  GatewayConfigView,
  GatewayDeliveryItem,
  GatewaySecretReveal,
} from '@quickerpay/shared-types'
import { FormField } from '@/components/forms/FormField'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { Input } from '@/components/forms/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CopyButton } from '@/components/ui/CopyButton'
import { DataTable, EmptyState, StatusBadge } from '@/components/ui/FilterBar'
import { Modal } from '@/components/ui/Modal'
import { DangerButton, ErrorAlert, OutlineButton, PrimaryButton } from '@/components/ui/PageHeader'
import { ApiClientError, apiRequest } from '@/lib/api'

interface GatewayIntegrationSectionProps {
  merchantId: string
  /** A merchant already on Supago or Crici cannot switch to the Gateway API. */
  panelLocked: boolean
  canEdit: boolean
  onChanged: () => void
}

interface DeliveryPage {
  items: GatewayDeliveryItem[]
  page: number
  page_size: number
  total: number
}

type PendingConfirm =
  | { kind: 'rotate'; keyId: string; prefix: string }
  | { kind: 'revoke'; keyId: string; prefix: string }
  | { kind: 'secret' }
  | { kind: 'status'; next: 'ACTIVE' | 'DISABLED' }

const DELIVERY_PAGE_SIZE = 10

function splitList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function formatWhen(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError ? caught.displayMessage() : fallback
}

export function GatewayIntegrationSection({ merchantId, panelLocked, canEdit, onChanged }: GatewayIntegrationSectionProps) {
  const [config, setConfig] = useState<GatewayConfigView | null>(null)
  const [deliveries, setDeliveries] = useState<DeliveryPage | null>(null)
  const [deliveryPage, setDeliveryPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [reveal, setReveal] = useState<GatewaySecretReveal | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [ipAllowlist, setIpAllowlist] = useState('')
  const [returnHosts, setReturnHosts] = useState('')
  const [expirySeconds, setExpirySeconds] = useState('900')
  const [newKeyLabel, setNewKeyLabel] = useState('')

  const base = `/api/v1/merchants/${merchantId}/gateway`

  const applyConfig = useCallback((next: GatewayConfigView) => {
    setConfig(next)
    setWebhookUrl(next.webhook_url ?? '')
    setIpAllowlist(next.ip_allowlist.join(', '))
    setReturnHosts(next.return_url_hosts.join(', '))
    setExpirySeconds(String(next.payin_expiry_seconds))
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      applyConfig(await apiRequest<GatewayConfigView>(base))
      setError(null)
    } catch (caught) {
      setError(errorText(caught, 'Could not load API integration'))
    }
  }, [applyConfig, base])

  const loadDeliveries = useCallback(async () => {
    try {
      setDeliveries(
        await apiRequest<DeliveryPage>(`${base}/deliveries?page=${deliveryPage}&page_size=${DELIVERY_PAGE_SIZE}`),
      )
    } catch (caught) {
      setError(errorText(caught, 'Could not load the delivery log'))
    }
  }, [base, deliveryPage])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (config?.enabled) void loadDeliveries()
  }, [config?.enabled, loadDeliveries])

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label)
    try {
      await action()
    } catch (caught) {
      toast.error(errorText(caught, 'Request failed'))
    } finally {
      setBusy(null)
    }
  }

  const handleEnable = () =>
    run('enable', async () => {
      const result = await apiRequest<GatewaySecretReveal & { config: GatewayConfigView }>(`${base}/enable`, {
        method: 'POST',
      })
      applyConfig(result.config)
      setReveal({ ...(result.api_key ? { api_key: result.api_key } : {}), ...(result.webhook_secret ? { webhook_secret: result.webhook_secret } : {}) })
      toast.success('API integration enabled')
      onChanged()
    })

  const handleSaveSettings = () =>
    run('settings', async () => {
      const expiry = Number.parseInt(expirySeconds, 10)
      applyConfig(
        await apiRequest<GatewayConfigView>(base, {
          method: 'PATCH',
          body: {
            webhook_url: webhookUrl.trim() === '' ? null : webhookUrl.trim(),
            ip_allowlist: splitList(ipAllowlist),
            return_url_hosts: splitList(returnHosts),
            ...(Number.isFinite(expiry) ? { payin_expiry_seconds: expiry } : {}),
          },
        }),
      )
      toast.success('API settings saved')
    })

  const handleCreateKey = () =>
    run('key', async () => {
      const result = await apiRequest<GatewaySecretReveal>(`${base}/keys`, {
        method: 'POST',
        body: newKeyLabel.trim() ? { label: newKeyLabel.trim() } : {},
      })
      setReveal(result)
      setNewKeyLabel('')
      await loadConfig()
    })

  const handleTestWebhook = () =>
    run('test', async () => {
      const result = await apiRequest<GatewayDeliveryItem>(`${base}/webhook-test`, { method: 'POST' })
      if (result.status === 'DELIVERED') toast.success(`Test webhook delivered (HTTP ${result.last_http_status ?? '—'})`)
      else toast.error(`Test webhook not delivered: ${result.last_error ?? `HTTP ${result.last_http_status ?? '—'}`}`)
      await loadDeliveries()
    })

  const handleResend = (deliveryId: string) =>
    run(`resend-${deliveryId}`, async () => {
      const result = await apiRequest<GatewayDeliveryItem>(`${base}/deliveries/${deliveryId}/resend`, { method: 'POST' })
      if (result.status === 'DELIVERED') toast.success('Webhook delivered')
      else toast.error(`Not delivered: ${result.last_error ?? `HTTP ${result.last_http_status ?? '—'}`}`)
      await loadDeliveries()
    })

  const handleConfirm = () => {
    const pending = pendingConfirm
    if (!pending) return
    void run('confirm', async () => {
      if (pending.kind === 'rotate') {
        setReveal(await apiRequest<GatewaySecretReveal>(`${base}/keys/${pending.keyId}/rotate`, { method: 'POST' }))
        toast.success('Key rotated. The old key keeps working for 24 hours.')
      }
      if (pending.kind === 'revoke') {
        await apiRequest(`${base}/keys/${pending.keyId}/revoke`, { method: 'POST' })
        toast.success('Key revoked')
      }
      if (pending.kind === 'secret') {
        setReveal(await apiRequest<GatewaySecretReveal>(`${base}/webhook-secret`, { method: 'POST' }))
        toast.success('Webhook secret regenerated')
      }
      if (pending.kind === 'status') {
        await apiRequest(base, { method: 'PATCH', body: { status: pending.next } })
        toast.success(pending.next === 'ACTIVE' ? 'API access enabled' : 'API access disabled')
      }
      setPendingConfirm(null)
      await loadConfig()
    })
  }

  if (!config) {
    return (
      <FormSection title="API Integration">
        {error ? <ErrorAlert message={error} /> : <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>Loading…</p>}
      </FormSection>
    )
  }

  if (!config.enabled) {
    return (
      <FormSection
        title="API Integration"
        description="SafePay247 Gateway API: the exchange master's panel creates Pay-Ins and Pay-Outs by API key and receives signed webhooks."
      >
        {panelLocked || config.integration_type === 'SUPAGO' || config.integration_type === 'CRICI' ? (
          <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
            Not available: this exchange master uses a panel integration. One integration per exchange master.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={() => void handleEnable()} loading={busy === 'enable'} disabled={!canEdit || busy !== null}>
              Enable API integration
            </PrimaryButton>
            <span className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
              Locks this exchange master to the Gateway API. The API key and webhook secret are shown once.
            </span>
          </div>
        )}
      </FormSection>
    )
  }

  const baseUrl = typeof window === 'undefined' ? config.base_url_path : `${window.location.origin}${config.base_url_path}`
  const isActive = config.status === 'ACTIVE'

  return (
    <>
      <FormSection
        title="API Integration"
        description="SafePay247 Gateway API. Keys and the webhook secret are shown once; store them in the panel's secret store."
      >
        {error ? (
          <div className="mb-3">
            <ErrorAlert message={error} />
          </div>
        ) : null}

        <FormGrid>
          <FormField label="Status">
            <div className="flex h-qp-ctl items-center gap-2">
              <StatusBadge status={config.status ?? 'DISABLED'} />
            </div>
          </FormField>
          <FormField label="Base URL">
            <div className="flex items-center gap-1">
              <Input value={baseUrl} readOnly aria-label="Gateway base URL" />
              <CopyButton value={baseUrl} label="Copy base URL" />
            </div>
          </FormField>
        </FormGrid>

        <div className="mt-qp-gap">
          <FormGrid>
            <FormField label="Webhook URL" hint="https only outside local. Events are signed with x-sp-signature.">
              <Input
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder="https://panel.example.com/safepay247/webhook"
                disabled={!canEdit}
                aria-label="Webhook URL"
              />
            </FormField>
            <FormField label="Pay-In expiry (seconds)" hint="60 to 86400. Unpaid pay-ins are rejected as EXPIRED.">
              <Input
                type="number"
                min={60}
                max={86400}
                value={expirySeconds}
                onChange={(event) => setExpirySeconds(event.target.value)}
                disabled={!canEdit}
                aria-label="Pay-In expiry seconds"
              />
            </FormField>
            <FormField label="IP allowlist" hint="Comma separated. Empty allows any IP.">
              <Input
                value={ipAllowlist}
                onChange={(event) => setIpAllowlist(event.target.value)}
                placeholder="203.0.113.9, 198.51.100.4"
                disabled={!canEdit}
                aria-label="IP allowlist"
              />
            </FormField>
            <FormField label="Return URL hosts" hint="Comma separated host names; *.example.com allowed.">
              <Input
                value={returnHosts}
                onChange={(event) => setReturnHosts(event.target.value)}
                placeholder="shop.example.com"
                disabled={!canEdit}
                aria-label="Return URL hosts"
              />
            </FormField>
          </FormGrid>
          {canEdit ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => void handleSaveSettings()} loading={busy === 'settings'} disabled={busy !== null}>
                Save settings
              </PrimaryButton>
              <OutlineButton onClick={() => void handleTestWebhook()} disabled={busy !== null || !config.webhook_url || !isActive}>
                {busy === 'test' ? 'Sending…' : 'Send test webhook'}
              </OutlineButton>
              <OutlineButton onClick={() => setPendingConfirm({ kind: 'secret' })} disabled={busy !== null}>
                Regenerate webhook secret
              </OutlineButton>
              {isActive ? (
                <DangerButton onClick={() => setPendingConfirm({ kind: 'status', next: 'DISABLED' })} disabled={busy !== null}>
                  Disable API access
                </DangerButton>
              ) : (
                <OutlineButton onClick={() => setPendingConfirm({ kind: 'status', next: 'ACTIVE' })} disabled={busy !== null}>
                  Enable API access
                </OutlineButton>
              )}
            </div>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="API keys">
        <DataTable
          columns={[
            { key: 'prefix', heading: 'KEY PREFIX' },
            { key: 'label', heading: 'LABEL' },
            { key: 'status', heading: 'STATUS' },
            { key: 'last_used', heading: 'LAST USED' },
            { key: 'expires', heading: 'EXPIRES' },
            { key: 'actions', heading: 'ACTIONS' },
          ]}
          rows={config.keys.map((key) => ({
            _rowKey: key.id,
            prefix: <span className="font-mono text-xs">{key.key_prefix}…</span>,
            label: key.label,
            status: <StatusBadge status={key.status} />,
            last_used: formatWhen(key.last_used_at),
            expires: formatWhen(key.expires_at),
            actions:
              canEdit && key.status === 'ACTIVE' ? (
                <div className="flex gap-2">
                  <OutlineButton
                    onClick={() => setPendingConfirm({ kind: 'rotate', keyId: key.id, prefix: key.key_prefix })}
                    disabled={busy !== null || key.expires_at !== null}
                  >
                    Rotate
                  </OutlineButton>
                  <DangerButton
                    onClick={() => setPendingConfirm({ kind: 'revoke', keyId: key.id, prefix: key.key_prefix })}
                    disabled={busy !== null}
                  >
                    Revoke
                  </DangerButton>
                </div>
              ) : (
                '—'
              ),
          }))}
          empty={<EmptyState message="No API keys" />}
        />
        {canEdit ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <FormField label="New key label" width="lg">
              <Input
                value={newKeyLabel}
                onChange={(event) => setNewKeyLabel(event.target.value)}
                placeholder="default"
                maxLength={60}
                aria-label="New key label"
              />
            </FormField>
            <PrimaryButton onClick={() => void handleCreateKey()} loading={busy === 'key'} disabled={busy !== null}>
              Create key
            </PrimaryButton>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Webhook delivery log">
        <div className="mb-2 flex justify-end">
          <OutlineButton onClick={() => void loadDeliveries()} disabled={busy !== null}>
            Reload
          </OutlineButton>
        </div>
        <DataTable
          columns={[
            { key: 'event', heading: 'EVENT' },
            { key: 'entity', heading: 'ENTITY' },
            { key: 'status', heading: 'STATUS' },
            { key: 'attempts', heading: 'ATTEMPTS' },
            { key: 'http', heading: 'LAST HTTP' },
            { key: 'created', heading: 'CREATED' },
            { key: 'actions', heading: 'ACTIONS' },
          ]}
          rows={(deliveries?.items ?? []).map((delivery) => ({
            _rowKey: delivery.id,
            event: <span className="font-mono text-xs">{delivery.event}</span>,
            entity: <span className="font-mono text-xs">{delivery.entity_id.slice(0, 8)}</span>,
            status: <StatusBadge status={delivery.status} />,
            attempts: delivery.attempts,
            http: delivery.last_http_status ?? (delivery.last_error ? 'error' : '—'),
            created: formatWhen(delivery.created_at),
            actions: canEdit ? (
              <OutlineButton onClick={() => void handleResend(delivery.id)} disabled={busy !== null || !config.webhook_url}>
                {busy === `resend-${delivery.id}` ? 'Sending…' : 'Resend'}
              </OutlineButton>
            ) : (
              '—'
            ),
          }))}
          empty={<EmptyState message="No webhook deliveries yet" />}
          pagination={deliveries ? { page: deliveries.page, page_size: deliveries.page_size, total: deliveries.total } : undefined}
          onPage={setDeliveryPage}
        />
      </FormSection>

      {reveal ? (
        <Modal
          title="Copy these now"
          size="lg"
          footer={
            <div className="flex justify-end">
              <PrimaryButton onClick={() => setReveal(null)}>I have stored them</PrimaryButton>
            </div>
          }
        >
          <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
            These values are shown once and cannot be read again. Store them in the panel&apos;s secret store.
          </p>
          {reveal.api_key ? (
            <FormField label="API key (x-api-key header)">
              <div className="flex items-center gap-1">
                <Input value={reveal.api_key} readOnly className="font-mono" aria-label="API key" />
                <CopyButton value={reveal.api_key} label="Copy API key" />
              </div>
            </FormField>
          ) : null}
          {reveal.webhook_secret ? (
            <div className="mt-3">
              <FormField label="Webhook secret (verifies x-sp-signature)">
                <div className="flex items-center gap-1">
                  <Input value={reveal.webhook_secret} readOnly className="font-mono" aria-label="Webhook secret" />
                  <CopyButton value={reveal.webhook_secret} label="Copy webhook secret" />
                </div>
              </FormField>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {pendingConfirm?.kind === 'rotate' ? (
        <ConfirmDialog
          title={`Rotate key ${pendingConfirm.prefix}…?`}
          subtitle="A new key is issued now. The old key keeps working for 24 hours, then stops."
          confirmLabel="Rotate"
          variant="primary"
          loading={busy === 'confirm'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      ) : null}
      {pendingConfirm?.kind === 'revoke' ? (
        <ConfirmDialog
          title={`Revoke key ${pendingConfirm.prefix}…?`}
          subtitle="The key stops working on the next request. This cannot be undone."
          confirmLabel="Revoke"
          loading={busy === 'confirm'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      ) : null}
      {pendingConfirm?.kind === 'secret' ? (
        <ConfirmDialog
          title="Regenerate webhook secret?"
          subtitle="Webhooks are signed with the new secret immediately. Update the panel before the next event."
          confirmLabel="Regenerate"
          loading={busy === 'confirm'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      ) : null}
      {pendingConfirm?.kind === 'status' ? (
        <ConfirmDialog
          title={pendingConfirm.next === 'DISABLED' ? 'Disable API access?' : 'Enable API access?'}
          subtitle={
            pendingConfirm.next === 'DISABLED'
              ? 'Every key is refused until access is enabled again. Open pay-ins keep their state.'
              : 'Active keys work again on the next request.'
          }
          confirmLabel={pendingConfirm.next === 'DISABLED' ? 'Disable' : 'Enable'}
          variant={pendingConfirm.next === 'DISABLED' ? 'danger' : 'primary'}
          loading={busy === 'confirm'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      ) : null}
    </>
  )
}
