import { Suspense, lazy } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Telescope } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const Hero3DElement = lazy(() => import('@/components/landing/Hero3DElement'))

const stats = [
  { label: 'Early Signups', value: 'Growing' },
  { label: 'User Roles', value: '3' },
  { label: 'Launch Status', value: 'Soon' },
]

function WaitlistHero() {
  const shouldReduceMotion = useReducedMotion()

  const handleScroll = (e, target) => {
    e.preventDefault()
    const el = document.querySelector(target)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="home" className="relative flex min-h-screen items-center overflow-hidden pt-28">
      {/* Background layers */}
      <div className="absolute inset-0">
        <div className="workspace-grid opacity-75" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(63,215,255,0.2),transparent_28%),radial-gradient(circle_at_26%_78%,rgba(38,208,124,0.12),transparent_28%),linear-gradient(180deg,rgba(7,16,24,0),rgba(2,8,13,0.72))]" />
        <Suspense fallback={<div className="absolute inset-0" />}>
          <Hero3DElement />
        </Suspense>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Coming Soon — Join the Early Access Waitlist
            </span>
          </motion.div>

          {/* Headline */}
          <div className="overflow-hidden">
            <motion.h1
              initial={shouldReduceMotion ? {} : { y: '110%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              Fix Flow AI —{' '}
              <span className="text-gradient-primary">
                Where Freelancers, Clients, and Developers Connect Smarter
              </span>
            </motion.h1>
          </div>

          {/* Subheadline */}
          <motion.p
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.58, delay: 0.34 }}
            className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground"
          >
            Join the early waitlist for an AI-powered platform built to understand your work needs,
            improve collaboration, and help the right people find the right opportunities.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.46 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <a href="#waitlist-form" onClick={(e) => handleScroll(e, '#waitlist-form')}>
              <Button size="lg" className="w-full glow-effect sm:w-auto">
                Join the Waitlist
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#problems" onClick={(e) => handleScroll(e, '#problems')}>
              <Button
                variant="outline"
                size="lg"
                className="w-full border-primary/25 bg-background/35 backdrop-blur-xl sm:w-auto"
              >
                <Telescope className="h-4 w-4" />
                Explore the Vision
              </Button>
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.58 }}
            className="mt-14 grid grid-cols-3 gap-3 max-w-md w-full"
          >
            {stats.map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border/70 bg-card/45 p-4 backdrop-blur-xl">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </section>
  )
}

export default WaitlistHero
