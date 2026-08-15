'use client'

import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { SessionProvider } from '@/lib/session'

export default function TenantGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <SessionProvider>{children}</SessionProvider>
    </NuqsAdapter>
  )
}
