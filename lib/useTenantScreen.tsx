'use client'

import { useRouter } from 'next/navigation'
import type { MenuCode } from '@quickerpay/shared-types'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { hasMenu, useSession } from '@/lib/session'

export function useTenantScreen(code: MenuCode) {
  const router = useRouter()
  const session = useSession()
  if (session.ready && !session.user) router.replace('/login')
  const allowed = hasMenu(session.menus, code)
  return {
    ...session,
    allowed,
    Forbidden: allowed ? null : <ForbiddenPage permission={`${code}.can_view`} />,
  }
}
