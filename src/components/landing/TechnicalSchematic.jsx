import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, Database, GitBranch, ShieldCheck, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const nodes = [
  { id: 'ai', label: 'AI workflows', icon: BrainCircuit, links: ['Gemini', 'SSE', 'Zod repair', 'Prompt ops'] },
  { id: 'fullstack', label: 'Full-stack delivery', icon: GitBranch, links: ['React', 'Express', 'MongoDB', 'S3'] },
  { id: 'ops', label: 'Revenue ops', icon: Zap, links: ['Lead scoring', 'Outreach', 'Invoices', 'ETA'] },
  { id: 'trust', label: 'Trust layer', icon: ShieldCheck, links: ['Escrow', 'DID', 'Credentials', 'Audit trail'] },
  { id: 'data', label: 'Product memory', icon: Database, links: ['BriefScore', 'Analytics', 'Patterns', 'Workspace'] },
]

function TechnicalSchematic() {
  const [activeId, setActiveId] = useState('ai')
  const active = useMemo(() => nodes.find((node) => node.id === activeId) || nodes[0], [activeId])

  return (
    <section id="schematic" className="relative overflow-hidden py-24">
      <div className="workspace-grid opacity-50" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">System capabilities</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">A blueprint for becoming more than a proposal generator.</h2>
            <p className="mt-5 text-muted-foreground">
              FixFlowAI keeps the proposal intelligence core, then adds the operating loops a freelancer needs after the brief: positioning, lead motion, outreach, payment state, and proof.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {nodes.map((node) => {
              const Icon = node.icon
              const isActive = activeId === node.id
              return (
                <button
                  key={node.id}
                  type="button"
                  onMouseEnter={() => setActiveId(node.id)}
                  onFocus={() => setActiveId(node.id)}
                  className={cn(
                    'relative min-h-36 rounded-xl border p-4 text-left transition-colors',
                    isActive ? 'border-primary/60 bg-primary/10' : 'border-border bg-card/70 hover:border-primary/35'
                  )}
                >
                  {isActive && <motion.span layoutId="schematic-highlight" className="absolute inset-0 rounded-xl border border-primary/50" />}
                  <Icon className="relative h-5 w-5 text-primary" />
                  <p className="relative mt-4 text-sm font-semibold">{node.label}</p>
                </button>
              )
            })}
          </div>
        </div>

        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-2xl border border-border/80 bg-card/75 p-5"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h3 className="text-2xl font-semibold">{active.label}</h3>
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-primary">linked modules</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {active.links.map((link) => (
              <div key={link} className="rounded-xl border border-border bg-background/40 p-4 font-mono text-sm text-muted-foreground">
                {link}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default TechnicalSchematic
