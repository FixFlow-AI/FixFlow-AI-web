const { z } = require('zod');

const FeatureSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  technical_approach: z.string().min(1),
  complexity: z.enum(['High', 'Medium', 'Low']),
  confidence: z.enum(['High', 'Medium', 'Low']),
  confidence_pct: z.coerce.number().min(0).max(100),
  area: z.string().min(1),
});

const RiskSchema = z.object({
  label: z.string().min(1),
  severity: z.coerce.number().min(0).max(100),
  mitigation: z.string().min(1),
  category: z.string().min(1),
});

const TimelineSchema = z.object({
  phase: z.string().min(1),
  duration: z.string().min(1),
  tasks: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string()).default([]),
});

const EffortSchema = z.object({
  label: z.string().min(1),
  percentage: z.coerce.number().min(0).max(100),
  timeframe: z.string().min(1),
  description: z.string().min(1),
});

const MarketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  trend: z.enum(['up', 'down', 'stable']),
  relevance: z.coerce.number().min(0).max(100),
});

const ImpactSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  impact_score: z.coerce.number().min(0).max(100),
  category: z.string().min(1),
});

const ProposalSchema = z.object({
  project_summary: z.string().min(10),
  features: z.array(FeatureSchema).min(1),
  risks: z.array(RiskSchema).min(1),
  timeline: z.array(TimelineSchema).min(1),
  effort: z.array(EffortSchema).min(1),
  market: z.array(MarketSchema).default([]),
  impact: z.array(ImpactSchema).default([]),
});

function stripCodeFences(rawText) {
  return rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJsonObject(rawText) {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return '';
  }

  return rawText.slice(start, end + 1);
}

function tryParse(candidate) {
  if (!candidate) {
    return null;
  }

  const data = JSON.parse(candidate);
  return ProposalSchema.parse(data);
}

async function validateAndRepair(rawText) {
  const attempts = [
    rawText,
    stripCodeFences(rawText),
    extractJsonObject(rawText),
  ];

  for (const candidate of attempts) {
    try {
      return tryParse(candidate);
    } catch (_error) {
      // Try the next repair strategy.
    }
  }

  throw new Error(
    'JSON_REPAIR_FAILED: All repair strategies were exhausted. Raw output could not be parsed as valid proposal JSON.'
  );
}

module.exports = {
  ProposalSchema,
  validateAndRepair,
  stripCodeFences,
  extractJsonObject,
};
