/**
 * Console extras for local/dev/test only: Pay-In/Pay-Out Create, mock GPay nav.
 * Production is NEXT_PUBLIC_QP_ENV=production (or unset with NODE_ENV=production).
 */
const LAB_ENVS = new Set(['local', 'development', 'dev', 'testing', 'test'])

export function isLabConsole(): boolean {
  const named = (process.env.NEXT_PUBLIC_QP_ENV ?? '').trim().toLowerCase()
  if (named.length > 0) return LAB_ENVS.has(named)
  return process.env.NODE_ENV !== 'production'
}
