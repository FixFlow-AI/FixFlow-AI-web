import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/config/api'
import useAuthStore from '@/stores/authStore'
import useAgencyBrainStore from '@/stores/agencyBrainStore'
import AgencyBrainHeader from '@/components/agencyBrain/AgencyBrainHeader'
import InsightCard from '@/components/agencyBrain/InsightCard'
import InsufficientDataState from '@/components/agencyBrain/InsufficientDataState'

function getScopeWorkspaceId(user, currentWorkspace) {
  if (user?.defaultEntryMode === 'team' && currentWorkspace?.id) {
    return currentWorkspace.id
  }

  return null
}

export default function AgencyBrain() {
  const user = useAuthStore((state) => state.user)
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace)
  const hydrateInsights = useAgencyBrainStore((state) => state.hydrateInsights)
  const enabledInsights = useAgencyBrainStore((state) => state.enabledInsights)
  const setInsightEnabled = useAgencyBrainStore((state) => state.setInsightEnabled)
  const queryClient = useQueryClient()

  const workspaceId = getScopeWorkspaceId(user, currentWorkspace)
  const canUseAgencyBrain = workspaceId ? Boolean(currentWorkspace?.capabilities?.agencyBrain) : Boolean(user?.capabilities?.agencyBrain)

  const insightsQuery = useQuery({
    queryKey: ['agency-brain', workspaceId || 'personal'],
    queryFn: () =>
      api.get('/agency-brain/insights', {
        params: workspaceId ? { workspaceId } : {},
      }).then((response) => response.data),
    enabled: canUseAgencyBrain,
  })

  useEffect(() => {
    hydrateInsights(insightsQuery.data?.insights || [])
  }, [hydrateInsights, insightsQuery.data])

  const analyzeMutation = useMutation({
    mutationFn: () => api.post('/agency-brain/analyze', workspaceId ? { workspaceId } : {}).then((response) => response.data),
    onSuccess: () => {
      toast.success('Agency Brain refreshed.')
      queryClient.invalidateQueries({ queryKey: ['agency-brain', workspaceId || 'personal'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Unable to refresh Agency Brain.')
    },
  })

  const insightData = insightsQuery.data?.insights || []
  const sampleSize = insightsQuery.data?.sampleSize || 0

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <AgencyBrainHeader
        analyzedAt={insightsQuery.data?.analyzedAt}
        sampleSize={sampleSize}
        onAnalyze={() => analyzeMutation.mutate()}
        isAnalyzing={analyzeMutation.isPending}
        title={workspaceId ? 'Workspace Brain' : 'Agency Brain'}
      />

      {!canUseAgencyBrain ? (
        <div className="glass-card rounded-[28px] p-8 text-sm text-muted-foreground">
          Upgrade to the Standard plan or higher in this mode to unlock Agency Brain analysis and calibration.
        </div>
      ) : null}

      {canUseAgencyBrain && sampleSize < 3 ? (
        <InsufficientDataState sampleSize={sampleSize} />
      ) : null}

      {canUseAgencyBrain && sampleSize >= 3 ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {insightData.map((insight, index) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              index={index}
              enabled={enabledInsights[insight.id] !== false}
              onToggle={setInsightEnabled}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
