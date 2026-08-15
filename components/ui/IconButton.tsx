'use client'

import React, { ReactNode } from 'react'
import Link from 'next/link'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement | HTMLAnchorElement> {
  icon: ReactNode
  tooltip: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  position?: 'top' | 'bottom' | 'left' | 'right'
  href?: string
}

export function IconButton({
  icon,
  tooltip,
  variant = 'ghost',
  position = 'top',
  className = '',
  disabled,
  ...props
}: IconButtonProps) {
  let variantClasses = ''
  
  if (variant === 'primary') {
    variantClasses = 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] hover:bg-[#d1fae5] hover:text-[#047857]'
  } else if (variant === 'danger') {
    variantClasses = 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700'
  } else if (variant === 'secondary') {
    variantClasses = 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
  } else if (variant === 'ghost') {
    variantClasses = 'bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent'
  }

  const baseClasses = 'flex h-8 w-8 items-center justify-center rounded-lg transition-colors'
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''

  const finalClassName = `${baseClasses} ${variantClasses} ${disabledClasses} ${className}`

  if (props.href) {
    return (
      <Tooltip content={tooltip} position={position}>
        <Link href={props.href} className={finalClassName} aria-label={tooltip}>
          {icon}
        </Link>
      </Tooltip>
    )
  }

  return (
    <Tooltip content={tooltip} position={position}>
      <button
        type="button"
        className={finalClassName}
        disabled={disabled}
        aria-label={tooltip}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {icon}
      </button>
    </Tooltip>
  )
}
