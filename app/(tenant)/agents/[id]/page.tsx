'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { RateKind } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { RateDisplay } from '@/lib/money'
import { apiRequest, ApiClientError } from '@/lib/api'
import { agentLabel, merchantLabel } from '@/lib/labels'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

interface AgentExchangeLink {
  merchant_id: string
  merchant_code: string
  display_name: string
  status: string
  rates: Array<{ rate_kind: RateKind; rate_bp: number; effective_from: string }>
}

interface AgentDetail {
  id: string
  username: string
  display_name: string
  status: string
  email: string | null
  mobile: string | null
  exchange_count: number
  created_at: string
  exchanges: AgentExchangeLink[]
}

function openBp(rates: AgentExchangeLink['rates'], kind: RateKind): number | undefined {
  return rates.find((row) => row.rate_kind === kind)?.rate_bp
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const canManage =
    allowed && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && hasMenu(menus, 'USERS', 'can_view')

  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!params.id) return
    setLoading(true)
    setError(null)
    try {
      const detail = await apiRequest<AgentDetail>(`/api/v1/agents/${params.id}`)
      setAgent(detail)
      setDisplayName(detail.display_name)
      setEmail(detail.email ?? '')
      setMobile(detail.mobile ?? '')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (ready && canManage) void load()
  }, [ready, canManage, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!canManage) return Forbidden

  const handleSave = async () => {
    if (!accessToken || !agent || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await apiRequest<AgentDetail>(`/api/v1/agents/${agent.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          display_name: displayName,
          email: email.trim() || null,
          mobile: mobile.trim() || null,
        },
      })
      setAgent(updated)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title={agent?.username ?? agentLabel()} role={user.role} menus={menus}>
      <PageHeader title={agent?.username ?? agentLabel()} />
      {error ? <ErrorAlert message={error} /> : null}
      {loading || !agent ? (
        <TableSkeleton />
      ) : (
        <>
          <p className="mb-3 text-xs text-zinc-500">
            Status {agent.status} · {agent.exchange_count} linked {merchantLabel({ plural: true })}
          </p>
          <FormShell
            title="Profile"
            loading={submitting}
            onCancel={() => router.push('/agents')}
            onSubmit={() => void handleSave()}
            submitLabel="Save"
          >
            <FormSection title="Identity">
              <FormGrid>
                <FormField label="Username">
                  <Input value={agent.username} disabled />
                </FormField>
                <FormField label="Display name">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                <FormField label="Mobile">
                  <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </FormField>
                <FormField label="Status">
                  <StatusBadge status={agent.status} />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>

          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-zinc-800">Linked {merchantLabel({ plural: true })}</h2>
            <DataTable
              columns={[
                { key: 'code', heading: 'CODE' },
                { key: 'name', heading: 'NAME' },
                { key: 'payin', heading: 'AGENT PAYIN' },
                { key: 'payout', heading: 'AGENT PAYOUT' },
                { key: 'status', heading: 'STATUS' },
              ]}
              rows={agent.exchanges.map((ex) => ({
                code: (
                  <a className="text-emerald-700 underline" href={`/merchants/${ex.merchant_id}`}>
                    {ex.merchant_code}
                  </a>
                ),
                name: ex.display_name,
                payin: <RateDisplay rateBp={openBp(ex.rates, 'PAYIN')} />,
                payout: <RateDisplay rateBp={openBp(ex.rates, 'PAYOUT')} />,
                status: <StatusBadge status={ex.status} />,
              }))}
              empty={<EmptyState message={`No ${merchantLabel({ plural: true }).toLowerCase()} linked yet. Assign on the Exchange Master page.`} />}
            />
          </div>
        </>
      )}
    </AppShell>
  )
}
