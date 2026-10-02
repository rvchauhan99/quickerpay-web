'use client'

import Link from 'next/link'
import { useState } from 'react'
import { axisTicks, labelStride, niceCeiling } from '@/lib/chart'

export type BarSeries = { key: string; label: string; color: string }
export type BarDatum = {
  id: string
  label: string
  /** Full name for the tooltip when `label` is abbreviated. */
  title?: string | undefined
  values: Record<string, number>
  href?: string | undefined
}

/**
 * Vertical (optionally grouped) bar chart. Bars are HTML, not canvas, so they stay crisp at any
 * density and every column is a focusable drill-through link when `href` is set.
 */
export function BarChart({
  data,
  series,
  formatAxis,
  formatValue,
  height = 200,
  maxLabels = 16,
  ariaLabel,
}: {
  data: ReadonlyArray<BarDatum>
  series: ReadonlyArray<BarSeries>
  formatAxis: (value: number) => string
  formatValue: (value: number, seriesKey: string) => React.ReactNode
  height?: number
  maxLabels?: number
  ariaLabel: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(0, ...data.flatMap((datum) => series.map((item) => datum.values[item.key] ?? 0)))
  const ceiling = niceCeiling(max)
  const ticks = axisTicks(ceiling)
  const stride = labelStride(data.length, maxLabels)
  const activeIndex = data.findIndex((datum) => datum.id === active)
  const activeDatum = activeIndex >= 0 ? data[activeIndex] : undefined

  return (
    <figure className="m-0" aria-label={ariaLabel}>
      <div className="flex gap-1.5">
        <div className="relative w-11 shrink-0" style={{ height }} aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[9.5px] qp-tabular"
              style={{ bottom: `${(tick / ceiling) * 100}%`, color: 'var(--qp-text-muted)' }}
            >
              {formatAxis(tick)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((tick) => (
              <div
                key={tick}
                className="pointer-events-none absolute inset-x-0 border-t"
                style={{
                  bottom: `${(tick / ceiling) * 100}%`,
                  borderColor: 'var(--qp-border)',
                  borderStyle: tick === 0 ? 'solid' : 'dashed',
                }}
                aria-hidden="true"
              />
            ))}
            <div className="absolute inset-0 flex items-stretch">
              {data.map((datum) => {
                const isActive = datum.id === active
                const bars = (
                  <div className="flex h-full w-full items-end justify-center gap-px px-[12%]">
                    {series.map((item) => {
                      const value = datum.values[item.key] ?? 0
                      const pct = ceiling > 0 ? (value / ceiling) * 100 : 0
                      return (
                        <span
                          key={item.key}
                          className="block min-w-[3px] max-w-[36px] flex-1 rounded-t-[3px] transition-[height,opacity] duration-300"
                          style={{
                            height: value > 0 ? `max(${pct}%, 2px)` : '0',
                            backgroundColor: item.color,
                            opacity: active && !isActive ? 0.55 : 1,
                          }}
                        />
                      )
                    })}
                  </div>
                )
                const columnClass =
                  'relative flex h-full min-w-0 flex-1 rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--qp-primary)]'
                const columnStyle = { backgroundColor: isActive ? 'var(--qp-surface)' : 'transparent' }
                const summary = `${datum.title ?? datum.label}: ${series
                  .map((item) => `${item.label} ${datum.values[item.key] ?? 0}`)
                  .join(', ')}`
                const handlers = {
                  onMouseEnter: () => setActive(datum.id),
                  onMouseLeave: () => setActive(null),
                  onFocus: () => setActive(datum.id),
                  onBlur: () => setActive(null),
                }
                return datum.href ? (
                  <Link key={datum.id} href={datum.href} className={columnClass} style={columnStyle} aria-label={summary} {...handlers}>
                    {bars}
                  </Link>
                ) : (
                  <div key={datum.id} className={columnClass} style={columnStyle} aria-label={summary} role="img" {...handlers}>
                    {bars}
                  </div>
                )
              })}
            </div>
            {activeDatum ? (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-1 z-10 min-w-[140px] rounded-qp border px-2 py-1.5 text-[11px]"
                style={{
                  left: `${((activeIndex + 0.5) / data.length) * 100}%`,
                  transform: `translateX(${activeIndex / data.length > 0.6 ? '-105%' : '5%'})`,
                  backgroundColor: 'var(--qp-card)',
                  borderColor: 'var(--qp-border)',
                  boxShadow: 'var(--qp-shadow-md)',
                }}
              >
                <p className="mb-0.5 font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{activeDatum.title ?? activeDatum.label}</p>
                {series.map((item) => (
                  <p key={item.key} className="flex items-center justify-between gap-3 qp-tabular" style={{ color: item.color }}>
                    <span>{item.label}</span>
                    <span>{formatValue(activeDatum.values[item.key] ?? 0, item.key)}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-1 flex" aria-hidden="true">
            {data.map((datum, index) => (
              <span
                key={datum.id}
                className="min-w-0 flex-1 truncate text-center text-[9.5px]"
                style={{ color: 'var(--qp-text-muted)' }}
                title={datum.title ?? datum.label}
              >
                {index % stride === 0 ? datum.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
