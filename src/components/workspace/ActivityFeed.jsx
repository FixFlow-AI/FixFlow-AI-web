import { formatRelativeTime } from '@/lib/utils'

export default function ActivityFeed({ proposals = [] }) {
  const events = proposals.slice(0, 6).map((proposal) => ({
    id: proposal.proposalId,
    title: proposal.title,
    createdAt: proposal.createdAt,
    author: proposal.createdBy?.name || 'A teammate',
    action: proposal.status === 'complete' ? 'generated' : 'updated',
  }))

  return (
    <div className="glass-card rounded-[28px] p-6">
      <h3 className="text-lg font-semibold">Activity Feed</h3>
      <div className="mt-5 space-y-4">
        {events.length ? events.map((event) => (
          <div key={event.id} className="rounded-2xl border border-border bg-background/25 p-4 text-sm">
            <div className="font-medium">{event.author} {event.action} "{event.title}"</div>
            <div className="mt-1 text-muted-foreground">{formatRelativeTime(event.createdAt)}</div>
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">Workspace activity will appear here once the team starts generating proposals.</p>
        )}
      </div>
    </div>
  )
}
