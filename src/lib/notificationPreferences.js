export const NOTIFICATION_EVENT_OPTIONS = [
  { key: 'invite', label: 'Invites', description: 'Workspace invitations sent and accepted.' },
  { key: 'comment', label: 'Comments', description: 'New review comments and resolved threads.' },
  { key: 'approval', label: 'Approvals', description: 'Approval notes added to proposal sections.' },
  { key: 'assignment', label: 'Assignments', description: 'Proposal ownership and follow-up handoffs.' },
  { key: 'goal_completed', label: 'Goal completion', description: 'Weekly delivery goals marked complete.' },
  { key: 'backlog_moved', label: 'Backlog moves', description: 'Tasks moved out of timeline into backlog.' },
]

export const NOTIFICATION_CHANNEL_OPTIONS = [
  { key: 'in_app', label: 'In-app' },
  { key: 'email', label: 'Email' },
]

export function normalizeNotificationPreferences(value = {}) {
  return {
    enabled: value?.enabled !== false,
    channels: Array.isArray(value?.channels) && value.channels.length ? value.channels : ['in_app', 'email'],
    events: Array.isArray(value?.events) && value.events.length
      ? value.events
      : NOTIFICATION_EVENT_OPTIONS.map((item) => item.key),
  }
}
