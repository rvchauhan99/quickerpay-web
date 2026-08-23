/**
 * Console extras for local/dev/test only: Pay-In/Pay-Out Create, mock GPay nav.
 *
 * Lab is OFF when:
 * - NEXT_PUBLIC_QP_ENV is production / prod, or
 * - NODE_ENV is production (Vercel/App production builds — even if NEXT_PUBLIC_QP_ENV
 *   was left as "local" by mistake)
 *
 * Backend QP_ENV is separate; set NEXT_PUBLIC_QP_ENV=production on the web host to
 * match, or rely on NODE_ENV=production for the hard block.
 */
const LAB_ENVS = new Set(['local', 'development', 'dev', 'testing', 'test'])
const PROD_ENVS = new Set(['production', 'prod'])

export function isLabConsole(): boolean {
  const named = (process.env.NEXT_PUBLIC_QP_ENV ?? '').trim().toLowerCase()

  if (PROD_ENVS.has(named)) return false

  // Production Next builds must never expose /mock/gpay or lab Create buttons.
  if (process.env.NODE_ENV === 'production') return false

  if (named.length > 0) return LAB_ENVS.has(named)
  return true
}
