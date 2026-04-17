import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InsightCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: 'default' | 'success' | 'warning' | 'danger'
  onClick?: () => void
  index?: number
}

const colorClasses = {
  default: {
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    icon: 'text-primary',
    hover: 'hover:border-primary/40',
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    icon: 'text-green-500',
    hover: 'hover:border-green-500/40',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-500',
    hover: 'hover:border-amber-500/40',
  },
  danger: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: 'text-red-500',
    hover: 'hover:border-red-500/40',
  },
}

function InsightCard({ title, value, subtitle, icon: Icon, color = 'default', onClick, index = 0 }: InsightCardProps) {
  const colors = colorClasses[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className={cn(
        'glass-card rounded-xl p-6 cursor-pointer transition-all duration-300 border',
        colors.border,
        colors.hover,
        onClick && 'hover:shadow-lg'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', colors.bg)}>
          <Icon className={cn('h-6 w-6', colors.icon)} />
        </div>
      </div>

      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </motion.div>
  )
}

export default InsightCard
