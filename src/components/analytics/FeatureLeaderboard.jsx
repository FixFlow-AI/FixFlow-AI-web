export default function FeatureLeaderboard({ features = [] }) {
  return (
    <div className="glass-card rounded-[28px] p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Top Winning Features</p>
      <div className="mt-5 space-y-3">
        {features.length ? (
          features.map((feature, index) => (
            <div key={feature.title} className="flex items-center justify-between rounded-2xl border border-border bg-background/35 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-primary">0{index + 1}</span>
                <span className="text-sm font-medium">{feature.title}</span>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {feature.count} wins
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border bg-background/35 px-4 py-6 text-sm text-muted-foreground">
            No won proposals yet, so feature win patterns will appear here once outcomes start closing.
          </div>
        )}
      </div>
    </div>
  )
}
