import { Suspense, lazy, useMemo } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Telescope } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const Hero3DElement = lazy(() => import('@/components/landing/Hero3DElement'))

const stats = [
  { label: 'Early Signups', value: 'Growing' },
  { label: 'User Roles', value: '3' },
  { label: 'Launch Status', value: 'Soon' },
]

// Word-by-word reveal animation for headline
function AnimatedWords({ text, className, delay = 0 }) {
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block mr-[0.28em]"
          initial={{ y: 80, opacity: 0, rotateX: -90 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          transition={{
            duration: 0.6,
            delay: delay + i * 0.04,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

// Floating particles background
function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        duration: 12 + Math.random() * 20,
        delay: Math.random() * 8,
      })),
    []
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{
            y: [0, -60, 0],
            x: [0, 20, -20, 0],
            opacity: [0, 0.6, 0.3, 0],
            scale: [0.5, 1.2, 0.8, 0.5],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

function WaitlistHero() {
  const shouldReduceMotion = useReducedMotion()
  const { scrollY } = useScroll()

  // Parallax transforms
  const yContent = useTransform(scrollY, [0, 700], shouldReduceMotion ? [0, 0] : [0, -100])
  const yBg = useTransform(scrollY, [0, 700], shouldReduceMotion ? [0, 0] : [0, 80])
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0])
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.95])
  const blurOnScroll = useTransform(scrollY, [0, 500], [0, 10])

  const handleScroll = (e, target) => {
    e.preventDefault()
    const el = document.querySelector(target)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="home" className="relative flex min-h-screen items-center overflow-hidden pt-28">
      {/* Background layers with parallax */}
      <motion.div className="absolute inset-0" style={{ y: yBg }}>
        <div className="workspace-grid opacity-75" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(63,215,255,0.2),transparent_28%),radial-gradient(circle_at_26%_78%,rgba(38,208,124,0.12),transparent_28%),linear-gradient(180deg,rgba(7,16,24,0),rgba(2,8,13,0.72))]" />
        {!shouldReduceMotion && <FloatingParticles />}
        <Suspense fallback={<div className="absolute inset-0" />}>
          <Hero3DElement />
        </Suspense>
      </motion.div>

      <motion.div
        style={{
          y: yContent,
          opacity: heroOpacity,
          scale: heroScale,
          filter: useTransform(blurOnScroll, (v) => `blur(${v}px)`),
        }}
        className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge with bounce-in */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.5, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
            className="mb-8"
          >
            <motion.span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium backdrop-blur-md"
              animate={shouldReduceMotion ? {} : { boxShadow: ['0 0 20px rgba(63,215,255,0)', '0 0 30px rgba(63,215,255,0.3)', '0 0 20px rgba(63,215,255,0)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Coming Soon — Join the Early Access Waitlist
            </motion.span>
          </motion.div>

          {/* Headline with word-by-word reveal */}
          <div className="overflow-hidden [perspective:1000px]">
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              {shouldReduceMotion ? (
                <>
                  Fix Flow AI —{' '}
                  <span className="text-gradient-primary">
                    Where Freelancers, Clients, and Developers Connect Smarter
                  </span>
                </>
              ) : (
                <>
                  <AnimatedWords text="Fix Flow AI —" delay={0.2} />
                  <AnimatedWords
                    text="Where Freelancers, Clients, and Developers Connect Smarter"
                    className="text-gradient-primary"
                    delay={0.5}
                  />
                </>
              )}
            </h1>
          </div>

          {/* Subheadline with fade-up + blur */}
          <motion.p
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 1.0 }}
            className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground"
          >
            Join the early waitlist for an AI-powered platform built to understand your work needs,
            improve collaboration, and help the right people find the right opportunities.
          </motion.p>

          {/* CTAs with spring hover + stagger */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 1.2 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <motion.a
              href="#waitlist-form"
              onClick={(e) => handleScroll(e, '#waitlist-form')}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button size="lg" className="w-full glow-effect sm:w-auto">
                Join the Waitlist
                <motion.span
                  animate={shouldReduceMotion ? {} : { x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </Button>
            </motion.a>
            <motion.a
              href="#problems"
              onClick={(e) => handleScroll(e, '#problems')}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full border-primary/25 bg-background/35 backdrop-blur-xl sm:w-auto"
              >
                <Telescope className="h-4 w-4" />
                Explore the Vision
              </Button>
            </motion.a>
          </motion.div>

          {/* Stats with staggered spring pop-in */}
          <div className="mt-14 grid grid-cols-3 gap-3 max-w-md w-full">
            {stats.map(({ label, value }, index) => (
              <motion.div
                key={label}
                initial={shouldReduceMotion ? {} : { opacity: 0, y: 40, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                  delay: 1.4 + index * 0.12,
                }}
                whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
                className="rounded-xl border border-border/70 bg-card/45 p-4 backdrop-blur-xl transition-colors cursor-default"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
    </section>
  )
}

export default WaitlistHero
