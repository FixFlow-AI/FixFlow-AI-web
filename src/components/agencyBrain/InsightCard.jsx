import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import PatternStrengthBar from '@/components/agencyBrain/PatternStrengthBar'

export default function InsightCard({ insight, enabled, onToggle, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card rounded-[28px] p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">{insight.category}</p>
          <h3 className="mt-2 text-xl font-semibold">{insight.title}</h3>
        </div>
        <Button variant={enabled ? 'default' : 'outline'} size="sm" onClick={() => onToggle(insight.id, !enabled)}>
          {enabled ? 'Applied' : 'Apply'}
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{insight.recommendation}</p>

      <div className="mt-5 rounded-2xl border border-border bg-transparent p-4 text-sm text-muted-foreground transition-colors hover:bg-background/35 focus-within:bg-background/35">
        {insight.calibrationText}
      </div>

      <div className="mt-6">
        <PatternStrengthBar sampleSize={insight.sampleSize} strength={insight.strength} />
      </div>
    </motion.div>
  )
}
