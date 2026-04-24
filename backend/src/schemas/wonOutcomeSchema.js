const { z } = require('zod');

const WonOutcomeSchema = z.object({
  checklist: z.array(z.string().min(8).max(180)).length(10),
  kickoffEmail: z.object({
    subject: z.string().min(5).max(160),
    body: z.string().min(40).max(4000),
  }),
});

const WON_OUTCOME_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    checklist: {
      type: 'array',
      minItems: 10,
      maxItems: 10,
      items: { type: 'string' },
    },
    kickoffEmail: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['subject', 'body'],
    },
  },
  required: ['checklist', 'kickoffEmail'],
};

module.exports = {
  WonOutcomeSchema,
  WON_OUTCOME_JSON_SCHEMA,
};
