import { Link2, ShieldCheck, TimerReset } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

export default function PortalBanner({ agencyName, expiryAt }) {
  return (
    <div className="glass-card rounded-[28px] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Client Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Shared by {agencyName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Interactive proposal access with delivery scope, risks, effort, and timeline in a read-only client view.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-border bg-background/35 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <Link2 className="h-4 w-4 text-primary" />
              Read-only interactive share
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/35 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              No login required
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/35 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <TimerReset className="h-4 w-4 text-amber-200" />
              {expiryAt ? `Expires ${formatRelativeTime(expiryAt)}` : 'No expiry set'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
