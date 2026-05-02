const { buildBriefScorePrompt } = require('../../prompts/briefScorePrompt');
const {
  BriefScoreSchema,
  BRIEF_SCORE_DIMENSION_NAMES,
  BRIEF_SCORE_RESPONSE_JSON_SCHEMA,
} = require('../../schemas/briefScoreSchema');
const { generateStructuredJSON } = require('../llm/structuredGeneration');

const KEYWORD_SETS = {
  scope: [
    'feature',
    'features',
    'deliverable',
    'deliverables',
    'workflow',
    'dashboard',
    'admin',
    'mobile app',
    'web app',
    'portal',
    'integration',
    'payment',
    'analytics',
  ],
  technical: [
    'api',
    'sdk',
    'integration',
    'salesforce',
    'shopify',
    'aws',
    'azure',
    'react',
    'node',
    'database',
    'platform',
    'ios',
    'android',
    'webhook',
    'erp',
  ],
  timeline: [
    'timeline',
    'deadline',
    'launch',
    'weeks',
    'months',
    'quarter',
    'q1',
    'q2',
    'q3',
    'q4',
    'asap',
    'urgent',
    'date',
    'milestone',
  ],
  budget: [
    'budget',
    'cost',
    'pricing',
    'rate',
    'rates',
    '$',
    'usd',
    'inr',
    'lakh',
    'crore',
    'retainer',
  ],
  stakeholders: [
    'stakeholder',
    'cto',
    'founder',
    'ceo',
    'product manager',
    'marketing',
    'ops',
    'sales',
    'admin',
    'end user',
    'customer support',
    'team',
  ],
  success: [
    'kpi',
    'metric',
    'success',
    'conversion',
    'retention',
    'revenue',
    'growth',
    'engagement',
    'reduce',
    'increase',
    'monthly active users',
    'maus',
    'time saved',
  ],
};

function countMatches(text, keywords) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreDimension({ text, wordCount, keywords, baseline, perMatch, bonus = 0 }) {
  return clampScore(baseline + countMatches(text, keywords) * perMatch + bonus + Math.min(20, wordCount / 20));
}

function buildMissingText(hasSignal, label, fallback) {
  return hasSignal ? null : fallback || `${label} is missing from the brief.`;
}

