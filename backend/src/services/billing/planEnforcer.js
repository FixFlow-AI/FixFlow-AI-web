const { ForbiddenError } = require('../../utils/errors');
const {
  getPersonalCapabilities,
  normalizePlan,
} = require('../capabilities/capabilityService');

function nextMonthlyResetDate(now = new Date()) {
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

function normalizeUsageFields(user, now = new Date()) {
  const capabilities = getPersonalCapabilities(user.plan);
  const resetDate = user.resetDate ? new Date(user.resetDate) : null;

  user.plan = normalizePlan(user.plan);
  user.usageLimit = capabilities.usageLimit;
  user.proposalLimit = capabilities.proposalLimit;

  if (!resetDate || resetDate.getTime() <= now.getTime()) {
    user.proposalsThisMonth = 0;
    user.usageCount = 0;
    user.resetDate = nextMonthlyResetDate(now);
  }

  if (typeof user.proposalsThisMonth !== 'number') {
    user.proposalsThisMonth = Number(user.usageCount || 0);
  }

  return user;
}

function buildUsageSummary(user) {
  const capabilities = getPersonalCapabilities(user.plan);
  const used = Number(user.proposalsThisMonth || user.usageCount || 0);
  const limit = capabilities.proposalLimit;

  return {
    plan: capabilities.normalizedPlan,
    proposalsUsed: used,
    proposalsThisMonth: used,
    proposalLimit: limit,
    usageLimit: limit,
    unlimited: capabilities.unlimitedProposals,
    resetDate: user.resetDate || null,
    remaining: capabilities.unlimitedProposals ? null : Math.max(0, Number(limit || 0) - used),
    nearLimit: !capabilities.unlimitedProposals && Number(limit || 0) > 0 && used / Number(limit) >= 0.8,
    limitReached: !capabilities.unlimitedProposals && Number(limit || 0) > 0 && used >= Number(limit),
  };
}

async function assertCanCreateProposal(user) {
  normalizeUsageFields(user);
  const usage = buildUsageSummary(user);

  if (usage.limitReached) {
    throw new ForbiddenError(`Your ${usage.plan} plan includes ${usage.proposalLimit} proposals per month. Upgrade to continue generating proposals.`);
  }

  await user.save();
  return usage;
}

async function incrementProposalUsage(user) {
  normalizeUsageFields(user);
  user.proposalsThisMonth = Number(user.proposalsThisMonth || 0) + 1;
  user.usageCount = user.proposalsThisMonth;
  await user.save();
  return buildUsageSummary(user);
}

async function resetMonthlyProposalUsage(user, now = new Date()) {
  normalizeUsageFields(user, now);
  user.proposalsThisMonth = 0;
  user.usageCount = 0;
  user.resetDate = nextMonthlyResetDate(now);
  await user.save();
  return buildUsageSummary(user);
}

module.exports = {
  assertCanCreateProposal,
  buildUsageSummary,
  incrementProposalUsage,
  nextMonthlyResetDate,
  normalizeUsageFields,
  resetMonthlyProposalUsage,
};
