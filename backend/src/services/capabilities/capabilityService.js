const { ForbiddenError } = require('../../utils/errors');

const PLAN_ORDER = {
  free: 0,
  standard: 1,
  pro: 2,
  enterprise: 2,
};

const PERSONAL_USAGE_LIMITS = {
  free: 10,
  standard: 50,
  pro: 250,
};

const TEAM_MEMBER_LIMITS = {
  free: 2,
  standard: 5,
  pro: 10,
};

function normalizePlan(plan = 'free') {
  if (plan === 'enterprise') {
    return 'pro';
  }

  return ['free', 'standard', 'pro'].includes(plan) ? plan : 'free';
}

function getPlanRank(plan) {
  return PLAN_ORDER[plan] ?? 0;
}

function getPersonalCapabilities(plan = 'free') {
  const normalized = normalizePlan(plan);
  const rank = getPlanRank(normalized);

  return {
    normalizedPlan: normalized,
    agencyBrain: rank >= 1,
    triProposal: rank >= 2,
    bundleShare: rank >= 2,
    usageLimit: PERSONAL_USAGE_LIMITS[normalized],
  };
}

function getWorkspaceCapabilities(plan = 'free') {
  const normalized = normalizePlan(plan);
  const rank = getPlanRank(normalized);

  return {
    normalizedPlan: normalized,
    agencyBrain: rank >= 1,
    triProposal: rank >= 2,
    bundleShare: rank >= 2,
    comments: true,
    presence: true,
    memberLimit: TEAM_MEMBER_LIMITS[normalized],
  };
}

function assertCapability(enabled, message) {
  if (!enabled) {
    throw new ForbiddenError(message);
  }
}

module.exports = {
  normalizePlan,
  getPlanRank,
  getPersonalCapabilities,
  getWorkspaceCapabilities,
  assertCapability,
  PERSONAL_USAGE_LIMITS,
  TEAM_MEMBER_LIMITS,
};
