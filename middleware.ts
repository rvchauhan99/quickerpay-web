import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * SINGLE_TENANT deployments have no Platform Owner console. Those routes 404
 * so a dedicated client cannot reach /platform/* on the same build.
 */
export function middleware(request: NextRequest) {
  const mode = process.env.QP_DEPLOYMENT_MODE ?? 'MULTI_TENANT'
  if (mode === 'SINGLE_TENANT' && request.nextUrl.pathname.startsWith('/platform')) {
    return new NextResponse(null, { status: 404 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/platform/:path*'],
}
