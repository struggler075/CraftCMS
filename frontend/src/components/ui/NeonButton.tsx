import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'green' | 'gold' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface NeonButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-craft-primary hover:bg-craft-primary-dark text-white shadow-neon hover:shadow-[0_0_30px_rgba(124,58,237,0.6)]',
  secondary:
    'bg-transparent border border-craft-primary text-craft-primary hover:bg-craft-primary hover:text-white',
  green:
    'bg-craft-green hover:bg-craft-green-dark text-white shadow-neon-green hover:shadow-[0_0_30px_rgba(34,197,94,0.6)]',
  gold:
    'bg-craft-gold hover:bg-craft-gold-dark text-craft-bg shadow-neon-gold',
  ghost:
    'bg-transparent border border-craft-border text-craft-muted hover:border-craft-primary hover:text-craft-primary',
  danger:
    'bg-craft-red hover:bg-craft-red-dark text-white',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

export default function NeonButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  onClick,
  type = 'button',
}: NeonButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled || loading ? 1 : 1.03 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-body font-semibold
        transition-all duration-200 cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </motion.button>
  )
}
