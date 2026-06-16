import StrategyBadge from '@/components/triproposal/StrategyBadge'

const STRATEGIES = ['lean', 'standard', 'premium']

export default function TriLoadingColumns({ strategies }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {STRATEGIES.map((strategy) => (
        <div key={strategy} className="glass-card rounded-[28px] p-5">
          <div className="flex items-center justify-between">
            <StrategyBadge strategy={strategy} />
            <span className="text-xs text-muted-foreground">
              {strategies[strategy]?.proposalId ? 'Ready' : 'Streaming'}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <div className="shimmer h-5 w-2/3 rounded-full" />
            <div className="shimmer h-20 rounded-2xl" />
            <div className="shimmer h-32 rounded-2xl" />
            <div className="shimmer h-24 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
