import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, CheckCircle2, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const Hero3DElement = lazy(() => import('./Hero3DElement'))

const headlineLines = ['Role-first work', 'from proof to delivery']

const signalCards = [
  ['BriefScore', '90%'],
  ['Revenue motion', '$3.6k'],
  ['Lead state', '4 active'],
]

function HeroSection() {
  const shouldReduceMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const yContent = useTransform(scrollY, [0, 720], shouldReduceMotion ? [0, 0] : [0, -96])
  const yFrame = useTransform(scrollY, [0, 720], shouldReduceMotion ? [0, 0] : [0, 74])
  const heroOpacity = useTransform(scrollY, [0, 560], [1, 0.18])
  const [bootIndex, setBootIndex] = useState(0)

  const bootLines = useMemo(() => [
    'intake scanned',
    'confidence mapped',
    'proposal structured',
    'flowboard ready',
  ], [])

  useEffect(() => {
    if (shouldReduceMotion) {
      setBootIndex(bootLines.length - 1)
      return undefined
    }

    const timers = bootLines.map((_, index) => window.setTimeout(() => setBootIndex(index), 520 + index * 440))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [bootLines, shouldReduceMotion])

  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden pt-28">
      <div className="absolute inset-0">
        <div className="workspace-grid opacity-75" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(63,215,255,0.2),transparent_28%),radial-gradient(circle_at_26%_78%,rgba(38,208,124,0.12),transparent_28%),linear-gradient(180deg,rgba(7,16,24,0),rgba(2,8,13,0.72))]" />
        <Suspense fallback={<div className="absolute inset-0" />}>
          <Hero3DElement />
        </Suspense>
      </div>

      <motion.div
        style={{ y: yContent, opacity }}
        className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 pb-12 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:px-8"
      >
        <div className="flex flex-col justify-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          >
            <span className="text-gradient">From brief intelligence to</span>
            <br />
            <span className="text-gradient-primary">freelancer operating system</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground"
          >
            FixFlowAI connects freelancers with GitHub-backed credibility, clients hiring trusted talent, and developers collaborating inside structured delivery workspaces.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.46 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Link to="/register?role=freelancer">
              <Button size="lg" className="w-full glow-effect sm:w-auto">
                Join as Freelancer
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/register?role=client">
              <Button variant="outline" size="lg" className="w-full border-primary/25 bg-background/35 backdrop-blur-xl sm:w-auto">
                <Users className="h-4 w-4" />
                Hire Talent as Client
              </Button>
            </Link>
            <Link to="/register?role=developer">
              <Button variant="outline" size="lg" className="w-full border-primary/25 bg-background/35 backdrop-blur-xl sm:w-auto">
                Join as Developer
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.58 }}
            className="mt-10 grid max-w-xl grid-cols-3 gap-3"
          >
            {signalCards.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border/70 bg-card/45 p-4 backdrop-blur-xl">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.18 }}
          className="relative"
        >
          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-[var(--glass-card-shadow)]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Boot sequence</span>
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
            </div>
            <img
              src="/web-interface/landing.png"
              alt="FixFlowAI landing and product preview"
              className="mt-3 aspect-[1.9/1] w-full rounded-[1.2rem] border border-white/5 object-cover object-top"
            />
          </div>

          <div className="landing-panel absolute bottom-10 left-0 max-w-[24rem] rounded-2xl p-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">execution sequence</span>
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="space-y-3 pt-4 font-mono text-xs uppercase tracking-[0.12em]">
              {bootLines.map((line, index) => (
                <div key={line} className="flex items-center justify-between gap-4">
                  <span className={index <= bootIndex ? 'text-foreground' : 'text-muted-foreground/35'}>{line}</span>
                  {index <= bootIndex ? <CheckCircle2 className="h-4 w-4 text-emerald-200" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </section>
  )
}

export default HeroSection
