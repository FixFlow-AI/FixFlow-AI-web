import { motion } from 'framer-motion'
import { CheckCircle2, CircleDashed, Clock3, RadioTower } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FreelancerPageShell({ title, description, action, children, className, ...props }) {
  return (
    <div {...props} className={cn('mx-auto max-w-7xl space-y-6', className)}>
      <div className="flex flex-col gap-4 border-b border-border/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Freelancer OS</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
          {description && <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function TechnicalPanel({ children, className, interactive = false, ...props }) {
  return (
    <div
      {...props}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/80 bg-transparent shadow-[var(--glass-card-shadow)] transition-colors',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent',
        'hover:bg-card/75 focus-within:bg-card/75',
        interactive && 'hover:border-primary/45',
        className
      )}
    >
      {children}
    </div>
  )
}

export function MetricTile({ label, value, detail, icon: Icon = RadioTower, tone = 'primary' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-300 bg-emerald-400/10' : 'text-primary bg-primary/10'

  return (
    <TechnicalPanel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={cn('rounded-lg border border-current/20 p-2', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {detail && <p className="mt-4 text-sm text-muted-foreground">{detail}</p>}
    </TechnicalPanel>
  )
}

export function ScoreRing({ score = 0, size = 54 }) {
  const normalized = Math.max(0, Math.min(100, Number(score) || 0))
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (normalized / 100) * circumference
  const color = normalized >= 85 ? 'var(--confidence-high)' : normalized >= 70 ? 'var(--primary)' : 'var(--confidence-medium)'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 54 54" className="-rotate-90">
        <circle cx="27" cy="27" r={radius} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="27"
          cy="27"
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-xs font-semibold">{normalized}</span>
    </div>
  )
}

export function StatusPill({ status }) {
  const map = {
    new: 'border-primary/30 bg-primary/10 text-primary',
    qualified: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
    contacted: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
    replied: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
    won: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
    lost: 'border-rose-300/30 bg-rose-400/10 text-rose-100',
    pending: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
    paid: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
    overdue: 'border-rose-300/40 bg-rose-400/15 text-rose-100',
    locked: 'border-primary/30 bg-primary/10 text-primary',
    released: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
    disputed: 'border-rose-300/40 bg-rose-400/15 text-rose-100',
  }

  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em]', map[status] || map.pending)}>
      {status}
    </span>
  )
}

export function TimelineRail({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const done = item.status === 'done'
        const waiting = item.status === 'waiting'
        const Icon = done ? CheckCircle2 : waiting ? Clock3 : CircleDashed

        return (
          <motion.div
            key={item.id || item.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="surface-frame flex items-center gap-3 rounded-lg border border-border/70 bg-background/35 px-4 py-3"
          >
            <Icon className={cn('h-4 w-4', done ? 'text-emerald-300' : waiting ? 'text-muted-foreground' : 'text-primary')} />
            <span className="text-sm">{item.label}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

export function SkeletonPanel({ rows = 4 }) {
  return (
    <TechnicalPanel className="p-5">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="shimmer h-4 rounded" style={{ width: `${95 - index * 12}%` }} />
        ))}
      </div>
    </TechnicalPanel>
  )
}
