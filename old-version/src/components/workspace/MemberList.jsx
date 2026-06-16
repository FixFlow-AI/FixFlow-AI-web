import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'

export default function MemberList({
  members = [],
  roles = [],
  onRemove,
  onRoleChange,
  canManage = false,
  canAssignRole = false,
}) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
            <div key={member.userId} className="surface-frame flex items-center justify-between rounded-2xl border border-border bg-background/30 p-4">
          <div className="flex items-center gap-3">
            <Avatar src={member.avatar || '/avatar.png'} fallback={member.name?.slice(0, 2)?.toUpperCase()} size="md" />
            <div>
              <div className="font-medium">{member.name || 'Workspace member'}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{member.roleName || member.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAssignRole && member.role !== 'owner' ? (
              <select
                value={member.role}
                onChange={(event) => onRoleChange?.(member, event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {roles.filter((role) => role.roleId !== 'owner').map((role) => (
                  <option key={role.roleId} value={role.roleId}>{role.name}</option>
                ))}
              </select>
            ) : null}
            {canManage && member.role !== 'owner' ? (
              <Button variant="outline" size="sm" onClick={() => onRemove?.(member)}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
