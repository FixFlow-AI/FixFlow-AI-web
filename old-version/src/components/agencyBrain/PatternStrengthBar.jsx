import { cn } from '@/lib/utils'

export default function PatternStrengthBar({ sampleSize = 0, strength = 'Anecdotal' }) {
  const percentage = Math.min(100, Math.max(15, sampleSize * 6))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{strength}</span>
        <span>{sampleSize} proposals</span>
      </div>
      <div className="h-2 rounded-full bg-muted/70">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            strength === 'Confirmed' && 'bg-emerald-400',
            strength === 'Emerging' && 'bg-sky-400',
            strength === 'Anecdotal' && 'bg-amber-300'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
