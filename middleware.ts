import { PANEL_BANK_CONSOLE_ENABLED } from '@quickerpay/shared-types'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const CLOSED_PANEL_BANK_PATHS = ['/supago-banks', '/crici-banks']

/**
 * SINGLE_TENANT deployments have no Platform Owner console. Those routes 404
 * so a dedicated client cannot reach /platform/* on the same build.
 *
 * Supago Banks and Crici Banks 404 while PANEL_BANK_CONSOLE_ENABLED is false.
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
  return NextResponse.next()
}

export const config = {
  matcher: ['/platform/:path*', '/supago-banks', '/supago-banks/:path*', '/crici-banks', '/crici-banks/:path*'],
}
