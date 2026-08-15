'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { AdminRate, MerchantDetail, MerchantListItem, UserListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { RateInput } from '@/components/forms/RateInput'
import { EmptyState } from '@/components/ui/FilterBar'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { RateDisplay } from '@/lib/money'
import { hasMenu, useSession } from '@/lib/session'

export default function CommissionConfigPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [merchants, setMerchants] = useState<MerchantDetail[]>([])
  const [admins, setAdmins] = useState<Array<UserListItem & { rates: AdminRate[] }>>([])
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { PAYIN: number; PAYOUT: number }>>({})

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      const [merchantRows, adminRows] = await Promise.all([
        apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken }),
        apiListRequest<UserListItem>('/api/v1/users?role=ADMIN&page_size=100', { token: accessToken }),
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
      const next: Record<string, { PAYIN: number; PAYOUT: number }> = {}
      for (const admin of withRates) {
        next[admin.id] = {
          PAYIN: openBp(admin.rates, 'PAYIN'),
          PAYOUT: openBp(admin.rates, 'PAYOUT'),
        }
      }
      setDrafts(next)
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

  if (!ready) return <p className="p-4 text-sm text-zinc-500">Loading</p>
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
      setError(caught instanceof ApiClientError ? caught.message : 'Save failed')
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
      setError(caught instanceof ApiClientError ? caught.message : 'Save failed')
    }
  }

  return (
    <AppShell title="Commission configuration" role={user.role} menus={menus}>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      <section className="mb-4">
        <h2 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Merchants</h2>
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
        <h2 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Admins</h2>
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
                    <span className="text-zinc-500">Merchant rate (reference)</span>
                    <RateDisplay rateBp={merchantPayin} />
                    <RateDisplay rateBp={merchantPayout} />
                    <span>Admin rate</span>
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
                    <p className="mt-1 text-xs text-red-700">The admin rate exceeds the merchant rate of the same kind</p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 h-7 rounded bg-zinc-900 px-3 text-xs text-white disabled:bg-zinc-300"
                    disabled={payinInvalid || payoutInvalid}
                    onClick={() => void handleSaveAdmin(admin.id)}
                  >
                    Save
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </AppShell>
  )
}

import { FormField } from '@/components/forms/FormField'

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
