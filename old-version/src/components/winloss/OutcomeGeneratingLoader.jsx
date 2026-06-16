export default function OutcomeGeneratingLoader({ label = 'Generating outcome package...' }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 px-4 py-8 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
