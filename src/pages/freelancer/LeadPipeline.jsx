import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { MessageSquareText, SendHorizonal, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FreelancerPageShell, ScoreRing, SkeletonPanel, StatusPill, TechnicalPanel } from '@/components/freelancer/FreelancerPrimitives'
import { countWords, useFreelancerLeads, useFreelancerMutations } from '@/hooks/useFreelancer'

const columns = [
  { id: 'new', label: 'New' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]

function LeadCard({ lead, onSelect, onDragStart }) {
  return (
    <motion.button
      type="button"
      data-testid={`lead-card-${lead.id}`}
      layout
      draggable
      onDragStart={(event) => onDragStart(event, lead.id)}
      onClick={() => onSelect(lead)}
      className="w-full rounded-lg border border-border/75 bg-transparent p-3 text-left transition-colors hover:border-primary/40 hover:bg-background/40 focus-visible:bg-background/40"
    >
      <div className="flex items-start gap-3">
        <ScoreRing score={lead.score} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{lead.company.name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{lead.role}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(lead.company.stack || []).slice(0, 3).map((item) => (
          <span key={item} className="rounded-full border border-border bg-transparent px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-card">{item}</span>
        ))}
      </div>
    </motion.button>
  )
}

function LeadDetail({ lead, onClose, onDraft, onSend, isDrafting, isSending }) {
  if (!lead) return null

  const draft = lead.draftMessage || {}
  const wordCount = draft.wordCount || countWords(draft.body)
  const canSend = wordCount <= 150

  return (
    <motion.aside
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-border bg-transparent p-5 shadow-2xl transition-colors hover:bg-card"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <StatusPill status={lead.status} />
          <h2 className="mt-3 text-2xl font-semibold">{lead.company.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lead.role}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 py-5">
        <TechnicalPanel className="p-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Research</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Company size</p>
              <p className="font-medium">{lead.company.size}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rate range</p>
              <p className="font-medium">${lead.rateRange?.[0]}-{lead.rateRange?.[1]}/hr</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(lead.company.stack || []).map((item) => (
              <span key={item} className="rounded-full border border-border bg-transparent px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-background/40">{item}</span>
            ))}
          </div>
        </TechnicalPanel>

        <TechnicalPanel className="p-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">AI reasoning</p>
          <div className="mt-3 space-y-2">
            {(lead.reasoning || []).map((reason) => (
              <div key={reason} className="rounded-lg bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/40">{reason}</div>
            ))}
          </div>
        </TechnicalPanel>

        <TechnicalPanel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Outreach draft</p>
            <span className={wordCount > 150 ? 'font-mono text-xs text-rose-200' : 'font-mono text-xs text-muted-foreground'}>{wordCount}/150 words</span>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-transparent p-3 transition-colors hover:bg-background/50">
            <p className="font-medium">{draft.subject || 'No subject yet'}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{draft.body || 'Generate a draft to preview the message.'}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" isLoading={isDrafting} onClick={onDraft}>
              <MessageSquareText className="h-4 w-4" />
              Regenerate
            </Button>
            <Button disabled={!canSend} isLoading={isSending} onClick={onSend}>
              <SendHorizonal className="h-4 w-4" />
              Send
            </Button>
          </div>
        </TechnicalPanel>
      </div>
    </motion.aside>
  )
}

function LeadPipeline() {
  const { data: leads = [], isLoading } = useFreelancerLeads()
  const { updateLead, draftLead, sendLead } = useFreelancerMutations()
  const [selectedLead, setSelectedLead] = useState(null)

  const grouped = useMemo(() => {
    return columns.reduce((acc, column) => {
      acc[column.id] = leads.filter((lead) => lead.status === column.id)
      return acc
    }, {})
  }, [leads])

  const handleDrop = async (event, status) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/lead-id')
    if (!id) return

    try {
      const lead = await updateLead.mutateAsync({ id, updates: { status } })
      setSelectedLead((current) => (current?.id === id ? lead : current))
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to move lead')
    }
  }

  const handleDraft = async () => {
    if (!selectedLead) return
    try {
      const draftMessage = await draftLead.mutateAsync(selectedLead.id)
      setSelectedLead((current) => ({ ...current, draftMessage }))
      toast.success('Draft refreshed')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to draft outreach')
    }
  }

  const handleSend = async () => {
    if (!selectedLead) return
    try {
      await sendLead.mutateAsync(selectedLead.id)
      setSelectedLead((current) => ({ ...current, status: 'contacted' }))
      toast.success('Outreach marked as sent')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to send outreach')
    }
  }

  return (
    <FreelancerPageShell
      data-testid="freelancer-leads"
      title="Lead Pipeline"
      description="AI-scored prospects move from discovery to contact, reply, and won revenue without leaving the freelancer workspace."
    >
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonPanel rows={6} />
          <SkeletonPanel rows={6} />
          <SkeletonPanel rows={6} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-6">
          {columns.map((column) => (
            <TechnicalPanel
              key={column.id}
              data-testid={`lead-column-${column.id}`}
              className="min-h-[340px] p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{column.label}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs">{grouped[column.id]?.length || 0}</span>
              </div>
              <div className="space-y-3">
                {(grouped[column.id] || []).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onSelect={setSelectedLead}
                    onDragStart={(event, id) => event.dataTransfer.setData('text/lead-id', id)}
                  />
                ))}
              </div>
            </TechnicalPanel>
          ))}
        </div>
      )}

      <LeadDetail
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onDraft={handleDraft}
        onSend={handleSend}
        isDrafting={draftLead.isPending}
        isSending={sendLead.isPending}
      />
    </FreelancerPageShell>
  )
}

export default LeadPipeline
