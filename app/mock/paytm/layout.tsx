import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { brandName } from '@/lib/brand'
import { isLabConsole } from '@/lib/lab'
import { SessionProvider } from '@/lib/session'
import { RedirectLoopbackToLocalhost } from '../gpay/redirect-loopback'

export const metadata: Metadata = {
  title: `Mock Paytm Business — ${brandName()}`,
  robots: { index: false, follow: false },
}

export default function MockPaytmLayout({ children }: { children: ReactNode }) {
  if (!isLabConsole()) notFound()
  return (
    <SessionProvider>
      <RedirectLoopbackToLocalhost />
      {children}
    </SessionProvider>
  )
}
