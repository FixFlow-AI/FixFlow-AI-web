import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Plus, Filter, SortDesc } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import ProposalCard from '@/components/dashboard/ProposalCard'
import EmptyState from '@/components/dashboard/EmptyState'
import api from '@/config/api'
import { normalizeProposalList } from '@/lib/proposals'

function Dashboard() {
  const { data: proposals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.get('/proposals').then((response) => normalizeProposalList(response.data.proposals)),
  })

  const hasProposals = proposals.length > 0

  return (
    <div className="max-w-7xl mx-auto">
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

      {hasProposals && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
            {[
              { label: 'Total Proposals', value: proposals.length },
              { label: 'Won', value: proposals.filter((proposal) => proposal.dealStatus === 'won').length },
              { label: 'Negotiating', value: proposals.filter((proposal) => proposal.dealStatus === 'negotiating').length },
              { label: 'Pending', value: proposals.filter((proposal) => proposal.dealStatus === 'pending').length },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl border border-border bg-transparent transition-colors hover:bg-card/50 focus-within:bg-card/50">
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="glass-card rounded-xl p-6 space-y-4">
              <div className="shimmer h-10 w-10 rounded-lg" />
              <div className="shimmer h-5 w-2/3 rounded" />
              <div className="shimmer h-4 w-full rounded" />
              <div className="shimmer h-4 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="glass-card rounded-2xl p-8 text-center max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-2">We couldn't load your proposals</h2>
          <p className="text-muted-foreground mb-6">
            The dashboard is ready, but the proposals API did not respond cleanly.
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      ) : hasProposals ? (
        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {proposals.map((proposal, index) => (
            <motion.div
              key={proposal.proposalId}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <ProposalCard proposal={proposal} index={index} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

export default Dashboard