function buildHeuristicBriefScore(briefText) {
  const normalized = String(briefText || '').toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  const dimensions = [
    {
      name: 'Scope Clarity',
      score: scoreDimension({
        text: normalized,
        wordCount,
        keywords: KEYWORD_SETS.scope,
        baseline: wordCount > 140 ? 34 : 18,
        perMatch: 9,
        bonus: /should|must|need to|allow|include/.test(normalized) ? 10 : 0,
      }),
      diagnostic:
        /deliverable|feature|workflow|module|screen|dashboard/.test(normalized)
          ? 'The brief names concrete product surfaces and user flows, which helps feature extraction stay specific.'
          : 'The brief describes the project direction, but the actual deliverables are still too broad for a sharp proposal.',
      missing: buildMissingText(
        /deliverable|feature|workflow|module|screen|dashboard/.test(normalized),
        'Scope clarity',
        'Specific deliverables or user flows are not clearly listed.'
      ),
    },
    {
      name: 'Technical Depth',
      score: scoreDimension({
        text: normalized,
        wordCount,
        keywords: KEYWORD_SETS.technical,
        baseline: 10,
        perMatch: 11,
        bonus: /api|integration|platform|database|react|node|ios|android|aws|azure/.test(normalized) ? 10 : 0,
      }),
      diagnostic:
        /api|integration|platform|database|react|node|ios|android|aws|azure/.test(normalized)
          ? 'The brief includes implementation context like platforms, integrations, or stack clues that improve technical planning.'
          : 'Technical constraints are light, so architecture and integration estimates will need more assumptions.',
      missing: buildMissingText(
        /api|integration|platform|database|react|node|ios|android|aws|azure/.test(normalized),
        'Technical depth',
        'Platforms, integrations, or system constraints are not clearly described.'
      ),
    },
    {
      name: 'Timeline Signal',
      score: scoreDimension({
        text: normalized,
        wordCount,
        keywords: KEYWORD_SETS.timeline,
        baseline: 8,
        perMatch: 14,
        bonus: /timeline|deadline|launch|week|month|q[1-4]|urgent|asap/.test(normalized) ? 10 : 0,
      }),
      diagnostic:
        /timeline|deadline|launch|week|month|q[1-4]|urgent|asap/.test(normalized)
          ? 'There is enough timing context to frame delivery phases and urgency with more confidence.'
          : 'The brief does not anchor delivery to any date or milestone, which weakens timeline calibration.',
      missing: buildMissingText(
        /timeline|deadline|launch|week|month|q[1-4]|urgent|asap/.test(normalized),
        'Timeline signal',
        'No deadline, milestone, or launch window was found.'
      ),
    },
    {
      name: 'Budget Signal',
      score: scoreDimension({
        text: normalized,
        wordCount,
        keywords: KEYWORD_SETS.budget,
        baseline: 5,
        perMatch: 18,
        bonus: /budget|cost|pricing|rate|\$|usd|inr|lakh|crore|retainer/.test(normalized) ? 8 : 0,
      }),
      diagnostic:
        /budget|cost|pricing|rate|\$|usd|inr|lakh|crore|retainer/.test(normalized)
          ? 'Budget language is present, which helps reality-check scope and sequencing.'
          : 'No cost or pricing envelope is mentioned, so the proposal will need to assume affordability constraints.',
      missing: buildMissingText(
        /budget|cost|pricing|rate|\$|usd|inr|lakh|crore|retainer/.test(normalized),
        'Budget signal',
        'Budget range, pricing constraints, or commercial guardrails were not found.'
      ),
    },
    {
      name: 'Stakeholder Definition',
      score: scoreDimension({
        text: normalized,
        wordCount,
        keywords: KEYWORD_SETS.stakeholders,
        baseline: 10,
        perMatch: 13,
      }),
      diagnostic:
        /cto|founder|ceo|product manager|stakeholder|marketing|ops|team|end user/.test(normalized)
          ? 'The brief points to the people involved, which improves approval and discovery planning.'
          : 'Decision-makers and user groups are not clearly named, so stakeholder alignment risks remain high.',
      missing: buildMissingText(
        /cto|founder|ceo|product manager|stakeholder|marketing|ops|team|end user/.test(normalized),
        'Stakeholder definition',
        'The brief does not identify approvers, operators, or end-user groups.'
      ),
    },
    {
      name: 'Success Criteria',
      score: scoreDimension({
        text: normalized,
        wordCount,
        keywords: KEYWORD_SETS.success,
        baseline: 10,
        perMatch: 13,
        bonus: /kpi|metric|success|conversion|retention|revenue|growth|engagement|reduce|increase|monthly active users/.test(normalized) ? 10 : 0,
      }),
      diagnostic:
        /kpi|metric|success|conversion|retention|revenue|growth|engagement|reduce|increase|monthly active users/.test(normalized)
          ? 'Outcome language is present, giving the proposal a stronger basis for prioritization and validation.'
          : 'The brief explains the project, but not how success will be measured once it ships.',
      missing: buildMissingText(
        /kpi|metric|success|conversion|retention|revenue|growth|engagement|reduce|increase|monthly active users/.test(normalized),
        'Success criteria',
        'KPIs, target outcomes, or measurable success markers are missing.'
      ),
    },
  ];

  const overallScore = clampScore(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length
  );
  const grade = overallScore >= 85 ? 'Excellent' : overallScore >= 70 ? 'Good' : overallScore >= 50 ? 'Fair' : 'Poor';
  const missingSections = dimensions.filter((dimension) => dimension.missing).map((dimension) => dimension.name);
  const improvementSuggestions = dimensions
    .filter((dimension) => dimension.missing)
    .slice(0, 4)
    .map((dimension) => ({
      question:
        {
          'Scope Clarity': 'Which exact deliverables, modules, or user flows need to be included in the first release?',
          'Technical Depth': 'What systems, APIs, platforms, or internal tools must this solution integrate with?',
          'Timeline Signal': 'Is there a target launch date, fixed milestone, or deadline we need to design around?',
          'Budget Signal': 'Is there a budget range or commercial ceiling that should guide scope and sequencing?',
          'Stakeholder Definition': 'Who will approve the project, who will use it daily, and who should join discovery sessions?',
          'Success Criteria': 'What measurable business outcomes or KPIs should this project improve after launch?',
        }[dimension.name],
      impact: ['Scope Clarity', 'Technical Depth', 'Success Criteria'].includes(dimension.name) ? 'High' : 'Medium',
    }));

  return BriefScoreSchema.parse({
    overallScore,
    grade,
    readyToGenerate: overallScore >= 70,
    dimensions,
    missingSections,
    improvementSuggestions,
    estimatedConfidenceBoost: clampScore(Math.max(8, Math.min(35, 100 - overallScore))),
  });
}

async function scoreBriefWithAI(briefText, { userId } = {}) {
  const { system, user } = buildBriefScorePrompt(briefText);
  const raw = await generateStructuredJSON({
    system,
    user,
    jsonSchema: BRIEF_SCORE_RESPONSE_JSON_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 2500,
    context: { userId, requestId: 'briefScore' },
  });

  return BriefScoreSchema.parse(JSON.parse(raw));
}

async function scoreBrief(briefText, { userId } = {}) {
  try {
    return await scoreBriefWithAI(briefText, { userId });
  } catch (error) {
    if (String(error?.message || '').includes('GEMINI')) {
      throw error;
    }

    return buildHeuristicBriefScore(briefText);
  }
}

function buildTooShortBriefScore() {
  return BriefScoreSchema.parse({
    overallScore: 0,
    grade: 'Poor',
    readyToGenerate: false,
    dimensions: BRIEF_SCORE_DIMENSION_NAMES.map((name) => ({
      name,
      score: 0,
      diagnostic: 'The brief is too short to analyze reliably.',
      missing: 'More discovery detail is needed before this dimension can be scored.',
    })),
    missingSections: [...BRIEF_SCORE_DIMENSION_NAMES],
    improvementSuggestions: [
      {
        question: 'Can you provide more detail on scope, timeline, stakeholders, budget, and success criteria before generating?',
        impact: 'High',
      },
    ],
    estimatedConfidenceBoost: 35,
  });
}

module.exports = {
  scoreBrief,
  buildHeuristicBriefScore,
  buildTooShortBriefScore,
};
