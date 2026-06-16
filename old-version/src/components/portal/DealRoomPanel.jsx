import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle2, MessageSquareText, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const SECTIONS = [
  { value: 'summary', label: 'Summary' },
  { value: 'features', label: 'Features' },
  { value: 'risks', label: 'Risks' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'effort', label: 'Effort' },
  { value: 'market', label: 'Market' },
  { value: 'impact', label: 'Impact' },
]

export default function DealRoomPanel({
  proposal,
  bundleProposals = [],
  selectedStrategyId,
  postAnnotation,
  postTierSelection,
}) {
  const [sectionName, setSectionName] = useState('summary')
  const [type, setType] = useState('question')
  const [comment, setComment] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const currentBundleItem = useMemo(
    () => bundleProposals.find((item) => item.proposalId === selectedStrategyId) || bundleProposals[0],
    [bundleProposals, selectedStrategyId]
  )

  const proposalId = proposal?.proposalId || currentBundleItem?.proposalId || ''
  const strategy = proposal?.strategy || currentBundleItem?.strategy || 'standard'

  const handleAnnotation = async () => {
    if (!comment.trim()) {
      toast.error('Add a comment before sending.')
      return
    }

    setIsSaving(true)
    try {
      await postAnnotation({
        proposalId,
        sectionName,
        type,
        comment,
        clientEmail,
      })
      setComment('')
      setSent(true)
      toast.success('Your question has been sent.')
    } catch (error) {
      toast.error(error.message || 'Could not send your comment.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTierSelection = async () => {
    setIsSaving(true)
    try {
      await postTierSelection({
        proposalId,
        strategy,
        clientEmail,
      })
      setSent(true)
      toast.success('Strategy preference saved.')
    } catch (error) {
      toast.error(error.message || 'Could not save strategy selection.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="sticky top-6 rounded-[28px] border border-border bg-card/90 p-5 shadow-xl backdrop-blur-xl"
      data-testid="deal-room-panel"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-border bg-background/40 p-3">
          <MessageSquareText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Deal Room</h2>
          <p className="mt-1 text-sm text-muted-foreground">Send section questions and mark the strategy you prefer.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <input
          value={clientEmail}
          onChange={(event) => setClientEmail(event.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="deal-room-client-email"
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={sectionName}
            onChange={(event) => setSectionName(event.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
            data-testid="deal-room-section"
          >
            {SECTIONS.map((section) => (
              <option key={section.value} value={section.value}>{section.label}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
            data-testid="deal-room-type"
          >
            <option value="question">Question</option>
            <option value="concern">Concern</option>
            <option value="approval">Approval</option>
          </select>
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Add a question or concern for the agency..."
          rows={4}
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="deal-room-comment"
        />
        <Button className="w-full" onClick={handleAnnotation} isLoading={isSaving}>
          <Send className="h-4 w-4" />
          Send comment
        </Button>
      </div>

      {bundleProposals.length ? (
        <div className="mt-5 rounded-2xl border border-border bg-background/35 p-4">
          <div className="text-sm font-medium capitalize">{strategy} strategy</div>
          <p className="mt-1 text-xs text-muted-foreground">Save this option as your preferred path.</p>
          <Button className="mt-3 w-full" variant="outline" onClick={handleTierSelection} isLoading={isSaving}>
            Request this approach
          </Button>
        </div>
      ) : null}

      {sent ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          Your update has been sent.
        </div>
      ) : null}
    </div>
  )
}
