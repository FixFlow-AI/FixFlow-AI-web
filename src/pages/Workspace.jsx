import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import api from '@/config/api'
import useAuthStore from '@/stores/authStore'
import { useWorkspace } from '@/hooks/useWorkspace'
import ActivityFeed from '@/components/workspace/ActivityFeed'
import WorkspaceProposalCard from '@/components/workspace/WorkspaceProposalCard'
import { normalizeProposalList } from '@/lib/proposals'

export default function Workspace() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const [workspaceName, setWorkspaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { currentWorkspace } = useWorkspace(true)

  const proposalsQuery = useQuery({
    queryKey: ['workspace-proposals', currentWorkspace?.id],
    queryFn: () =>
      api
        .get('/proposals', { params: { scope: 'workspace', workspaceId: currentWorkspace.id } })
        .then((response) => normalizeProposalList(response.data.proposals)),
    enabled: Boolean(currentWorkspace?.id),
  })

  const handleCreateWorkspace = async () => {
    setIsCreating(true)
    try {
      const { data } = await api.post('/workspaces', {
        name: workspaceName,
        plan: user?.teamPlanPreference || 'free',
      })
      updateUser({ defaultEntryMode: 'team' })
      toast.success('Workspace created.')
      queryClient.invalidateQueries({ queryKey: ['current-workspace'] })
      setWorkspaceName('')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create workspace.')
    } finally {
      setIsCreating(false)
    }
  }

  if (!currentWorkspace) {
    return (
      <div className="mx-auto max-w-3xl glass-card rounded-[32px] p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Team Mode</p>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Create your workspace</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Start the shared proposal room for your agency, then invite editors and viewers.
        </p>
        <div className="mt-6 space-y-4">
          <Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Acme Studio" />
          <Button onClick={handleCreateWorkspace} isLoading={isCreating}>
            Create Workspace
          </Button>
        </div>
      </div>
    )
  }

  const proposals = proposalsQuery.data || []

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Workspace</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{currentWorkspace.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Shared proposals, activity, and delivery momentum across your team.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          {proposals.length ? proposals.map((proposal, index) => (
            <WorkspaceProposalCard key={proposal.proposalId} proposal={proposal} index={index} />
          )) : (
            <div className="glass-card rounded-[28px] p-6 text-sm text-muted-foreground">
              No workspace proposals yet. Generate one from the shared team context to start the feed.
            </div>
          )}
        </div>
        <ActivityFeed proposals={proposals} />
      </div>
    </div>
  )
}
