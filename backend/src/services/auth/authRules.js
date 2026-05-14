const { BadRequestError, ForbiddenError } = require('../../utils/errors');
const { normalizePlan } = require('../capabilities/capabilityService');

const AUTH_ROLES = ['freelancer', 'client', 'developer'];
const AUTH_PROVIDERS = ['email', 'google', 'github'];
const FREELANCER_GITHUB_ONLY_MESSAGE = 'Freelancer accounts can only be accessed using GitHub login.';

const ROLE_PLAN_OPTIONS = {
  freelancer: ['free', 'solo', 'agency'],
  client: ['free', 'pro', 'agency'],
  developer: ['free', 'pro', 'agency'],
};

const ROLE_PROVIDER_OPTIONS = {
  freelancer: ['github'],
  client: ['email', 'google', 'github'],
  developer: ['email', 'google', 'github'],
};

function normalizeRole(role) {
  return AUTH_ROLES.includes(role) ? role : 'client';
}

function inferUserRole(user = {}) {
  if (AUTH_ROLES.includes(user.role)) {
    return user.role;
  }

  const selectedPlan = normalizePlan(user.selectedPlan || user.plan || 'free');
  if (selectedPlan === 'solo') {
    return 'freelancer';
  }

  return 'client';
}

function normalizeSelectedPlanForRole(role, selectedPlan = 'free') {
  const normalizedRole = normalizeRole(role);
  const normalizedPlan = normalizePlan(selectedPlan);
  const allowedPlans = ROLE_PLAN_OPTIONS[normalizedRole] || ROLE_PLAN_OPTIONS.client;

  if (allowedPlans.includes(normalizedPlan)) {
    return normalizedPlan;
  }

  return 'free';
}

function assertValidRole(role) {
  if (!AUTH_ROLES.includes(role)) {
    throw new BadRequestError('Choose a valid account role.');
  }
  return role;
}

function assertProviderAllowedForRole(role, provider) {
  assertValidRole(role);
  if (!AUTH_PROVIDERS.includes(provider)) {
    throw new BadRequestError('Choose a valid authentication provider.');
  }

  if (!ROLE_PROVIDER_OPTIONS[role].includes(provider)) {
    if (role === 'freelancer') {
      throw new ForbiddenError(FREELANCER_GITHUB_ONLY_MESSAGE);
    }
    throw new ForbiddenError('This authentication method is not available for the selected role.');
  }
}

function assertPlanAllowedForRole(role, selectedPlan) {
  assertValidRole(role);
  const normalizedPlan = normalizePlan(selectedPlan);
  if (!ROLE_PLAN_OPTIONS[role].includes(normalizedPlan)) {
    throw new BadRequestError('Choose a plan that matches the selected role.');
  }
  return normalizedPlan;
}

function assertRoleMatchesUser(user, requestedRole) {
  const actualRole = inferUserRole(user);
  if (requestedRole && actualRole !== requestedRole) {
    throw new ForbiddenError(`This account is registered as ${actualRole}. Select the correct role to continue.`);
  }
  return actualRole;
}

function applyAuthMetadata(user, { role, selectedPlan, authProvider, githubUsername, googleId } = {}) {
  const resolvedRole = role ? assertValidRole(role) : inferUserRole(user);
  const resolvedPlan = selectedPlan
    ? assertPlanAllowedForRole(resolvedRole, selectedPlan)
    : normalizeSelectedPlanForRole(resolvedRole, user.selectedPlan || user.plan || 'free');
  const resolvedProvider = authProvider || user.authProvider || (user.githubId ? 'github' : 'email');

  assertProviderAllowedForRole(resolvedRole, resolvedProvider);

  user.role = resolvedRole;
  user.selectedPlan = resolvedPlan;
  user.plan = resolvedPlan;
  user.authProvider = resolvedProvider;
  if (githubUsername !== undefined) user.githubUsername = githubUsername || '';
  if (googleId !== undefined) user.googleId = googleId || '';

  return user;
}

function getRoleDashboardPath(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'freelancer') return '/freelancer';
  if (normalizedRole === 'developer') return '/developer';
  return '/dashboard';
}

module.exports = {
  AUTH_PROVIDERS,
  AUTH_ROLES,
  FREELANCER_GITHUB_ONLY_MESSAGE,
  ROLE_PLAN_OPTIONS,
  ROLE_PROVIDER_OPTIONS,
  applyAuthMetadata,
  assertPlanAllowedForRole,
  assertProviderAllowedForRole,
  assertRoleMatchesUser,
  assertValidRole,
  getRoleDashboardPath,
  inferUserRole,
  normalizeRole,
  normalizeSelectedPlanForRole,
};
