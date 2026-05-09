const { getPersonalCapabilities, getWorkspaceCapabilities, normalizePlan } = require('../capabilities/capabilityService');
const { getCurrentWorkspaceForUser, buildWorkspaceSummary } = require('../workspace/workspaceService');
const { normalizeNotificationPreferences } = require('../notifications/notificationPreferences');
const { buildUsageSummary, normalizeUsageFields } = require('../billing/planEnforcer');

async function buildAuthProfile(user) {
  const currentWorkspace = await getCurrentWorkspaceForUser(user);
  normalizeUsageFields(user);
  const normalizedPlan = normalizePlan(user.plan);
  const usage = buildUsageSummary(user);

  const authUser = {
    ...user.toJSON(),
    plan: normalizedPlan,
    proposalsThisMonth: usage.proposalsThisMonth,
    proposalLimit: usage.proposalLimit,
    usageLimit: usage.usageLimit,
    resetDate: usage.resetDate,
    billingUsage: usage,
    notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences),
    capabilities: getPersonalCapabilities(normalizedPlan),
    teamPlanCapabilities: getWorkspaceCapabilities(user.teamPlanPreference || 'free'),
  };

  return {
    user: authUser,
    currentWorkspace: buildWorkspaceSummary(currentWorkspace, user._id),
  };
}

module.exports = {
  buildAuthProfile,
};
