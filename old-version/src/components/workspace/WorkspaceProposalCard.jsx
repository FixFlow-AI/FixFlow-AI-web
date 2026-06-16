import ProposalCard from '@/components/dashboard/ProposalCard'

export default function WorkspaceProposalCard({ proposal, index }) {
  return (
    <div className="space-y-3">
      <ProposalCard proposal={proposal} index={index} />
      <div className="px-2 text-xs text-muted-foreground">
        Created by {proposal.createdBy?.name || 'Team member'}
      </div>
    </div>
  )
}
