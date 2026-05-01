import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { BadgeDollarSign, BrainCircuit, Fingerprint, Mail, Radar, Workflow } from 'lucide-react'

const cards = [
  { title: 'Lead Hunter', type: 'agent', body: 'Turns public signals into scored prospects with source, stack, and reasoning.', icon: Radar, tone: 'primary' },
  { title: 'BriefScore', type: 'existing core', body: 'Keeps the original proposal intelligence engine as the trustable scoping layer.', icon: BrainCircuit, tone: 'emerald' },
  { title: 'Outreach Writer', type: 'agent', body: 'Drafts short messages, validates word count, and exposes personalization tokens.', icon: Mail, tone: 'primary' },
  { title: 'FlowBoard', type: 'command surface', body: 'Shows lead motion, tasks, escrow, reputation, and active agents at a glance.', icon: Workflow, tone: 'emerald' },
  { title: 'Credential Vault', type: 'trust', body: 'Models skill proof and DID metadata now, with Web3 adapters later.', icon: Fingerprint, tone: 'primary' },
  { title: 'Escrow Watcher', type: 'trust', body: 'Tracks locked, released, pending, and disputed milestones without hiding risk.', icon: BadgeDollarSign, tone: 'emerald' },
]

function MasonryVanguard() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const visualY = useTransform(scrollYProgress, [0, 1], ['12%', '-12%'])
  const visualRotate = useTransform(scrollYProgress, [0, 1], [-8, 8])

  return (
    <section id="evidence" ref={ref} className="relative scroll-mt-28 overflow-hidden py-24">
      <div className="absolute inset-0 workspace-grid opacity-30" />
      <motion.div
        aria-hidden="true"
        style={{ y: visualY, rotate: visualRotate }}
        className="absolute left-[-10rem] top-32 hidden h-[26rem] w-[26rem] rounded-full border border-primary/20 bg-primary/5 shadow-[0_0_90px_rgba(63,215,255,0.12)] lg:block"
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">MVP architecture</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Useful modules, not decorative widgets.</h2>
          <p className="mt-5 text-muted-foreground">
            Scroll through the operating system layer. Each module keeps its job visible and uses a distinct technical visual, so the page feels like a working product map instead of static cards.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {cards.map((card, index) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 36, rotateX: -8 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
              className="group relative min-h-[17rem] overflow-hidden rounded-xl border border-border/80 bg-card/75 p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-400/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="absolute right-5 top-5 grid h-24 w-24 place-items-center rounded-2xl border border-primary/20 bg-background/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform duration-500 group-hover:-translate-y-2 group-hover:rotate-6">
                <card.icon className={card.tone === 'emerald' ? 'h-10 w-10 text-emerald-300' : 'h-10 w-10 text-primary'} />
              </div>
              <div className="relative max-w-[72%]">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{card.type}</p>
                <h3 className="mt-5 text-2xl font-semibold">{card.title}</h3>
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
