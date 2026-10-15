/**
 * Console extras for local/dev/test only: Pay-In/Pay-Out Create.
 *
 * Lab is OFF when:
 * - NEXT_PUBLIC_QP_ENV is production / prod, or
 * - NODE_ENV is production (a production Next build — even if NEXT_PUBLIC_QP_ENV
 *   was left as "local" by mistake)
 *
 * /mock/gpay does not use this. The page asks GET /health/mock-gpay, which
 * follows the API QP_ENV.
 */
const LAB_ENVS = new Set(['local', 'development', 'dev', 'testing', 'test'])
const PROD_ENVS = new Set(['production', 'prod'])

function namedEnv(): string {
  return (process.env.NEXT_PUBLIC_QP_ENV ?? '').trim().toLowerCase()
}

export function isLabConsole(): boolean {
  const named = namedEnv()

  if (PROD_ENVS.has(named)) return false

  // Production Next builds must never expose lab Create buttons.
  if (process.env.NODE_ENV === 'production') return false

  if (named.length > 0) return LAB_ENVS.has(named)
  return true
}
