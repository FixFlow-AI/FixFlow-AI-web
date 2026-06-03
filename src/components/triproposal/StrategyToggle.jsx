export default function StrategyToggle({ enabled, onChange, disabled = false }) {
  return (
  <label className="surface-frame flex items-start gap-4 rounded-[24px] border border-border bg-background/30 px-5 py-4">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-border"
        checked={enabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div>
        <div className="font-medium">Generate 3 strategies</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Create Lean, Standard, and Premium proposals in parallel and compare them side by side.
        </p>
      </div>
    </label>
  )
}
