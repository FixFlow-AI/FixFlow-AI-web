import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DEAL_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', tone: 'text-sky-200 bg-sky-500/12 border-sky-400/25' },
  { value: 'negotiating', label: 'Negotiating', tone: 'text-amber-100 bg-amber-400/12 border-amber-300/25' },
  { value: 'won', label: 'Won', tone: 'text-emerald-100 bg-emerald-400/12 border-emerald-300/25' },
  { value: 'lost', label: 'Lost', tone: 'text-rose-100 bg-rose-400/12 border-rose-300/25' },
]

export function getDealStatusMeta(value) {
  return DEAL_STATUS_OPTIONS.find((option) => option.value === value) || DEAL_STATUS_OPTIONS[0]
}

export default function StatusSelector({ value = 'pending', onChange, isLoading = false, className, compact = false }) {
  const meta = getDealStatusMeta(value)

  return (
    <label className={cn('relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', meta.tone, className)}>
      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-current" />}
      <select
        data-testid="deal-status-selector"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={isLoading}
        className={cn(
          'appearance-none bg-transparent pr-4 text-sm font-medium outline-none',
          compact ? 'min-w-[6.5rem]' : 'min-w-[7.5rem]'
        )}
      >
        {DEAL_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950 text-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
