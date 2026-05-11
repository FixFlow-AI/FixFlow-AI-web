import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { BadgeDollarSign, Fingerprint, Mail, Radar, Workflow } from 'lucide-react'

const timelineItems = [
  {
    title: 'Niche Scan',
    meta: 'repo evidence -> rate ceiling',
    icon: Radar,
    body: 'GitHub and product signals become a ranked service lane with depth score, proof snippets, and demand context.',
  },
  {
    title: 'Lead Pipeline',
    meta: 'signals -> scored prospects',
    icon: Workflow,
    body: 'Potential clients move through a visible pipeline with reasoning chips, source context, and next-best action.',
  },
  {
    title: 'Outreach Draft',
    meta: 'personalized <= 150 words',
    icon: Mail,
    body: 'The writer agent prepares concise outreach with visible personalization tokens and reviewable assumptions.',
  },
  {
    title: 'Escrow',
    meta: 'milestones -> release state',
    icon: BadgeDollarSign,
    body: 'Payment progress sits next to delivery state so risk is visible before it becomes a project problem.',
  },
  {
    title: 'Credential',
    meta: 'work history -> proof graph',
    icon: Fingerprint,
    body: 'Completed wins produce a reputation vault that can later connect to DID and verifiable proof layers.',
  },
]

function TimelineCard({ item, index }) {
  const Icon = item.icon

  return (
    <motion.article
      initial={{ opacity: 0, y: 42, rotateX: -8 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.52, delay: (index % 2) * 0.08 }}
      whileHover={{ y: -8, rotate: index % 2 === 0 ? -1 : 1 }}
      className="group relative w-[80vw] shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-6 shadow-[0_34px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl md:w-[34rem]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-emerald-300/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative mb-20 flex items-center justify-between border-b border-border/70 pb-4">
        <span className="font-mono text-xs text-muted-foreground">SCENE 0{index + 1}</span>
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="relative">
        <h3 className="text-4xl font-semibold tracking-tight">{item.title}</h3>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.22em] text-primary">{item.meta}</p>
        <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">{item.body}</p>
      </div>
    </motion.article>
  )
}

function ProjectsTimeline() {
  const targetRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: targetRef, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ['0%', '0%'] : ['0%', '-62%'])
  const progressScale = useTransform(scrollYProgress, [0.08, 0.92], [0, 1])
  const titleY = useTransform(scrollYProgress, [0, 0.28], shouldReduceMotion ? [0, 0] : [80, 0])

  return (
    <section id="flow" ref={targetRef} className="relative bg-background md:h-[340vh]">
      <div className="hidden md:sticky md:top-0 md:flex md:h-screen md:items-center md:overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(63,215,255,0.1),transparent_22%,transparent_78%,rgba(38,208,124,0.08))]" />
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <motion.div style={{ y: titleY }} className="mb-14 max-w-4xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Operating flow</p>
            <h2 className="mt-3 text-4xl font-bold leading-[1.02] tracking-tight md:text-5xl lg:text-6xl">One horizontal line from identity to revenue.</h2>
          </motion.div>

          <div className="mb-10 h-px w-full overflow-hidden bg-border/70">
            <motion.div style={{ scaleX: progressScale }} className="h-full origin-left bg-gradient-to-r from-primary to-emerald-300" />
          </div>

          <motion.div style={{ x }} className="flex w-[255vw] gap-5 lg:w-[185vw]">
            {timelineItems.map((item, index) => (
              <TimelineCard key={item.title} item={item} index={index} />
            ))}
          </motion.div>
        </div>
      </div>

      <div className="px-4 py-24 sm:px-6 md:hidden">
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Operating flow</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tight">From identity to revenue.</h2>
        </div>
        <div className="space-y-5">
          {timelineItems.map((item, index) => (
            <TimelineCard key={item.title} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default ProjectsTimeline
