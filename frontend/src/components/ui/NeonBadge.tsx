type BadgeColor = 'purple' | 'green' | 'gold' | 'red' | 'blue' | 'gray'

interface NeonBadgeProps {
  children: string
  color?: BadgeColor
  size?: 'sm' | 'md'
}

const colorStyles: Record<BadgeColor, string> = {
  purple: 'bg-craft-primary/20 text-craft-primary-light border-craft-primary/40',
  green: 'bg-craft-green/20 text-craft-green border-craft-green/40',
  gold: 'bg-craft-gold/20 text-craft-gold border-craft-gold/40',
  red: 'bg-craft-red/20 text-craft-red border-craft-red/40',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  gray: 'bg-white/5 text-craft-muted border-white/10',
}

export default function NeonBadge({ children, color = 'purple', size = 'sm' }: NeonBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-body font-semibold uppercase tracking-wider
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'}
        ${colorStyles[color]}`}
    >
      {children}
    </span>
  )
}
