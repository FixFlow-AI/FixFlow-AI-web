import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  Share2,
  Layers,
  AlertTriangle,
  Target,
  Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import InsightCard from '@/components/proposal/InsightCard'
import ConfidenceCard from '@/components/proposal/ConfidenceCard'
import TimelineStep from '@/components/proposal/TimelineStep'
import EffortCard from '@/components/proposal/EffortCard'
import RiskCard from '@/components/proposal/RiskCard'
import DetailDrawer from '@/components/proposal/DetailDrawer'
import SectionSkeleton from '@/components/proposal/SectionSkeleton'
import ExportModal from '@/components/proposal/ExportModal'
import RevisionHistory from '@/components/proposal/RevisionHistory'
import ErrorBoundary from '@/components/ErrorBoundary'
import api from '@/config/api'
import { normalizeProposalRecord, summarizeChangedSections } from '@/lib/proposals'

function ProposalResult() {
  const { id } = useParams()
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)

  const proposalQuery = useQuery({
    queryKey: ['proposal', id],
    queryFn: () => api.get(`/proposals/${id}`).then((response) => normalizeProposalRecord(response.data)),
    enabled: Boolean(id),
  })

  const versionsQuery = useQuery({
    queryKey: ['proposal', id, 'versions'],
    queryFn: () => api.get(`/proposals/${id}/versions`).then((response) => response.data),
    enabled: Boolean(id),
  })

  const compareQuery = useQuery({
    queryKey: ['proposal', id, 'compare', versionsQuery.data?.currentVersion],
    queryFn: () =>
      api
        .get(`/proposals/${id}/versions/compare`, {
          params: {
            from: versionsQuery.data.currentVersion - 1,
            to: versionsQuery.data.currentVersion,
          },
        })
        .then((response) => response.data),
    enabled: Boolean(id && versionsQuery.data?.currentVersion > 1),
  })

  const proposal = proposalQuery.data
  const changedSections = useMemo(
    () => summarizeChangedSections(compareQuery.data?.diff),
    [compareQuery.data?.diff]
  )

  const handleFeatureClick = (feature) => {
    setSelectedFeature(feature)
    setIsDrawerOpen(true)
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Proposal link copied to clipboard.')
    } catch {
      toast.error('Unable to copy the share link right now.')
    }
  }

  if (proposalQuery.isLoading) {
    return (
      <div className="space-y-8">
        <div className="glass-card rounded-xl p-6 space-y-3">
          <div className="shimmer h-6 w-1/3 rounded" />
          <div className="shimmer h-4 w-full rounded" />
          <div className="shimmer h-4 w-2/3 rounded" />
        </div>
        <SectionSkeleton type="grid" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SectionSkeleton type="card" />
          <SectionSkeleton type="card" />
        </div>
        <SectionSkeleton type="list" />
      </div>
    )
  }

  if (proposalQuery.isError || !proposal) {
    return (
      <div className="max-w-2xl mx-auto glass-card rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold mb-3">We couldn't load this proposal</h1>
        <p className="text-muted-foreground mb-6">
          The proposal exists in the workspace, but the API did not return a valid response for it.
        </p>
        <Link to="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    )
  }

  if (proposal.status === 'failed') {
    return (
      <div className="max-w-2xl mx-auto glass-card rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold mb-3">Generation didn't finish cleanly</h1>
        <p className="text-muted-foreground mb-2">
          {proposal.generationError || 'The model or export pipeline returned an error.'}
        </p>
        <Link to="/new">
          <Button className="mt-6">Create a New Proposal</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold"
            >
              {proposal.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm text-muted-foreground"
            >
              Generated proposal with AI-powered analysis and export-ready sections
            </motion.p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button size="sm" className="glow-effect" onClick={() => setIsExportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </motion.div>
      </div>

      <ErrorBoundary>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 mb-8"
        >
          <h2 className="font-semibold mb-3">Project Summary</h2>
          <p className="text-muted-foreground leading-relaxed">{proposal.project_summary}</p>
        </motion.div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <InsightCard
            title="Features"
            value={proposal.features.length}
            subtitle="Identified features"
            icon={Layers}
            color="default"
            index={0}
          />
          <InsightCard
            title="Risks"
            value={proposal.risks.length}
            subtitle="Risk factors"
            icon={AlertTriangle}
            color="warning"
            index={1}
          />
          <InsightCard
            title="Timeline"
            value={proposal.estimatedDuration}
            subtitle="Estimated duration"
            icon={Clock}
            color="success"
            index={2}
          />
          <InsightCard
            title="Confidence"
            value={`${proposal.overallConfidence}%`}
            subtitle="Overall score"
            icon={Target}
            color="default"
            index={3}
          />
        </div>
      </ErrorBoundary>

      <div className="mb-8">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-lg font-semibold mb-4"
        >
          Feature Analysis
        </motion.h2>

        <ErrorBoundary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {proposal.features.map((feature, index) => (
              <ConfidenceCard
                key={feature.id}
                feature={feature}
                onClick={() => handleFeatureClick(feature)}
                index={index}
              />
            ))}
          </div>
        </ErrorBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Risk Assessment</h2>
          <ErrorBoundary>
            <RiskCard risks={proposal.risks} />
          </ErrorBoundary>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Effort Estimation</h2>
          <ErrorBoundary>
            <EffortCard efforts={proposal.effort} />
          </ErrorBoundary>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Project Timeline</h2>
        <ErrorBoundary>
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
        </ErrorBoundary>
      </div>

      {proposal.market.length > 0 && (
        <ErrorBoundary>
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Market Signals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposal.market.map((item) => (
                <div key={item.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-semibold">{item.title}</h3>
                    <span className="text-sm text-primary font-medium">{item.relevance}% relevance</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </ErrorBoundary>
      )}

      {proposal.impact.length > 0 && (
        <ErrorBoundary>
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Business Impact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposal.impact.map((item) => (
                <div key={item.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-semibold">{item.title}</h3>
                    <span className="text-sm text-primary font-medium">{item.impact_score}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </ErrorBoundary>
      )}

      <RevisionHistory
        versions={versionsQuery.data?.versions || []}
        currentVersion={versionsQuery.data?.currentVersion || proposal.versionCount}
        changedSections={changedSections}
      />

      <DetailDrawer
        feature={selectedFeature}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {isExportOpen && (
        <ExportModal proposalId={proposal.proposalId} onClose={() => setIsExportOpen(false)} />
      )}
    </div>
  )
}

export default ProposalResult
