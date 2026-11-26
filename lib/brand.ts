/** Display name for UI chrome. Set NEXT_PUBLIC_QP_BRAND_NAME on the host; default SAFEPAY247. */
export function brandName(): string {
  return (process.env.NEXT_PUBLIC_QP_BRAND_NAME ?? 'SAFEPAY247').trim() || 'SAFEPAY247'
}
