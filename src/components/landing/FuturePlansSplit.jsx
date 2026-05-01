import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const roadmap = [
  {
    id: 'agents',
    title: 'Background agents',
    body: 'Move lead discovery, scoring, and escrow watching into scheduled workers with transparent review states.',
    tone: 'primary',
  },
  {
    id: 'market',
    title: 'Freelancer marketplace graph',
    body: 'Use niche, proof, and delivery outcomes to make capability search more honest than a static profile page.',
    tone: 'emerald',
  },
  {
    id: 'proof',
    title: 'Credential adapter',
    body: 'Connect DID, Soulbound credential, and milestone evidence once the product motion proves the trust model.',
    tone: 'primary',
  },
]

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
    <section id="roadmap" className="py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border bg-card/75 p-6 transition-colors duration-500',
              active.tone === 'emerald' ? 'border-emerald-300/50' : 'border-primary/55'
            )}
          >
            <div className="absolute inset-0 workspace-grid opacity-40" />
            <div className="relative aspect-square rounded-xl border border-border bg-background/55 p-6">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Future mode</span>
                  <span className={active.tone === 'emerald' ? 'h-3 w-3 rounded-full bg-emerald-300' : 'h-3 w-3 rounded-full bg-primary'} />
                </div>
                <div>
                  <div className="mx-auto grid h-36 w-36 place-items-center rounded-full border border-primary/35 bg-primary/10">
                    <span className="text-5xl font-bold text-gradient-primary">FF</span>
                  </div>
                  <h2 className="mt-8 text-3xl font-semibold">{active.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{active.body}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Future plans</p>
          {roadmap.map((item) => (
            <article
              key={item.id}
              ref={(node) => { refs.current[item.id] = node }}
              data-id={item.id}
              className="min-h-[46vh] rounded-2xl border border-border/80 bg-card/70 p-6"
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{item.id}</p>
              <h3 className="mt-5 text-3xl font-semibold">{item.title}</h3>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{item.body}</p>
            </article>
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
