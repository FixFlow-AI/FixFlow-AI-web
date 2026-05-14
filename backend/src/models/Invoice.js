const { createDynamoModel } = require('../db/dynamoModel');

const Invoice = createDynamoModel({
  modelName: 'Invoice',
  defaults: () => ({
    leadId: null,
    clientName: '',
    amount: 0,
    currency: 'USDC',
    status: 'pending',
    dueDate: null,
  }),
});

module.exports = Invoice;
