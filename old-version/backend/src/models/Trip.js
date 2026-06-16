const { createDynamoModel } = require('../db/dynamoModel');

const Trip = createDynamoModel({
  modelName: 'Trip',
  defaults: () => ({
    workspaceId: null,
    proposals: [],
  }),
});

module.exports = Trip;
