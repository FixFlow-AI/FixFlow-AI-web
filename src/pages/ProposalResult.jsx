import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Layers, 
  AlertTriangle, 
  TrendingUp, 
  Target,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import InsightCard from '@/components/proposal/InsightCard'
import ConfidenceCard from '@/components/proposal/ConfidenceCard'
import TimelineStep from '@/components/proposal/TimelineStep'
import EffortCard from '@/components/proposal/EffortCard'
import RiskCard from '@/components/proposal/RiskCard'
import DetailDrawer from '@/components/proposal/DetailDrawer'
import SectionSkeleton from '@/components/proposal/SectionSkeleton'
import { mockProposal } from '@/lib/mock-data'

function ProposalResult() {
  const { id } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [loadedSections, setLoadedSections] = useState([])
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Simulate streaming loading
  useEffect(() => {
    const sections = ['summary', 'insights', 'features', 'risks', 'timeline', 'effort']
    let currentIndex = 0

    const interval = setInterval(() => {
      if (currentIndex < sections.length) {
        setLoadedSections(prev => [...prev, sections[currentIndex]])
        currentIndex++
      } else {
        setIsLoading(false)
        clearInterval(interval)
      }
    }, 600)

    return () => clearInterval(interval)
  }, [])

  const handleFeatureClick = (feature) => {
    setSelectedFeature(feature)
    setIsDrawerOpen(true)
  }

  const isSectionLoaded = (section) => loadedSections.includes(section)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
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
              {mockProposal.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm text-muted-foreground"
            >
              Generated proposal with AI-powered analysis
            </motion.p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button size="sm" className="glow-effect">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </motion.div>
      </div>

      {/* Project Summary */}
      <AnimatePresence mode="wait">
        {isSectionLoaded('summary') ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-6 mb-8"
          >
            <h2 className="font-semibold mb-3">Project Summary</h2>
            <p className="text-muted-foreground leading-relaxed">
              {mockProposal.project_summary}
            </p>
          </motion.div>
        ) : (
          <div className="glass-card rounded-xl p-6 mb-8 space-y-3">
            <div className="shimmer h-5 w-32 rounded" />
            <div className="shimmer h-4 w-full rounded" />
            <div className="shimmer h-4 w-3/4 rounded" />
          </div>
        )}
      </AnimatePresence>

      {/* Insight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isSectionLoaded('insights') ? (
          <>
            <InsightCard
              title="Features"
              value={mockProposal.features.length}
              subtitle="Identified features"
              icon={Layers}
              color="default"
              index={0}
            />
            <InsightCard
              title="Risks"
              value={mockProposal.risks.length}
              subtitle="Risk factors"
              icon={AlertTriangle}
              color="warning"
              index={1}
            />
            <InsightCard
              title="Timeline"
              value="18 weeks"
              subtitle="Estimated duration"
              icon={Clock}
              color="success"
              index={2}
            />
            <InsightCard
              title="Confidence"
              value="82%"
              subtitle="Overall score"
              icon={Target}
              color="default"
              index={3}
            />
          </>
        ) : (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6 space-y-3">
              <div className="shimmer h-12 w-12 rounded-xl" />
              <div className="shimmer h-4 w-20 rounded" />
              <div className="shimmer h-8 w-12 rounded" />
            </div>
          ))
        )}
      </div>

      {/* Features Section - Confidence Grid */}
      <div className="mb-8">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-lg font-semibold mb-4"
        >
          Feature Analysis
        </motion.h2>
        
        {isSectionLoaded('features') ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockProposal.features.map((feature, index) => (
              <ConfidenceCard
                key={feature.id}
                feature={feature}
                onClick={() => handleFeatureClick(feature)}
                index={index}
              />
            ))}
          </div>
        ) : (
          <SectionSkeleton type="grid" />
        )}
      </div>

      {/* Two Column Layout: Risks + Effort */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Risks */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Risk Assessment</h2>
          {isSectionLoaded('risks') ? (
            <RiskCard risks={mockProposal.risks} />
          ) : (
            <SectionSkeleton type="card" />
          )}
        </div>

        {/* Effort */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Effort Estimation</h2>
          {isSectionLoaded('effort') ? (
            <EffortCard efforts={mockProposal.effort} />
          ) : (
            <SectionSkeleton type="card" />
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Project Timeline</h2>
        {isSectionLoaded('timeline') ? (
          <div className="max-w-2xl">
            {mockProposal.timeline.map((phase, index) => (
              <TimelineStep
                key={phase.id}
                phase={phase}
                index={index}
                total={mockProposal.timeline.length}
                isActive={index === 0}
              />
            ))}
          </div>
        ) : (
          <SectionSkeleton type="list" />
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        feature={selectedFeature}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  )
}

export default ProposalResult
