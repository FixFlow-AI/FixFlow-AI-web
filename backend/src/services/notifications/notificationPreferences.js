const NOTIFICATION_CHANNELS = ['in_app', 'email'];
const NOTIFICATION_EVENTS = [
  'invite',
  'comment',
  'approval',
  'assignment',
  'goal_completed',
  'backlog_moved',
];

const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  enabled: true,
  channels: [...NOTIFICATION_CHANNELS],
  events: [...NOTIFICATION_EVENTS],
});

function uniqueAllowed(values = [], allowed = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => allowed.includes(value)))];
}

function cloneDefaultNotificationPreferences() {
  return {
    enabled: DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    channels: [...DEFAULT_NOTIFICATION_PREFERENCES.channels],
    events: [...DEFAULT_NOTIFICATION_PREFERENCES.events],
  };
}

function normalizeNotificationPreferences(input = {}, fallback = DEFAULT_NOTIFICATION_PREFERENCES) {
  const base = cloneDefaultNotificationPreferences();
  const fallbackValue = fallback || DEFAULT_NOTIFICATION_PREFERENCES;

  const channels = uniqueAllowed(input.channels, NOTIFICATION_CHANNELS);
  const events = uniqueAllowed(input.events, NOTIFICATION_EVENTS);

  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : fallbackValue.enabled ?? base.enabled,
    channels: channels.length
      ? channels
      : [...(fallbackValue.channels?.length ? fallbackValue.channels : base.channels)],
    events: events.length
      ? events
      : [...(fallbackValue.events?.length ? fallbackValue.events : base.events)],
  };
}

function intersectPreferences(left = DEFAULT_NOTIFICATION_PREFERENCES, right = DEFAULT_NOTIFICATION_PREFERENCES) {
  const normalizedLeft = normalizeNotificationPreferences(left);
  const normalizedRight = normalizeNotificationPreferences(right);

  return {
    enabled: normalizedLeft.enabled && normalizedRight.enabled,
    channels: normalizedLeft.channels.filter((channel) => normalizedRight.channels.includes(channel)),
    events: normalizedLeft.events.filter((eventKey) => normalizedRight.events.includes(eventKey)),
  };
}

function mergeNotificationPreferences(userPreferences, ...defaultLayers) {
  let effective = cloneDefaultNotificationPreferences();

  defaultLayers
    .filter(Boolean)
    .forEach((layer) => {
      effective = intersectPreferences(effective, normalizeNotificationPreferences(layer));
    });

  if (userPreferences) {
    effective = intersectPreferences(effective, normalizeNotificationPreferences(userPreferences));
  }

  return effective;
}

function hasNotificationChannel(preferences, channel) {
  const normalized = normalizeNotificationPreferences(preferences);
  return normalized.enabled && normalized.channels.includes(channel);
}

function hasNotificationEvent(preferences, eventKey) {
  const normalized = normalizeNotificationPreferences(preferences);
  return normalized.enabled && normalized.events.includes(eventKey);
}

module.exports = {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  cloneDefaultNotificationPreferences,
  normalizeNotificationPreferences,
  intersectPreferences,
  mergeNotificationPreferences,
  hasNotificationChannel,
  hasNotificationEvent,
};
