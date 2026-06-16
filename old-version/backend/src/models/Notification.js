const { createDynamoModel } = require('../db/dynamoModel');

const Notification = createDynamoModel({
  modelName: 'Notification',
  defaults: () => ({
    workspaceId: null,
    proposalId: '',
    scope: 'personal',
    metadata: {},
    readAt: null,
    emailStatus: 'disabled',
  }),
});

module.exports = Notification;
