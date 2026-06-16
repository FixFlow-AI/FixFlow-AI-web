import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { BrainCircuit, CheckCircle2, FileText, Gauge, ShieldCheck } from 'lucide-react'

const proofPoints = [
  { label: 'BriefScore', value: '90%', icon: Gauge },
  { label: 'Confidence grid', value: 'Live', icon: ShieldCheck },
  { label: 'Structured output', value: 'JSON', icon: FileText },
]

function BriefIntelligence() {
  const ref = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imageScale = useTransform(scrollYProgress, [0.08, 0.58], shouldReduceMotion ? [1, 1] : [0.92, 1.08])
  const imageY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [80, -80])
  const clipPath = useTransform(
    scrollYProgress,
    [0.05, 0.36, 0.78],
    ['inset(14% 18% 14% 18% round 28px)', 'inset(0% 0% 0% 0% round 28px)', 'inset(6% 10% 6% 10% round 28px)']
  )

  return (
    <section id="intelligence" ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(38,208,124,0.12),transparent_32%),linear-gradient(180deg,transparent,rgba(2,8,13,0.58),transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Brief intelligence</p>
            <h2 className="mt-4 text-4xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Every proposal starts with evidence, not guesswork.
            </h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground sm:text-lg">
              FixFlowAI turns messy client inputs into a scored, structured plan with visible confidence, risks, effort, and delivery logic before a buyer sees the final proposal.
            </p>
          </motion.div>

          <div className="mt-9 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {proofPoints.map((point, index) => {
              const Icon = point.icon
              return (
                <motion.div
                  key={point.label}
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="landing-panel group flex items-center justify-between rounded-xl p-4 transition-colors hover:border-primary/45 hover:bg-primary/10"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium">{point.label}</span>
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{point.value}</span>
                </motion.div>
              )
            })}
          </div>
        </div>

        <motion.div style={{ y: imageY }} className="relative">
          <div className="absolute -inset-8 rounded-[2rem] bg-primary/10 blur-3xl" />
          <motion.div
            style={{ scale: imageScale, clipPath }}
            className="landing-panel-strong relative overflow-hidden rounded-[1.75rem]"
          >
            <div className="flex items-center justify-between border-b border-border/70 bg-background/55 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">proposal intelligence canvas</span>
            </div>
            <img
              src="/web-interface/proposal-section.png"
              alt="FixFlowAI proposal intelligence interface"
              className="aspect-[1.95/1] w-full object-cover object-top"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-90px' }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="landing-success-callout relative ml-auto mt-5 max-w-xl rounded-2xl p-5 backdrop-blur-xl"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">staged output</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Features, effort, risks, delivery plan, and client-facing proof move as one structured system.
                </p>
              </div>
              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-200" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default BriefIntelligence
