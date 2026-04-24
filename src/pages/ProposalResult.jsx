import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  Share2,
  Gauge,
  Layers,
  AlertTriangle,
  Target,
  Clock,
  MessageSquare,
  Users,
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
import ProposalChatPane from '@/components/proposalChat/ProposalChatPane'
import SectionUpdateOverlay from '@/components/proposalChat/SectionUpdateOverlay'
import ShareModal from '@/components/portal/ShareModal'
import PortalAnalyticsPanel from '@/components/portal/PortalAnalyticsPanel'
import ErrorBoundary from '@/components/ErrorBoundary'
import StatusSelector from '@/components/winloss/StatusSelector'
import WonOutcomeModal from '@/components/winloss/WonOutcomeModal'
import LostOutcomeModal from '@/components/winloss/LostOutcomeModal'
import api from '@/config/api'
import { cn } from '@/lib/utils'
import { normalizeProposalRecord, summarizeChangedSections, calculateOverallConfidence, calculateEstimatedDuration } from '@/lib/proposals'
import { useProposalChat } from '@/hooks/useProposalChat'
import { usePresence } from '@/hooks/usePresence'
import PresenceStack from '@/components/workspace/PresenceStack'
import CommentsSidebar from '@/components/comments/CommentsSidebar'
import CommentMarker from '@/components/comments/CommentMarker'
import ApprovalBadge from '@/components/comments/ApprovalBadge'
import DeliveryPlanSection from '@/components/proposal/DeliveryPlanSection'
import { useWorkspace } from '@/hooks/useWorkspace'

