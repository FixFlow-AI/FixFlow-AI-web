import { motion } from 'framer-motion'

const cards = [
  { title: 'Lead Hunter', type: 'agent', body: 'Turns public signals into scored prospects with source, stack, and reasoning.' },
  { title: 'BriefScore', type: 'existing core', body: 'Keeps the original proposal intelligence engine as the trustable scoping layer.' },
  { title: 'Outreach Writer', type: 'agent', body: 'Drafts short messages, validates word count, and exposes personalization tokens.' },
  { title: 'FlowBoard', type: 'command surface', body: 'Shows lead motion, tasks, escrow, reputation, and active agents at a glance.' },
  { title: 'Credential Vault', type: 'trust', body: 'Models skill proof and DID metadata now, with Web3 adapters later.' },
  { title: 'Escrow Watcher', type: 'trust', body: 'Tracks locked, released, pending, and disputed milestones without hiding risk.' },
]

function MasonryVanguard() {
  return (
    <section id="evidence" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">MVP architecture</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Useful modules, not decorative widgets.</h2>
        </div>

        <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
          {cards.map((card, index) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: (index % 3) * 0.06 }}
              className="mb-5 break-inside-avoid rounded-xl border border-border/80 bg-card/75 p-6"
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{card.type}</p>
              <h3 className="mt-5 text-2xl font-semibold">{card.title}</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{card.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default MasonryVanguard
