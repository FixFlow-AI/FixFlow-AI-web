import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, CheckCircle2, Github, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import useAuthStore from '@/stores/authStore'

const Hero3DElement = lazy(() => import('./Hero3DElement'))

const headlineLines = ['From client brief', 'to revenue system']

const signalCards = [
  ['BriefScore', '90%'],
  ['Revenue motion', '$3.6k'],
  ['Lead state', '4 active'],
]

function HeroSection() {
  const shouldReduceMotion = useReducedMotion()
  const startGithubLogin = useAuthStore((state) => state.startGithubLogin)
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

  const handleGithub = async () => {
    try {
      await startGithubLogin('individual')
    } catch (error) {
      toast.error(error.message || 'GitHub login is not available right now.')
    }
  }

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-28">
      <div className="absolute inset-0">
        <div className="workspace-grid opacity-75" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(63,215,255,0.2),transparent_28%),radial-gradient(circle_at_26%_78%,rgba(38,208,124,0.12),transparent_28%),linear-gradient(180deg,rgba(7,16,24,0),rgba(2,8,13,0.72))]" />
        <Suspense fallback={<div className="absolute inset-0" />}>
          <Hero3DElement />
        </Suspense>
      </div>

      <motion.div
        style={{ y: yContent, opacity: heroOpacity }}
        className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:px-8"
      >
        <div className="flex flex-col justify-center">
          <div className="overflow-hidden">
            {headlineLines.map((line, index) => (
              <motion.h1
                key={line}
                initial={{ y: '110%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.72, delay: index * 0.13, ease: [0.22, 1, 0.36, 1] }}
                className="text-5xl font-bold leading-[0.92] tracking-tight text-foreground sm:text-7xl lg:text-[6.8rem]"
              >
                {index === 1 ? <span className="text-gradient-primary">{line}</span> : line}
              </motion.h1>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.58, delay: 0.34 }}
            className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground"
          >
            FixFlowAI converts raw briefs, repo signals, delivery risk, lead motion, and client proof into one cinematic operating layer for freelancers and teams.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.46 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button size="lg" onClick={handleGithub} className="glow-effect">
              <Github className="h-4 w-4" />
              Connect GitHub
            </Button>
            <Link to="/freelancer">
              <Button variant="outline" size="lg" className="w-full border-primary/25 bg-background/35 backdrop-blur-xl sm:w-auto">
                View FlowBoard
                <ArrowRight className="h-4 w-4" />
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
          initial={{ opacity: 0, x: 34, rotateY: -8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{ y: yFrame }}
          className="relative min-h-[34rem] [perspective:1200px]"
        >
          <div className="landing-panel-strong absolute right-0 top-0 w-full max-w-[42rem] rounded-[2rem] p-3 lg:rotate-[-2deg]">
            <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">live product surface</span>
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
