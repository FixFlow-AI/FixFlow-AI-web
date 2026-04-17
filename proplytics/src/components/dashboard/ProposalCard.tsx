import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { Proposal } from '@/lib/mock-data'

interface ProposalCardProps {
  proposal: Proposal
  index: number
}

function ProposalCard({ proposal, index }: ProposalCardProps) {
  const statusVariant = {
    draft: 'secondary',
    processing: 'warning',
    complete: 'success',
  } as const

  const statusLabel = {
    draft: 'Draft',
    processing: 'Processing',
    complete: 'Complete',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Link to={`/proposal/${proposal.id}`}>
        <div className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <Badge variant={statusVariant[proposal.status]}>
              {proposal.status === 'processing' && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {statusLabel[proposal.status]}
            </Badge>
          </div>

          <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
            {proposal.title}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {proposal.project_summary}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDate(proposal.createdAt)}</span>
            </div>
            
            <div className="flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <span>View</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default ProposalCard
