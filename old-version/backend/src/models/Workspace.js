const { createDynamoModel } = require('../db/dynamoModel');
const {
  DEFAULT_NOTIFICATION_PREFERENCES,
} = require('../services/notifications/notificationPreferences');

function buildNotificationDefaults() {
  return {
    enabled: DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    channels: [...DEFAULT_NOTIFICATION_PREFERENCES.channels],
    events: [...DEFAULT_NOTIFICATION_PREFERENCES.events],
  };
}

function buildSlackDefaults() {
  return {
    teamId: '',
    teamName: '',
    channelId: '',
    channelName: '',
    webhookUrlEncrypted: '',
    installedBy: null,
    installedAt: null,
    status: 'disconnected',
    lastDeliveryStatus: '',
    lastDeliveryAt: null,
  };
}

const Workspace = createDynamoModel({
  modelName: 'Workspace',
  defaults: () => ({
    plan: 'free',
    notificationDefaults: buildNotificationDefaults(),
    roleDefinitions: [],
    slack: buildSlackDefaults(),
    members: [],
    invitePending: [],
  }),
});

module.exports = Workspace;
