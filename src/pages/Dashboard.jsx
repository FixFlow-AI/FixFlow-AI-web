import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Filter, SortDesc } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import ProposalCard from '@/components/dashboard/ProposalCard'
import EmptyState from '@/components/dashboard/EmptyState'
import { mockProposals } from '@/lib/mock-data'

function Dashboard() {
  const hasProposals = mockProposals.length > 0

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold mb-1"
          >
            Your Proposals
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground"
          >
            Manage and track all your AI-generated proposals
          </motion.p>
        </div>
        
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <SortDesc className="h-4 w-4 mr-2" />
            Sort
          </Button>
          <Link to="/new">
            <Button size="sm" className="glow-effect">
              <Plus className="h-4 w-4 mr-2" />
              New Proposal
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Stats Overview */}
      {hasProposals && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Proposals', value: mockProposals.length },
            { label: 'Completed', value: mockProposals.filter(p => p.status === 'complete').length },
            { label: 'Processing', value: mockProposals.filter(p => p.status === 'processing').length },
            { label: 'Drafts', value: mockProposals.filter(p => p.status === 'draft').length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-xl border border-border bg-card/50"
            >
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Proposals Grid or Empty State */}
      {hasProposals ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProposals.map((proposal, index) => (
            <ProposalCard key={proposal.id} proposal={proposal} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

export default Dashboard
