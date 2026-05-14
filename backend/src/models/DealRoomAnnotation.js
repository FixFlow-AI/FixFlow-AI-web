const { createDynamoModel } = require('../db/dynamoModel');

const DealRoomAnnotation = createDynamoModel({
  modelName: 'DealRoomAnnotation',
  defaults: () => ({
    workspaceId: null,
    type: 'question',
    clientEmail: '',
  }),
  timestamps: true,
});

module.exports = DealRoomAnnotation;
