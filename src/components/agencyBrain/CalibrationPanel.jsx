import { Brain, Sparkles } from 'lucide-react'
import useAgencyBrainStore from '@/stores/agencyBrainStore'

export default function CalibrationPanel({ insights = [], isLoading = false }) {
  const enabledInsights = useAgencyBrainStore((state) => state.enabledInsights)
  const setInsightEnabled = useAgencyBrainStore((state) => state.setInsightEnabled)

  if (!isLoading && !insights.length) {
    return null
  }

  return (
    <div className="glass-card rounded-[28px] p-6">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Agency Calibration</p>
          <h2 className="mt-1 text-xl font-semibold">Patterns we can apply to this brief</h2>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="shimmer h-20 rounded-2xl" />
          ))
        ) : (
          insights.map((insight) => {
            const enabled = enabledInsights[insight.id] !== false

            return (
              <label
                key={insight.id}
                className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-background/30 px-4 py-4"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={enabled}
                  onChange={(event) => setInsightEnabled(insight.id, event.target.checked)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {insight.title}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{insight.recommendation}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Based on {insight.sampleSize} proposals</p>
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
