export default function MissingSignalsList({ signals = [] }) {
  if (!signals.length) return null

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Missing Signals
      </h3>
      <div className="flex flex-wrap gap-2">
        {signals.map((signal) => (
          <span
            key={signal}
            className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100"
          >
            {signal}
          </span>
        ))}
      </div>
    </div>
  )
}
