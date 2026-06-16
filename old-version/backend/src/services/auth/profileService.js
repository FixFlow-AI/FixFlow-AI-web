const { getPersonalCapabilities, getWorkspaceCapabilities, normalizePlan } = require('../capabilities/capabilityService');
const { getCurrentWorkspaceForUser, buildWorkspaceSummary } = require('../workspace/workspaceService');
const { normalizeNotificationPreferences } = require('../notifications/notificationPreferences');
const { buildUsageSummary, normalizeUsageFields } = require('../billing/planEnforcer');
const { inferUserRole, normalizeSelectedPlanForRole } = require('./authRules');

async function buildAuthProfile(user) {
  const currentWorkspace = await getCurrentWorkspaceForUser(user);
  const role = inferUserRole(user);
  const normalizedPlan = normalizeSelectedPlanForRole(role, user.selectedPlan || user.plan || 'free');
  user.role = role;
  user.selectedPlan = normalizedPlan;
  user.plan = normalizedPlan;
  normalizeUsageFields(user);
  const usage = buildUsageSummary(user);

  const authUser = {
    ...user.toJSON(),
    role,
    selectedPlan: normalizedPlan,
    authProvider: user.authProvider || (user.githubId ? 'github' : user.googleId ? 'google' : 'email'),
    githubUsername: user.githubUsername || '',
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
