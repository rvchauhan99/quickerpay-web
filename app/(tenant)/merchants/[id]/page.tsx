'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { MerchantDetail, MerchantRate } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { RateInput } from '@/components/forms/RateInput'
import { DataTable, EmptyState, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { apiRequest, ApiClientError } from '@/lib/api'
import { RateDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

interface SupagoStatus {
  connected: boolean
  uname?: string
  bcode?: string
  transaction_code?: string | null
  expires_at?: string
  last_error?: string
}

type WithdrawRoutingMode = 'queue' | 'direct'

export default function MerchantDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('MERCHANTS')
  const { isSuperAdmin, admins } = useSuperAdminDirectory(accessToken, user?.role)
  const [merchant, setMerchant] = useState<MerchantDetail | null>(null)
  const [history, setHistory] = useState<MerchantRate[]>([])
  const [payinBp, setPayinBp] = useState(0)
  const [payoutBp, setPayoutBp] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingRate, setSavingRate] = useState<'PAYIN' | 'PAYOUT' | null>(null)
  const [routingMode, setRoutingMode] = useState<WithdrawRoutingMode>('queue')
  const [routingAdminId, setRoutingAdminId] = useState('')
  const [savingRouting, setSavingRouting] = useState(false)

  // Supago state
  const [supagoStatus, setSupagoStatus] = useState<SupagoStatus | null>(null)
  const [supagoUsername, setSupagoUsername] = useState('')
  const [supagoPassword, setSupagoPassword] = useState('')
  const [supagoTransactionCode, setSupagoTransactionCode] = useState('')
  const [supagoLoading, setSupagoLoading] = useState(false)
  const [supagoError, setSupagoError] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [updateCredsOpen, setUpdateCredsOpen] = useState(false)

  const loadSupagoStatus = useCallback(async (token: string, id: string) => {
    try {
      const status = await apiRequest<SupagoStatus>(`/api/v1/merchants/${id}/supago/status`, { token })
      setSupagoStatus(status)
      setSupagoTransactionCode(status.transaction_code ?? '')
    } catch {
      setSupagoStatus({ connected: false })
    }
  }, [])

  const applyRoutingFromDetail = (detail: MerchantDetail) => {
    if (detail.default_payout_admin_user_id) {
      setRoutingMode('direct')
      setRoutingAdminId(detail.default_payout_admin_user_id)
      return
    }
    setRoutingMode('queue')
    setRoutingAdminId('')
  }

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    setLoading(true)
    setError(null)
    try {
      const detail = await apiRequest<MerchantDetail>(`/api/v1/merchants/${params.id}`, { token: accessToken })
      const rates = await apiRequest<MerchantRate[]>(`/api/v1/merchants/${params.id}/rates`, { token: accessToken })
      setMerchant(detail)
      applyRoutingFromDetail(detail)
      setHistory(rates)
      setPayinBp(detail.rates.find((row) => row.rate_kind === 'PAYIN')?.rate_bp ?? 0)
      setPayoutBp(detail.rates.find((row) => row.rate_kind === 'PAYOUT')?.rate_bp ?? 0)
      void loadSupagoStatus(accessToken, params.id)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [accessToken, params.id, loadSupagoStatus])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSaveKind = async (kind: 'PAYIN' | 'PAYOUT') => {
    if (!accessToken || !params.id || savingRate) return
    setSavingRate(kind)
    try {
      await apiRequest(`/api/v1/merchants/${params.id}/rates`, {
        method: 'POST',
        token: accessToken,
        body: { rate_kind: kind, rate_bp: kind === 'PAYIN' ? payinBp : payoutBp },
      })
      toast.success(`${kind} rate updated`)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Save failed')
    } finally {
      setSavingRate(null)
    }
  }

  const handleSupagoConnect = async () => {
    const trimmedUsername = supagoUsername.trim()
    const trimmedPassword = supagoPassword.trim()
    const trimmedTransactionCode = supagoTransactionCode.trim()
    if (!accessToken || !params.id || !trimmedUsername || !trimmedPassword || !trimmedTransactionCode) return
    setSupagoLoading(true)
    setSupagoError(null)
    try {
      const status = await apiRequest<SupagoStatus>(`/api/v1/merchants/${params.id}/supago`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          supago_username: trimmedUsername,
          supago_password: trimmedPassword,
          supago_transaction_code: trimmedTransactionCode,
        },
      })
      setSupagoStatus(status)
      setSupagoUsername('')
      setSupagoPassword('')
      setSupagoTransactionCode(status.transaction_code ?? trimmedTransactionCode)
      setUpdateCredsOpen(false)
      toast.success(updateCredsOpen ? 'Supago credentials updated' : 'Supago connected')
    } catch (caught) {
      setSupagoError(caught instanceof ApiClientError ? caught.message : 'Connection failed')
    } finally {
      setSupagoLoading(false)
    }
  }

  const handleSupagoDisconnect = async () => {
    if (!accessToken || !params.id) return
    setSupagoLoading(true)
    setSupagoError(null)
    setConfirmDisconnect(false)
    try {
      const status = await apiRequest<SupagoStatus>(`/api/v1/merchants/${params.id}/supago`, {
        method: 'DELETE',
        token: accessToken,
      })
      setSupagoStatus(status)
      toast.success('Supago disconnected')
    } catch (caught) {
      setSupagoError(caught instanceof ApiClientError ? caught.message : 'Disconnect failed')
    } finally {
      setSupagoLoading(false)
    }
  }

  const handleSaveRouting = async () => {
    if (!accessToken || !params.id || savingRouting) return
    if (routingMode === 'direct' && !routingAdminId) {
      toast.error('Select an Admin for direct assign')
      return
    }
    setSavingRouting(true)
    try {
      const detail = await apiRequest<MerchantDetail>(`/api/v1/merchants/${params.id}/payout-routing`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          default_payout_admin_user_id: routingMode === 'direct' ? routingAdminId : null,
        },
      })
      setMerchant(detail)
      applyRoutingFromDetail(detail)
      toast.success('Withdraw routing updated')
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Could not save routing')
    } finally {
      setSavingRouting(false)
    }
  }

  const canEdit = hasMenu(menus, 'MERCHANTS', 'can_edit')
  const canEditRouting = Boolean(isSuperAdmin && canEdit)
  const activeAdmins = admins.filter((row) => row.role === 'ADMIN' && row.status === 'ACTIVE')

  return (
    <AppShell title="Merchant Detail" role={user.role} menus={menus}>
      <PageHeader title="Merchant Detail" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading || !merchant ? (
        <TableSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <FormShell>
            <FormSection title="Merchant Information" description="Legal name and status of the merchant.">
              <FormGrid>
                <FormField label="Legal Name">
                  <Input value={merchant.legal_name} readOnly />
                </FormField>
                <FormField label="Merchant Code">
                  <Input value={merchant.merchant_code} readOnly />
                </FormField>
                <FormField label="Status">
                  <div className="flex h-10 items-center px-3">
                    <StatusBadge status={merchant.status} />
                  </div>
                </FormField>
                <FormField label="Contact Email">
                  <Input value={merchant.contact_email ?? 'N/A'} readOnly />
                </FormField>
              </FormGrid>
            </FormSection>

            {canEdit ? (
              <FormSection title="Manage Rates" description="Update PAY-IN and PAY-OUT commission rates.">
                <FormGrid>
                  <FormField label="PAY-IN Rate">
                    <div className="flex items-center gap-2">
                      <RateInput id="edit-payin" valueBp={payinBp} onChangeBp={setPayinBp} />
                      <PrimaryButton disabled={savingRate === 'PAYIN'} onClick={() => void handleSaveKind('PAYIN')}>
                        {savingRate === 'PAYIN' ? 'Saving…' : 'Update'}
                      </PrimaryButton>
                    </div>
                  </FormField>
                  <FormField label="PAY-OUT Rate">
                    <div className="flex items-center gap-2">
                      <RateInput id="edit-payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
                      <PrimaryButton disabled={savingRate === 'PAYOUT'} onClick={() => void handleSaveKind('PAYOUT')}>
                        {savingRate === 'PAYOUT' ? 'Saving…' : 'Update'}
                      </PrimaryButton>
                    </div>
                  </FormField>
                </FormGrid>
              </FormSection>
            ) : null}

            {canEditRouting ? (
              <FormSection
                title="Withdraw routing"
                description="Where Supago Manual Withdraw requests land for this merchant. Changes apply to new polls only."
              >
                <FormGrid>
                  <FormField label="Routing" required>
                    <Select
                      id="withdraw-routing-mode"
                      value={routingMode}
                      onChange={(event) => {
                        const next = event.target.value as WithdrawRoutingMode
                        setRoutingMode(next)
                        if (next === 'queue') setRoutingAdminId('')
                      }}
                      aria-label="Withdraw routing mode"
                    >
                      <option value="queue">Super Admin queue (assign later)</option>
                      <option value="direct">Direct to Admin</option>
                    </Select>
                  </FormField>
                  {routingMode === 'direct' ? (
                    <FormField label="Admin" required>
                      <Select
                        id="withdraw-routing-admin"
                        value={routingAdminId}
                        onChange={(event) => setRoutingAdminId(event.target.value)}
                        aria-label="Default payout Admin"
                      >
                        <option value="">Select Admin</option>
                        {activeAdmins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.username}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  ) : (
                    <FormField label="Current">
                      <Input value="Unassigned until Super Admin bulk-assigns" readOnly />
                    </FormField>
                  )}
                </FormGrid>
                <div className="mt-3 flex justify-end">
                  <PrimaryButton
                    type="button"
                    disabled={savingRouting || (routingMode === 'direct' && !routingAdminId)}
                    onClick={() => void handleSaveRouting()}
                  >
                    {savingRouting ? 'Saving…' : 'Save routing'}
                  </PrimaryButton>
                </div>
              </FormSection>
            ) : merchant?.default_payout_admin_user_id ? (
              <FormSection title="Withdraw routing" description="Configured by Super Admin.">
                <FormField label="Direct Admin">
                  <Input
                    value={merchant.default_payout_admin_username ?? merchant.default_payout_admin_user_id}
                    readOnly
                  />
                </FormField>
              </FormSection>
            ) : null}
          </FormShell>

          <FormShell>
            <FormSection title="Rate History" description="Historical log of rate changes.">
              <DataTable
                columns={[
                  { key: 'kind', heading: 'KIND' },
                  { key: 'rate', heading: 'RATE' },
                  { key: 'from', heading: 'EFFECTIVE FROM' },
                ]}
                rows={history.map((row) => ({
                  kind: row.rate_kind,
                  rate: <RateDisplay rateBp={row.rate_bp} />,
                  from: new Date(row.effective_from).toLocaleString(),
                }))}
                empty={<EmptyState message="No rate history" />}
              />
            </FormSection>
          </FormShell>

          <FormShell>
            <FormSection title="Supago Integration" description="Connect this merchant to the Supago platform for automated deposits.">
              {supagoError ? (
                <div className="mb-3">
                  <ErrorAlert message={supagoError} />
                </div>
              ) : null}

              {supagoStatus?.connected ? (
                <>
                  <FormGrid>
                    <FormField label="Supago Username">
                      <Input value={supagoStatus.uname ?? ''} readOnly />
                    </FormField>
                    <FormField label="Branch Code">
                      <Input value={supagoStatus.bcode ?? ''} readOnly />
                    </FormField>
                    <FormField label="Token Expires">
                      <Input
                        value={supagoStatus.expires_at ? new Date(supagoStatus.expires_at).toLocaleString() : ''}
                        readOnly
                      />
                    </FormField>
                    <FormField label="Transaction Code">
                      <Input value={supagoStatus.transaction_code ?? ''} readOnly />
                    </FormField>
                    <FormField label="Status">
                      <div className="flex h-10 items-center px-3">
                        <StatusBadge status="ACTIVE" />
                      </div>
                    </FormField>
                  </FormGrid>

                  {canEdit ? (
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUpdateCredsOpen((open) => !open)
                          setSupagoUsername('')
                          setSupagoPassword('')
                          setSupagoTransactionCode(supagoStatus.transaction_code ?? '')
                          setSupagoError(null)
                        }}
                        disabled={supagoLoading}
                        className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                        style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
                      >
                        {updateCredsOpen ? 'Cancel' : 'Change'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDisconnect(true)}
                        disabled={supagoLoading}
                        className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                        style={{ borderColor: 'var(--qp-danger)', color: 'var(--qp-danger)', backgroundColor: 'var(--qp-danger-bg)' }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : null}

                  {canEdit && updateCredsOpen ? (
                    <div className="mt-3 rounded-lg border p-4" style={{ borderColor: 'var(--qp-border)', backgroundColor: 'var(--qp-bg-card)' }}>
                      <FormGrid>
                        <FormField label="Username" required>
                          <Input
                            value={supagoUsername}
                            onChange={(e) => setSupagoUsername(e.target.value)}
                            placeholder="New Supago username"
                            aria-label="Supago username"
                          />
                        </FormField>
                        <FormField label="Password" required>
                          <Input
                            type="password"
                            value={supagoPassword}
                            onChange={(e) => setSupagoPassword(e.target.value)}
                            placeholder="New Supago password"
                            aria-label="Supago password"
                          />
                        </FormField>
                        <FormField label="Transaction Code" required>
                          <Input
                            value={supagoTransactionCode}
                            onChange={(e) => setSupagoTransactionCode(e.target.value)}
                            placeholder="e.g. 643795"
                            aria-label="Supago transaction code"
                          />
                        </FormField>
                      </FormGrid>
                      <div className="mt-3 flex justify-end">
                        <PrimaryButton
                          onClick={() => void handleSupagoConnect()}
                          disabled={
                            supagoLoading ||
                            !supagoUsername.trim() ||
                            !supagoPassword.trim() ||
                            !supagoTransactionCode.trim()
                          }
                        >
                          {supagoLoading ? 'Saving…' : 'Save'}
                        </PrimaryButton>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                canEdit ? (
                  <>
                    <FormGrid>
                      <FormField label="Supago Username" required>
                        <Input
                          value={supagoUsername}
                          onChange={(e) => setSupagoUsername(e.target.value)}
                          placeholder="Enter Supago username"
                          aria-label="Supago username"
                        />
                      </FormField>
                      <FormField label="Supago Password" required>
                        <Input
                          type="password"
                          value={supagoPassword}
                          onChange={(e) => setSupagoPassword(e.target.value)}
                          placeholder="Enter Supago password"
                          aria-label="Supago password"
                        />
                      </FormField>
                      <FormField label="Transaction Code" required>
                        <Input
                          value={supagoTransactionCode}
                          onChange={(e) => setSupagoTransactionCode(e.target.value)}
                          placeholder="e.g. 643795"
                          aria-label="Supago transaction code"
                        />
                      </FormField>
                    </FormGrid>
                    <div className="mt-4 flex justify-end">
                      <PrimaryButton
                        onClick={() => void handleSupagoConnect()}
                        disabled={
                          supagoLoading ||
                          !supagoUsername.trim() ||
                          !supagoPassword.trim() ||
                          !supagoTransactionCode.trim()
                        }
                      >
                        {supagoLoading ? 'Connecting…' : 'Connect'}
                      </PrimaryButton>
                    </div>
                  </>
                ) : (
                  <p className="text-xs py-2" style={{ color: 'var(--qp-text-muted)' }}>Not connected</p>
                )
              )}
            </FormSection>
          </FormShell>
        </div>
      )}

      {confirmDisconnect ? (
        <ConfirmDialog
          title="Disconnect Supago?"
          subtitle="The cached token will be evicted and credentials removed. You can reconnect at any time."
          confirmLabel="Disconnect"
          variant="danger"
          loading={supagoLoading}
          onConfirm={() => void handleSupagoDisconnect()}
          onCancel={() => setConfirmDisconnect(false)}
        />
      ) : null}
    </AppShell>
  )
}
