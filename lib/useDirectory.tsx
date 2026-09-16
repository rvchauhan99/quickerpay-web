'use client'

import { useEffect, useState } from 'react'
import type { MerchantListItem, UserListItem } from '@quickerpay/shared-types'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import { apiListRequest } from '@/lib/api'

/** Roles that may filter Pay-In / Pay-Out / Dashboard by merchant. */
const MERCHANT_FILTER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'AUDITOR'])

export function useSuperAdminDirectory(accessToken: string | null, role: string | undefined) {
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const canFilterMerchants = Boolean(role && MERCHANT_FILTER_ROLES.has(role))
  const [admins, setAdmins] = useState<UserListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])

  useEffect(() => {
    if (!accessToken) return

    if (isSuperAdmin) {
      void Promise.all([
        apiListRequest<UserListItem>('/api/v1/users?role=ADMIN&page_size=100', { token: accessToken }),
        apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken }).catch(() => ({
          items: [] as MerchantListItem[],
        })),
      ]).then(([adminRows, merchantRows]) => {
        setAdmins(adminRows.items)
        setMerchants(merchantRows.items)
      })
      return
    }

    if (!canFilterMerchants) return
    void apiListRequest<MerchantListItem>('/api/v1/merchants?status=ACTIVE&page_size=100', {
      token: accessToken,
    })
      .then((result) => setMerchants(result.items))
      .catch(() => setMerchants([]))
  }, [accessToken, isSuperAdmin, canFilterMerchants])

  return { isSuperAdmin, canFilterMerchants, admins, merchants }
}

export function SuperAdminDirectoryFilters(props: {
  admins: { id: string; username: string }[]
  merchants: MerchantListItem[]
  adminId?: string
  merchantId?: string
  onAdminChange?: (value: string) => void
  onMerchantChange?: (value: string) => void
  showAdmin?: boolean
  showMerchant?: boolean
}) {
  const showAdmin = props.showAdmin !== false && Boolean(props.onAdminChange)
  const showMerchant = props.showMerchant !== false && Boolean(props.onMerchantChange)
  if (!showAdmin && !showMerchant) return null

  return (
    <>
      {showAdmin ? (
        <FormField label="Admin">
          <Select
            aria-label="Admin"
            value={props.adminId ?? ''}
            onChange={(event) => props.onAdminChange?.(event.target.value)}
          >
            <option value="">All Admins</option>
            {props.admins.map((row) => (
              <option key={row.id} value={row.id}>{row.username}</option>
            ))}
          </Select>
        </FormField>
      ) : null}
      {showMerchant ? (
        <FormField label="Merchant">
          <Select
            aria-label="Merchant"
            value={props.merchantId ?? ''}
            onChange={(event) => props.onMerchantChange?.(event.target.value)}
          >
            <option value="">All Merchants</option>
            {props.merchants.map((row) => (
              <option key={row.id} value={row.id}>{row.display_name}</option>
            ))}
          </Select>
        </FormField>
      ) : null}
    </>
  )
}
