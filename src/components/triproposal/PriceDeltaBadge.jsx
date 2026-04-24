import { estimateProposalPrice } from '@/lib/proposals'

export default function PriceDeltaBadge({ proposal, baseline }) {
  const proposalPrice = estimateProposalPrice(proposal)
  const basePrice = estimateProposalPrice(baseline)
  const delta = basePrice ? Math.round(((proposalPrice - basePrice) / basePrice) * 100) : 0

  return (
    <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
      {delta === 0 ? 'Baseline' : `${delta > 0 ? '+' : ''}${delta}% vs baseline`}
    </div>
  )
}
