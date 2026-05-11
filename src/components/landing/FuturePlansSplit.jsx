import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, Bot, Github, Network } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const roadmap = [
  {
    id: 'agents',
    title: 'Background agents',
    body: 'Move lead discovery, scoring, and escrow watching into scheduled workers with transparent review states.',
    tone: 'primary',
    icon: Bot,
    slides: ['Discovery worker', 'Score review', 'Escrow monitor'],
  },
  {
    id: 'market',
    title: 'Freelancer marketplace graph',
    body: 'Use niche, proof, and delivery outcomes to make capability search more honest than a static profile page.',
    tone: 'emerald',
    icon: Network,
    slides: ['Niche graph', 'Proof edges', 'Client match'],
  },
  {
    id: 'proof',
    title: 'Credential adapter',
    body: 'Connect DID, Soulbound credential, and milestone evidence once the product motion proves the trust model.',
    tone: 'primary',
    icon: BadgeCheck,
    slides: ['DID layer', 'Milestone proof', 'Reputation token'],
  },
]

function RoadmapIconStage({ active }) {
  const Icon = active.icon

  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-background/55 p-6">
      <div className="absolute inset-0 workspace-grid opacity-35" />
      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 24, rotateY: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, rotateY: 18, scale: 0.96 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="relative flex h-full flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Future mode</span>
            <span className={active.tone === 'emerald' ? 'h-3 w-3 rounded-full bg-emerald-300' : 'h-3 w-3 rounded-full bg-primary'} />
          </div>

          <div>
            <div className="relative mx-auto grid h-40 w-40 place-items-center [perspective:800px]">
              <motion.div
                animate={{ rotateY: [0, 16, 0], y: [0, -6, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                className={cn(
                  'relative grid h-32 w-32 place-items-center rounded-[2rem] border shadow-2xl',
                  active.tone === 'emerald'
                    ? 'border-emerald-300/40 bg-emerald-400/15 shadow-emerald-400/10'
                    : 'border-primary/45 bg-primary/15 shadow-primary/10'
                )}
              >
                <div className="absolute inset-3 rounded-[1.4rem] border border-white/10" />
                <Icon className={active.tone === 'emerald' ? 'h-14 w-14 text-emerald-200' : 'h-14 w-14 text-primary'} />
              </motion.div>
              <motion.div
                aria-hidden="true"
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-dashed border-primary/25"
              />
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {active.slides.map((slide, index) => (
                <motion.span
                  key={slide}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="rounded-full border border-border bg-background/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {slide}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function FuturePlansSplit() {
  const [activeId, setActiveId] = useState(roadmap[0].id)
  const refs = useRef({})
  const active = useMemo(() => roadmap.find((item) => item.id === activeId) || roadmap[0], [activeId])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible?.target?.dataset?.id) {
          setActiveId(visible.target.dataset.id)
        }
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: 0.1 }
    )

    const nodes = Object.values(refs.current).filter(Boolean)
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <section id="roadmap" className="relative scroll-mt-28 overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(63,215,255,0.16),transparent_34%),linear-gradient(180deg,transparent,rgba(2,8,13,0.72))]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div
            className={cn(
              'relative overflow-hidden rounded-[1.75rem] border bg-card/70 p-5 shadow-[0_38px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-colors duration-500',
              active.tone === 'emerald' ? 'border-emerald-300/50' : 'border-primary/55'
            )}
          >
            <RoadmapIconStage active={active} />
            <div className="mt-6">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Final scene</p>
              <h2 className="mt-3 text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">Open the operating layer.</h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">
                Start with the current MVP, then let the product story expand into agents, marketplace graph, and verifiable proof.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/register?mode=individual&plan=free">
                  <Button size="lg" className="w-full sm:w-auto">
                    <Github className="h-4 w-4" />
                    Connect GitHub
                  </Button>
                </Link>
                <Link to="/freelancer">
                  <Button variant="outline" size="lg" className="w-full border-primary/25 bg-background/35 sm:w-auto">
                    Open the MVP
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Roadmap / CTA</p>
          {roadmap.map((item) => (
            <motion.article
              key={item.id}
              ref={(node) => { refs.current[item.id] = node }}
              data-id={item.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.45 }}
              className={cn(
                'min-h-[42vh] rounded-2xl border p-6 transition-colors duration-500',
                activeId === item.id ? 'border-primary/60 bg-primary/10' : 'border-border/80 bg-card/60'
              )}
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{item.id}</p>
              <h3 className="mt-5 text-4xl font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{item.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FuturePlansSplit
