import type { Metadata } from 'next'
import { brandName } from '@/lib/brand'
import { HostedPayoutPage } from './HostedPayoutPage'

export const metadata: Metadata = {
  title: `Confirm pay-out · ${brandName()}`,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function WithdrawPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <HostedPayoutPage token={token} />
}
