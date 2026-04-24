const { getPersonalCapabilities, getWorkspaceCapabilities, normalizePlan } = require('../capabilities/capabilityService');
const { getCurrentWorkspaceForUser, buildWorkspaceSummary } = require('../workspace/workspaceService');

async function buildAuthProfile(user) {
  const currentWorkspace = await getCurrentWorkspaceForUser(user);
  const normalizedPlan = normalizePlan(user.plan);

  const authUser = {
    ...user.toJSON(),
    plan: normalizedPlan,
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
