import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowRight, Pause, Play } from 'lucide-react'
import { RevealText } from '../components/RevealText'
import { audiences, heroSteps } from '../data/landing'
import { useLandingStore } from '../store/useLandingStore'

export function Hero() {
  const heroStep = useLandingStore((state) => state.heroStep)
  const demoRunning = useLandingStore((state) => state.demoRunning)
  const setHeroStep = useLandingStore((state) => state.setHeroStep)
  const setDemoRunning = useLandingStore((state) => state.setDemoRunning)
  const setAudience = useLandingStore((state) => state.setAudience)
  const reducedMotion = useReducedMotion()
  const activeStep = heroSteps[heroStep]

  useEffect(() => {
    if (!demoRunning || reducedMotion) return undefined

    if (heroStep >= heroSteps.length - 1) {
      const stopTimer = window.setTimeout(() => setDemoRunning(false), 900)
      return () => window.clearTimeout(stopTimer)
    }

    const timer = window.setTimeout(() => setHeroStep(heroStep + 1), 1050)
    return () => window.clearTimeout(timer)
  }, [demoRunning, heroStep, reducedMotion, setDemoRunning, setHeroStep])

  const toggleDemo = () => {
    if (demoRunning) {
      setDemoRunning(false)
      return
    }
    setHeroStep(0)
    if (reducedMotion) {
      setHeroStep(heroSteps.length - 1)
    } else {
      setDemoRunning(true)
    }
  }

  return (
    <section className="hero section-grid" id="top">
      <div className="hero-copy">
        <RevealText as="h1" className="hero-title">
          Work moves when trust is already built.
        </RevealText>
        <p className="hero-description">
          FixFlowAI turns a raw project brief into a verified plan, proof-led match, protected
          milestones, and one shared delivery record.
        </p>
        <div className="hero-actions">
          <a className="button" href="#/signup">
            Request early access
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <button className="button button--quiet" type="button" onClick={toggleDemo}>
            {demoRunning ? <Pause aria-hidden="true" size={17} /> : <Play aria-hidden="true" size={17} />}
            {demoRunning ? 'Pause system' : 'Watch the system think'}
          </button>
        </div>
        <div className="hero-audiences" aria-label="Built for">
          <span>Built for</span>
          {audiences.map((audience) => (
            <a href="#problem" key={audience.id} onClick={() => setAudience(audience.id)}>
              {audience.title.toLowerCase()}
            </a>
          ))}
        </div>
      </div>

      <motion.div
        className="hero-system"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.7, delay: reducedMotion ? 0 : 0.25 }}
      >
        <div className="system-topbar">
          <div>
            <span className="system-kicker">Live agreement path</span>
            <strong>Billing service migration</strong>
          </div>
          <span className="system-state">{activeStep.status}</span>
        </div>

        <div className="hero-flow" aria-label="Project trust workflow">
          {heroSteps.map((step, index) => {
            const StepIcon = step.icon
            const isComplete = index < heroStep
            const isActive = index === heroStep
            return (
              <button
                className={`hero-flow-step${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                key={step.label}
                type="button"
                aria-current={isActive ? 'step' : undefined}
                onClick={() => {
                  setDemoRunning(false)
                  setHeroStep(index)
                }}
              >
                <span className="hero-flow-icon">
                  <StepIcon aria-hidden="true" size={18} strokeWidth={1.9} />
                </span>
                <span>
                  <small>0{index + 1}</small>
                  <strong>{step.label}</strong>
                </span>
              </button>
            )
          })}
          <div
            className="hero-flow-line"
            style={{ '--flow-progress': `${(heroStep / (heroSteps.length - 1)) * 100}%` } as React.CSSProperties}
            aria-hidden="true"
          />
        </div>

        <motion.div
          className="system-insight"
          key={activeStep.label}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.28 }}
          aria-live="polite"
        >
          <span className="system-insight-index">0{heroStep + 1}</span>
          <div>
            <strong>{activeStep.label}</strong>
            <p>{activeStep.detail}</p>
          </div>
          <ArrowDownRight aria-hidden="true" size={20} />
        </motion.div>

        <div className="system-footer">
          <span>Source brief v1.2</span>
          <span>{heroStep + 1} / {heroSteps.length}</span>
        </div>
      </motion.div>

      <a className="hero-next" href="#problem">
        The old marketplace makes everyone do the wrong work.
        <ArrowDownRight aria-hidden="true" size={18} />
      </a>
    </section>
  )
}
