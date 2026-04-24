import StrategyBadge from '@/components/triproposal/StrategyBadge'
import PriceDeltaBadge from '@/components/triproposal/PriceDeltaBadge'
import { calculateEstimatedDuration, calculateOverallConfidence } from '@/lib/proposals'

export default function ComparisonColumn({ proposal, baseline }) {
  if (!proposal) {
    return null
  }

  const featureCount = proposal.features?.length || 0
  const timeline = calculateEstimatedDuration(proposal.timeline)
  const confidence = calculateOverallConfidence(proposal.features)

  return (
    <div className="glass-card rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <StrategyBadge strategy={proposal.strategy} />
        <PriceDeltaBadge proposal={proposal} baseline={baseline} />
      </div>
      <h3 className="mt-5 text-2xl font-semibold">{proposal.title}</h3>
      <p className="mt-3 text-sm text-muted-foreground">{proposal.project_summary}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <div className="rounded-2xl border border-border bg-background/25 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Features</div>
          <div className="mt-2 text-2xl font-semibold">{featureCount}</div>
        </div>
        <div className="rounded-2xl border border-border bg-background/25 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Timeline</div>
          <div className="mt-2 text-2xl font-semibold">{timeline}</div>
        </div>
        <div className="rounded-2xl border border-border bg-background/25 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Confidence</div>
          <div className="mt-2 text-2xl font-semibold">{confidence}%</div>
        </div>
      </div>
    </div>
  )
}
