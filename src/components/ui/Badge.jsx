import { cn } from '@/lib/utils'

function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-primary/15 text-primary border-primary/30',
    secondary: 'bg-secondary/80 text-secondary-foreground border-border',
    success: 'bg-emerald-500/18 text-emerald-300 border-emerald-400/30',
    warning: 'bg-amber-500/18 text-amber-200 border-amber-400/30',
    destructive: 'bg-red-500/18 text-red-300 border-red-400/30',
    outline: 'text-foreground border-border',
    info: 'bg-sky-500/18 text-sky-200 border-sky-400/30',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
