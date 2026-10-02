export function DirectionBadge({ direction }: { direction: 'CREDIT' | 'DEBIT' }) {
  const credit = direction === 'CREDIT'
  return (
    <span
      className="rounded px-1.5 py-px text-[10.5px] font-semibold"
      style={{
        backgroundColor: credit ? 'var(--qp-success-bg)' : 'var(--qp-danger-bg)',
        color: credit ? 'var(--qp-success)' : 'var(--qp-danger)',
      }}
    >
      {direction}
    </span>
  )
}
