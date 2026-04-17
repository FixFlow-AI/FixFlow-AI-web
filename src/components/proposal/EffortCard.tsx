import { motion } from 'framer-motion'
import type { EffortEstimate } from '@/lib/mock-data'

interface EffortCardProps {
  efforts: EffortEstimate[]
}

function EffortCard({ efforts }: EffortCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card rounded-xl p-6"
    >
      <h3 className="font-semibold mb-6">Effort Breakdown</h3>
      
      <div className="space-y-5">
        {efforts.map((effort, index) => (
          <motion.div
            key={effort.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: effort.color }}
                />
                <span className="text-sm font-medium">{effort.label}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{effort.timeframe}</span>
                <span className="font-semibold" style={{ color: effort.color }}>
                  {effort.percentage}%
                </span>
              </div>
            </div>
            
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${effort.percentage}%` }}
                transition={{ duration: 0.8, delay: index * 0.1 + 0.2, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: effort.color }}
              />
            </div>
            
            <p className="text-xs text-muted-foreground mt-1.5">{effort.description}</p>
          </motion.div>
        ))}
      </div>

      {/* Total Duration */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estimated Total Duration</span>
          <span className="text-lg font-bold text-primary">18-22 weeks</span>
        </div>
      </div>
    </motion.div>
  )
}

export default EffortCard
