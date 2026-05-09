const ProposalEval = require('../../models/ProposalEval');
const { getProposalJSONForRecord } = require('../proposal/proposalAccess');

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function average(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + Number(value || 0), 0) / numbers.length;
}

function tokenize(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .slice(0, 1500)
  );
}

function scoreBriefAlignment(briefText = '', proposalJSON = {}) {
  const briefTokens = tokenize(briefText);
  if (!briefTokens.size) return 0;

  const proposalTokens = tokenize([
    proposalJSON.project_summary,
    ...(proposalJSON.features || []).map((feature) => `${feature.title} ${feature.description} ${feature.technical_approach}`),
    ...(proposalJSON.risks || []).map((risk) => `${risk.label} ${risk.mitigation}`),
  ].join(' '));

  let overlap = 0;
  briefTokens.forEach((token) => {
    if (proposalTokens.has(token)) overlap += 1;
  });

  return clampScore((overlap / Math.max(briefTokens.size, 1)) * 100);
}

function buildEvalScores(proposal, proposalJSON) {
  const features = Array.isArray(proposalJSON.features) ? proposalJSON.features : [];
  const risks = Array.isArray(proposalJSON.risks) ? proposalJSON.risks : [];
  const effort = Array.isArray(proposalJSON.effort) ? proposalJSON.effort : [];
  const timeline = Array.isArray(proposalJSON.timeline) ? proposalJSON.timeline : [];
  const deliveryPlan = proposalJSON.delivery_plan || {};
  const confidenceValues = features
    .map((feature) => Number(feature.confidence_pct))
    .filter((value) => Number.isFinite(value));

  const requiredSections = [
    proposalJSON.project_summary,
    features.length,
    risks.length,
    timeline.length,
    effort.length,
  ];
  const completenessScore = clampScore((requiredSections.filter(Boolean).length / requiredSections.length) * 100);
  const confidenceMean = Math.round(average(confidenceValues) * 10) / 10;
  const confidenceStd = confidenceValues.length
    ? Math.round(Math.sqrt(average(confidenceValues.map((value) => (value - confidenceMean) ** 2))) * 10) / 10
    : 0;
  const riskCoverage = clampScore(Math.min(risks.length, 5) * 20);
  const effortSpecificity = clampScore((effort.filter((item) => item.timeframe && item.percentage).length / Math.max(effort.length, 1)) * 100);
  const deliveryPlanQuality = clampScore(
    ((Array.isArray(deliveryPlan.weeks) && deliveryPlan.weeks.length > 1 ? 50 : 0) +
      (Array.isArray(deliveryPlan.roadmap) && deliveryPlan.roadmap.length ? 25 : 0) +
      (timeline.length > 1 ? 25 : 0))
  );
  const briefToProposalAlignment = scoreBriefAlignment(proposal.briefSnapshot, proposalJSON);

  return {
    completenessScore,
    confidenceDistribution: {
      mean: confidenceMean,
      std: confidenceStd,
    },
    riskCoverage,
    effortSpecificity,
    deliveryPlanQuality,
    briefToProposalAlignment,
  };
}

function totalScore(scores) {
  return clampScore(
    average([
      scores.completenessScore,
      scores.riskCoverage,
      scores.effortSpecificity,
      scores.deliveryPlanQuality,
      scores.briefToProposalAlignment,
    ])
  );
}

async function evaluate(proposal) {
  if (!proposal) return null;
  const proposalJSON = await getProposalJSONForRecord(proposal);
  const evalScores = buildEvalScores(proposal, proposalJSON);

  return ProposalEval.findOneAndUpdate(
    { proposalId: proposal.proposalId, generatedAt: proposal.updatedAt || proposal.createdAt },
    {
      proposalId: proposal.proposalId,
      userId: proposal.userId,
      workspaceId: proposal.workspaceId || null,
      generatedAt: proposal.updatedAt || proposal.createdAt || new Date(),
      modelUsed: proposal.modelUsed || '',
      briefScoreAtGeneration: proposal.briefScore || null,
      evalScores,
      totalEvalScore: totalScore(evalScores),
      briefLength: String(proposal.briefSnapshot || '').length,
      generationTimeMs: proposal.generationTimeMs || null,
      inputTokens: proposal.inputTokens || 0,
      outputTokens: proposal.outputTokens || 0,
      estimatedCostUsd: proposal.estimatedCostUsd || 0,
    },
    { upsert: true, new: true }
  );
}

async function getEvalTrends({ userId, workspaceId = null, days = 30 }) {
  const since = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000);
  const query = {
    generatedAt: { $gte: since },
    ...(workspaceId ? { workspaceId } : { userId }),
  };

  const evals = await ProposalEval.find(query).sort({ generatedAt: 1 }).lean();
  const grouped = new Map();

  for (const item of evals) {
    const key = new Date(item.generatedAt).toISOString().slice(0, 10);
    const current = grouped.get(key) || [];
    current.push(item);
    grouped.set(key, current);
  }

  const trends = Array.from(grouped.entries()).map(([date, records]) => ({
    date,
    count: records.length,
    averageTotalScore: Math.round(average(records.map((item) => item.totalEvalScore)) * 10) / 10,
    averageCompleteness: Math.round(average(records.map((item) => item.evalScores?.completenessScore || 0)) * 10) / 10,
    averageRiskCoverage: Math.round(average(records.map((item) => item.evalScores?.riskCoverage || 0)) * 10) / 10,
    averageAlignment: Math.round(average(records.map((item) => item.evalScores?.briefToProposalAlignment || 0)) * 10) / 10,
  }));

  return {
    totalRecords: evals.length,
    trends,
    latest: evals.at(-1) || null,
  };
}

module.exports = {
  buildEvalScores,
  evaluate,
  getEvalTrends,
  scoreBriefAlignment,
  totalScore,
};
