'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { AdminRate, MerchantDetail, MerchantListItem, UserListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { RateInput } from '@/components/forms/RateInput'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { EmptyState } from '@/components/ui/FilterBar'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError, formError } from '@/lib/api'
import { agentLabel, bankerLabel, merchantLabel } from '@/lib/labels'
import { RateDisplay } from '@/lib/money'
import { hasMenu, useSession } from '@/lib/session'

export default function CommissionConfigPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [merchants, setMerchants] = useState<MerchantDetail[]>([])
  const [admins, setAdmins] = useState<Array<UserListItem & { rates: AdminRate[] }>>([])
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { PAYIN: number; PAYOUT: number }>>({})
  const [agentOptions, setAgentOptions] = useState<Array<{ id: string; username: string }>>([])
  const [brokerDrafts, setBrokerDrafts] = useState<
    Record<string, { agentId: string; PAYIN: number; PAYOUT: number }>
  >({})

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      const [merchantRows, adminRows, agentRows] = await Promise.all([
        apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken }),
        apiListRequest<UserListItem>('/api/v1/users?role=BANKER&page_size=100', { token: accessToken }),
        apiListRequest<{ id: string; username: string; banker_count: number }>(
          '/api/v1/agents?page_size=100&status=ACTIVE',
          { token: accessToken },
        ),
      ])
      const details = await Promise.all(
        merchantRows.items.map((row) => apiRequest<MerchantDetail>(`/api/v1/merchants/${row.id}`, { token: accessToken })),
      )
      const withRates = await Promise.all(
        adminRows.items.map(async (row) => ({
          ...row,
          rates: await apiRequest<AdminRate[]>(`/api/v1/admins/${row.id}/rates`, { token: accessToken }),
        })),
      )
      setMerchants(details)
      setAdmins(withRates)
      setAgentOptions(agentRows.items.map((row) => ({ id: row.id, username: row.username })))
      const linked = await Promise.all(
        agentRows.items
          .filter((row) => row.banker_count > 0)
          .map((row) =>
            apiRequest<{
              id: string
              bankers: Array<{
                banker_user_id: string
                rates: Array<{ rate_kind: 'PAYIN' | 'PAYOUT'; rate_bp: number }>
              }>
            }>(`/api/v1/agents/${row.id}`, { token: accessToken }),
          ),
      )
      const next: Record<string, { PAYIN: number; PAYOUT: number }> = {}
      const brokers: Record<string, { agentId: string; PAYIN: number; PAYOUT: number }> = {}
      for (const admin of withRates) {
        next[admin.id] = {
          PAYIN: openBp(admin.rates, 'PAYIN'),
          PAYOUT: openBp(admin.rates, 'PAYOUT'),
        }
        brokers[admin.id] = { agentId: '', PAYIN: 0, PAYOUT: 0 }
      }
      for (const agent of linked) {
        for (const link of agent.bankers ?? []) {
          brokers[link.banker_user_id] = {
            agentId: agent.id,
            PAYIN: link.rates.find((rate) => rate.rate_kind === 'PAYIN')?.rate_bp ?? 0,
            PAYOUT: link.rates.find((rate) => rate.rate_kind === 'PAYOUT')?.rate_bp ?? 0,
          }
        }
      }
      setDrafts(next)
      setBrokerDrafts(brokers)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message} ${caught.requestId}` : 'Could not load rates')
    }
  }, [accessToken])

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!hasMenu(menus, 'COMMISSION', 'can_edit')) return
    void load()
  }, [ready, user, menus, load, router])

  if (!ready) return <p className="p-qp-card text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (!hasMenu(menus, 'COMMISSION', 'can_edit')) return <ForbiddenPage permission="COMMISSION.can_edit" />

  const reference = merchants[0]
  const merchantPayin = openBp(reference?.rates ?? [], 'PAYIN')
  const merchantPayout = openBp(reference?.rates ?? [], 'PAYOUT')

  const handleSaveAdmin = async (adminId: string) => {
    const draft = drafts[adminId]
    if (!draft || !accessToken) return
    try {
      await apiRequest(`/api/v1/admins/${adminId}/rates`, {
        method: 'POST',
        token: accessToken,
        body: { rate_kind: 'PAYIN', rate_bp: draft.PAYIN },
      })
      await apiRequest(`/api/v1/admins/${adminId}/rates`, {
        method: 'POST',
        token: accessToken,
        body: { rate_kind: 'PAYOUT', rate_bp: draft.PAYOUT },
      })
      await load()
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? `${formError(caught, 'Save failed').banner}${caught.requestId ? ` (${caught.requestId})` : ''}`
          : 'Save failed',
      )
    }
  }

  const handleSaveBroker = async (adminId: string) => {
    const draft = brokerDrafts[adminId]
    if (!draft || !accessToken) return
    try {
      await apiRequest(`/api/v1/admins/${adminId}/agent`, {
        method: 'POST',
        token: accessToken,
        body: draft.agentId
          ? {
              agent_user_id: draft.agentId,
              rates: [
                { rate_kind: 'PAYIN', rate_bp: draft.PAYIN },
                { rate_kind: 'PAYOUT', rate_bp: draft.PAYOUT },
              ],
            }
          : { agent_user_id: null },
      })
      await load()
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? `${formError(caught, 'Save failed').banner}${caught.requestId ? ` (${caught.requestId})` : ''}`
          : 'Save failed',
      )
    }
  }
  const handleSaveMerchant = async (merchantId: string, kind: 'PAYIN' | 'PAYOUT', rateBp: number) => {
    if (!accessToken) return
    try {
      await apiRequest(`/api/v1/merchants/${merchantId}/rates`, {
        method: 'POST',
        token: accessToken,
        body: { rate_kind: kind, rate_bp: rateBp },
      })
      await load()
    } catch (caught) {
      setError(formError(caught, 'Save failed').banner)
    }
  }

  return (
    <AppShell title="Commission configuration" role={user.role} menus={menus}>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      <section className="mb-qp-gap">
        <h2 className="mb-1 text-xs font-semibold uppercase text-zinc-500">{merchantLabel({ plural: true })}</h2>
        {merchants.length === 0 ? (
          <EmptyState message="No records match these filters" />
        ) : (
          <div className="space-y-2">
            {merchants.map((merchant) => (
              <MerchantRateRow key={merchant.id} merchant={merchant} onSave={handleSaveMerchant} />
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase text-zinc-500">{bankerLabel({ plural: true })}</h2>
        {admins.length === 0 ? (
          <EmptyState message="No records match these filters" />
        ) : (
          <div className="space-y-2">
            {admins.map((admin) => {
              const draft = drafts[admin.id] ?? { PAYIN: 0, PAYOUT: 0 }
              const payinInvalid = draft.PAYIN > merchantPayin && merchantPayin > 0
              const payoutInvalid = draft.PAYOUT > merchantPayout && merchantPayout > 0
              return (
                <div key={admin.id} className="rounded border border-zinc-200 bg-white p-2">
                  <p className="text-sm font-medium">Commission — {admin.display_name}</p>
                  <div className="mt-2 grid grid-cols-[8rem_1fr_1fr] items-end gap-2 text-xs">
                    <span />
                    <span className="font-medium">PAY-IN</span>
                    <span className="font-medium">PAY-OUT</span>
                    <span className="text-zinc-500">{merchantLabel()} rate (reference)</span>
                    <RateDisplay rateBp={merchantPayin} />
                    <RateDisplay rateBp={merchantPayout} />
                    <span>{bankerLabel()} rate</span>
                    <RateInput
                      id={`${admin.id}-payin`}
                      valueBp={draft.PAYIN}
                      onChangeBp={(rateBp) =>
                        setDrafts((current) => ({ ...current, [admin.id]: { ...draft, PAYIN: rateBp } }))
                      }
                    />
                    <RateInput
                      id={`${admin.id}-payout`}
                      valueBp={draft.PAYOUT}
                      onChangeBp={(rateBp) =>
                        setDrafts((current) => ({ ...current, [admin.id]: { ...draft, PAYOUT: rateBp } }))
                      }
                    />
                    <span>Your margin</span>
                    <RateDisplay rateBp={merchantPayin - draft.PAYIN} />
                    <RateDisplay rateBp={merchantPayout - draft.PAYOUT} />
                  </div>
                  {payinInvalid || payoutInvalid ? (
                    <p className="mt-1 text-xs text-red-700">The {bankerLabel().toLowerCase()} rate exceeds the {merchantLabel().toLowerCase()} rate of the same kind</p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 h-7 rounded bg-zinc-900 px-3 text-xs text-white disabled:bg-zinc-300"
                    disabled={payinInvalid || payoutInvalid}
                    onClick={() => void handleSaveAdmin(admin.id)}
                  >
                    Save
                  </button>
                  <BrokerAssign
                    adminId={admin.id}
                    options={agentOptions}
                    draft={brokerDrafts[admin.id] ?? { agentId: '', PAYIN: 0, PAYOUT: 0 }}
                    onChange={(next) => setBrokerDrafts((current) => ({ ...current, [admin.id]: next }))}
                    onSave={() => void handleSaveBroker(admin.id)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </AppShell>
  )
}

function BrokerAssign({
  adminId,
  options,
  draft,
  onChange,
  onSave,
}: {
  adminId: string
  options: Array<{ id: string; username: string }>
  draft: { agentId: string; PAYIN: number; PAYOUT: number }
  onChange: (next: { agentId: string; PAYIN: number; PAYOUT: number }) => void
  onSave: () => void
}) {
  return (
    <div className="mt-3 border-t border-zinc-100 pt-2">
      <p className="text-xs font-medium text-zinc-600">{agentLabel()} (from this {bankerLabel().toLowerCase()} rate)</p>
      <div className="mt-2 grid grid-cols-[8rem_1fr_1fr] items-end gap-2 text-xs">
        <FormField label={agentLabel()}>
          <Select
            id={`${adminId}-agent`}
            value={draft.agentId}
            onChange={(event) => onChange({ ...draft, agentId: event.target.value })}
            aria-label={agentLabel()}
          >
            <option value="">None</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.username}
              </option>
            ))}
          </Select>
        </FormField>
        {draft.agentId ? (
          <>
            <FormField label="PAY-IN brokerage">
              <RateInput
                id={`${adminId}-broker-payin`}
                valueBp={draft.PAYIN}
                onChangeBp={(rateBp) => onChange({ ...draft, PAYIN: rateBp })}
              />
            </FormField>
            <FormField label="PAY-OUT brokerage">
              <RateInput
                id={`${adminId}-broker-payout`}
                valueBp={draft.PAYOUT}
                onChangeBp={(rateBp) => onChange({ ...draft, PAYOUT: rateBp })}
              />
            </FormField>
          </>
        ) : null}
      </div>
      <button type="button" className="mt-2 h-7 rounded bg-zinc-900 px-3 text-xs text-white" onClick={onSave}>
        Save {agentLabel()}
      </button>
    </div>
  )
}

function MerchantRateRow({
  merchant,
  onSave,
}: {
  merchant: MerchantDetail
  onSave: (id: string, kind: 'PAYIN' | 'PAYOUT', rateBp: number) => Promise<void>
}) {
  const [payin, setPayin] = useState(openBp(merchant.rates, 'PAYIN'))
  const [payout, setPayout] = useState(openBp(merchant.rates, 'PAYOUT'))
  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-zinc-200 bg-white p-2">
      <p className="w-40 text-sm font-medium">{merchant.legal_name}</p>
      <FormField label="PAY-IN">
        <RateInput id={`${merchant.id}-payin`} valueBp={payin} onChangeBp={setPayin} />
      </FormField>
      <FormField label="PAY-OUT">
        <RateInput id={`${merchant.id}-payout`} valueBp={payout} onChangeBp={setPayout} />
      </FormField>
      <button
        type="button"
        className="h-7 rounded bg-zinc-900 px-3 text-xs text-white"
        onClick={() => {
          void onSave(merchant.id, 'PAYIN', payin)
          void onSave(merchant.id, 'PAYOUT', payout)
        }}
      >
        Save
      </button>
    </div>
  )
}

function openBp(rates: AdminRate[] | MerchantDetail['rates'], kind: 'PAYIN' | 'PAYOUT'): number {
  return rates.find((row) => row.rate_kind === kind)?.rate_bp ?? 0
}
