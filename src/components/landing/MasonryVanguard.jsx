import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { BadgeDollarSign, BrainCircuit, Fingerprint, Mail, Radar, Workflow } from 'lucide-react'

const cards = [
  { title: 'Lead Hunter', type: 'agent', body: 'Turns public signals into scored prospects with source, stack, and reasoning.', icon: Radar, tone: 'primary' },
  { title: 'BriefScore', type: 'existing core', body: 'Keeps the proposal engine grounded in intake quality and confidence diagnostics.', icon: BrainCircuit, tone: 'emerald' },
  { title: 'Outreach Writer', type: 'agent', body: 'Drafts short messages, validates word count, and exposes personalization tokens.', icon: Mail, tone: 'primary' },
  { title: 'FlowBoard', type: 'command surface', body: 'Shows lead motion, tasks, escrow, reputation, and active agents at a glance.', icon: Workflow, tone: 'emerald' },
  { title: 'Credential Vault', type: 'trust', body: 'Models skill proof and DID metadata now, with Web3 adapters later.', icon: Fingerprint, tone: 'primary' },
  { title: 'Escrow Watcher', type: 'trust', body: 'Tracks locked, released, pending, and disputed milestones without hiding risk.', icon: BadgeDollarSign, tone: 'emerald' },
]

function MasonryVanguard() {
  const ref = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const visualY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ['0%', '0%'] : ['12%', '-12%'])
  const visualRotate = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [-8, 8])

  return (
    <section id="evidence" ref={ref} className="relative scroll-mt-28 overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 workspace-grid opacity-25" />
      <motion.div
        aria-hidden="true"
        style={{ y: visualY, rotate: visualRotate }}
        className="absolute left-[-10rem] top-32 hidden h-[26rem] w-[26rem] rounded-full border border-primary/20 bg-primary/5 shadow-[0_0_100px_rgba(63,215,255,0.13)] lg:block"
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.58 }}
          className="lg:sticky lg:top-28 lg:self-start"
        >
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Module vanguard</p>
          <h2 className="mt-3 text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">Useful modules, not decorative widgets.</h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">
            Each surface has a job: find opportunity, shape the proposal, protect payment, and turn completed work into durable proof.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2">
          {cards.map((card, index) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 44, rotateX: -8 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
              whileHover={{ y: -8, rotate: index % 2 === 0 ? -1.2 : 1.2 }}
              className="group relative min-h-[18rem] overflow-hidden rounded-2xl border border-border/80 bg-card/65 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-emerald-400/12 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="absolute right-5 top-5 grid h-24 w-24 place-items-center rounded-2xl border border-primary/20 bg-background/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform duration-500 group-hover:-translate-y-2 group-hover:rotate-6">
                <card.icon className={card.tone === 'emerald' ? 'h-10 w-10 text-emerald-300' : 'h-10 w-10 text-primary'} />
              </div>
              <div className="relative max-w-[72%]">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{card.type}</p>
                <h3 className="mt-5 text-3xl font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{card.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default MasonryVanguard
