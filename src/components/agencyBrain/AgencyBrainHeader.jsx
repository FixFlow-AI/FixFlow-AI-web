import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'

export default function AgencyBrainHeader({ analyzedAt, sampleSize, onAnalyze, isAnalyzing = false, title = 'Agency Brain' }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Institutional Intelligence</p>
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last analysis: {analyzedAt ? formatDateTime(analyzedAt) : 'Not yet analyzed'} · Sample size {sampleSize}
        </p>
      </div>
      <Button onClick={onAnalyze} isLoading={isAnalyzing}>
        Re-analyze
      </Button>
    </div>
  )
}
