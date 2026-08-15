export function DirectionBadge({ direction }: { direction: 'CREDIT' | 'DEBIT' }) {
  const tone = direction === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{direction}</span>
}
