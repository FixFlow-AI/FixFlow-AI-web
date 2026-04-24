import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useWorkspace } from '@/hooks/useWorkspace'
import InviteModal from '@/components/workspace/InviteModal'
import MemberList from '@/components/workspace/MemberList'
import InviteHistoryList from '@/components/workspace/InviteHistoryList'
import NotificationPreferencesCard from '@/components/settings/NotificationPreferencesCard'
import api from '@/config/api'

export default function WorkspaceSettings() {
  const { currentWorkspace, fullWorkspace, refetch } = useWorkspace(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const canManage = ['owner', 'editor'].includes(currentWorkspace?.currentUserRole)

  const handleRemove = async (member) => {
    try {
      await api.delete(`/workspaces/current/members/${member.userId}`)
      toast.success('Member removed.')
      refetch()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to remove member.')
    }
  }

  const handleSaveNotifications = async (notificationDefaults) => {
    try {
      await api.patch('/workspaces/current', { notificationDefaults })
      toast.success('Workspace notifications updated.')
      refetch()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update workspace notifications.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Workspace Settings</p>
          <h1 className="mt-2 text-3xl font-bold">{currentWorkspace?.name || 'Workspace'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage team members, collaboration roles, and your workspace plan.
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} disabled={!canManage}>
          Invite Member
        </Button>
      </div>

      <div className="glass-card rounded-[28px] p-6">
        <div className="text-sm text-muted-foreground">Current team plan</div>
        <div className="mt-2 text-2xl font-semibold capitalize">{currentWorkspace?.plan || 'free'}</div>
      </div>

      <div className="glass-card rounded-[28px] p-6">
        <h2 className="text-xl font-semibold">Members</h2>
        <div className="mt-5">
          <MemberList members={fullWorkspace?.members || []} canManage={currentWorkspace?.currentUserRole === 'owner'} onRemove={handleRemove} />
        </div>
      </div>

      <NotificationPreferencesCard
        title="Workspace Notifications"
        description="Control how the team hears about invites, comments, approvals, assignments, goal completion, and backlog movement."
        value={fullWorkspace?.notificationDefaults || currentWorkspace?.notificationDefaults}
        onSave={handleSaveNotifications}
        disabled={currentWorkspace?.currentUserRole !== 'owner'}
      />

      <div className="glass-card rounded-[28px] p-6">
        <h2 className="text-xl font-semibold">Invitations</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Track every invite by email, role, status, and timestamp.
        </p>
        <div className="mt-5">
          <InviteHistoryList invites={fullWorkspace?.invites || []} />
        </div>
      </div>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvited={() => refetch()}
      />
    </div>
  )
}
