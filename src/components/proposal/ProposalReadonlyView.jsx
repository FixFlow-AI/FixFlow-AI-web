import { Badge } from '@/components/ui/Badge'
import RiskCard from '@/components/proposal/RiskCard'
import EffortCard from '@/components/proposal/EffortCard'
import TimelineStep from '@/components/proposal/TimelineStep'
import ConfidenceBar from '@/components/proposal/ConfidenceBar'
import { getConfidenceColor } from '@/lib/utils'

export default function ProposalReadonlyView({ proposal, sectionRefs = {} }) {
  if (!proposal) return null

  return (
    <div className="space-y-8">
      <section ref={sectionRefs.summary} className="glass-card rounded-[28px] p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Executive Summary</p>
        <h1 className="mt-3 text-3xl font-semibold">{proposal.title}</h1>
        <p className="mt-4 max-w-4xl text-base leading-8 text-muted-foreground">{proposal.project_summary}</p>
      </section>

      <section ref={sectionRefs.features}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Feature Analysis</h2>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {proposal.features.length} features
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {proposal.features.map((feature) => (
            <div key={feature.id} className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: getConfidenceColor(feature.confidence_pct) }}>
                  {feature.confidence_pct}%
                </span>
              </div>
              <ConfidenceBar percentage={feature.confidence_pct} />
              <p className="mt-3 text-sm text-muted-foreground">{feature.technical_approach}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">{feature.area}</Badge>
                <Badge variant={feature.complexity === 'High' ? 'destructive' : feature.complexity === 'Medium' ? 'warning' : 'success'}>
                  {feature.complexity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section ref={sectionRefs.risks}>
          <RiskCard risks={proposal.risks} />
        </section>
        <section ref={sectionRefs.effort}>
          <EffortCard efforts={proposal.effort} totalDuration={proposal.estimatedDuration} />
        </section>
      </div>

      <section ref={sectionRefs.timeline}>
        <h2 className="mb-4 text-xl font-semibold">Project Timeline</h2>
        <div className="max-w-3xl">
          {proposal.timeline.map((phase, index) => (
            <TimelineStep
              key={phase.id}
              phase={phase}
              index={index}
              total={proposal.timeline.length}
              isActive={index === 0}
            />
          ))}
        </div>
      </section>

      {!!proposal.market.length && (
        <section ref={sectionRefs.market}>
          <h2 className="mb-4 text-xl font-semibold">Market Signals</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {proposal.market.map((item) => (
              <div key={item.id} className="glass-card rounded-2xl p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{item.title}</h3>
                  <Badge variant="info">{item.relevance}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!proposal.impact.length && (
        <section ref={sectionRefs.impact}>
          <h2 className="mb-4 text-xl font-semibold">Business Impact</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {proposal.impact.map((item) => (
              <div key={item.id} className="glass-card rounded-2xl p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{item.title}</h3>
                  <Badge variant="success">{item.impact_score}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
