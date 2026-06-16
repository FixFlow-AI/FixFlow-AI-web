import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import api from '@/config/api'
import EmailCard from './EmailCard'
import OutcomeGeneratingLoader from './OutcomeGeneratingLoader'

export default function LostOutcomeModal({ proposalId, isOpen, onClose, defaultLossReason = '' }) {
  const queryClient = useQueryClient()
  const [lossReason, setLossReason] = useState(defaultLossReason)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [outcome, setOutcome] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sendingKey, setSendingKey] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLossReason(defaultLossReason || '')
      setOutcome(null)
    }
  }, [defaultLossReason, isOpen])

  const handleGenerate = async () => {
    setIsLoading(true)
    try {
      const { data } = await api.post(`/proposals/${proposalId}/outcome`, {
        dealStatus: 'lost',
        lossReason: lossReason.trim(),
      })
      setOutcome(data.outcome)
      queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] })
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      queryClient.invalidateQueries({ queryKey: ['proposal-analytics'] })
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to generate the follow-up sequence.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async (emailKey) => {
    if (!recipientEmail.trim()) {
      toast.error('Add a recipient email before sending.')
      return
    }

    setSendingKey(emailKey)
    try {
      await api.post(`/proposals/${proposalId}/outcome/send`, {
        recipientEmail: recipientEmail.trim(),
        emailKey,
      })
      toast.success('Follow-up email sent.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to send follow-up email.')
    } finally {
      setSendingKey('')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lost deal follow-up sequence"
      description="Capture the likely loss reason and generate a three-touch sequence to learn, reframe, and reopen the conversation."
    >
      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="rounded-[24px] border border-border bg-background/35 p-5">
          <div className="text-sm font-semibold">Context</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This is optional, but giving the model a reason helps tailor the objection handling in the second and third emails.
          </p>
          <Textarea
            value={lossReason}
            onChange={(event) => setLossReason(event.target.value)}
            placeholder="Budget pressure, timeline concern, chose in-house, stakeholder uncertainty..."
            className="mt-4 min-h-[180px]"
          />
          <Button className="mt-4 w-full" onClick={handleGenerate} isLoading={isLoading}>
            Generate follow-up sequence
          </Button>

          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold">Send to</div>
            <Input
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/35 p-5">
          {isLoading && !outcome ? (
            <OutcomeGeneratingLoader label="Generating the 3-email recovery sequence..." />
          ) : outcome ? (
            <div className="space-y-4">
              <EmailCard title="Email 1" email={outcome.email1} isSending={sendingKey === 'email1'} onSend={() => handleSend('email1')} />
              <EmailCard title="Email 2" email={outcome.email2} isSending={sendingKey === 'email2'} onSend={() => handleSend('email2')} />
              <EmailCard title="Email 3" email={outcome.email3} isSending={sendingKey === 'email3'} onSend={() => handleSend('email3')} />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              Generate the follow-up pack to see the same-day thank-you, one-week objection email, and one-month re-engagement email.
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
