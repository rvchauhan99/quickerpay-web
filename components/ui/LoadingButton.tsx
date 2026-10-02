import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button, type ButtonSize } from './Button'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  variant?: 'primary' | 'danger' | 'ghost' | 'secondary'
  size?: ButtonSize
  children: ReactNode
}

export const LoadingButton = ({
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: LoadingButtonProps) => (
  <Button {...props} variant={variant} size={size} loading={loading}>
    {loading && loadingText ? loadingText : children}
  </Button>
)
