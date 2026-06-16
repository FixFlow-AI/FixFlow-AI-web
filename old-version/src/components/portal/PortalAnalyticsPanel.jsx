import { Activity, Clock3, Eye, MessageSquareDiff } from 'lucide-react'
import { formatDateTime, formatDurationMs } from '@/lib/utils'

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-background/35 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export default function PortalAnalyticsPanel({ portal }) {
  if (!portal) {
    return (
      <div className="glass-card rounded-[28px] p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Portal Analytics</p>
        <h3 className="mt-2 text-xl font-semibold">No share link yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate a client portal link to start tracking opens, section engagement, and feedback.
        </p>
      </div>
    )
  }

  const sectionEntries = Object.entries(portal.sectionMetrics || {}).sort((a, b) => b[1].dwellMs - a[1].dwellMs)
  const totalDwell = sectionEntries.reduce((sum, [, value]) => sum + Number(value.dwellMs || 0), 0)
  const latestFeedback = portal.latestFeedback?.[0]

  return (
    <div className="glass-card rounded-[28px] p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Portal Analytics</p>
          <h3 className="mt-2 text-xl font-semibold">Client engagement after sharing</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Track opens, last activity, section dwell, and the latest feedback from the portal.
          </p>
        </div>
        <a
          href={portal.shareUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          Open public portal
        </a>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric icon={Eye} label="Views" value={portal.viewCount} />
        <Metric icon={Clock3} label="First Viewed" value={portal.firstViewedAt ? formatDateTime(portal.firstViewedAt) : 'Not yet'} />
        <Metric icon={Activity} label="Last Activity" value={portal.lastViewedAt ? formatDateTime(portal.lastViewedAt) : 'Not yet'} />
        <Metric icon={MessageSquareDiff} label="Tracked Dwell" value={formatDurationMs(totalDwell)} hint="Across visible sections" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mb-3 text-sm font-semibold">Section engagement</p>
          <div className="space-y-3">
            {sectionEntries.map(([section, metrics]) => (
              <div key={section} className="rounded-2xl border border-border bg-background/30 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium capitalize">{section}</div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.views} views • {formatDurationMs(metrics.dwellMs)}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${totalDwell ? (metrics.dwellMs / totalDwell) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Latest client feedback</p>
          <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm text-muted-foreground">
            {latestFeedback ? (
              <>
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-primary">
                  {formatDateTime(latestFeedback.submittedAt)}
                </div>
                <p className="whitespace-pre-wrap">{latestFeedback.message}</p>
              </>
            ) : (
              'No client feedback has been submitted yet.'
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
