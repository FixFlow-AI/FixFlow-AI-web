import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { SendHorizonal, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FreelancerPageShell, ScoreRing, SkeletonPanel, StatusPill, TechnicalPanel } from '@/components/freelancer/FreelancerPrimitives'
import { countWords, useFreelancerMutations, useFreelancerOutreach } from '@/hooks/useFreelancer'
import { cn } from '@/lib/utils'

function highlightTokens(text = '') {
  return text.split(/(\{\{[a-zA-Z][a-zA-Z0-9_]*\}\})/g).map((part, index) => {
    if (/^\{\{/.test(part)) {
      return <mark key={`${part}-${index}`} className="rounded bg-primary/15 px-1 text-primary">{part}</mark>
    }
    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function OutreachQueue() {
  const { data: leads = [], isLoading } = useFreelancerOutreach()
  const { draftLead, sendLead } = useFreelancerMutations()
  const [selectedId, setSelectedId] = useState('')
  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedId) || leads[0], [leads, selectedId])
  const draft = selectedLead?.draftMessage || {}
  const wordCount = draft.wordCount || countWords(draft.body)

  const regenerate = async () => {
    if (!selectedLead) return
    try {
      await draftLead.mutateAsync(selectedLead.id)
      toast.success('Outreach regenerated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to regenerate')
    }
  }

  const send = async () => {
    if (!selectedLead) return
    try {
      await sendLead.mutateAsync(selectedLead.id)
      toast.success('Outreach sent')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to send outreach')
    }
  }

  return (
    <FreelancerPageShell
      title="Outreach Queue"
      description="Review concise, personalized drafts before they move a qualified lead into active conversation."
    >
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <SkeletonPanel rows={7} />
          <SkeletonPanel rows={9} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <TechnicalPanel className="p-4">
            <div className="mb-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Queue</p>
              <h2 className="mt-1 text-xl font-semibold">Draft-ready leads</h2>
            </div>
            <div className="space-y-3">
              {leads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    selectedLead?.id === lead.id ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-background/35 hover:border-primary/35'
                  )}
                >
                  <ScoreRing score={lead.score} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{lead.company.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{lead.role}</p>
                  </div>
                  <StatusPill status={lead.status} />
                </button>
              ))}
            </div>
          </TechnicalPanel>

          <TechnicalPanel className="p-5">
            {selectedLead ? (
              <>
                <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">{selectedLead.company.name}</p>
                    <h2 className="mt-2 text-2xl font-semibold">{draft.subject}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedLead.company.mission}</p>
                  </div>
                  <span className={wordCount > 150 ? 'font-mono text-sm text-rose-200' : 'font-mono text-sm text-muted-foreground'}>
                    {wordCount}/150
                  </span>
                </div>

                <div className="my-5 rounded-xl border border-border bg-background/45 p-5 text-sm leading-7 text-muted-foreground">
                  {highlightTokens(draft.body)}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" isLoading={draftLead.isPending} onClick={regenerate}>
                    <WandSparkles className="h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button disabled={wordCount > 150} isLoading={sendLead.isPending} onClick={send}>
                    <SendHorizonal className="h-4 w-4" />
                    Send draft
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No outreach items are available yet.</p>
            )}
          </TechnicalPanel>
        </div>
      )}
    </FreelancerPageShell>
  )
}

export default OutreachQueue
