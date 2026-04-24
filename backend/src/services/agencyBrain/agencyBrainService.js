const Proposal = require('../../models/Proposal');
const AgencyPattern = require('../../models/AgencyPattern');
const s3Service = require('../storage/s3');
const { calculateProposalConfidence } = require('../proposal/proposalAccess');
const { inferSignalsFromProposal, buildBriefSignals } = require('./briefSignalService');
const { techStackWinRate } = require('../../utils/patternExtractors/techStackWinRate');
const { effortCalibrationDelta } = require('../../utils/patternExtractors/effortCalibrationDelta');
const { featureCountCorrelation } = require('../../utils/patternExtractors/featureCountCorrelation');
const { confidenceThreshold } = require('../../utils/patternExtractors/confidenceThreshold');
const { industryWinRate } = require('../../utils/patternExtractors/industryClassifier');
const { normalizePlan } = require('../capabilities/capabilityService');
const { assertWorkspaceMembership } = require('../workspace/workspaceService');

function getStrength(sampleSize) {
  if (sampleSize > 15) {
    return 'Confirmed';
  }
  if (sampleSize >= 5) {
    return 'Emerging';
  }
  return 'Anecdotal';
}

async function loadProposalRecords(proposals) {
  return Promise.all(
    proposals.map(async (proposal) => {
      try {
        const proposalJSON = proposal.s3Key ? await s3Service.getProposalJSON(proposal.s3Key) : {};
        const signals = inferSignalsFromProposal(proposal, proposalJSON);

        return {
          proposal,
          proposalJSON,
          status: proposal.dealStatus,
          confidenceScore: calculateProposalConfidence(proposalJSON),
          featureCount: Array.isArray(proposalJSON.features) ? proposalJSON.features.length : 0,
          techTags: signals.tech,
          industryTags: signals.industries,
          effortEntries: proposalJSON.effort || [],
        };
      } catch {
        return {
          proposal,
          proposalJSON: {},
          status: proposal.dealStatus,
          confidenceScore: 0,
          featureCount: 0,
          techTags: proposal.briefSignals?.tech || [],
          industryTags: proposal.briefSignals?.industries || [],
          effortEntries: [],
        };
      }
    })
  );
}

