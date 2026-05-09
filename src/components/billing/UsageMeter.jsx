export default function UsageMeter({ usage }) {
  const used = usage?.proposalsThisMonth || usage?.proposalsUsed || 0
  const limit = usage?.proposalLimit
  const unlimited = usage?.unlimited || limit === null
  const percent = unlimited || !limit ? 100 : Math.min(100, Math.round((used / limit) * 100))

  return (
    <div data-testid="billing-usage-meter">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Proposal usage</span>
        <span className="font-medium">{unlimited ? `${used} used · unlimited` : `${used}/${limit}`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${usage?.limitReached ? 'bg-destructive' : usage?.nearLimit ? 'bg-amber-400' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {usage?.resetDate ? (
        <p className="mt-2 text-xs text-muted-foreground">Resets {new Date(usage.resetDate).toLocaleDateString()}</p>
      ) : null}
    </div>
  )
}
