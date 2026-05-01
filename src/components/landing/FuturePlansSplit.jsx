import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Bot, Network } from 'lucide-react'
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
    <div className="relative aspect-square rounded-xl border border-border bg-background/55 p-6">
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

            <h2 className="mt-8 text-3xl font-semibold">{active.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{active.body}</p>
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
    <section id="roadmap" className="scroll-mt-28 py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border bg-card/75 p-6 transition-colors duration-500',
              active.tone === 'emerald' ? 'border-emerald-300/50' : 'border-primary/55'
            )}
          >
            <div className="absolute inset-0 workspace-grid opacity-40" />
            <RoadmapIconStage active={active} />
          </div>
        </div>

        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Future plans</p>
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
                'min-h-[46vh] rounded-2xl border p-6 transition-colors duration-500',
                activeId === item.id ? 'border-primary/60 bg-primary/10' : 'border-border/80 bg-card/70'
              )}
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{item.id}</p>
              <h3 className="mt-5 text-3xl font-semibold">{item.title}</h3>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{item.body}</p>
            </motion.article>
          ))}
          <Link to="/freelancer">
            <Button size="lg">Open the MVP</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

export default FuturePlansSplit