function buildInsights(patterns, sampleSize) {
  const strength = getStrength(sampleSize);
  const insights = [];

  const topTech = patterns.techStackWinRate?.[0];
  if (topTech) {
    insights.push({
      id: `tech-${topTech.tag}`,
      category: 'tech',
      title: `Your ${topTech.tag} proposals win at ${topTech.winRate}%`,
      recommendation: `Lean into ${topTech.tag} when the brief leaves technology choices open.`,
      calibrationText: `This team performs strongly on ${topTech.tag} work (${topTech.winRate}% historical win rate across ${topTech.total} proposals). Prefer it when the brief allows.`,
      sampleSize: topTech.total,
      strength,
      data: topTech,
    });
  }

  const topEffort = patterns.effortCalibrationDelta?.find((item) => Math.abs(item.delta) >= 0.5);
  if (topEffort) {
    insights.push({
      id: `effort-${topEffort.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      category: 'effort',
      title: `${topEffort.label} estimates trend ${topEffort.delta > 0 ? 'higher' : 'lower'} in won proposals`,
      recommendation: `Adjust ${topEffort.label} estimates by roughly ${Math.abs(topEffort.delta)} weeks when similar scope appears.`,
      calibrationText: `Historically, won proposals estimate ${topEffort.label} about ${Math.abs(topEffort.delta)} weeks ${topEffort.delta > 0 ? 'higher' : 'lower'} than lost proposals.`,
      sampleSize,
      strength,
      data: topEffort,
    });
  }

  const featurePattern = patterns.featureCountCorrelation;
  if (featurePattern?.optimalRange?.[1]) {
    insights.push({
      id: 'feature-count-window',
      category: 'scope',
      title: `Won proposals cluster around ${featurePattern.optimalRange[0]}-${featurePattern.optimalRange[1]} features`,
      recommendation: 'Phase or simplify very large briefs before generating the final pitch.',
      calibrationText: `Won proposals typically land in the ${featurePattern.optimalRange[0]}-${featurePattern.optimalRange[1]} feature range. Flag scope inflation when the current brief exceeds that.`,
      sampleSize,
      strength,
      data: featurePattern,
    });
  }

  const confidencePattern = patterns.confidenceThreshold;
  if (confidencePattern?.threshold) {
    insights.push({
      id: 'confidence-threshold',
      category: 'confidence',
      title: `Confidence above ${confidencePattern.threshold}% performs better historically`,
      recommendation: 'Use the confidence threshold as a pre-send quality bar before sharing the proposal.',
      calibrationText: `Historically, proposals above about ${confidencePattern.threshold}% confidence perform better. Aim to keep the current proposal above that threshold.`,
      sampleSize,
      strength,
      data: confidencePattern,
    });
  }

  const topIndustry = patterns.industryWinRate?.[0];
  if (topIndustry) {
    insights.push({
      id: `industry-${topIndustry.industry}`,
      category: 'industry',
      title: `${topIndustry.industry} is a strong-fit category at ${topIndustry.winRate}% win rate`,
      recommendation: `Emphasize domain confidence and relevant delivery patterns for ${topIndustry.industry} briefs.`,
      calibrationText: `This agency has a strong historical win pattern in ${topIndustry.industry} work (${topIndustry.winRate}% win rate).`,
      sampleSize: topIndustry.total,
      strength,
      data: topIndustry,
    });
  }

  return insights;
}

async function getScopedProposals({ userId, workspaceId = null }) {
  if (workspaceId) {
    const { workspace } = await assertWorkspaceMembership(userId, workspaceId, ['owner', 'editor', 'viewer']);
    const proposals = await Proposal.find({
      workspaceId: workspace._id,
      status: 'complete',
      dealStatus: { $in: ['won', 'lost'] },
    }).sort({ createdAt: -1 });

    return {
      scopeType: 'workspace',
      workspace,
      proposals,
    };
  }

  const proposals = await Proposal.find({
    userId,
    workspaceId: null,
    status: 'complete',
    dealStatus: { $in: ['won', 'lost'] },
  }).sort({ createdAt: -1 });

  return {
    scopeType: 'personal',
    workspace: null,
    proposals,
  };
}

async function analyzeAgencyPatterns({ userId, workspaceId = null }) {
  const scoped = await getScopedProposals({ userId, workspaceId });
  const records = await loadProposalRecords(scoped.proposals);
  const sampleSize = records.length;

  const patterns = {
    techStackWinRate: techStackWinRate(records),
    effortCalibrationDelta: effortCalibrationDelta(records),
    featureCountCorrelation: featureCountCorrelation(records),
    confidenceThreshold: confidenceThreshold(records),
    industryWinRate: industryWinRate(records),
  };

  const insights = buildInsights(patterns, sampleSize);

  const query = scoped.scopeType === 'workspace'
    ? { scopeType: 'workspace', workspaceId: scoped.workspace._id }
    : { scopeType: 'personal', ownerUserId: userId };

  const update = {
    ...query,
    sampleSize,
    analyzedAt: new Date(),
    patterns,
    insights,
  };

  const document = await AgencyPattern.findOneAndUpdate(
    query,
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    scopeType: scoped.scopeType,
    workspaceId: scoped.workspace?._id?.toString() || null,
    sampleSize,
    analyzedAt: document.analyzedAt,
    patterns,
    insights,
    insufficientData: sampleSize < 3,
  };
}

async function getLatestAgencyPatterns({ userId, workspaceId = null }) {
  if (workspaceId) {
    const { workspace } = await assertWorkspaceMembership(userId, workspaceId, ['owner', 'editor', 'viewer']);
    const document = await AgencyPattern.findOne({ scopeType: 'workspace', workspaceId: workspace._id }).lean();
    return document || null;
  }

  return AgencyPattern.findOne({ scopeType: 'personal', ownerUserId: userId }).lean();
}

function scoreInsightRelevance(insight, signals, featureGuess = 0) {
  let score = 1;

  if (insight.category === 'tech') {
    const tag = insight.data?.tag;
    if (tag && signals.tech.includes(tag)) {
      score += 4;
    }
  }

  if (insight.category === 'industry') {
    const industry = insight.data?.industry;
    if (industry && signals.industries.includes(industry)) {
      score += 4;
    }
  }

  if (insight.category === 'scope' && featureGuess) {
    const [min, max] = insight.data?.optimalRange || [];
    if (featureGuess < min || featureGuess > max) {
      score += 3;
    }
  }

  if (insight.category === 'effort') {
    const label = String(insight.data?.label || '').toLowerCase();
    if (signals.keywords.some((keyword) => label.includes(keyword) || keyword.includes(label.split(' ')[0] || ''))) {
      score += 3;
    }
  }

  if (insight.category === 'confidence') {
    score += 2;
  }

  score += Math.min(insight.sampleSize || 0, 20) / 10;

  return score;
}

function estimateFeatureGuess(briefText = '') {
  const matches = String(briefText || '').match(/,| and | plus | integration| dashboard| portal| workflow| report/gi) || [];
  return Math.max(3, Math.min(15, matches.length + 3));
}

async function buildCalibrationPayload({ userId, workspaceId = null, briefText = '' }) {
  const document = await getLatestAgencyPatterns({ userId, workspaceId });
  if (!document) {
    return {
      analyzedAt: null,
      sampleSize: 0,
      signals: buildBriefSignals(briefText),
      insights: [],
      calibrationContext: '',
    };
  }

  const signals = buildBriefSignals(briefText);
  const featureGuess = estimateFeatureGuess(briefText);
  const selectedInsights = (document.insights || [])
    .map((insight) => ({
      ...insight,
      relevanceScore: scoreInsightRelevance(insight, signals, featureGuess),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);

  return {
    analyzedAt: document.analyzedAt,
    sampleSize: document.sampleSize || 0,
    signals,
    insights: selectedInsights,
    calibrationContext: selectedInsights.map((insight) => `- ${insight.calibrationText}`).join('\n'),
  };
}

async function refreshAgencyPatternsForProposal(proposal) {
  if (!proposal) {
    return null;
  }

  return analyzeAgencyPatterns({
    userId: proposal.userId.toString(),
    workspaceId: proposal.workspaceId ? proposal.workspaceId.toString() : null,
  });
}

module.exports = {
  analyzeAgencyPatterns,
  getLatestAgencyPatterns,
  buildCalibrationPayload,
  refreshAgencyPatternsForProposal,
  buildInsights,
  normalizePlan,
};
