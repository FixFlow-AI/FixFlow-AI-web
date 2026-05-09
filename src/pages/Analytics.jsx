import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '@/config/api'
import WinRateDonut from '@/components/analytics/WinRateDonut'
import ComparisonBar from '@/components/analytics/ComparisonBar'
import FeatureLeaderboard from '@/components/analytics/FeatureLeaderboard'

function MetricCard({ label, value, hint }) {
  return (
    <div className="glass-card rounded-[24px] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-sm text-muted-foreground">{hint}</div>}
    </div>
  )
}

function AIQualityTrends({ data }) {
  const trends = data?.trends || []
  const latestScore = data?.latest?.totalEvalScore || 0

  return (
    <div className="glass-card rounded-[28px] p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">AI Quality Trends</p>
          <h2 className="mt-2 text-xl font-semibold">Proposal evaluation harness</h2>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold">{latestScore || '—'}</div>
          <div className="text-xs text-muted-foreground">latest score</div>
        </div>
      </div>

      {!trends.length ? (
        <div className="mt-6 rounded-2xl border border-border bg-background/30 p-5 text-sm text-muted-foreground">
          Generate a few complete proposals to unlock AI quality trend lines.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {trends.slice(-8).map((item) => (
            <div key={item.date}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.date} · {item.count} proposal{item.count === 1 ? '' : 's'}</span>
                <span className="font-semibold">{item.averageTotalScore}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.averageTotalScore)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Analytics() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['proposal-analytics'],
    queryFn: () => api.get('/analytics/proposals').then((response) => response.data),
  })
  const evalTrendsQuery = useQuery({
    queryKey: ['proposal-eval-trends'],
    queryFn: () => api.get('/analytics/eval-trends').then((response) => response.data),
  })

  if (isLoading) {
    return <div className="grid gap-6 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="glass-card rounded-[24px] p-6"><div className="shimmer h-5 w-24 rounded" /><div className="shimmer mt-4 h-10 w-20 rounded" /></div>)}</div>
  }

  if (isError) {
    return (
      <div className="glass-card rounded-[28px] p-8 text-center">
        <h1 className="text-2xl font-semibold">Analytics could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">The analytics endpoint did not return a usable response.</p>
        <button type="button" onClick={() => refetch()} className="mt-4 rounded-full border border-border px-4 py-2 text-sm text-primary">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8" data-testid="analytics-page">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Lifecycle Analytics</p>
        <h1 className="mt-2 text-3xl font-bold">Proposal outcomes across your pipeline</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Compare win rate, proposal confidence, brief quality, and the features that show up most often in won deals.
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Proposals" value={data.totalProposals} />
        <MetricCard label="Pending" value={data.statusBreakdown.pending} />
        <MetricCard label="Negotiating" value={data.statusBreakdown.negotiating} />
        <MetricCard label="Average Time to Close" value={`${data.timeToCloseDays || 0} days`} />
      </div>

      <AIQualityTrends data={evalTrendsQuery.data} />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <WinRateDonut winRate={data.winRate} />
        <div className="grid gap-6 md:grid-cols-2">
          <ComparisonBar
            title="Confidence vs Outcome"
            leftLabel="Won"
            rightLabel="Lost"
            leftValue={data.confidenceComparison.won}
            rightValue={data.confidenceComparison.lost}
          />
          <ComparisonBar
            title="BriefScore vs Outcome"
            leftLabel="Won"
            rightLabel="Lost"
            leftValue={data.briefScoreComparison.won}
            rightValue={data.briefScoreComparison.lost}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <FeatureLeaderboard features={data.topWinningFeatures} />
        <div className="glass-card rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status Breakdown</p>
          <div className="mt-5 space-y-4">
            {Object.entries(data.statusBreakdown).map(([status, count]) => (
              <div key={status}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{status}</span>
                  <span className="font-semibold">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${data.totalProposals ? (count / data.totalProposals) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
