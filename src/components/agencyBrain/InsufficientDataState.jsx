import { DatabaseZap } from 'lucide-react'

export default function InsufficientDataState({ sampleSize = 0 }) {
  return (
    <div className="glass-card rounded-[28px] p-10 text-center">
      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10">
        <DatabaseZap className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold">Agency Brain is still learning</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
        You have {sampleSize} completed won or lost proposals in this scope. Add a few more closed-loop proposals and FixFlowAI will start surfacing stronger pattern intelligence.
      </p>
    </div>
  )
}
