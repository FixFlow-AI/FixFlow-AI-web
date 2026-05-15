const { createDynamoModel } = require('../db/dynamoModel');

const WaitlistEntry = createDynamoModel({
  modelName: 'waitlist',
  idField: '_id',
  timestamps: true,
  defaults: () => ({
    source: 'waitlist-landing-page',
    status: 'new',
    comment: '',
    userAgent: '',
  }),
});

module.exports = WaitlistEntry;
