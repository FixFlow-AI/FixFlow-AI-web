const { ForbiddenError } = require('../../utils/errors');

const CANONICAL_PLANS = ['free', 'pro', 'agency', 'solo', 'scale'];
const LEGACY_PLAN_MIGRATION = {
  standard: 'pro',
  pro: 'agency',
  enterprise: 'scale',
};
const LEGACY_PLAN_COMPATIBILITY = {
  standard: 'pro',
  enterprise: 'scale',
};

const PLAN_ORDER = {
  free: 0,
  solo: 1,
  pro: 2,
  agency: 3,
  scale: 4,
};

const PERSONAL_PROPOSAL_LIMITS = {
  free: 5,
  solo: 50,
  pro: 50,
  agency: null,
  scale: null,
};

const TEAM_MEMBER_LIMITS = {
  free: 2,
  solo: 1,
  pro: 5,
  agency: null,
  scale: null,
};

function normalizePlan(plan = 'free') {
  if (CANONICAL_PLANS.includes(plan)) {
    return plan;
  }

  return LEGACY_PLAN_COMPATIBILITY[plan] || 'free';
}

function migrateLegacyPlan(plan = 'free') {
  return LEGACY_PLAN_MIGRATION[plan] || normalizePlan(plan);
}

function getPlanRank(plan) {
  return PLAN_ORDER[normalizePlan(plan)] ?? 0;
}

function isUnlimited(limit) {
  return limit === null;
}

function getPersonalCapabilities(plan = 'free') {
  const normalized = normalizePlan(plan);
  const rank = getPlanRank(normalized);
  const isAgencyTier = rank >= PLAN_ORDER.agency;
  const isProTier = rank >= PLAN_ORDER.pro;

  return {
    normalizedPlan: normalized,
    agencyBrain: isProTier || normalized === 'scale',
    triProposal: isProTier || normalized === 'scale',
    bundleShare: isProTier || normalized === 'scale',
    dealRoom: isProTier || normalized === 'agency' || normalized === 'scale',
    freelancerOS: ['solo', 'agency', 'scale'].includes(normalized),
    whiteLabel: isAgencyTier,
    apiAccess: isAgencyTier,
    auditLog: normalized === 'scale',
    usageLimit: PERSONAL_PROPOSAL_LIMITS[normalized],
    proposalLimit: PERSONAL_PROPOSAL_LIMITS[normalized],
    unlimitedProposals: isUnlimited(PERSONAL_PROPOSAL_LIMITS[normalized]),
  };
}

function getWorkspaceCapabilities(plan = 'free') {
  const normalized = normalizePlan(plan);
  const rank = getPlanRank(normalized);
  const memberLimit = TEAM_MEMBER_LIMITS[normalized];
  const isAgencyTier = rank >= PLAN_ORDER.agency;
  const isProTier = rank >= PLAN_ORDER.pro;

  return {
    normalizedPlan: normalized,
    agencyBrain: isProTier || normalized === 'scale',
    triProposal: isProTier || normalized === 'scale',
    bundleShare: isProTier || normalized === 'scale',
    dealRoom: isProTier || normalized === 'agency' || normalized === 'scale',
    freelancerOS: ['agency', 'scale'].includes(normalized),
    whiteLabel: isAgencyTier,
    apiAccess: isAgencyTier,
    auditLog: normalized === 'scale',
    comments: true,
    presence: true,
    memberLimit,
    unlimitedMembers: isUnlimited(memberLimit),
  };
}

function assertCapability(enabled, message) {
  if (!enabled) {
    throw new ForbiddenError(message);
  }
}

module.exports = {
  CANONICAL_PLANS,
  LEGACY_PLAN_MIGRATION,
  normalizePlan,
  migrateLegacyPlan,
  getPlanRank,
  getPersonalCapabilities,
  getWorkspaceCapabilities,
  assertCapability,
  PERSONAL_PROPOSAL_LIMITS,
  TEAM_MEMBER_LIMITS,
};
