import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowRight } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'
import { audiences } from '../data/landing'
import { useLandingStore } from '../store/useLandingStore'

export function Problem() {
  const audience = useLandingStore((state) => state.audience)
  const setAudience = useLandingStore((state) => state.setAudience)
  const reducedMotion = useReducedMotion()

  return (
    <section className="problem section-shell" id="problem">
      <SectionHeading index="01" title="The old marketplace makes everyone do the wrong work." />
      <div className="problem-header" aria-hidden="true">
        <span>Who carries the burden</span>
        <span>What changes</span>
      </div>
      <div className="problem-list">
        {audiences.map((item, index) => {
          const Icon = item.icon
          const isActive = item.id === audience
          return (
            <article
              className={`problem-row${isActive ? ' is-active' : ''}`}
              key={item.id}
              onMouseEnter={() => setAudience(item.id)}
            >
              <button
                className="problem-row-main"
                type="button"
                aria-expanded={isActive}
                onClick={() => setAudience(item.id)}
              >
                <span className="problem-number">0{index + 1}</span>
                <span className="problem-audience">
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                  <strong>{item.title}</strong>
                </span>
                <span className="problem-burden">{item.burden}</span>
                <ArrowDownRight className="problem-toggle" aria-hidden="true" size={20} />
              </button>
              <AnimatePresence initial={false}>
                {isActive ? (
                  <motion.div
                    className="problem-shift"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.32 }}
                  >
                    <div className="problem-path" aria-hidden="true">
                      <span>Marketplace effort</span>
                      <i />
                      <ArrowRight size={17} />
                      <i />
                      <span>Working agreement</span>
                    </div>
                    <p>{item.shift}</p>
                    <strong>{item.outcome}</strong>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </article>
          )
        })}
      </div>
    </section>
  )
}
