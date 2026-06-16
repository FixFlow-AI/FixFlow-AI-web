import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrainCircuit, Database, GitBranch, ShieldCheck, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const nodes = [
  {
    id: 'ai',
    label: 'AI workflows',
    icon: BrainCircuit,
    links: ['SSE streaming', 'JSON repair', 'Prompt ops', 'Confidence grid'],
    metric: 'structured first',
    image: '/web-interface/proposal-flow.png',
    sceneTitle: 'Consultant-grade intake',
    sceneBody: 'A buyer brief becomes scored scope, risk, and effort signals before the proposal is written.',
    avatar: '/avatar.png',
  },
  {
    id: 'fullstack',
    label: 'Full-stack delivery',
    icon: GitBranch,
    links: ['React', 'Express', 'MongoDB', 'S3'],
    metric: 'delivery visible',
    image: '/web-interface/architecture-map.png',
    sceneTitle: 'Build plan customers can inspect',
    sceneBody: 'Architecture, milestones, and implementation paths are framed like a delivery room instead of hidden notes.',
    avatar: '/avatar2.png',
  },
  {
    id: 'ops',
    label: 'Revenue ops',
    icon: Zap,
    links: ['Lead scoring', 'Outreach', 'Invoices', 'ETA'],
    metric: 'pipeline alive',
    image: '/web-interface/lifecycle-workflow.png',
    sceneTitle: 'Revenue motion in context',
    sceneBody: 'Lead, outreach, payment, and ETA states stay visible around the actual work.',
    avatar: '/avatar3.png',
  },
  {
    id: 'trust',
    label: 'Trust layer',
    icon: ShieldCheck,
    links: ['Escrow', 'DID', 'Credentials', 'Audit trail'],
    metric: 'risk exposed',
    image: '/web-interface/nogotiate-refinement.png',
    sceneTitle: 'Trust before handoff',
    sceneBody: 'Clients see constraints, negotiation history, and release logic without digging through documents.',
    avatar: '/avatar4.png',
  },
  {
    id: 'data',
    label: 'Product memory',
    icon: Database,
    links: ['BriefScore', 'Analytics', 'Patterns', 'Workspace'],
    metric: 'learning loop',
    image: '/web-interface/hero-architecture.png',
    sceneTitle: 'Memory that compounds',
    sceneBody: 'Proposal outcomes, proof, and workspace patterns become reusable intelligence for the next deal.',
    avatar: '/avatar5.png',
  },
]

function TechnicalSchematic() {
  const [activeId, setActiveId] = useState('ai')
  const active = useMemo(() => nodes.find((node) => node.id === activeId) || nodes[0], [activeId])
  const ActiveIcon = active.icon

  return (
    <section id="schematic" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 workspace-grid opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(63,215,255,0.12),transparent_28%),radial-gradient(circle_at_82%_62%,rgba(38,208,124,0.1),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.58 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">System blueprint</p>
            <h2 className="mt-3 text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">A product brain behind every buyer conversation.</h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
              Proposal intelligence, delivery context, revenue operations, and trust signals stay connected instead of becoming scattered documents.
            </p>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-5">
            {nodes.map((node) => {
              const Icon = node.icon
              const isActive = activeId === node.id
              return (
                <button
                  key={node.id}
                  type="button"
                  onMouseEnter={() => setActiveId(node.id)}
                  onFocus={() => setActiveId(node.id)}
                  onClick={() => setActiveId(node.id)}
                  className={cn(
                    'landing-future-card group relative min-h-36 overflow-hidden rounded-xl p-4 text-left transition-colors',
                    isActive ? 'border-primary/60 bg-primary/12' : 'hover:border-primary/35'
                  )}
                >
                  {isActive && <motion.span layoutId="schematic-highlight" className="absolute inset-0 rounded-xl border border-primary/60 shadow-[inset_0_0_42px_rgba(63,215,255,0.1)]" />}
                  <Icon className="relative h-5 w-5 text-primary transition-transform group-hover:-translate-y-1" />
                  <p className="relative mt-4 text-sm font-semibold">{node.label}</p>
                  <p className="relative mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{node.metric}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 22, clipPath: 'inset(10% 8% 10% 8% round 24px)' }}
              animate={{ opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0% round 24px)' }}
              exit={{ opacity: 0, y: -16, clipPath: 'inset(10% 8% 10% 8% round 24px)' }}
              transition={{ duration: 0.42 }}
              className="landing-panel-strong relative overflow-hidden rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-border/70 bg-background/45 px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">{active.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{active.metric}</span>
              </div>
              <img src={active.image} alt={`${active.label} preview`} className="aspect-[2.1/1] w-full object-cover object-top opacity-90" />
            </motion.div>
          </AnimatePresence>

          <motion.div
            key={`${active.id}-copy`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="landing-panel rounded-2xl p-6"
          >
            <div className="workflow-photo mb-6 overflow-hidden rounded-2xl border border-border/70 p-4">
              <div className="flex items-center gap-4">
                <img src={active.avatar} alt="" className="h-16 w-16 rounded-2xl border border-white/20 object-cover shadow-lg" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">customer scene</p>
                  <h4 className="mt-1 text-xl font-semibold">{active.sceneTitle}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{active.sceneBody}</p>
                </div>
              </div>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <ActiveIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-6 text-3xl font-semibold tracking-tight">{active.label}</h3>
            <div className="mt-6 grid gap-3">
              {active.links.map((link, index) => (
                <motion.div
                  key={link}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card/45 px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <span>{link}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default TechnicalSchematic
