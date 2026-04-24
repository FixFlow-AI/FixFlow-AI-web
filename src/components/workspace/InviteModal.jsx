import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import api from '@/config/api'

export default function InviteModal({ isOpen, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [isSaving, setIsSaving] = useState(false)

  const handleInvite = async () => {
    setIsSaving(true)
    try {
      const { data } = await api.post('/workspaces/current/invites', { email, role })
      toast.success(data.invite.emailDeliverySkipped ? 'Invite link created. Email delivery is not configured.' : 'Invite sent.')
      onInvited?.(data.invite)
      setEmail('')
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not send invite.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Teammate" description="Send a workspace invitation by email.">
      <div className="space-y-4">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@agency.com" />
        <select
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <Button className="w-full" onClick={handleInvite} isLoading={isSaving}>
          Send Invite
        </Button>
      </div>
    </Modal>
  )
}
