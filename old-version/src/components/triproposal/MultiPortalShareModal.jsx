import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import api from '@/config/api'
import { copyToClipboard } from '@/lib/utils'

export default function MultiPortalShareModal({ tripId, proposals = [], isOpen, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => proposals.map((proposal) => proposal.proposalId))
  const [isSaving, setIsSaving] = useState(false)
  const [portal, setPortal] = useState(null)

  useEffect(() => {
    setSelectedIds(proposals.map((proposal) => proposal.proposalId))
  }, [proposals])

  const handleToggle = (proposalId) => {
    setSelectedIds((current) =>
      current.includes(proposalId)
        ? current.filter((value) => value !== proposalId)
        : [...current, proposalId]
    )
  }

  const handleCreate = async () => {
    if (!selectedIds.length) {
      toast.error('Choose at least one strategy to share.')
      return
    }

    setIsSaving(true)
    try {
      const { data } = await api.post(`/trips/${tripId}/portal`, {
        proposalIds: selectedIds,
        expiryDays: 7,
        pinEnabled: false,
        pin: null,
      })
      setPortal(data.portal)
      toast.success('Bundle portal created.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create the bundle portal.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Selected Strategies"
      description="Create one client-facing portal for the strategies you want to present."
    >
      <div className="space-y-4">
        {proposals.map((proposal) => (
          <label key={proposal.proposalId} className="flex items-start gap-3 rounded-2xl border border-border bg-background/30 px-4 py-4">
            <input
              type="checkbox"
              checked={selectedIds.includes(proposal.proposalId)}
              onChange={() => handleToggle(proposal.proposalId)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <div>
              <div className="font-medium">{proposal.title}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{proposal.strategy}</div>
            </div>
          </label>
        ))}

        <Button className="w-full" isLoading={isSaving} onClick={handleCreate}>
          Create bundle share link
        </Button>

        {portal ? (
          <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm">
            <div className="font-medium">Share link</div>
            <div className="mt-2 break-all text-muted-foreground">{portal.shareUrl}</div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={async () => {
                await copyToClipboard(portal.shareUrl)
                toast.success('Bundle link copied.')
              }}
            >
              Copy Link
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
