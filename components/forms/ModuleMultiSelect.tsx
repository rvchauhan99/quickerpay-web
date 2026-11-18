'use client'

import type { MenuCode } from '@quickerpay/shared-types'

/**
 * View-level module chips. Used by the Banker's reduced Operator create/edit form
 * (docs/03 §4.5.1). Offerable codes must already be clipped to the actor ceiling.
 */
export function ModuleMultiSelect(props: {
  offerable: MenuCode[]
  selected: MenuCode[]
  onChange: (next: MenuCode[]) => void
  'aria-label'?: string
}) {
  const toggle = (code: MenuCode) => {
    props.onChange(
      props.selected.includes(code)
        ? props.selected.filter((item) => item !== code)
        : [...props.selected, code],
    )
  }

  if (props.offerable.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
        No modules available to grant from your access.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label={props['aria-label'] ?? 'Select modules'}>
      {props.offerable.map((code) => {
        const on = props.selected.includes(code)
        return (
          <button
            key={code}
            type="button"
            data-on={on ? 'true' : 'false'}
            className="qp-menu-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
            style={{
              backgroundColor: on ? 'var(--qp-primary)' : 'var(--qp-card)',
              color: on ? '#ffffff' : 'var(--qp-text-secondary)',
              border: `1px solid ${on ? 'var(--qp-primary)' : 'var(--qp-border)'}`,
              boxShadow: on ? '0 1px 3px 0 rgba(37, 99, 235, 0.2)' : 'none',
            }}
            aria-pressed={on}
            aria-label={code.replaceAll('_', ' ')}
            onClick={() => toggle(code)}
          >
            {on ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : null}
            {code.replaceAll('_', ' ')}
          </button>
        )
      })}
    </div>
  )
}
