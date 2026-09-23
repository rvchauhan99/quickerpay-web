/** Display name for UI chrome. Set NEXT_PUBLIC_QP_BRAND_NAME on the host; default SafePay247. */
export function brandName(): string {
  return (process.env.NEXT_PUBLIC_QP_BRAND_NAME ?? 'SafePay247').trim() || 'SafePay247'
}
