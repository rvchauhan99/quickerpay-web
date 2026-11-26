'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Toaster } from 'sonner'
import { SessionProvider, useSession } from '@/lib/session'
import { LiveStreamProvider } from '@/lib/live/LiveStreamProvider'
import { useOperationalStateSync } from '@/lib/live/useOperationalStateSync'

export default function TenantGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <SessionProvider>
        <LiveStreamProvider>
          <SessionGate>{children}</SessionGate>
        </LiveStreamProvider>
      </SessionProvider>
      <Toaster position="top-right" richColors closeButton duration={4000} />
    </NuqsAdapter>
  )
}

function SessionGate({ children }: { children: ReactNode }) {
  const { ready, user } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (ready && !user && !isLoginPage) {
      router.replace('/login')
    }
  }, [ready, user, isLoginPage, router])

  // Always render the login page — it manages its own loading state
  if (isLoginPage) return <>{children}</>

  if (!ready) return <FullScreenSpinner />

  // user is null and not on login — redirect is in-flight, render nothing
  if (!user) return null

  return (
    <>
      <OperationalStateSync />
      {children}
    </>
  )
}

function OperationalStateSync() {
  useOperationalStateSync()
  return null
}

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--qp-card)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4" style={{ borderColor: 'var(--qp-border)', borderTopColor: 'var(--qp-primary)' }} />
          <span className="text-[11px] font-bold leading-none tracking-tight" style={{ color: 'var(--qp-primary)' }}>SAFEPAY</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>Loading…</p>
      </div>
    </div>
  )
}
