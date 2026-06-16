import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useWorkspace } from '@/hooks/useWorkspace'
import InviteModal from '@/components/workspace/InviteModal'
import MemberList from '@/components/workspace/MemberList'
import InviteHistoryList from '@/components/workspace/InviteHistoryList'
import RoleManager from '@/components/workspace/RoleManager'
import SlackIntegrationCard from '@/components/workspace/SlackIntegrationCard'
import NotificationPreferencesCard from '@/components/settings/NotificationPreferencesCard'
import { WORKSPACE_NOTIFICATION_CHANNEL_OPTIONS } from '@/lib/notificationPreferences'
import api from '@/config/api'

export default function WorkspaceSettings() {
  const { currentWorkspace, fullWorkspace, refetch } = useWorkspace(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const permissions = currentWorkspace?.permissions || []
  const canInvite = permissions.includes('members.invite')
  const canRemove = permissions.includes('members.remove')
  const canAssignRole = permissions.includes('members.role.assign')
  const canManageRoles = permissions.includes('roles.manage')
  const canManageNotifications = permissions.includes('notifications.manage') || permissions.includes('workspace.settings.manage')
  const canManageSlack = permissions.includes('slack.manage')

  const handleRemove = async (member) => {
    try {
      await api.delete(`/workspaces/current/members/${member.userId}`)
      toast.success('Member removed.')
      refetch()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to remove member.')
    }
  }

  const handleRoleChange = async (member, role) => {
    try {
      await api.patch(`/workspaces/current/members/${member.userId}/role`, { role })
      toast.success('Member role updated.')
      refetch()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update member role.')
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
        <Button onClick={() => setIsInviteOpen(true)} disabled={!canInvite}>
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
          <MemberList
            members={fullWorkspace?.members || []}
            roles={fullWorkspace?.roles || []}
            canManage={canRemove}
            canAssignRole={canAssignRole}
            onRemove={handleRemove}
            onRoleChange={handleRoleChange}
          />
        </div>
      </div>

      <RoleManager
        roles={fullWorkspace?.roles || []}
        permissions={[
          'workspace.view',
          'workspace.settings.manage',
          'members.invite',
          'members.remove',
          'members.role.assign',
          'roles.manage',
          'proposals.create',
          'proposals.edit',
          'proposals.comment',
          'proposals.share',
          'freelancer.view',
          'freelancer.manage',
          'slack.manage',
          'notifications.manage',
        ]}
        canManage={canManageRoles}
        onChanged={() => refetch()}
      />

      <SlackIntegrationCard canManage={canManageSlack} />

      <NotificationPreferencesCard
        title="Workspace Notifications"
        description="Control how the team hears about invites, comments, approvals, assignments, goal completion, and backlog movement."
        value={fullWorkspace?.notificationDefaults || currentWorkspace?.notificationDefaults}
        onSave={handleSaveNotifications}
        channelOptions={WORKSPACE_NOTIFICATION_CHANNEL_OPTIONS}
        disabled={!canManageNotifications}
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
        roles={fullWorkspace?.roles || []}
      />
    </div>
  )
}
