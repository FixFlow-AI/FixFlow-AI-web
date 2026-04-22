import { useState } from 'react'
import { Layers, AlertTriangle, Clock, Target } from 'lucide-react'
import InsightCard from '@/components/proposal/InsightCard'
import ConfidenceCard from '@/components/proposal/ConfidenceCard'
import RiskCard from '@/components/proposal/RiskCard'
import EffortCard from '@/components/proposal/EffortCard'
import TimelineStep from '@/components/proposal/TimelineStep'
import DetailDrawer from '@/components/proposal/DetailDrawer'
import SectionSkeleton from '@/components/proposal/SectionSkeleton'
import ErrorBoundary from '@/components/ErrorBoundary'
import { normalizeProposalRecord } from '@/lib/proposals'

export default function StreamingDisplay({ parsedSections }) {
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const proposal = normalizeProposalRecord({
    title: 'Streaming Proposal Preview',
    data: parsedSections,
    projectSummary: parsedSections.project_summary || '',
  })

  const handleFeatureClick = (feature) => {
    setSelectedFeature(feature)
    setIsDrawerOpen(true)
  }

  return (
    <div className="space-y-8">
      <ErrorBoundary>
        {proposal.project_summary ? (
          <div className="glass-card rounded-xl p-6">
            <h2 className="font-semibold mb-3">Project Summary</h2>
            <p className="text-muted-foreground leading-relaxed">{proposal.project_summary}</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl p-6 space-y-3">
            <div className="shimmer h-5 w-32 rounded" />
            <div className="shimmer h-4 w-full rounded" />
            <div className="shimmer h-4 w-2/3 rounded" />
          </div>
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InsightCard
            title="Features"
            value={proposal.features.length}
            subtitle="Parsed so far"
            icon={Layers}
            color="default"
            index={0}
          />
          <InsightCard
            title="Risks"
            value={proposal.risks.length}
            subtitle="Captured"
            icon={AlertTriangle}
            color="warning"
            index={1}
          />
          <InsightCard
            title="Timeline"
            value={proposal.estimatedDuration}
            subtitle="Current estimate"
            icon={Clock}
            color="success"
            index={2}
          />
          <InsightCard
            title="Confidence"
            value={`${proposal.overallConfidence}%`}
            subtitle="Running average"
            icon={Target}
            color="default"
            index={3}
          />
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div>
          <h2 className="text-lg font-semibold mb-4">Feature Analysis</h2>
          {proposal.features.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {proposal.features.map((feature, index) => (
                <ConfidenceCard
                  key={feature.id}
                  feature={feature}
                  index={index}
                  onClick={() => handleFeatureClick(feature)}
                />
              ))}
            </div>
          ) : (
            <SectionSkeleton type="grid" />
          )}
        </div>
      </ErrorBoundary>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ErrorBoundary>
          <div>
            <h2 className="text-lg font-semibold mb-4">Risk Assessment</h2>
            {proposal.risks.length ? <RiskCard risks={proposal.risks} /> : <SectionSkeleton type="card" />}
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div>
            <h2 className="text-lg font-semibold mb-4">Effort Estimation</h2>
            {proposal.effort.length ? <EffortCard efforts={proposal.effort} /> : <SectionSkeleton type="card" />}
          </div>
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <div>
          <h2 className="text-lg font-semibold mb-4">Project Timeline</h2>
          {proposal.timeline.length ? (
            <div className="max-w-2xl">
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
          ) : (
            <SectionSkeleton type="list" />
          )}
        </div>
      </ErrorBoundary>

      <DetailDrawer
        feature={selectedFeature}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  )
}
