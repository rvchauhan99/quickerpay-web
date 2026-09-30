'use client'

import { useEffect, useState } from 'react'
import type { MerchantListItem, UserListItem } from '@quickerpay/shared-types'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import { apiListRequest } from '@/lib/api'
import { bankerLabel, merchantLabel } from '@/lib/labels'
import { canSeeMerchants } from '@/lib/merchant-visibility'

export function useSuperAdminDirectory(accessToken: string | null, role: string | undefined) {
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const canFilterDirectory = role === 'SUPER_ADMIN' || role === 'ADMIN'
  const canFilterMerchants = canSeeMerchants(role)
  const [admins, setAdmins] = useState<UserListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])

  useEffect(() => {
    if (!accessToken) return

    if (canFilterDirectory) {
      void Promise.all([
        apiListRequest<UserListItem>('/api/v1/users?role=BANKER&page_size=100', { token: accessToken }),
        canFilterMerchants
          ? apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken }).catch(() => ({
              items: [] as MerchantListItem[],
            }))
          : Promise.resolve({ items: [] as MerchantListItem[] }),
      ]).then(([adminRows, merchantRows]) => {
        setAdmins(adminRows.items)
        setMerchants(merchantRows.items)
      })
      return
    }

    setAdmins([])
    setMerchants([])
  }, [accessToken, canFilterDirectory, canFilterMerchants])

  return { isSuperAdmin, canFilterMerchants, admins, merchants }
}

export function SuperAdminDirectoryFilters(props: {
  admins: { id: string; username: string }[]
  merchants: MerchantListItem[]
  adminId?: string | undefined
  merchantId?: string | undefined
  onAdminChange?: ((value: string) => void) | undefined
  onMerchantChange?: ((value: string) => void) | undefined
  showAdmin?: boolean | undefined
  showMerchant?: boolean | undefined
}) {
  const showAdmin = props.showAdmin !== false && Boolean(props.onAdminChange)
  const showMerchant = props.showMerchant !== false && Boolean(props.onMerchantChange)
  if (!showAdmin && !showMerchant) return null

  return (
    <>
      {showAdmin ? (
        <FormField label={bankerLabel()}>
          <Select
            aria-label={bankerLabel()}
            value={props.adminId ?? ''}
            onChange={(event) => props.onAdminChange?.(event.target.value)}
          >
            <option value="">All {bankerLabel({ plural: true })}</option>
            {props.admins.map((row) => (
              <option key={row.id} value={row.id}>{row.username}</option>
            ))}
          </Select>
        </FormField>
      ) : null}
      {showMerchant ? (
        <FormField label={merchantLabel()}>
          <Select
            aria-label={merchantLabel()}
            value={props.merchantId ?? ''}
            onChange={(event) => props.onMerchantChange?.(event.target.value)}
          >
            <option value="">All {merchantLabel({ plural: true })}</option>
            {props.merchants.map((row) => (
              <option key={row.id} value={row.id}>{row.display_name}</option>
            ))}
          </Select>
        </FormField>
      ) : null}
    </>
  )
}
