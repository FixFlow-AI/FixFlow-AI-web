import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

function TimelineStep({ phase, index, total, isActive = false }) {
  const isLast = index === total - 1
  const tasks = Array.isArray(phase.tasks)
    ? phase.tasks
    : Array.isArray(phase.deliverables)
      ? phase.deliverables
      : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.15 }}
      className="relative flex gap-4"
    >
      {/* Timeline Connector */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.15 + 0.2 }}
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border-2 border-primary/30'
          }`}
        >
          {isActive ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <span className="text-sm font-bold">{index + 1}</span>
          )}
        </motion.div>
        
        {/* Connecting Line */}
        {!isLast && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: '100%' }}
            transition={{ duration: 0.5, delay: index * 0.15 + 0.3 }}
            className="w-0.5 bg-gradient-to-b from-primary/30 to-border flex-1 my-2"
          />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-8 ${isLast ? 'pb-0' : ''}`}>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h4 className="font-semibold">{phase.phase}</h4>
            <span className="text-sm text-primary font-medium">{phase.duration}</span>
          </div>
          
          <ul className="space-y-1.5">
            {tasks.map((task, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.15 + 0.3 + i * 0.05 }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <div className="h-1 w-1 rounded-full bg-primary/50" />
                {task}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  )
}

export default TimelineStep
