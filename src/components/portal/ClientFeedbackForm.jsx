import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'

export default function ClientFeedbackForm({ onSubmit }) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (message.trim().length < 5) {
      toast.error('Please add a bit more detail before sending feedback.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(message.trim())
      setMessage('')
      toast.success('Feedback sent to the agency.')
    } catch (error) {
      toast.error(error.message || 'Feedback submission failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-[28px] p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Request Changes</p>
        <h2 className="mt-2 text-xl font-semibold">Send feedback directly to the agency</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask for clarifications, note changes, or point out sections you want revised.
        </p>
      </div>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Share what needs to change, what feels unclear, or what you'd like the agency to revisit."
        className="min-h-[160px]"
      />
      <div className="mt-4 flex justify-end">
        <Button type="submit" isLoading={isSubmitting}>
          Submit feedback
        </Button>
      </div>
    </form>
  )
}
