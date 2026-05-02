import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Github, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FreelancerPageShell, ScoreRing, SkeletonPanel, StatusPill, TechnicalPanel } from '@/components/freelancer/FreelancerPrimitives'
import { streamNicheAnalysis, useFreelancerMutations, useFreelancerNiches } from '@/hooks/useFreelancer'

function NicheCard({ niche, onToggle, isUpdating }) {
  return (
    <motion.div layout className="h-full">
      <TechnicalPanel className="flex h-full flex-col p-5" interactive>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3"><StatusPill status={niche.accepted ? 'won' : 'pending'} /></div>
            <h2 className="text-xl font-semibold">{niche.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{niche.reasoning}</p>
          </div>
          <ScoreRing score={niche.depth} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(niche.tags || []).map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-transparent px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-background/40 focus-within:bg-background/40">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {(niche.evidence || []).map((evidence) => (
            <div key={`${niche.id}-${evidence.repo}`} className="rounded-lg border border-border/70 bg-transparent p-3 transition-colors hover:bg-background/35 focus-within:bg-background/35">
              <p className="font-mono text-xs text-primary">{evidence.repo}</p>
              <p className="mt-1 text-sm text-muted-foreground">{evidence.signal || `${evidence.commits} commits, ${evidence.stars} stars`}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Rate ceiling</p>
            <p className="mt-1 text-2xl font-semibold">${niche.rateCeiling}/hr</p>
          </div>
          <Button
            data-testid={`accept-niche-${niche.id}`}
            variant={niche.accepted ? 'success' : 'outline'}
            isLoading={isUpdating}
            onClick={() => onToggle(niche)}
          >
            {niche.accepted ? 'Accepted' : 'Accept'}
          </Button>
        </div>
      </TechnicalPanel>
    </motion.div>
  )
}

function NicheAnalysis() {
  const queryClient = useQueryClient()
  const { data: niches = [], isLoading } = useFreelancerNiches()
  const { acceptNiche, generateProfiles } = useFreelancerMutations()
  const [streamedNiches, setStreamedNiches] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const displayedNiches = isAnalyzing && streamedNiches.length ? streamedNiches : niches
  const acceptedCount = displayedNiches.filter((niche) => niche.accepted).length

  const runAnalysis = async () => {
    setIsAnalyzing(true)
    setStreamedNiches([])

    try {
      await streamNicheAnalysis({
        onNiche: (niche) => setStreamedNiches((current) => [...current, niche]),
        onComplete: () => {
          queryClient.invalidateQueries({ queryKey: ['freelancer'] })
          toast.success('Niche analysis refreshed')
        },
      })
    } catch (error) {
      toast.error(error.message || 'Niche analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateProfiles = async () => {
    try {
      await generateProfiles.mutateAsync()
      toast.success('Profiles generated from accepted niches')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to generate profiles')
    }
  }

  return (
    <FreelancerPageShell
      data-testid="freelancer-niches"
      title="Niche Analysis"
      description="Turn repo signals and delivery history into clear positioning, rate ceilings, and evidence-backed service lanes."
      action={
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={runAnalysis} isLoading={isAnalyzing}>
            <RefreshCw className="h-4 w-4" />
            Re-run scan
          </Button>
          <Button disabled={acceptedCount === 0} isLoading={generateProfiles.isPending} onClick={handleGenerateProfiles}>
            <Sparkles className="h-4 w-4" />
            Generate profiles
          </Button>
        </div>
      }
    >
      <TechnicalPanel className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-primary">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">GitHub evidence scan</h2>
              <p className="text-sm text-muted-foreground">Demo-ready now, adapter-ready for live repo analysis.</p>
            </div>
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {acceptedCount} accepted / {displayedNiches.length || 3} detected
          </div>
        </div>
      </TechnicalPanel>

      {isLoading && !streamedNiches.length ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <SkeletonPanel rows={5} />
          <SkeletonPanel rows={5} />
          <SkeletonPanel rows={5} />
        </div>
      ) : (
        <motion.div layout className="grid gap-5 lg:grid-cols-3">
          {displayedNiches.map((niche) => (
            <NicheCard
              key={niche.id}
              niche={niche}
              onToggle={(item) => acceptNiche.mutate({ id: item.id, accepted: !item.accepted })}
              isUpdating={acceptNiche.isPending}
            />
          ))}
        </motion.div>
      )}
    </FreelancerPageShell>
  )
}

export default NicheAnalysis
