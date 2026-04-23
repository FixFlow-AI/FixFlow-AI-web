const { z } = require('zod');

// ── Individual section sub-schemas (extracted from jsonValidator.js) ────────

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

// ── Array-level schemas for section validation ─────────────────────────────

const FeaturesArraySchema = z.array(FeatureSchema).min(1);
const RisksArraySchema = z.array(RiskSchema).min(1);
const TimelineArraySchema = z.array(TimelineSchema).min(1);
const EffortArraySchema = z.array(EffortSchema).min(1);
const MarketArraySchema = z.array(MarketSchema);
const ImpactArraySchema = z.array(ImpactSchema);
const SummarySchema = z.string().min(10);

// ── Section → schema map ───────────────────────────────────────────────────

const SECTION_SCHEMAS = {
  features: FeaturesArraySchema,
  risks: RisksArraySchema,
  timeline: TimelineArraySchema,
  effort: EffortArraySchema,
  market: MarketArraySchema,
  impact: ImpactArraySchema,
  summary: SummarySchema,
};

// Map section names to their JSON key in the proposal object
const SECTION_JSON_KEYS = {
  features: 'features',
  risks: 'risks',
  timeline: 'timeline',
  effort: 'effort',
  market: 'market',
  impact: 'impact',
  summary: 'project_summary',
};

const VALID_SECTIONS = Object.keys(SECTION_SCHEMAS);

module.exports = {
  FeatureSchema,
  RiskSchema,
  TimelineSchema,
  EffortSchema,
  MarketSchema,
  ImpactSchema,
  FeaturesArraySchema,
  RisksArraySchema,
  TimelineArraySchema,
  EffortArraySchema,
  MarketArraySchema,
  ImpactArraySchema,
  SummarySchema,
  SECTION_SCHEMAS,
  SECTION_JSON_KEYS,
  VALID_SECTIONS,
};
