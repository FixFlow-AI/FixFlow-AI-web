import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { BadgeDollarSign, Fingerprint, Mail, Radar, Workflow } from 'lucide-react'

const timelineItems = [
  {
    title: 'Niche Scan',
    meta: 'repo evidence -> rate ceiling',
    icon: Radar,
    body: 'GitHub signals become a ranked service lane with depth score, tags, and proof snippets.',
  },
  {
    title: 'Lead Pipeline',
    meta: 'signals -> scored prospects',
    icon: Workflow,
    body: 'Potential clients move through a Kanban pipeline with reasoning chips and source context.',
  },
  {
    title: 'Outreach Draft',
    meta: 'personalized <= 150 words',
    icon: Mail,
    body: 'The writer agent prepares concise messages with visible personalization tokens.',
  },
  {
    title: 'Escrow',
    meta: 'milestones -> release state',
    icon: BadgeDollarSign,
    body: 'Payment progress sits next to delivery state so risk is visible before it becomes painful.',
  },
  {
    title: 'Credential',
    meta: 'work history -> proof graph',
    icon: Fingerprint,
    body: 'Completed wins produce a reputation vault that can later connect to DID and ZK proof layers.',
  },
]

function ProjectsTimeline() {
  const targetRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: targetRef, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-64%'])

  return (
    <section id="flow" ref={targetRef} className="relative h-[320vh] bg-background">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">System working</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">One horizontal line from identity to revenue.</h2>
          </div>
          <motion.div style={{ x }} className="flex w-[250vw] gap-5 md:w-[185vw]">
            {timelineItems.map((item, index) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="w-[78vw] shrink-0 rounded-xl border border-border/80 bg-card/75 p-6 md:w-[34rem]">
                  <div className="mb-14 flex items-center justify-between border-b border-border pb-4">
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-3xl font-semibold">{item.title}</h3>
                  <p className="mt-3 font-mono text-xs uppercase tracking-[0.22em] text-primary">{item.meta}</p>
                  <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">{item.body}</p>
                </article>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default ProjectsTimeline
