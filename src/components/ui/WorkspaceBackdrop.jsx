export default function WorkspaceBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 workspace-grid opacity-40" />
      <div className="absolute -top-40 left-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute top-24 right-[-6%] h-[22rem] w-[22rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="absolute bottom-[-8rem] left-1/3 h-[18rem] w-[18rem] rounded-full bg-emerald-400/10 blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_32%),linear-gradient(180deg,rgba(4,11,18,0.22),rgba(4,11,18,0.6))]" />
    </div>
  )
}
