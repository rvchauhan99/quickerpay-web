import { PANEL_BANK_CONSOLE_ENABLED } from '@quickerpay/shared-types'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const CLOSED_PANEL_BANK_PATHS = ['/supago-banks', '/crici-banks']
const LAB_MOCK_PATHS = ['/mock/gpay', '/mock/paytm', '/mock/bharatpe']

/**
 * Gateway hosted links are `/payin/{token}` and `/payout/{token}` (FastTag parity).
 * Those paths also hold the console detail screens `/payin/{uuid}` and `/payout/{uuid}`.
 * A pay-link token is 40+ base64url characters and a row id is a 36 character UUID,
 * so only a token is rewritten to the public, session-free hosted page.
 */
const HOSTED_TOKEN = /^\/(payin|payout)\/([A-Za-z0-9_-]{40,64})\/?$/
const HOSTED_TARGET: Record<string, string> = { payin: '/pay', payout: '/withdraw' }

/**
 * SINGLE_TENANT deployments have no Platform Owner console. Those routes 404
 * so a dedicated client cannot reach /platform/* on the same build.
 *
 * Supago Banks and Crici Banks 404 while PANEL_BANK_CONSOLE_ENABLED is false.
 * Mock GPay / Paytm / BharatPe pages 404 on production Next builds.
 *
 * Both rewrite to /closed, which calls notFound() so the response stays HTTP 404
 * and the body is the branded not-found page. /closed is outside the matcher.
 */
function rewriteNotFound(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/closed'
  return NextResponse.rewrite(url)
}

export function middleware(request: NextRequest) {
  const hosted = HOSTED_TOKEN.exec(request.nextUrl.pathname)
  if (hosted) {
    const url = request.nextUrl.clone()
    url.pathname = `${HOSTED_TARGET[hosted[1]!]}/${hosted[2]}`
    return NextResponse.rewrite(url)
  }
  const mode = process.env.QP_DEPLOYMENT_MODE ?? 'MULTI_TENANT'
  if (mode === 'SINGLE_TENANT' && request.nextUrl.pathname.startsWith('/platform')) {
    return rewriteNotFound(request)
  }
  if (
    !PANEL_BANK_CONSOLE_ENABLED &&
    CLOSED_PANEL_BANK_PATHS.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))
  ) {
    return rewriteNotFound(request)
  }
  if (
    process.env.NODE_ENV === 'production' &&
    LAB_MOCK_PATHS.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))
  ) {
    return rewriteNotFound(request)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/platform/:path*',
    '/supago-banks',
    '/supago-banks/:path*',
    '/crici-banks',
    '/crici-banks/:path*',
    '/mock/gpay',
    '/mock/gpay/:path*',
    '/mock/paytm',
    '/mock/paytm/:path*',
    '/mock/bharatpe',
    '/mock/bharatpe/:path*',
    '/payin/:token',
    '/payout/:token',
  ],
}
