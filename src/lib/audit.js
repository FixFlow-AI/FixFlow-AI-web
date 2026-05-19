import api from '@/config/api'

const ALLOWED_METADATA_TYPES = new Set(['string', 'number', 'boolean'])

function cleanMetadata(metadata = {}) {
  return Object.entries(metadata || {}).reduce((acc, [key, value]) => {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) return acc
    if (value === null || ALLOWED_METADATA_TYPES.has(typeof value)) {
      acc[key] = value
    }
    return acc
  }, {})
}

export async function trackEvent(eventName, metadata = {}) {
  if (!eventName || typeof eventName !== 'string') return

  try {
    await api.post('/audit/client-event', {
      eventName: eventName.slice(0, 120),
      metadata: cleanMetadata(metadata),
    })
  } catch {
    // Client-side tracking should never block the user workflow.
  }
}
