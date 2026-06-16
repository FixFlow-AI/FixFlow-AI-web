import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Copy, ExternalLink, Shield } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import api from '@/config/api'
import { copyToClipboard, formatDateTime } from '@/lib/utils'

function inferExpiryDays(portal) {
  if (!portal?.expiryAt) return 0
  const diffDays = Math.round((new Date(portal.expiryAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  return diffDays > 14 ? 30 : 7
}

export default function ShareModal({ proposalId, portal, isOpen, onClose, onSaved }) {
  const [expiryDays, setExpiryDays] = useState(inferExpiryDays(portal))
  const [pinEnabled, setPinEnabled] = useState(Boolean(portal?.pinEnabled))
  const [pin, setPin] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedPortal, setSavedPortal] = useState(portal || null)

  const activePortal = savedPortal || portal
  const ctaLabel = activePortal ? 'Update portal' : 'Create portal'

  const helperText = useMemo(() => {
    if (!activePortal) return 'Set the access rules, create the public link, and share it with the client.'
    return activePortal.expiryAt
      ? `Current portal expires on ${formatDateTime(activePortal.expiryAt)}.`
      : 'Current portal does not expire.'
  }, [activePortal])

  useEffect(() => {
    if (!isOpen) return
    setExpiryDays(inferExpiryDays(portal))
    setPinEnabled(Boolean(portal?.pinEnabled))
    setPin('')
    setSavedPortal(portal || null)
  }, [isOpen, portal])

  const handleSave = async () => {
    if (pinEnabled && pin && pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits.')
      return
    }

    setIsSaving(true)
    try {
      const { data } = await api.post(`/proposals/${proposalId}/portal`, {
        expiryDays,
        pinEnabled,
        pin: pinEnabled && pin ? pin : null,
      })
      setSavedPortal(data.portal)
      onSaved?.(data.portal)
      toast.success('Client portal is ready to share.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Portal setup failed.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share with client"
      description={helperText}
      className="max-w-2xl"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5 rounded-[24px] border border-border bg-background/30 p-5">
          <div>
            <div className="text-sm font-medium">Link expiry</div>
            <div className="mt-3 grid gap-2">
              {[
                { value: 7, label: '7 days' },
                { value: 30, label: '30 days' },
                { value: 0, label: 'Never expires' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpiryDays(option.value)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                    expiryDays === option.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={pinEnabled}
                onChange={(event) => setPinEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-border bg-background"
              />
              <Shield className="h-4 w-4 text-primary" />
              Enable 4-digit PIN
            </label>
            {pinEnabled && (
              <Input
                value={pin}
                maxLength={4}
                inputMode="numeric"
                placeholder={portal?.pinEnabled ? 'Leave blank to keep current PIN' : 'Enter PIN'}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="mt-3"
              />
            )}
          </div>

          <Button onClick={handleSave} isLoading={isSaving} className="w-full">
            {ctaLabel}
          </Button>
        </div>

        <div className="rounded-[24px] border border-border bg-background/30 p-5">
          <div className="text-sm font-medium">Shareable portal link</div>
          <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
            {activePortal ? (
              <>
                <div className="break-all text-sm text-muted-foreground">{activePortal.shareUrl}</div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await copyToClipboard(activePortal.shareUrl)
                      toast.success('Share link copied.')
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </Button>
                  <Button variant="ghost" onClick={() => window.open(activePortal.shareUrl, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Create the portal to generate a public link, then copy it from here.
              </p>
            )}
          </div>

          <div className="mt-5 space-y-3 text-sm text-muted-foreground">
            <p>Clients do not need an account to open the portal.</p>
            <p>The shared page stays interactive and read-only, so your proposal retains its confidence, timeline, and risk views.</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
