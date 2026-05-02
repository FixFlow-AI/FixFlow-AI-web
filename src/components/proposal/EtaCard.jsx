import { Clock3, TimerReset } from 'lucide-react'
import { formatEtaRange, formatSecondsLabel, describeEtaBasis } from '@/lib/eta'

export default function EtaCard({ eta, elapsedSeconds = 0, isActive = false }) {
  if (!eta) {
    return null
  }

  const isLongerThanUsual = isActive && elapsedSeconds > eta.maxSeconds

  return (
    <div className="rounded-2xl border border-border bg-transparent px-4 py-4 transition-colors hover:bg-background/30 focus-within:bg-background/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary">
            <Clock3 className="h-3.5 w-3.5" />
            Estimated Time
          </div>
          <div className="mt-2 text-lg font-semibold">
            {eta.isTriMode ? `About ${formatEtaRange(eta)} for all 3 strategies` : `About ${formatEtaRange(eta)}`}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {describeEtaBasis(eta)}
          </p>
        </div>
        {eta.queueDelaySeconds > 0 ? (
          <div className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
            Queue +{formatSecondsLabel(eta.queueDelaySeconds)}
          </div>
        ) : null}
      </div>

      {isActive ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-transparent px-3 py-2 text-sm transition-colors hover:bg-background/45 focus-within:bg-background/45">
          <TimerReset className="h-4 w-4 text-primary" />
          <span className="text-foreground">Elapsed {formatSecondsLabel(elapsedSeconds)}</span>
          <span className="text-muted-foreground">
            {isLongerThanUsual ? 'Taking longer than usual.' : 'Still within the normal range.'}
          </span>
        </div>
      ) : null}
    </div>
  )
}
