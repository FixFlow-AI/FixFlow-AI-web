import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeDollarSign, BrainCircuit, CheckCircle2, RadioTower, ShieldCheck, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FreelancerPageShell, MetricTile, ScoreRing, SkeletonPanel, StatusPill, TechnicalPanel, TimelineRail } from '@/components/freelancer/FreelancerPrimitives'
import { useFreelancerFlowboard } from '@/hooks/useFreelancer'

function LeadRow({ lead }) {
  return (
    <Link
      to="/freelancer/leads"
      className="flex items-center gap-4 rounded-lg border border-border/70 bg-transparent p-3 transition-colors hover:border-primary/40 hover:bg-background/30 focus-within:bg-background/30"
    >
      <ScoreRing score={lead.score} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">{lead.company.name}</h3>
          <StatusPill status={lead.status} />
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{lead.role}</p>
      </div>
      <span className="hidden font-mono text-xs text-muted-foreground sm:block">${lead.rateRange?.[0]}-{lead.rateRange?.[1]}/hr</span>
    </Link>
  )
}

function NicheBar({ niche }) {
  return (
    <div className="rounded-lg border border-border/70 bg-transparent p-4 transition-colors hover:bg-background/30 focus-within:bg-background/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{niche.name}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">${niche.rateCeiling}/hr ceiling</p>
        </div>
        <span className="font-mono text-sm text-primary">{niche.depth}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${niche.depth}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full bg-primary"
        />
      </div>
    </div>
  )
}

function FlowBoard() {
  const { data, isLoading, isError, refetch } = useFreelancerFlowboard()

  if (isLoading) {
    return (
      <FreelancerPageShell title="FlowBoard" description="Loading the operating view for leads, niches, escrow, and credentials.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonPanel rows={3} />
          <SkeletonPanel rows={3} />
          <SkeletonPanel rows={3} />
          <SkeletonPanel rows={3} />
        </div>
      </FreelancerPageShell>
    )
  }

  if (isError) {
    return (
      <FreelancerPageShell title="FlowBoard" description="The freelancer API did not respond cleanly.">
        <TechnicalPanel className="p-8 text-center">
          <p className="text-muted-foreground">The module is ready, but the backend needs another attempt.</p>
          <Button onClick={() => refetch()} className="mt-5">Retry</Button>
        </TechnicalPanel>
      </FreelancerPageShell>
    )
  }

  const metrics = data.metrics || {}
  const topLeads = (data.leads || []).slice(0, 4)
  const acceptedNiches = (data.niches || []).filter((niche) => niche.accepted).slice(0, 3)
  const escrow = data.escrows?.[0]

  return (
    <FreelancerPageShell
      data-testid="freelancer-flowboard"
      title="FlowBoard"
      description="A calm operating surface for your niche, lead motion, outreach, escrow state, and reputation proof."
      action={
        <div className="flex flex-wrap gap-3">
          <Link to="/freelancer/onboarding"><Button variant="outline">Run scan</Button></Link>
          <Link to="/freelancer/leads"><Button>Open pipeline</Button></Link>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Niche depth" value={metrics.nicheDepth || 0} detail="Accepted positioning strength" icon={BrainCircuit} />
        <MetricTile label="Qualified leads" value={metrics.qualifiedLeads || 0} detail={`${metrics.averageLeadScore || 0} average score`} icon={Target} tone="emerald" />
        <MetricTile label="Escrow locked" value={`$${(metrics.escrowBalance || 0).toLocaleString()}`} detail="Milestone funds in motion" icon={BadgeDollarSign} />
        <MetricTile label="Reputation" value={metrics.reputationScore || 0} detail={`${metrics.activeAgents || 0} agents enabled`} icon={ShieldCheck} tone="emerald" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TechnicalPanel className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Lead radar</p>
              <h2 className="mt-1 text-xl font-semibold">Highest-fit opportunities</h2>
            </div>
            <RadioTower className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-3">
            {topLeads.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
          </div>
        </TechnicalPanel>

        <TechnicalPanel className="p-5">
          <div className="mb-4">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Action queue</p>
            <h2 className="mt-1 text-xl font-semibold">Next moves</h2>
          </div>
          <TimelineRail items={data.tasks || []} />
        </TechnicalPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <TechnicalPanel className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            <h2 className="text-xl font-semibold">Accepted niche stack</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {acceptedNiches.map((niche) => <NicheBar key={niche.id} niche={niche} />)}
          </div>
        </TechnicalPanel>

        <TechnicalPanel className="p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Escrow state</p>
          <h2 className="mt-1 text-xl font-semibold">{escrow ? `${escrow.totalAmount.toLocaleString()} ${escrow.currency}` : 'No active escrow'}</h2>
          <div className="mt-5 space-y-3">
            {(escrow?.milestones || []).map((milestone) => (
              <div key={milestone.name} className="flex items-center justify-between gap-3 rounded-lg bg-transparent px-3 py-2 transition-colors hover:bg-background/35 focus-within:bg-background/35">
                <span className="text-sm">{milestone.name}</span>
                <StatusPill status={milestone.status} />
              </div>
            ))}
          </div>
        </TechnicalPanel>
      </div>
    </FreelancerPageShell>
  )
}

export default FlowBoard
