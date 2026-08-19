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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-100 border-t-emerald-500" />
          <span className="text-lg font-bold tracking-tight text-emerald-600">QP</span>
        </div>
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    </div>
  )
}
