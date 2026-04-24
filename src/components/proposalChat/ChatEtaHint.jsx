import { Clock3 } from 'lucide-react'
import { describeEtaBasis, formatEtaRange, formatSecondsLabel } from '@/lib/eta'

export default function ChatEtaHint({ eta, elapsedSeconds = 0, isStreaming = false }) {
  if (!eta) {
    return null
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
      <Clock3 className="h-3.5 w-3.5 text-primary" />
      <span className="text-foreground">
        {isStreaming ? `Usually ${formatEtaRange(eta)} • elapsed ${formatSecondsLabel(elapsedSeconds)}` : `Usually ${formatEtaRange(eta)}`}
      </span>
      <span>{describeEtaBasis(eta)}</span>
    </div>
  )
}
