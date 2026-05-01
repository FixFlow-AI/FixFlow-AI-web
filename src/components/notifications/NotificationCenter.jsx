import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'personal', label: 'Personal' },
]

function formatDateTime(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Just now'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export default function NotificationCenter() {
  const navigate = useNavigate()
  const [scope, setScope] = useState('all')
  const [isOpen, setIsOpen] = useState(false)
  const badgeQuery = useNotifications('all')
  const scopedQuery = useNotifications(scope)
  const { notifications, markRead, isLoading } = scopedQuery
  const { unreadCount, markAllRead, isMarkingAllRead } = badgeQuery

  const handleOpenNotification = async (notification) => {
    if (!notification.readAt) {
      await markRead(notification.id)
    }

    if (notification.proposalId) {
      navigate(`/proposal/${notification.proposalId}`)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative p-2 hover:bg-muted rounded-lg transition-colors inline-flex"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-[18px] text-primary-foreground">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-primary/35 bg-card/70 p-5 shadow-2xl shadow-primary/10 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 workspace-grid opacity-35" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full border border-primary/25 bg-primary/10 blur-sm" />
          <div className="pointer-events-none absolute bottom-[-5rem] left-8 h-36 w-36 rounded-full border border-emerald-300/20 bg-emerald-400/10 blur-md" />

          <div className="relative flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Notifications</div>
              <div className="text-xs text-muted-foreground">Unread: {unreadCount}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => markAllRead()} isLoading={isMarkingAllRead}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setScope(filter.key)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  scope === filter.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background/40 text-muted-foreground'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length ? notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleOpenNotification(notification)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                  notification.readAt
                    ? 'border-border bg-background/20'
                    : 'border-primary/30 bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{notification.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{notification.body}</div>
                  </div>
                  {!notification.readAt ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {notification.scope} · {formatDateTime(notification.createdAt)}
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/20 p-4 text-sm text-muted-foreground">
                No notifications in this view yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
