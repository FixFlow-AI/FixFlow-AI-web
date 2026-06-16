import { History } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

export default function RevisionHistory({ versions = [], currentVersion = 1, changedSections = [] }) {
  if (!versions.length) {
    return null
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Revision History</h2>
            <p className="text-sm text-muted-foreground">
              Track the proposal versions saved to storage.
            </p>
          </div>
        </div>
        <Badge variant="outline">
          {versions.length} version{versions.length > 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        {versions.map((version) => (
          <div
            key={version.version}
            className={`rounded-xl border px-4 py-3 min-w-[160px] ${
              version.version === currentVersion
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background/60'
            }`}
          >
            <p className="text-sm font-semibold">Version {version.version}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(version.createdAt)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-background/60 p-4">
        <p className="text-sm font-medium mb-2">Latest change summary</p>
        {changedSections.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            The latest revision changed these top-level sections: {changedSections.join(', ')}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This is the initial saved revision, so there is no previous version diff yet.
          </p>
        )}
      </div>
    </div>
  )
}
