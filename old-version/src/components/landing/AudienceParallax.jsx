import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { BriefcaseBusiness, Building2, Layers3, Scale, Sparkles, Users } from 'lucide-react'

const audiences = [
  {
    title: 'Freelancers',
    label: 'Sell expertise',
    quote: 'Your niche, proof, outreach, and payments operate from the same command surface.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Clients',
    label: 'Buy outcomes',
    quote: 'Scope, risk, timeline, and delivery evidence are visible before work begins.',
    icon: Building2,
  },
  {
    title: 'Project Managers',
    label: 'Carry delivery',
    quote: 'Briefs, approvals, comments, and handoffs stay connected to the work they affect.',
    icon: Layers3,
  },
  {
    title: 'Agencies',
    label: 'Ship proposals daily',
    quote: 'Repeatable proposal quality becomes a system instead of a document template.',
    icon: Users,
  },
  {
    title: 'Founders',
    label: 'Move fast with proof',
    quote: 'AI speed stays paired with the evidence a serious buyer expects.',
    icon: Sparkles,
  },
  {
    title: 'Operators',
    label: 'Keep revenue honest',
    quote: 'Lead scoring, delivery state, and reputation stay visible in the same workflow.',
    icon: Scale,
  },
]

function AudienceParallax() {
  const ref = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ['0%', '0%'] : ['8%', '-8%'])
  const rotate = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [-5, 5])

  return (
    <section ref={ref} id="audience" className="relative scroll-mt-28 overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 workspace-grid opacity-25" />
      <motion.div
        aria-hidden="true"
        style={{ y, rotate }}
        className="absolute right-[-8rem] top-16 hidden h-[28rem] w-[28rem] rounded-[4rem] border border-primary/20 bg-primary/5 shadow-[0_0_100px_rgba(63,215,255,0.12)] lg:block"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.58 }}
            className="lg:sticky lg:top-28"
          >
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Audience risk</p>
            <h2 className="mt-3 text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">Built for the people who cannot afford vague delivery.</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">
              The story shifts by role, but the system stays the same: evidence first, workflow visible, risk handled before the handoff.
            </p>
          </motion.div>

          <div className="space-y-5">
            {audiences.map((audience, index) => {
              const Icon = audience.icon
              return (
                <motion.article
                  key={audience.title}
                  initial={{ opacity: 0, y: 44, scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-90px' }}
                  transition={{ duration: 0.5, delay: (index % 3) * 0.06 }}
                  whileHover={{ x: 10 }}
                  className="landing-future-card group relative overflow-hidden rounded-[1.35rem] p-5 backdrop-blur-sm md:p-7"
                >
                  <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary to-transparent opacity-40" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-emerald-300/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex flex-col gap-5 md:flex-row md:items-start">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{audience.label}</p>
                      <h3 className="mt-2 text-3xl font-semibold tracking-tight">{audience.title}</h3>
                      <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">{audience.quote}</p>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default AudienceParallax
