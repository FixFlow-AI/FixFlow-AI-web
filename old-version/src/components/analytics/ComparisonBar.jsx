export default function ComparisonBar({ title, leftLabel, rightLabel, leftValue = 0, rightValue = 0 }) {
  const max = Math.max(leftValue, rightValue, 1)

  return (
    <div className="glass-card rounded-[28px] p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
      <div className="mt-6 space-y-4">
        {[
          { label: leftLabel, value: leftValue, color: 'bg-emerald-400' },
          { label: rightLabel, value: rightValue, color: 'bg-rose-400' },
        ].map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-semibold">{item.value || 0}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
