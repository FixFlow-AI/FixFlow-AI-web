import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  NOTIFICATION_CHANNEL_OPTIONS,
  NOTIFICATION_EVENT_OPTIONS,
  normalizeNotificationPreferences,
} from '@/lib/notificationPreferences'

export default function NotificationPreferencesCard({
  title = 'Notifications',
  description = 'Choose how and when FixFlowAI should keep you updated.',
  value,
  onSave,
  isSaving = false,
  disabled = false,
  className,
}) {
  const [draft, setDraft] = useState(normalizeNotificationPreferences(value))

  useEffect(() => {
    setDraft(normalizeNotificationPreferences(value))
  }, [value])

  const toggleChannel = (channel) => {
    setDraft((current) => {
      const nextChannels = current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel]
      return {
        ...current,
        channels: nextChannels.length ? nextChannels : current.channels,
      }
    })
  }

  const toggleEvent = (eventKey) => {
    setDraft((current) => {
      const nextEvents = current.events.includes(eventKey)
        ? current.events.filter((item) => item !== eventKey)
        : [...current.events, eventKey]
      return {
        ...current,
        events: nextEvents.length ? nextEvents : current.events,
      }
    })
  }

  return (
    <div className={cn('glass-card rounded-[28px] p-6', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <label className="inline-flex items-center gap-3 rounded-full border border-border bg-background/40 px-4 py-2 text-sm">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={draft.enabled}
            disabled={disabled}
            onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
          />
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="text-sm font-medium">Channels</div>
          <div className="mt-3 space-y-3">
            {NOTIFICATION_CHANNEL_OPTIONS.map((channel) => (
              <label key={channel.key} className="flex items-center justify-between rounded-2xl border border-border bg-background/30 px-4 py-3 text-sm">
                <span>{channel.label}</span>
                <input
                  type="checkbox"
                  checked={draft.channels.includes(channel.key)}
                  disabled={disabled || !draft.enabled}
                  onChange={() => toggleChannel(channel.key)}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">Events</div>
          <div className="mt-3 space-y-3">
            {NOTIFICATION_EVENT_OPTIONS.map((eventOption) => (
              <label key={eventOption.key} className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background/30 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{eventOption.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{eventOption.description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.events.includes(eventOption.key)}
                  disabled={disabled || !draft.enabled}
                  onChange={() => toggleEvent(eventOption.key)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => onSave?.(normalizeNotificationPreferences(draft))} isLoading={isSaving} disabled={disabled}>
          Save Notification Preferences
        </Button>
      </div>
    </div>
  )
}
