import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const stats = [
  { label: 'Onboarding', value: 'Autonomous' },
  { label: 'Payments', value: 'Razorpay' },
  { label: 'Access Queue', value: 'Batch 01' },
]

function WaitlistHero() {
  const shouldReduceMotion = useReducedMotion()
  const { scrollY } = useScroll()

  // Subtle parallax shifts
  const yContent = useTransform(scrollY, [0, 900], shouldReduceMotion ? [0, 0] : [0, -80])
  const heroOpacity = useTransform(scrollY, [600, 1100], [1, 0])
  const heroScale = useTransform(scrollY, [600, 1100], [1, 0.95])

  const handleScroll = (e, target) => {
    e.preventDefault()
    const el = document.querySelector(target)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="home" className="relative flex min-h-[92vh] items-center overflow-hidden pt-28 pb-16">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="workspace-grid opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(7,91,255,0.06),transparent_32%),radial-gradient(circle_at_26%_78%,rgba(22,160,133,0.04),transparent_32%),linear-gradient(180deg,transparent,var(--background))] pointer-events-none" />
      </div>

      <motion.div
        style={{
          y: yContent,
          opacity: heroOpacity,
          scale: heroScale,
        }}
        className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Text & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-start text-left max-w-2xl">
            {/* Live Indicator Badge */}
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-foreground text-xs font-mono font-medium shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Active Queue — Batch 01 Opening Soon
              </span>
            </motion.div>

            {/* H1 Heading */}
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              The autonomous escrow and{' '}
              <span className="text-gradient-primary">scoping workspace.</span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              FixFlow AI removes freelancer onboarding barriers, establishes collaborative proposal workspaces, and automates milestone payments with secure escrow protection.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <a
                href="#waitlist-form"
                onClick={(e) => handleScroll(e, '#waitlist-form')}
                className="w-full sm:w-auto"
              >
                <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm">
                  Request Beta Access
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </a>
              <a
                href="#workflow"
                onClick={(e) => handleScroll(e, '#workflow')}
                className="w-full sm:w-auto"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-border bg-card/60 backdrop-blur-md"
                >
                  See How It Works
                </Button>
              </a>
            </div>

            {/* Stats list */}
            <div className="mt-12 grid grid-cols-3 gap-4 border-t border-border/80 pt-8 w-full max-w-lg">
              {stats.map(({ label, value }) => (
                <div key={label} className="flex flex-col">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    {label}
                  </span>
                  <span className="mt-1.5 text-base font-semibold text-foreground tracking-tight">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Hero Video Frame */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, x: 40, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 w-full relative"
          >
            {/* Visual background shadows */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary/10 to-accent/5 blur-2xl opacity-40 pointer-events-none" />
            
            {/* Web browser frame mockup */}
            <div className="relative rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Browser bar */}
              <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/40 border-b border-border/60">
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="ml-4 h-4 w-40 rounded bg-border/40" />
              </div>
              
              {/* Video Player */}
              <div className="aspect-[16/9] relative bg-muted/20 overflow-hidden">
                <video
                  src="/video/hero-ui.mp4"
                  poster="/landing-page/hero-ui.png"
                  muted
                  playsInline
                  autoPlay
                  loop
                  className="w-full h-full object-cover scale-[1.08] translate-x-[2.5%] translate-y-[2.5%]"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background pointer-events-none" />
    </section>
  )
}

export default WaitlistHero
