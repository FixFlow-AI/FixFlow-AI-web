const { createDynamoModel } = require('../db/dynamoModel');

const PRESENCE_TTL_SECONDS = 20;

function ensurePresenceTtl(doc) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  doc.expiresAt = nowSeconds + PRESENCE_TTL_SECONDS;
}

const ProposalPresence = createDynamoModel({
  modelName: 'ProposalPresence',
  defaults: () => ({
    workspaceId: null,
    avatar: '',
    avatarInitials: '??',
    lastSeenAt: new Date().toISOString(),
  }),
  beforeSave: async (doc) => {
    ensurePresenceTtl(doc);
  },
});

module.exports = ProposalPresence;
