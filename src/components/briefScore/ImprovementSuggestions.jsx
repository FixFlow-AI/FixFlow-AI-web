export default function ImprovementSuggestions({ suggestions = [] }) {
  if (!suggestions.length) return null

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Improvement Suggestions
      </h3>
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <div key={suggestion.question} className="rounded-2xl border border-border bg-background/30 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">{suggestion.question}</div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                {suggestion.impact}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
