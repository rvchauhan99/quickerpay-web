'use client'

import { useEffect, useId, useRef, useState } from 'react'

export interface SearchableOption {
  /** Unique across groups. */
  key: string
  label: string
  group?: string
}

/* ─── SearchableSelect ───────────────────────────────────────────────────────
   Combobox that looks like <Select> when closed. Typing is debounced into
   onSearch; results render grouped in groupOrder. Arrow keys, Enter, Escape.
──────────────────────────────────────────────────────────────────────────── */
export function SearchableSelect<T extends SearchableOption>({
  value,
  onChange,
  onSearch,
  placeholder = 'Select',
  groupOrder = [],
  disabled = false,
  debounceMs = 200,
  ...aria
}: {
  value: T | null
  onChange: (option: T | null) => void
  onSearch: (query: string) => Promise<T[]>
  placeholder?: string
  groupOrder?: string[]
  disabled?: boolean
  debounceMs?: number
  'aria-label'?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestSeq = useRef(0)
  const groupOrderRef = useRef(groupOrder)
  groupOrderRef.current = groupOrder
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    const seq = ++requestSeq.current
    setLoading(true)
    const timer = setTimeout(() => {
      onSearch(query.trim())
        .then((found) => {
          if (seq !== requestSeq.current) return
          setOptions(sortByGroup(found, groupOrderRef.current))
          setActive(0)
        })
        .catch(() => {
          if (seq === requestSeq.current) setOptions([])
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false)
        })
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [open, query, onSearch, debounceMs])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const pick = (option: T) => {
    onChange(option)
    close()
    inputRef.current?.blur()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      else setActive((index) => Math.min(index + 1, Math.max(options.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      if (!open) return
      event.preventDefault()
      const option = options[active]
      if (option) pick(option)
    } else if (event.key === 'Escape') {
      close()
    }
  }

  let lastGroup: string | undefined
  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={aria['aria-label']}
        disabled={disabled}
        value={open ? query : (value?.label ?? '')}
        placeholder={open && value ? value.label : placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          if (!open) setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className="h-qp-ctl w-full rounded-qp border px-qp-ctl-x text-qp-body transition-colors placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          borderColor: 'var(--qp-border)',
          backgroundColor: '#ffffff',
          color: 'var(--qp-text-primary)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '12px',
          paddingRight: '26px',
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-qp border py-1 text-qp-body"
          style={{
            borderColor: 'var(--qp-border)',
            backgroundColor: '#ffffff',
            boxShadow: 'var(--qp-shadow-sm)',
          }}
        >
          {options.length === 0 ? (
            <li className="px-qp-ctl-x py-1.5 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
              {loading ? 'Searching…' : 'No matches'}
            </li>
          ) : (
            options.map((option, index) => {
              const heading = option.group && option.group !== lastGroup ? option.group : null
              lastGroup = option.group
              return (
                <li key={option.key} role="presentation">
                  {heading ? (
                    <p
                      className="px-qp-ctl-x pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--qp-text-muted)' }}
                    >
                      {heading}
                    </p>
                  ) : null}
                  <div
                    role="option"
                    aria-selected={value?.key === option.key}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      pick(option)
                    }}
                    onMouseEnter={() => setActive(index)}
                    className="cursor-pointer truncate px-qp-ctl-x py-1.5"
                    style={{
                      color: 'var(--qp-text-primary)',
                      backgroundColor: index === active ? 'var(--qp-primary-light)' : undefined,
                    }}
                  >
                    {option.label}
                  </div>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}

function sortByGroup<T extends SearchableOption>(options: T[], groupOrder: string[]): T[] {
  if (groupOrder.length === 0) return options
  const rank = (group: string | undefined) => {
    const index = group ? groupOrder.indexOf(group) : -1
    return index === -1 ? groupOrder.length : index
  }
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => rank(a.option.group) - rank(b.option.group) || a.index - b.index)
    .map((entry) => entry.option)
}
