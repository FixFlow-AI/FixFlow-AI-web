import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, RotateCcw } from 'lucide-react'

/**
 * SectionUpdateOverlay
 *
 * Wraps a proposal section and triggers exit/enter animations
 * when the section data is updated via a chat mutation.
 */
function SectionUpdateOverlay({ 
  sectionKey, 
  isUpdating, 
  hasPendingUpdate,
  newVersion, 
  onApply,
  onRevert,
  children 
}) {
  const [showBadge, setShowBadge] = useState(false)
  const [animationKey, setAnimationKey] = useState(0)

  // Trigger re-animation when update completes
  useEffect(() => {
    if (isUpdating) {
      setAnimationKey((prev) => prev + 1)
    }
  }, [isUpdating])

  // Show "Updated" badge briefly after mutation
  useEffect(() => {
    if (newVersion && !isUpdating && !hasPendingUpdate) {
      setShowBadge(true)
      const timer = setTimeout(() => setShowBadge(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [newVersion, isUpdating, hasPendingUpdate])

  return (
    <div className="relative group">
      {/* Golden pulsing border during update */}
      <AnimatePresence>
        {(isUpdating || hasPendingUpdate) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.3, 0.5, 0.3],
              boxShadow: hasPendingUpdate 
                ? '0 0 0 2px rgba(16, 185, 129, 0.3)' 
                : '0 0 0 2px rgba(251, 191, 36, 0.3)',
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={`absolute inset-[-4px] rounded-2xl pointer-events-none z-10 border-2 ${
              hasPendingUpdate ? 'border-emerald-500/40' : 'border-amber-400/40'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Mutation Controls */}
      <AnimatePresence>
        {hasPendingUpdate && !isUpdating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-background/80 backdrop-blur-md border border-border p-1.5 rounded-full shadow-xl"
          >
            <button
              onClick={onApply}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Commit Changes
            </button>
            <button
              onClick={onRevert}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Revert
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Updated badge */}
      <AnimatePresence>
        {showBadge && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="absolute -top-2 right-4 z-20"
          >
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Applied · v{newVersion}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section content with exit/enter animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={animationKey}
          initial={animationKey > 0 ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={hasPendingUpdate ? 'opacity-80 blur-[1px] grayscale-[0.2] transition-all' : ''}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default SectionUpdateOverlay
