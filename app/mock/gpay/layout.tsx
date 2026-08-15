import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Mock Google Pay — QuickerPay',
  robots: { index: false, follow: false },
}

export default function MockGpayLayout({ children }: { children: ReactNode }) {
  return children
}
