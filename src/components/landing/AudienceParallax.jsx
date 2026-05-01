import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { BriefcaseBusiness, Building2, Layers3, Scale, Sparkles, Users } from 'lucide-react'

const audiences = [
  {
    title: 'Freelancers',
    label: 'If you sell expertise',
    quote: 'Choose FixFlowAI when you need your niche, proof, outreach, and payments to work like one operating system.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Clients',
    label: 'If you buy outcomes',
    quote: 'Choose FixFlowAI when you want proposals that expose scope, risk, timeline, and delivery evidence before work begins.',
    icon: Building2,
  },
  {
    title: 'Project Managers',
    label: 'If every project needs attention',
    quote: 'Choose FixFlowAI when scattered briefs, approvals, comments, and handoffs are exhausting your delivery rhythm.',
    icon: Layers3,
  },
  {
    title: 'Agencies',
    label: 'If your team ships proposals daily',
    quote: 'Choose FixFlowAI when repeatable proposal quality matters more than another document template.',
    icon: Users,
  },
  {
    title: 'Founders',
    label: 'If speed and proof both matter',
    quote: 'Choose FixFlowAI when your sales motion needs AI speed without losing the evidence a serious buyer expects.',
    icon: Sparkles,
  },
  {
    title: 'Operators',
    label: 'If revenue process must stay honest',
    quote: 'Choose FixFlowAI when lead scoring, delivery state, and reputation need to be visible in the same workflow.',
    icon: Scale,
  },
]

function AudienceParallax() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['8%', '-8%'])
  const rotate = useTransform(scrollYProgress, [0, 1], [-4, 4])

  return (
    <section ref={ref} id="audience" className="relative scroll-mt-28 overflow-hidden py-24">
      <div className="absolute inset-0 workspace-grid opacity-35" />
      <motion.div
        aria-hidden="true"
        style={{ y, rotate }}
        className="absolute right-[-8rem] top-16 hidden h-[28rem] w-[28rem] rounded-[4rem] border border-primary/20 bg-primary/5 shadow-[0_0_80px_rgba(63,215,255,0.12)] lg:block"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Audience fit</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Built for the people who carry delivery risk.</h2>
            <p className="mt-5 text-muted-foreground">
              Each workflow is designed around a specific pressure point: winning better work, buying with confidence, and managing execution without losing context.
            </p>
          </div>

          <div className="space-y-5">
            {audiences.map((audience, index) => {
              const Icon = audience.icon
              return (
                <motion.article
                  key={audience.title}
                  initial={{ opacity: 0, y: 32, scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.48, delay: (index % 2) * 0.08 }}
                  className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-5 md:p-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-400/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex flex-col gap-5 md:flex-row md:items-start">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{audience.label}</p>
                      <h3 className="mt-2 text-2xl font-semibold">{audience.title}</h3>
                      <blockquote className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
                        “{audience.quote}”
                      </blockquote>
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
