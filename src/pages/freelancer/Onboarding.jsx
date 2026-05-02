import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Github, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FreelancerPageShell, TechnicalPanel } from '@/components/freelancer/FreelancerPrimitives'
import api from '@/config/api'

const stages = [
  'Connecting identity',
  'Reading repository signals',
  'Mapping languages and commits',
  'Scoring niche depth',
  'Preparing lead radar',
  'Opening FlowBoard',
]

function Onboarding() {
  const [activeStage, setActiveStage] = useState(0)
  const [scan, setScan] = useState(null)

  useEffect(() => {
    let cancelled = false
    const timers = stages.map((_, index) =>
      window.setTimeout(() => {
        if (!cancelled) setActiveStage(index)
      }, index * 650)
    )

    api.post('/freelancer/github/scan').then((response) => {
      if (!cancelled) setScan(response.data)
    }).catch(() => null)

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return (
    <FreelancerPageShell
      title="Onboarding Scan"
      description="A fast boot sequence that turns your GitHub profile into positioning, profile copy, and an operating workspace."
      action={<Link to="/freelancer"><Button>Open FlowBoard</Button></Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <TechnicalPanel className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-primary">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Boot sequence</p>
              <h2 className="text-xl font-semibold">GitHub intelligence</h2>
            </div>
          </div>
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const complete = index < activeStage
              const active = index === activeStage
              return (
                <div key={stage} className="flex items-center gap-3 rounded-lg border border-border/70 bg-transparent px-4 py-3 transition-colors hover:bg-background/35 focus-within:bg-background/35">
                  {complete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-border" />
                  )}
                  <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{stage}</span>
                </div>
              )
            })}
          </div>
        </TechnicalPanel>

        <TechnicalPanel className="p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Scan output</p>
          <h2 className="mt-2 text-2xl font-semibold">{scan ? `${scan.commits} commits indexed` : 'Preparing scan'}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(scan?.repos || []).map((repo) => (
              <div key={repo.name} className="rounded-xl border border-border/70 bg-transparent p-4 transition-colors hover:bg-background/35 focus-within:bg-background/35">
                <p className="font-mono text-xs text-primary">{repo.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">{repo.language} · {repo.commits} commits · {repo.stars} stars</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(scan?.languages || []).map((language) => (
              <span key={language} className="rounded-full border border-border bg-transparent px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-background/40 focus-within:bg-background/40">
                {language}
              </span>
            ))}
          </div>
        </TechnicalPanel>
      </div>
    </FreelancerPageShell>
  )
}

export default Onboarding
