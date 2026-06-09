import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { AlertTriangle, Clock, ShieldAlert, Sparkles, DollarSign, EyeOff } from 'lucide-react'

const problems = [
  {
    icon: ShieldAlert,
    title: 'Onboarding Gatekeeping',
    description: 'Traditional platforms gatekeep opportunities by over-indexing on historical profile reviews, locking out highly skilled talent.',
  },
  {
    icon: AlertTriangle,
    title: 'Payment Security Risk',
    description: 'Freelancers face unpaid work after task completion, while clients struggle to verify work deliverables before releasing funds.',
  },
  {
    icon: Clock,
    title: 'Scattered Proposals',
    description: 'Proposals are drafted manually across email chains and chats instead of co-creating requirements under a single unified roof.',
  },
  {
    icon: DollarSign,
    title: 'Inflexible Milestones',
    description: 'Service teams are forced to work under rigid timeline quotes that cannot adapt to evolving project scope requirements.',
  },
  {
    icon: EyeOff,
    title: 'Scope Creep Gaps',
    description: 'Vague initial briefs cause hidden project constraints to go unnoticed until they manifest as costly mid-project delays.',
  },
  {
    icon: Sparkles,
    title: 'Disorganized Intakes',
    description: 'Onboarding clients through scattered Slack channels and documents instead of a professional, collaborative workspace.',
  },
]

function ProblemCard({ problem, index, isInView }) {
  const cardRef = useRef(null)
  const Icon = problem.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div
        ref={cardRef}
        className="landing-panel rounded-xl p-6 border border-border bg-card hover:border-border-strong hover:shadow-sm transition-all duration-300 cursor-default"
      >
        <div className="mb-4 inline-flex items-center justify-center h-10 w-10 rounded-lg bg-destructive/10 text-destructive/80">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">{problem.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{problem.description}</p>
      </div>
    </motion.div>
  )
}

function ProblemSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const yShift = useTransform(scrollYProgress, [0, 1], [30, -30])

  return (
    <section id="workflow" className="py-24 sm:py-32 overflow-hidden border-b border-border/60 bg-muted/20">
      <motion.div ref={ref} style={{ y: yShift }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary inline-block font-semibold">
            The Scoping Creep Audit
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Vague specifications cost{' '}
            <span className="text-gradient-primary">more than time.</span>
          </h2>
          <p className="mt-5 text-base text-muted-foreground leading-7">
            Unstructured client briefs cause bad estimates, scope creep, and slow proposal cycles. FixFlow AI turns client briefs into scoped, contract-ready proposals.
          </p>
        </motion.div>

        {/* Problem Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => (
            <ProblemCard key={problem.title} problem={problem} index={index} isInView={isInView} />
          ))}
        </div>
      </motion.div>
    </section>
  )
}

export default ProblemSection
