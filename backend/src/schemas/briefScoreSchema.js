const { z } = require('zod');

const BRIEF_SCORE_DIMENSION_NAMES = [
  'Scope Clarity',
  'Technical Depth',
  'Timeline Signal',
  'Budget Signal',
  'Stakeholder Definition',
  'Success Criteria',
];

const BriefScoreDimensionSchema = z.object({
  name: z.enum(BRIEF_SCORE_DIMENSION_NAMES),
  score: z.coerce.number().min(0).max(100),
  diagnostic: z.string().min(10).max(280),
  missing: z.string().max(180).nullable().default(null),
});

const BriefScoreSuggestionSchema = z.object({
  question: z.string().min(10).max(240),
  impact: z.enum(['High', 'Medium']),
});

const BriefScoreSchema = z.object({
  overallScore: z.coerce.number().min(0).max(100),
  grade: z.enum(['Excellent', 'Good', 'Fair', 'Poor']),
  readyToGenerate: z.boolean(),
  dimensions: z.array(BriefScoreDimensionSchema).length(BRIEF_SCORE_DIMENSION_NAMES.length),
  missingSections: z.array(z.string().min(1).max(120)).max(10),
  improvementSuggestions: z.array(BriefScoreSuggestionSchema).max(6),
  estimatedConfidenceBoost: z.coerce.number().min(0).max(100),
});

const BRIEF_SCORE_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallScore: { type: 'number', minimum: 0, maximum: 100 },
    grade: { type: 'string', enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
    readyToGenerate: { type: 'boolean' },
    dimensions: {
      type: 'array',
      minItems: BRIEF_SCORE_DIMENSION_NAMES.length,
      maxItems: BRIEF_SCORE_DIMENSION_NAMES.length,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', enum: BRIEF_SCORE_DIMENSION_NAMES },
          score: { type: 'number', minimum: 0, maximum: 100 },
          diagnostic: { type: 'string' },
          missing: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
        },
        required: ['name', 'score', 'diagnostic', 'missing'],
      },
    },
    missingSections: {
      type: 'array',
      items: { type: 'string' },
    },
    improvementSuggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          impact: { type: 'string', enum: ['High', 'Medium'] },
        },
        required: ['question', 'impact'],
      },
    },
    estimatedConfidenceBoost: { type: 'number', minimum: 0, maximum: 100 },
  },
  required: [
    'overallScore',
    'grade',
    'readyToGenerate',
    'dimensions',
    'missingSections',
    'improvementSuggestions',
    'estimatedConfidenceBoost',
  ],
};

module.exports = {
  BRIEF_SCORE_DIMENSION_NAMES,
  BriefScoreDimensionSchema,
  BriefScoreSuggestionSchema,
  BriefScoreSchema,
  BRIEF_SCORE_RESPONSE_JSON_SCHEMA,
};
