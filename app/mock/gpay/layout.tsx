import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { isLabConsole } from '@/lib/lab'
import { SessionProvider } from '@/lib/session'
import { RedirectLoopbackToLocalhost } from './redirect-loopback'

export const metadata: Metadata = {
  title: 'Mock Google Pay — QuickerPay',
  robots: { index: false, follow: false },
}

export default function MockGpayLayout({ children }: { children: ReactNode }) {
  if (!isLabConsole()) notFound()
  return (
    <SessionProvider>
      <RedirectLoopbackToLocalhost />
      {children}
    </SessionProvider>
  )
}

