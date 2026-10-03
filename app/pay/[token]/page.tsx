import type { Metadata } from 'next'
import { brandName } from '@/lib/brand'
import { HostedPayPage } from './HostedPayPage'

export const metadata: Metadata = {
  title: `Pay · ${brandName()}`,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <HostedPayPage token={token} />
}
