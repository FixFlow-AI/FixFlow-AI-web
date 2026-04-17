import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import type { RiskItem } from '@/lib/mock-data'

interface RiskCardProps {
  risks: RiskItem[]
}

function RiskCard({ risks }: RiskCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card rounded-xl p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold">Risk Assessment</h3>
      </div>
      
      <div className="space-y-4">
        {risks.map((risk, index) => (
          <motion.div
            key={risk.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="p-4 rounded-lg bg-muted/30 border border-border"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{risk.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {risk.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: risk.color }}>
                  {risk.severity}%
                </span>
              </div>
            </div>
            
            {/* Severity Bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${risk.severity}%` }}
                transition={{ duration: 0.8, delay: index * 0.1 + 0.2, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: risk.color }}
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Mitigation:</span> {risk.mitigation}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

export default RiskCard
