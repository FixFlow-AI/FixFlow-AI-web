const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mergeNotificationPreferences,
  normalizeNotificationPreferences,
} = require('../services/notifications/notificationPreferences');

test('normalizeNotificationPreferences fills defaults for incomplete payloads', () => {
  const normalized = normalizeNotificationPreferences({ channels: ['email'] });

  assert.equal(normalized.enabled, true);
  assert.deepEqual(normalized.channels, ['email']);
  assert.ok(normalized.events.includes('invite'));
});

test('mergeNotificationPreferences intersects user and workspace choices safely', () => {
  const merged = mergeNotificationPreferences(
    {
      enabled: true,
      channels: ['in_app'],
      events: ['comment', 'approval', 'assignment'],
    },
    {
      enabled: true,
      channels: ['in_app', 'email'],
      events: ['comment', 'assignment'],
    }
  );

  assert.deepEqual(merged.channels, ['in_app']);
  assert.deepEqual(merged.events.sort(), ['assignment', 'comment']);
});
