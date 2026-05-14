const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-16';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-16';

const { ForbiddenError, BadRequestError } = require('../utils/errors');
const {
  FREELANCER_GITHUB_ONLY_MESSAGE,
  applyAuthMetadata,
  assertPlanAllowedForRole,
  assertProviderAllowedForRole,
  assertRoleMatchesUser,
  inferUserRole,
  normalizeSelectedPlanForRole,
} = require('../services/auth/authRules');

test('freelancer accounts reject email and google providers', () => {
  assert.throws(
    () => assertProviderAllowedForRole('freelancer', 'email'),
    (error) => error instanceof ForbiddenError && error.message === FREELANCER_GITHUB_ONLY_MESSAGE
  );
  assert.throws(
    () => assertProviderAllowedForRole('freelancer', 'google'),
    (error) => error instanceof ForbiddenError && error.message === FREELANCER_GITHUB_ONLY_MESSAGE
  );
});

test('freelancer github signup metadata is accepted with a freelancer plan', () => {
  const user = { email: 'dev@example.com' };
  applyAuthMetadata(user, {
    role: 'freelancer',
    selectedPlan: 'solo',
    authProvider: 'github',
    githubUsername: 'octo-dev',
  });

  assert.equal(user.role, 'freelancer');
  assert.equal(user.selectedPlan, 'solo');
  assert.equal(user.plan, 'solo');
  assert.equal(user.authProvider, 'github');
  assert.equal(user.githubUsername, 'octo-dev');
});

test('client and developer allow email google and github providers', () => {
  for (const role of ['client', 'developer']) {
    for (const provider of ['email', 'google', 'github']) {
      assert.doesNotThrow(() => assertProviderAllowedForRole(role, provider));
    }
  }
});

test('invalid role plan combinations are rejected', () => {
  assert.throws(() => assertPlanAllowedForRole('freelancer', 'pro'), BadRequestError);
  assert.throws(() => assertPlanAllowedForRole('client', 'solo'), BadRequestError);
  assert.throws(() => assertPlanAllowedForRole('developer', 'solo'), BadRequestError);
});

test('login role mismatch is rejected', () => {
  assert.throws(
    () => assertRoleMatchesUser({ role: 'developer', selectedPlan: 'pro' }, 'client'),
    ForbiddenError
  );
  assert.equal(assertRoleMatchesUser({ role: 'developer', selectedPlan: 'pro' }, 'developer'), 'developer');
});

test('legacy users default to client unless a freelancer-only plan exists', () => {
  assert.equal(inferUserRole({ plan: 'free' }), 'client');
  assert.equal(inferUserRole({ plan: 'solo' }), 'freelancer');
  assert.equal(normalizeSelectedPlanForRole('client', 'solo'), 'free');
});
