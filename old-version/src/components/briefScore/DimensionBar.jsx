import { motion } from 'framer-motion'

function getBarColor(score) {
  if (score >= 70) return 'var(--confidence-high)'
  if (score >= 41) return 'var(--confidence-medium)'
  return 'var(--confidence-low)'
}

export default function DimensionBar({ dimension, index }) {
  return (
    <div className="rounded-2xl border border-border bg-background/30 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{dimension.name}</div>
        <div className="text-sm font-semibold" style={{ color: getBarColor(dimension.score) }}>
          {dimension.score}%
        </div>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: getBarColor(dimension.score) }}
          initial={{ width: 0 }}
          animate={{ width: `${dimension.score}%` }}
          transition={{ duration: 0.6, delay: 0.1 + index * 0.04 }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{dimension.diagnostic}</p>
      {dimension.missing && (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          Missing: {dimension.missing}
        </div>
      )}
    </div>
  )
}
