import { cn } from '@/lib/utils'

const STYLES = {
  lean: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/25',
  standard: 'bg-sky-400/15 text-sky-200 border-sky-300/25',
  premium: 'bg-amber-300/15 text-amber-100 border-amber-200/25',
}

export default function StrategyBadge({ strategy = 'standard' }) {
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]', STYLES[strategy] || STYLES.standard)}>
      {strategy}
    </span>
  )
}
