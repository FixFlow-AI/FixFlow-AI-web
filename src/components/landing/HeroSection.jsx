import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Github } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import useAuthStore from '@/stores/authStore'

const Hero3DElement = lazy(() => import('./Hero3DElement'))

function HeroSection() {
  const shouldReduceMotion = useReducedMotion()
  const startGithubLogin = useAuthStore((state) => state.startGithubLogin)
  const { scrollY } = useScroll()
  const yContent = useTransform(scrollY, [0, 700], [0, -80])
  const opacity = useTransform(scrollY, [0, 520], [1, 0.18])
  const [bootIndex, setBootIndex] = useState(0)

  const bootLines = useMemo(() => [
    'boot.fixflow.ai',
    'scan: briefs + repo evidence',
    'route: niche -> lead -> outreach -> escrow',
    'status: freelancer os ready',
  ], [])

  useEffect(() => {
    if (shouldReduceMotion) {
      setBootIndex(bootLines.length - 1)
      return undefined
    }

    const timers = bootLines.map((_, index) => window.setTimeout(() => setBootIndex(index), index * 420))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [bootLines, shouldReduceMotion])

  const handleGithub = async () => {
    try {
      await startGithubLogin('individual')
    } catch (error) {
      toast.error(error.message || 'GitHub login is not available right now.')
    }
  }

  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden pt-28">
      <div className="absolute inset-0">
        <div className="workspace-grid opacity-80" />
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground"
          >
            Analyze your niche, discover qualified leads, draft outreach, track escrow, and prove reputation from one calm engineering workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button size="lg" onClick={handleGithub} className="glow-effect">
              <Github className="h-4 w-4" />
              Connect GitHub
            </Button>
            <Link to="/freelancer">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                View FlowBoard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
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
            <div className="space-y-3 pt-4 font-mono text-sm">
              {bootLines.map((line, index) => (
                <div key={line} className={index <= bootIndex ? 'text-foreground' : 'text-muted-foreground/35'}>
                  <span className="mr-2 text-primary">&gt;</span>
                  {index <= bootIndex ? line : 'waiting...'}
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Niche', '91 depth'],
                ['Leads', '4 active'],
                ['Escrow', '$3.6k locked'],
                ['Proof', '2 credentials'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-background/40 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default HeroSection
