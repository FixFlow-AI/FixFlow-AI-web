import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * SectionUpdateOverlay
 *
 * Wraps a proposal section and triggers exit/enter animations
 * when the section data is updated via a chat mutation.
 *
 * Props:
 * - sectionKey: identifier like "features", "timeline", etc.
 * - isUpdating: boolean, true when a mutation for this section is in progress
 * - newVersion: number, the new version after mutation (for badge display)
 * - children: the section content to render
 */
function SectionUpdateOverlay({ sectionKey, isUpdating, newVersion, children }) {
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
    if (newVersion && !isUpdating) {
      setShowBadge(true)
      const timer = setTimeout(() => setShowBadge(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [newVersion, isUpdating])

  return (
    <div className="relative">
      {/* Golden pulsing border during update */}
      <AnimatePresence>
        {isUpdating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.3, 0.7, 0.3],
              boxShadow: [
                '0 0 0 2px rgba(251, 191, 36, 0.2)',
                '0 0 0 3px rgba(251, 191, 36, 0.5)',
                '0 0 0 2px rgba(251, 191, 36, 0.2)',
              ],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-xl pointer-events-none z-10 border-2 border-amber-400/40"
          />
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
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Updated · v{newVersion}
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
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default SectionUpdateOverlay
