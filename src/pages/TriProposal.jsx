import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ComparisonColumn from '@/components/triproposal/ComparisonColumn'
import ComparisonRow from '@/components/triproposal/ComparisonRow'
import MultiPortalShareModal from '@/components/triproposal/MultiPortalShareModal'
import { Button } from '@/components/ui/Button'
import api from '@/config/api'
import { calculateEstimatedDuration, calculateOverallConfidence, estimateProposalPrice, normalizeProposalRecord } from '@/lib/proposals'

function summarizeTopRisks(proposal) {
  return (proposal.risks || []).slice(0, 2).map((risk) => risk.label).join(', ') || 'None'
}

export default function TriProposal() {
  const { tripId } = useParams()
  const [isShareOpen, setIsShareOpen] = useState(false)

  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => api.get(`/trips/${tripId}`).then((response) => response.data),
    enabled: Boolean(tripId),
  })

  const proposals = useMemo(() => {
    return (tripQuery.data?.proposals || []).map((proposal) =>
      normalizeProposalRecord({
        proposalId: proposal.proposalId,
        title: proposal.title,
        strategy: proposal.strategy,
        status: proposal.status,
        data: proposal.data,
      })
    )
  }, [tripQuery.data])

  const lean = proposals.find((proposal) => proposal.strategy === 'lean')
  const standard = proposals.find((proposal) => proposal.strategy === 'standard')
  const premium = proposals.find((proposal) => proposal.strategy === 'premium')
  const baseline = standard || lean || premium

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">TriProposal</p>
          <h1 className="mt-2 text-3xl font-bold">Compare Lean, Standard, and Premium</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Compare scope, confidence, timeline, and pricing posture before you decide what to send.
          </p>
        </div>
        <Button onClick={() => setIsShareOpen(true)}>
          Share Selected Strategies
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ComparisonColumn proposal={lean} baseline={baseline} />
        <ComparisonColumn proposal={standard} baseline={baseline} />
        <ComparisonColumn proposal={premium} baseline={baseline} />
      </div>

      <div className="space-y-3">
        <ComparisonRow
          label="Estimated price"
          lean={`$${estimateProposalPrice(lean || {})}`}
          standard={`$${estimateProposalPrice(standard || {})}`}
          premium={`$${estimateProposalPrice(premium || {})}`}
        />
        <ComparisonRow
          label="Timeline"
          lean={calculateEstimatedDuration(lean?.timeline || [])}
          standard={calculateEstimatedDuration(standard?.timeline || [])}
          premium={calculateEstimatedDuration(premium?.timeline || [])}
        />
        <ComparisonRow
          label="Confidence"
          lean={`${calculateOverallConfidence(lean?.features || [])}%`}
          standard={`${calculateOverallConfidence(standard?.features || [])}%`}
          premium={`${calculateOverallConfidence(premium?.features || [])}%`}
        />
        <ComparisonRow
          label="Top risks"
          lean={summarizeTopRisks(lean || {})}
          standard={summarizeTopRisks(standard || {})}
          premium={summarizeTopRisks(premium || {})}
        />
      </div>

      <MultiPortalShareModal
        tripId={tripId}
        proposals={proposals}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  )
}
