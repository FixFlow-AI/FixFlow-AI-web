import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'

export default function MemberList({ members = [], onRemove, canManage = false }) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={member.userId} className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-4">
          <div className="flex items-center gap-3">
            <Avatar src={member.avatar || '/avatar.png'} fallback={member.name?.slice(0, 2)?.toUpperCase()} size="md" />
            <div>
              <div className="font-medium">{member.name || 'Workspace member'}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{member.role}</div>
            </div>
          </div>
          {canManage && member.role !== 'owner' ? (
            <Button variant="outline" size="sm" onClick={() => onRemove?.(member)}>
              Remove
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
