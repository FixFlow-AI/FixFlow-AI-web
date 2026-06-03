import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileText, Clock, ArrowRight, Loader2, Gauge } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import StatusSelector from '@/components/winloss/StatusSelector'
import api from '@/config/api'

function ProposalCard({ proposal, index }) {
  const queryClient = useQueryClient()
  const [dealStatus, setDealStatus] = useState(proposal.dealStatus || 'pending')
  const [isUpdating, setIsUpdating] = useState(false)

  const statusVariant = {
    draft: 'secondary',
    generating: 'warning',
    processing: 'warning',
    complete: 'success',
    failed: 'destructive',
  }

  const statusLabel = {
    draft: 'Draft',
    generating: 'Generating',
    processing: 'Processing',
    complete: 'Complete',
    failed: 'Failed',
  }

  const proposalId = proposal.proposalId || proposal.id
  const summary =
    proposal.project_summary || proposal.projectSummary || 'Proposal details are still being prepared.'

  const handleDealStatusChange = async (nextStatus) => {
    setDealStatus(nextStatus)
    setIsUpdating(true)

    try {
      await api.patch(`/proposals/${proposalId}/deal-status`, {
        dealStatus: nextStatus,
      })
      toast.success(`Deal status set to ${nextStatus}.`)
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
    } catch (error) {
      setDealStatus(proposal.dealStatus || 'pending')
      toast.error(error.response?.data?.error || 'Deal status update failed.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <div className="glass-card rounded-[24px] border border-border/50 p-5 shadow-lg shadow-black/5 transition-all duration-300 hover:border-primary/30 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <Badge variant={statusVariant[proposal.status] || 'secondary'}>
            {['processing', 'generating'].includes(proposal.status) && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            {statusLabel[proposal.status] || proposal.status}
          </Badge>
        </div>

        <Link to={`/proposal/${proposalId}`}>
          <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
            {proposal.title}
          </h3>
        </Link>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{summary}</p>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StatusSelector value={dealStatus} onChange={handleDealStatusChange} isLoading={isUpdating} compact />
          {proposal.strategy && proposal.strategy !== 'standard' ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {proposal.strategy}
            </div>
          ) : null}
          {proposal.briefScore?.overallScore ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              BriefScore {proposal.briefScore.overallScore}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDate(proposal.createdAt)}</span>
          </div>

          <Link to={`/proposal/${proposalId}`} className="flex items-center gap-1 text-sm text-primary transition-opacity">
            <span>View</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

export default ProposalCard
