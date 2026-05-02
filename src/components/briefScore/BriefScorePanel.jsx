import ScoreDial from './ScoreDial'
import DimensionBar from './DimensionBar'
import MissingSignalsList from './MissingSignalsList'
import ImprovementSuggestions from './ImprovementSuggestions'

function ScoreSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="glass-card flex h-56 items-center justify-center rounded-[28px]">
        <div className="shimmer h-40 w-40 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="glass-card rounded-2xl p-4">
            <div className="shimmer mb-3 h-4 w-28 rounded" />
            <div className="shimmer mb-3 h-2 w-full rounded" />
            <div className="shimmer h-4 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BriefScorePanel({ briefScore, isLoading }) {
  if (isLoading && !briefScore) {
    return <ScoreSkeleton />
  }

  if (!briefScore) {
    return null
  }

  return (
    <div className="glass-card rounded-[28px] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary">Preflight Analysis</p>
          <h2 className="mt-2 text-2xl font-semibold">Brief quality before generation</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Catch weak signals early, tighten discovery questions, and improve the confidence of the generated proposal.
          </p>
        </div>
        <div className="rounded-full border border-border bg-transparent px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/40 focus-within:bg-background/40">
          Estimated confidence lift: <span className="font-semibold text-foreground">+{briefScore.estimatedConfidenceBoost}%</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-border bg-transparent p-6 transition-colors hover:bg-background/45 focus-within:bg-background/45">
          <ScoreDial score={briefScore.overallScore} grade={briefScore.grade} />
          <div className="text-center text-sm text-muted-foreground">
            {briefScore.readyToGenerate ? 'Brief is healthy enough to generate.' : 'Review gaps or generate with caution.'}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {briefScore.dimensions.map((dimension, index) => (
            <DimensionBar key={dimension.name} dimension={dimension} index={index} />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MissingSignalsList signals={briefScore.missingSections} />
        <ImprovementSuggestions suggestions={briefScore.improvementSuggestions} />
      </div>
    </div>
  )
}
