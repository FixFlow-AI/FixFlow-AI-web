import { motion } from 'framer-motion'
import { getConfidenceColor } from '@/lib/utils'

function ConfidenceBar({ percentage, animated = true, delay = 0 }) {
  const color = getConfidenceColor(percentage)

  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <motion.div
        initial={animated ? { width: 0 } : { width: `${percentage}%` }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, delay, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

export default ConfidenceBar
