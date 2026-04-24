import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import OutcomeGeneratingLoader from './OutcomeGeneratingLoader'
import api from '@/config/api'
import { copyToClipboard } from '@/lib/utils'

export default function WonOutcomeModal({ proposalId, isOpen, onClose }) {
  const queryClient = useQueryClient()
  const [outcome, setOutcome] = useState(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let ignore = false
    setIsLoading(true)

    api
      .post(`/proposals/${proposalId}/outcome`, { dealStatus: 'won' })
      .then(({ data }) => {
        if (!ignore) {
          setOutcome(data.outcome)
          queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] })
          queryClient.invalidateQueries({ queryKey: ['proposals'] })
          queryClient.invalidateQueries({ queryKey: ['proposal-analytics'] })
        }
      })
      .catch((error) => {
        if (!ignore) {
          toast.error(error.response?.data?.error || 'Unable to generate the kickoff package.')
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [isOpen, proposalId, queryClient])

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      toast.error('Add a client email before sending.')
      return
    }

    setIsSending(true)
    try {
      await api.post(`/proposals/${proposalId}/outcome/send`, {
        recipientEmail: recipientEmail.trim(),
        emailKey: 'kickoff',
      })
      toast.success('Kickoff email sent.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kickoff email failed to send.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Won deal kickoff package"
      description="A client-ready kickoff email plus the first ten delivery actions from the approved proposal."
    >
      {isLoading && !outcome ? (
        <OutcomeGeneratingLoader label="Generating kickoff checklist and email..." />
      ) : outcome ? (
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[24px] border border-border bg-background/35 p-5">
            <div className="mb-4 text-sm font-semibold">Kickoff checklist</div>
            <div className="space-y-3">
              {outcome.checklist.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-border bg-background/35 px-4 py-3">
                  <span className="text-xs font-semibold text-primary">0{index + 1}</span>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={async () => {
                await copyToClipboard(outcome.checklist.join('\n'))
                toast.success('Checklist copied.')
              }}
            >
              Copy checklist
            </Button>
          </div>

          <div className="rounded-[24px] border border-border bg-background/35 p-5">
            <div className="mb-2 text-xs uppercase tracking-[0.22em] text-primary">Kickoff Email</div>
            <div className="text-xl font-semibold">{outcome.kickoffEmail.subject}</div>
            <pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{outcome.kickoffEmail.body}</pre>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="client@example.com"
              />
              <Button
                variant="outline"
                onClick={async () => {
                  await copyToClipboard(`${outcome.kickoffEmail.subject}\n\n${outcome.kickoffEmail.body}`)
                  toast.success('Kickoff email copied.')
                }}
              >
                Copy email
              </Button>
              <Button onClick={handleSend} isLoading={isSending}>
                Send email
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
