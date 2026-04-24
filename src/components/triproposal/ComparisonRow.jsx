export default function ComparisonRow({ label, lean, standard, premium }) {
  return (
    <div className="grid gap-4 rounded-[24px] border border-border bg-background/25 p-4 text-sm xl:grid-cols-[180px_1fr_1fr_1fr]">
      <div className="font-medium text-muted-foreground">{label}</div>
      <div>{lean}</div>
      <div>{standard}</div>
      <div>{premium}</div>
    </div>
  )
}
