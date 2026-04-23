import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

function MutationConfirmBanner({ section, newVersion, summary }) {
  const [visible, setVisible] = useState(true)

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  const sectionLabel = section
    ? section.charAt(0).toUpperCase() + section.slice(1)
    : 'Section'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-emerald-400">
                  {sectionLabel} Updated
                </span>
                {newVersion && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                    v{newVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                {summary || `The ${sectionLabel.toLowerCase()} section has been regenerated and saved.`}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MutationConfirmBanner
