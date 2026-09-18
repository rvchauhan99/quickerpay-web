'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/forms/Input'

export function PasswordInput({
  className = '',
  disabled,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)

  const handleToggle = () => {
    setVisible((open) => !open)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={['pr-10', className].join(' ')}
        spellCheck={false}
        autoCorrect="off"
      />
      <button
        type="button"
        disabled={disabled}
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ color: 'var(--qp-text-muted)' }}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={handleToggle}
      >
        {visible ? (
          <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
