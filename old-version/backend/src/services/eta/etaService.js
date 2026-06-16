const Proposal = require('../../models/Proposal');
const { env } = require('../../config/env');
const { inferInputType } = require('../brief/briefHydrationService');
const { getGeminiModelCandidates } = require('../llm/geminiGuard');
const { geminiModelCoordinator } = require('../llm/modelCoordinator');

const GENERATION_BASE_SECONDS = {
  text: 24,
  txt: 22,
  pdf: 34,
  docx: 32,
};

const STRATEGY_SECONDS = {
  lean: -3,
  standard: 0,
  premium: 7,
};

const CHAT_BASE_SECONDS = {
  question: 9,
  mutate: 18,
};

const CHAT_SECTION_SECONDS = {
  summary: -1,
  features: 4,
  risks: 2,
  timeline: 3,
  effort: 3,
  market: 2,
  impact: 1,
};

function countWords(text = '') {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function roundSeconds(value) {
  return Math.max(4, Math.round(Number(value) || 0));
}

function buildRange(estimatedSeconds, confidence = 'low') {
  const spreadRatio = confidence === 'high' ? 0.18 : confidence === 'medium' ? 0.28 : 0.38;
  const spreadSeconds = Math.max(3, Math.round(estimatedSeconds * spreadRatio));

  return {
    minSeconds: Math.max(4, estimatedSeconds - spreadSeconds),
    maxSeconds: estimatedSeconds + spreadSeconds,
  };
}

function getQueueDelaySeconds(models = []) {
  const waitMs = geminiModelCoordinator.getEarliestAvailabilityDelayMs(models);
  return Math.max(0, Math.ceil(waitMs / 1000));
}

function getHistorySummary(samples = []) {
  const normalized = samples
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (!normalized.length) {
    return {
      sampleSize: 0,
      medianSeconds: null,
      averageSeconds: null,
    };
  }

  const middle = Math.floor(normalized.length / 2);
  const medianMs = normalized.length % 2 === 0
    ? (normalized[middle - 1] + normalized[middle]) / 2
    : normalized[middle];
  const averageMs = normalized.reduce((sum, value) => sum + value, 0) / normalized.length;

  return {
    sampleSize: normalized.length,
    medianSeconds: roundSeconds(medianMs / 1000),
    averageSeconds: roundSeconds(averageMs / 1000),
  };
}

function blendEstimate({ heuristicSeconds, historySummary }) {
  if (!historySummary?.sampleSize) {
    return {
      estimatedSeconds: heuristicSeconds,
      confidence: 'low',
      basis: 'heuristic',
      sampleSize: 0,
    };
  }

  if (historySummary.sampleSize >= 8) {
    return {
      estimatedSeconds: roundSeconds(historySummary.medianSeconds * 0.8 + heuristicSeconds * 0.2),
      confidence: 'high',
      basis: 'history',
      sampleSize: historySummary.sampleSize,
    };
  }

  return {
    estimatedSeconds: roundSeconds(historySummary.medianSeconds * 0.55 + heuristicSeconds * 0.45),
    confidence: 'medium',
    basis: 'blended',
    sampleSize: historySummary.sampleSize,
  };
}

function buildGenerationHeuristic({ inputType, strategy = 'standard', wordCount = 0, isTriMode = false, workspaceId = null }) {
  const base = GENERATION_BASE_SECONDS[inputType] || GENERATION_BASE_SECONDS.text;
  let estimate = base + (STRATEGY_SECONDS[strategy] || 0);

  if (wordCount >= 1800) {
    estimate += 14;
  } else if (wordCount >= 1000) {
    estimate += 9;
  } else if (wordCount >= 450) {
    estimate += 4;
  } else if (wordCount > 0 && wordCount < 150) {
    estimate -= 3;
  }

  if (workspaceId) {
    estimate += 2;
  }

  if (isTriMode) {
    const lean = buildGenerationHeuristic({ inputType, strategy: 'lean', wordCount, workspaceId });
    const standard = buildGenerationHeuristic({ inputType, strategy: 'standard', wordCount, workspaceId });
    const premium = buildGenerationHeuristic({ inputType, strategy: 'premium', wordCount, workspaceId });

    return Math.max(lean, standard, premium) + 4;
  }

  return roundSeconds(estimate);
}

function buildChatHeuristic({ message = '', intent = 'question', targetSection = null }) {
  let estimate = CHAT_BASE_SECONDS[intent] || CHAT_BASE_SECONDS.question;
  const messageLength = String(message || '').trim().length;

  if (messageLength >= 900) {
    estimate += 7;
  } else if (messageLength >= 450) {
    estimate += 4;
  } else if (messageLength >= 180) {
    estimate += 2;
  } else if (messageLength > 0 && messageLength < 80) {
    estimate -= 1;
  }

  if (intent === 'mutate' && targetSection) {
    estimate += CHAT_SECTION_SECONDS[targetSection] || 0;
  }

  return roundSeconds(estimate);
}

async function getGenerationSamples({ userId, workspaceId = null, strategy, inputType }) {
  const scopeQuery = workspaceId
    ? { workspaceId }
    : { userId, workspaceId: null };

  const exact = await Proposal.find({
    ...scopeQuery,
    status: 'complete',
    generationTimeMs: { $ne: null },
    strategy,
    inputType,
  })
    .sort({ createdAt: -1 })
    .limit(12)
    .select('generationTimeMs')
    .lean();

  if (exact.length >= 3) {
    return exact.map((proposal) => proposal.generationTimeMs);
  }

  const broader = await Proposal.find({
    ...scopeQuery,
    status: 'complete',
    generationTimeMs: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('generationTimeMs')
    .lean();

  return broader.map((proposal) => proposal.generationTimeMs);
}

function getProposalChatStats(proposal, intent, targetSection = null) {
  const stats = proposal?.chatTimingStats || {};

  if (intent === 'mutate' && targetSection && stats.sections?.[targetSection]?.count >= 2) {
    const sectionStats = stats.sections[targetSection];
    return {
      sampleSize: sectionStats.count,
      medianSeconds: roundSeconds(sectionStats.totalMs / sectionStats.count / 1000),
      averageSeconds: roundSeconds(sectionStats.totalMs / sectionStats.count / 1000),
    };
  }

  const bucket = stats[intent];
  if (!bucket?.count) {
    return {
      sampleSize: 0,
      medianSeconds: null,
      averageSeconds: null,
    };
  }

  return {
    sampleSize: bucket.count,
    medianSeconds: roundSeconds(bucket.totalMs / bucket.count / 1000),
    averageSeconds: roundSeconds(bucket.totalMs / bucket.count / 1000),
  };
}

async function buildProposalEta({ userId, workspaceId = null, briefText = '', fileKey = null, strategy = 'standard', isTriMode = false }) {
  const inputType = inferInputType({ briefText, fileKey });
  const wordCount = countWords(briefText);
  const heuristicSeconds = buildGenerationHeuristic({ inputType, strategy, wordCount, isTriMode, workspaceId });
  const sampleMs = await getGenerationSamples({
    userId,
    workspaceId,
    strategy: isTriMode ? 'standard' : strategy,
    inputType,
  });
  const historySummary = getHistorySummary(sampleMs);
  const blended = blendEstimate({ heuristicSeconds, historySummary });
  const queueDelaySeconds = getQueueDelaySeconds(
    getGeminiModelCandidates(env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL, env.GEMINI_MODEL_FALLBACKS)
  );
  const estimatedSeconds = blended.estimatedSeconds + queueDelaySeconds;
  const range = buildRange(estimatedSeconds, blended.confidence);

  return {
    type: 'proposal',
    inputType,
    strategy: isTriMode ? 'tri' : strategy,
    isTriMode,
    wordCount,
    estimatedSeconds,
    queueDelaySeconds,
    basis: blended.basis,
    confidence: blended.confidence,
    sampleSize: blended.sampleSize,
    ...range,
  };
}

async function buildChatEta({ proposal, message = '', intent = 'question', targetSection = null }) {
  const heuristicSeconds = buildChatHeuristic({ message, intent, targetSection });
  const historySummary = getProposalChatStats(proposal, intent, targetSection);
  const blended = blendEstimate({ heuristicSeconds, historySummary });
  const queueDelaySeconds = getQueueDelaySeconds(
    getGeminiModelCandidates(env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL, env.GEMINI_MODEL_FALLBACKS)
  );
  const estimatedSeconds = blended.estimatedSeconds + queueDelaySeconds;
  const range = buildRange(estimatedSeconds, blended.confidence);

  return {
    type: 'chat',
    intent,
    targetSection,
    estimatedSeconds,
    queueDelaySeconds,
    basis: blended.basis,
    confidence: blended.confidence,
    sampleSize: blended.sampleSize,
    ...range,
  };
}

async function recordChatTiming({ proposal, intent = 'question', targetSection = null, durationMs }) {
  const nextStats = {
    question: { count: 0, totalMs: 0, lastMs: null },
    mutate: { count: 0, totalMs: 0, lastMs: null },
    sections: {},
    ...(proposal.chatTimingStats || {}),
  };

  const intentBucket = {
    count: Number(nextStats[intent]?.count || 0) + 1,
    totalMs: Number(nextStats[intent]?.totalMs || 0) + Number(durationMs || 0),
    lastMs: Number(durationMs || 0),
  };
  nextStats[intent] = intentBucket;

  if (intent === 'mutate' && targetSection) {
    const sectionBucket = nextStats.sections?.[targetSection] || { count: 0, totalMs: 0, lastMs: null };
    nextStats.sections = {
      ...(nextStats.sections || {}),
      [targetSection]: {
        count: Number(sectionBucket.count || 0) + 1,
        totalMs: Number(sectionBucket.totalMs || 0) + Number(durationMs || 0),
        lastMs: Number(durationMs || 0),
      },
    };
  }

  proposal.chatTimingStats = nextStats;
  proposal.markModified('chatTimingStats');
  await proposal.save();
}

module.exports = {
  countWords,
  buildGenerationHeuristic,
  buildChatHeuristic,
  buildRange,
  getHistorySummary,
  blendEstimate,
  buildProposalEta,
  buildChatEta,
  recordChatTiming,
};
