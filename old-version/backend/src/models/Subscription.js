const { createDynamoModel } = require('../db/dynamoModel');

const Subscription = createDynamoModel({
  modelName: 'Subscription',
  defaults: () => ({
    stripeSubscriptionId: '',
    stripePriceId: '',
    plan: 'free',
    status: 'none',
    currentPeriodEnd: null,
    seats: 1,
    usageThisMonth: 0,
    lastInvoiceStatus: '',
  }),
});

module.exports = Subscription;
