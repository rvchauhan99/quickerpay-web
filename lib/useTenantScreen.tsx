'use client'

import type { MenuCode } from '@quickerpay/shared-types'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { hasMenu, useSession } from '@/lib/session'

export function useTenantScreen(code: MenuCode) {
  const session = useSession()
  const allowed = hasMenu(session.menus, code)

  return {
    ...session,
    allowed,
    Forbidden: allowed ? null : <ForbiddenPage permission={`${code}.can_view`} />,
  }
}
