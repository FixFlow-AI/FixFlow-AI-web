import { Badge } from '@/components/ui/Badge'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDateTime(value) {
  if (!value) {
    return 'Not available'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available'
  }

  return dateFormatter.format(parsed)
}

function getInviteStatusMeta(invite) {
  if (invite.status === 'accepted') {
    return {
      label: 'Accepted',
      variant: 'success',
    }
  }

  return {
    label: 'Pending',
    variant: 'warning',
  }
}

export default function InviteHistoryList({ invites = [] }) {
  if (!invites.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background/20 p-5 text-sm text-muted-foreground">
        No invitations have been sent yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {invites.map((invite) => {
        const status = getInviteStatusMeta(invite)

        return (
          <div key={invite.inviteId || `${invite.email}-${invite.createdAt}`} className="rounded-2xl border border-border bg-background/30 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <div className="font-medium">{invite.email}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {invite.roleName || invite.role} invitation
                </div>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em]">Sent</div>
                <div className="mt-1 text-foreground">{formatDateTime(invite.createdAt)}</div>
                <div className="mt-1">Invited by {invite.inviterName || 'Workspace owner'}</div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.2em]">Accepted</div>
                <div className="mt-1 text-foreground">
                  {invite.status === 'accepted' ? formatDateTime(invite.acceptedAt) : 'Pending'}
                </div>
                <div className="mt-1">
                  {invite.status === 'accepted'
                    ? `Joined by ${invite.acceptedBy?.name || invite.email}`
                    : `Expires ${formatDateTime(invite.expiresAt)}`}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
