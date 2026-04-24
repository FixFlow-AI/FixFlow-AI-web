const { z } = require('zod');

const OutcomeEmailSchema = z.object({
  subject: z.string().min(5).max(160),
  body: z.string().min(40).max(4000),
  sendTiming: z.string().min(3).max(80),
});

const LostOutcomeSchema = z.object({
  email1: OutcomeEmailSchema,
  email2: OutcomeEmailSchema,
  email3: OutcomeEmailSchema,
});

const LOST_OUTCOME_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email1: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        sendTiming: { type: 'string' },
      },
      required: ['subject', 'body', 'sendTiming'],
    },
    email2: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        sendTiming: { type: 'string' },
      },
      required: ['subject', 'body', 'sendTiming'],
    },
    email3: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        sendTiming: { type: 'string' },
      },
      required: ['subject', 'body', 'sendTiming'],
    },
  },
  required: ['email1', 'email2', 'email3'],
};

module.exports = {
  OutcomeEmailSchema,
  LostOutcomeSchema,
  LOST_OUTCOME_JSON_SCHEMA,
};