function ProposalResult() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isWonOutcomeOpen, setIsWonOutcomeOpen] = useState(false)
  const [isLostOutcomeOpen, setIsLostOutcomeOpen] = useState(false)
  const [isUpdatingDealStatus, setIsUpdatingDealStatus] = useState(false)
  const [dealStatus, setDealStatus] = useState('pending')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [hasOpenedChat, setHasOpenedChat] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)
  const [comments, setComments] = useState([])
  const [deliveryPlan, setDeliveryPlan] = useState(null)
  const [assignedTo, setAssignedTo] = useState('')
  const { fullWorkspace } = useWorkspace(true)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Section-level state for live patching from mutations
  const [sectionOverrides, setSectionOverrides] = useState({})
  const [updatingSections, setUpdatingSections] = useState({})
  const [sectionVersions, setSectionVersions] = useState({})
  const [pendingUpdates, setPendingUpdates] = useState({}) // track sections with uncommitted updates

  // ProposalChat hook
  const {
    messages: chatMessages,
    isStreaming: isChatStreaming,
    sectionUpdates,
    currentVersion: chatVersion,
    sendMessage: sendChatMessage,
  } = useProposalChat(id)

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

  const portalQuery = useQuery({
    queryKey: ['proposal', id, 'portal'],
    queryFn: () => api.get(`/proposals/${id}/portal`).then((response) => response.data.portal),
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

  const rawProposal = proposalQuery.data

  // Apply section overrides from chat mutations
  const proposal = useMemo(() => {
    if (!rawProposal) return null

    const patched = { ...rawProposal }

    for (const [section, data] of Object.entries(sectionOverrides)) {
      if (section === 'summary') {
        patched.project_summary = data
      } else if (Array.isArray(data)) {
        // Re-normalize the section data with IDs
        patched[section] = data.map((item, index) => ({
          ...item,
          id: item.id || `${section}-${index + 1}`,
        }))
      }
    }

    // Recalculate derived values
    if (sectionOverrides.features) {
      patched.overallConfidence = calculateOverallConfidence(patched.features)
    }
    if (sectionOverrides.timeline) {
      patched.estimatedDuration = calculateEstimatedDuration(patched.timeline)
    }

    return patched
  }, [rawProposal, sectionOverrides])
  const isViewer = proposal?.accessRole === 'viewer'
  const { viewers } = usePresence(proposal?.proposalId, proposal?.workspace?.id, Boolean(proposal?.workspace?.id))

  const planningMutation = useMutation({
    mutationFn: (payload) => api.patch(`/proposals/${id}/planning`, payload).then((response) => response.data),
    onSuccess: (data) => {
      setDeliveryPlan(data.deliveryPlan)
      queryClient.invalidateQueries({ queryKey: ['proposal', id] })
      queryClient.invalidateQueries({ queryKey: ['proposal', id, 'versions'] })
      toast.success('Delivery plan updated.')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Unable to update the delivery plan.')
    },
  })

  const assignmentMutation = useMutation({
    mutationFn: (payload) => api.patch(`/proposals/${id}/assignment`, payload).then((response) => response.data),
    onSuccess: (data) => {
      setAssignedTo(data.assignedTo || '')
      queryClient.invalidateQueries({ queryKey: ['proposal', id] })
      toast.success(data.assignedTo ? 'Proposal assignment updated.' : 'Proposal assignment cleared.')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Unable to update proposal assignment.')
    },
  })

  useEffect(() => {
    setComments(proposal?.comments || [])
  }, [proposal?.comments])

  useEffect(() => {
    setDeliveryPlan(proposal?.delivery_plan || null)
  }, [proposal?.delivery_plan])

  useEffect(() => {
    setAssignedTo(proposal?.assignedTo || '')
  }, [proposal?.assignedTo])

  const unresolvedCommentCounts = useMemo(() => {
    return comments.reduce((accumulator, comment) => {
      if (comment.resolved) {
        return accumulator
      }

      accumulator[comment.section] = (accumulator[comment.section] || 0) + 1
      return accumulator
    }, {})
  }, [comments])

  const approvedSections = useMemo(() => {
    return comments.reduce((accumulator, comment) => {
      if (comment.type === 'approval' && !comment.resolved) {
        accumulator[comment.section] = true
      }
      return accumulator
    }, {})
  }, [comments])

  const changedSections = useMemo(
    () => summarizeChangedSections(compareQuery.data?.diff),
    [compareQuery.data?.diff]
  )

  useEffect(() => {
    if (!proposal?.dealStatus) return
    setDealStatus(proposal.dealStatus)
  }, [proposal?.dealStatus])

  // Handle section updates from chat mutations
  useEffect(() => {
    if (sectionUpdates.length === 0) return

    const latest = sectionUpdates[sectionUpdates.length - 1]

    // Mark section as updating briefly for animation
    setUpdatingSections((prev) => ({ ...prev, [latest.section]: true }))
    setTimeout(() => {
      setUpdatingSections((prev) => ({ ...prev, [latest.section]: false }))
    }, 500)

    // Apply the section override
    setSectionOverrides((prev) => ({
      ...prev,
      [latest.section]: latest.payload,
    }))

    // Track section version for badge display
    setSectionVersions((prev) => ({
      ...prev,
      [latest.section]: latest.newVersion,
    }))

    // Mark as pending user commitment
    setPendingUpdates((prev) => ({
      ...prev,
      [latest.section]: true,
    }))

    // Invalidate queries so next full fetch picks up the new data
    queryClient.invalidateQueries({ queryKey: ['proposal', id] })
    queryClient.invalidateQueries({ queryKey: ['proposal', id, 'versions'] })

    toast.success(`New version of ${latest.section} is ready for review.`, {
      icon: '✨',
      duration: 5000,
    })
  }, [sectionUpdates, queryClient, id])

  const handleApplyUpdate = useCallback((section) => {
    setPendingUpdates((prev) => {
      const next = { ...prev }
      delete next[section]
      return next
    })
    toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} changes committed.`)
  }, [])

  const handleRevertUpdate = useCallback((section) => {
    setSectionOverrides((prev) => {
      const next = { ...prev }
      delete next[section]
      return next
    })
    setPendingUpdates((prev) => {
      const next = { ...prev }
      delete next[section]
      return next
    })
    toast.error(`${section.charAt(0).toUpperCase() + section.slice(1)} reverted to original.`)
  }, [])

  const handleOpenChat = useCallback(() => {
    if (isViewer) return
    setIsCommentsOpen(false)
    setIsChatOpen(true)
    setHasOpenedChat(true)
  }, [isViewer])

  const handleSendChatMessage = useCallback(
    (message, intent, targetSection) => {
      // Mark section as updating when mutation starts
      if (intent === 'mutate' && targetSection) {
        setUpdatingSections((prev) => ({ ...prev, [targetSection]: true }))
      }
      sendChatMessage(message, intent, targetSection)
    },
    [sendChatMessage]
  )

  const handleFeatureClick = (feature) => {
    setSelectedFeature(feature)
    setIsDrawerOpen(true)
  }

  const handleShare = () => {
    if (isViewer) return
    setIsShareOpen(true)
  }

  const handleDealStatusChange = async (nextStatus) => {
    const previousStatus = dealStatus
    setDealStatus(nextStatus)
    setIsUpdatingDealStatus(true)

    try {
      await api.patch(`/proposals/${id}/deal-status`, {
        dealStatus: nextStatus,
      })

      toast.success(`Deal status updated to ${nextStatus}.`)
      queryClient.invalidateQueries({ queryKey: ['proposal', id] })
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      queryClient.invalidateQueries({ queryKey: ['proposal-analytics'] })

      if (nextStatus === 'won') {
        setIsWonOutcomeOpen(true)
      }

      if (nextStatus === 'lost') {
        setIsLostOutcomeOpen(true)
      }
    } catch (statusError) {
      setDealStatus(previousStatus)
      toast.error(statusError.response?.data?.error || 'Unable to update deal status.')
    } finally {
      setIsUpdatingDealStatus(false)
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
    <div className="flex min-h-screen">
      <motion.div 
        animate={{ 
          marginRight: (isChatOpen || isCommentsOpen) && !isMobile ? '400px' : '0px',
          paddingRight: (isChatOpen || isCommentsOpen) && !isMobile ? '40px' : '0px'
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        className="flex-1 max-w-6xl mx-auto w-full"
      >
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
            <div className="mt-3 flex flex-wrap gap-3">
              <StatusSelector value={dealStatus} onChange={handleDealStatusChange} isLoading={isUpdatingDealStatus || isViewer} />
              {proposal.briefScore?.overallScore ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/35 px-3 py-1.5 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  BriefScore {proposal.briefScore.overallScore}
                </div>
              ) : null}
              {proposal.workspace ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/35 px-3 py-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  {proposal.workspace.name}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Button data-testid="open-share-modal" variant="outline" size="sm" onClick={handleShare} className="h-9" disabled={isViewer}>
            <Share2 className="h-4 w-4 mr-2" />
            Share Portal
          </Button>
          <Button size="sm" className="glow-effect h-10 px-5" onClick={() => setIsExportOpen(true)} disabled={isViewer}>
            <Download className="h-5 w-5 mr-2" />
            <span className="font-semibold">Export PDF</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            setIsChatOpen(false)
            setIsCommentsOpen(!isCommentsOpen)
          }} className="h-10 px-5">
            <MessageSquare className="h-5 w-5 mr-2" />
            <span className="font-semibold">Comments</span>
          </Button>
          <div className="relative">
            <Button
              size="sm"
              variant={isChatOpen ? "secondary" : "outline"}
              onClick={() => {
                setIsCommentsOpen(false)
                setIsChatOpen(!isChatOpen)
              }}
              disabled={isViewer}
              className={cn(
                "h-10 px-5 border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all relative overflow-visible",
                isChatOpen && "bg-primary/10 border-primary/50 text-primary"
              )}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              <span className="font-semibold">Negotiate & Refine</span>
              
              {/* Pulsing indicator - now better aligned */}
              {!hasOpenedChat && !isChatOpen && (
                <motion.span
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/50 border-2 border-background"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [1, 0.8, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </Button>
          </div>
        </motion.div>
      </div>

      {proposal.workspace ? (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-background/30 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Live workspace presence</div>
            <div className="text-xs text-muted-foreground">See who else is reviewing this proposal right now.</div>
          </div>
          <PresenceStack viewers={viewers} />
        </div>
      ) : null}

      {proposal.workspace ? (
        <div className="mb-6 rounded-2xl border border-border bg-background/30 px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium">Assignment</div>
              <div className="text-xs text-muted-foreground">Route delivery follow-up to a teammate and notify them immediately.</div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={assignedTo || ''}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setAssignedTo(nextValue)
                  assignmentMutation.mutate({ assignedTo: nextValue || null })
                }}
                disabled={isViewer || assignmentMutation.isPending}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Unassigned</option>
                {(fullWorkspace?.members || []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <ErrorBoundary>
        <SectionUpdateOverlay
          sectionKey="summary"
          isUpdating={updatingSections.summary}
          hasPendingUpdate={pendingUpdates.summary}
          newVersion={sectionVersions.summary}
          onApply={() => handleApplyUpdate('summary')}
          onRevert={() => handleRevertUpdate('summary')}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-6 mb-8"
          >
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-semibold">Project Summary</h2>
              <CommentMarker count={unresolvedCommentCounts.summary || 0} />
              <ApprovalBadge approved={approvedSections.summary} />
            </div>
            <p className="text-muted-foreground leading-relaxed">{proposal.project_summary}</p>
          </motion.div>
        </SectionUpdateOverlay>
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

      <PortalAnalyticsPanel portal={portalQuery.data} />

      <SectionUpdateOverlay
        sectionKey="features"
        isUpdating={updatingSections.features}
        hasPendingUpdate={pendingUpdates.features}
        newVersion={sectionVersions.features}
        onApply={() => handleApplyUpdate('features')}
        onRevert={() => handleRevertUpdate('features')}
      >
        <div className="mb-8">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 flex items-center gap-3 text-lg font-semibold"
          >
            <span>Feature Analysis</span>
            <CommentMarker count={unresolvedCommentCounts.features || 0} />
            <ApprovalBadge approved={approvedSections.features} />
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
      </SectionUpdateOverlay>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <SectionUpdateOverlay
          sectionKey="risks"
          isUpdating={updatingSections.risks}
          hasPendingUpdate={pendingUpdates.risks}
          newVersion={sectionVersions.risks}
          onApply={() => handleApplyUpdate('risks')}
          onRevert={() => handleRevertUpdate('risks')}
        >
          <div>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Risk Assessment</h2>
              <CommentMarker count={unresolvedCommentCounts.risks || 0} />
              <ApprovalBadge approved={approvedSections.risks} />
            </div>
            <ErrorBoundary>
              <RiskCard risks={proposal.risks} />
            </ErrorBoundary>
          </div>
        </SectionUpdateOverlay>

        <SectionUpdateOverlay
          sectionKey="effort"
          isUpdating={updatingSections.effort}
          hasPendingUpdate={pendingUpdates.effort}
          newVersion={sectionVersions.effort}
          onApply={() => handleApplyUpdate('effort')}
          onRevert={() => handleRevertUpdate('effort')}
        >
          <div>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Effort Estimation</h2>
              <CommentMarker count={unresolvedCommentCounts.effort || 0} />
              <ApprovalBadge approved={approvedSections.effort} />
            </div>
            <ErrorBoundary>
              <EffortCard efforts={proposal.effort} totalDuration={proposal.estimatedDuration} />
            </ErrorBoundary>
          </div>
        </SectionUpdateOverlay>
      </div>

      <SectionUpdateOverlay
        sectionKey="timeline"
        isUpdating={updatingSections.timeline}
        hasPendingUpdate={pendingUpdates.timeline}
        newVersion={sectionVersions.timeline}
        onApply={() => handleApplyUpdate('timeline')}
        onRevert={() => handleRevertUpdate('timeline')}
      >
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold">Project Timeline</h2>
            <CommentMarker count={unresolvedCommentCounts.timeline || 0} />
            <ApprovalBadge approved={approvedSections.timeline} />
          </div>
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
      </SectionUpdateOverlay>

      {deliveryPlan ? (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold">Delivery Plan</h2>
            <CommentMarker count={unresolvedCommentCounts.timeline || 0} />
          </div>
          <DeliveryPlanSection
            deliveryPlan={deliveryPlan}
            canEdit={!isViewer}
            isSaving={planningMutation.isPending}
            onSetTaskStatus={(weekId, taskId, status) => planningMutation.mutate({ action: 'set_task_status', weekId, taskId, status })}
            onMoveToBacklog={(weekId, taskId) => planningMutation.mutate({ action: 'move_task_to_backlog', weekId, taskId })}
            onRestoreBacklog={(backlogItemId, weekId) => planningMutation.mutate({ action: 'restore_backlog_item', backlogItemId, weekId })}
            onSaveGoals={(weekId, goals) => planningMutation.mutate({ action: 'update_goals', weekId, goals })}
            onSaveNotifications={(notificationDefaults) => planningMutation.mutate({ action: 'update_notifications', notificationDefaults })}
          />
        </div>
      ) : null}

      {proposal.market.length > 0 && (
        <ErrorBoundary>
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Market Signals</h2>
              <CommentMarker count={unresolvedCommentCounts.market || 0} />
              <ApprovalBadge approved={approvedSections.market} />
            </div>
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
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Business Impact</h2>
              <CommentMarker count={unresolvedCommentCounts.impact || 0} />
              <ApprovalBadge approved={approvedSections.impact} />
            </div>
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
      </motion.div>

      {isExportOpen && (
        <ExportModal proposalId={proposal.proposalId} onClose={() => setIsExportOpen(false)} />
      )}

      <ShareModal
        proposalId={proposal.proposalId}
        portal={portalQuery.data}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['proposal', id, 'portal'] })
        }}
      />

      <WonOutcomeModal
        proposalId={proposal.proposalId}
        isOpen={isWonOutcomeOpen}
        onClose={() => setIsWonOutcomeOpen(false)}
      />

      <LostOutcomeModal
        proposalId={proposal.proposalId}
        isOpen={isLostOutcomeOpen}
        defaultLossReason={proposal.lossReason}
        onClose={() => setIsLostOutcomeOpen(false)}
      />

      {/* Persistent Chat Pane for Split View (Desktop) */}
      {!isMobile && (
        <div 
          className={cn(
            "fixed top-[73px] right-0 bottom-0 z-40 transition-all duration-500 ease-in-out",
            isChatOpen || isCommentsOpen ? "w-[400px] opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-full"
          )}
        >
          {isCommentsOpen ? (
            <CommentsSidebar
              proposalId={proposal.proposalId}
              comments={comments}
              canComment
              onCommentsChange={setComments}
              onClose={() => setIsCommentsOpen(false)}
            />
          ) : (
            <ProposalChatPane
              proposalId={id}
              messages={chatMessages}
              isStreaming={isChatStreaming}
              currentVersion={chatVersion || versionsQuery.data?.currentVersion || proposal.versionCount}
              onSendMessage={handleSendChatMessage}
              onClose={() => setIsChatOpen(false)}
              showClose={true}
            />
          )}
        </div>
      )}

      {/* Mobile Drawer */}
      {isMobile && (isChatOpen || isCommentsOpen) && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
            setIsChatOpen(false)
            setIsCommentsOpen(false)
          }} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-0 left-0 right-0 h-[80vh] rounded-t-3xl overflow-hidden"
          >
            {isCommentsOpen ? (
              <CommentsSidebar
                proposalId={proposal.proposalId}
                comments={comments}
                canComment
                onCommentsChange={setComments}
                onClose={() => setIsCommentsOpen(false)}
              />
            ) : (
              <ProposalChatPane
                proposalId={id}
                messages={chatMessages}
                isStreaming={isChatStreaming}
                currentVersion={chatVersion || versionsQuery.data?.currentVersion || proposal.versionCount}
                onSendMessage={handleSendChatMessage}
                onClose={() => setIsChatOpen(false)}
                showClose={true}
              />
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default ProposalResult
