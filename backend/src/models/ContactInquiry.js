const { createDynamoModel } = require('../db/dynamoModel');

const ContactInquiry = createDynamoModel({
  modelName: 'contact_inquiry',
  idField: '_id',
  timestamps: true,
  defaults: () => ({
    source: 'waitlist-landing-page',
    status: 'unread',
    userAgent: '',
  }),
});

module.exports = ContactInquiry;
