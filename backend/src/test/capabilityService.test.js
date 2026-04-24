const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePlan,
  getPersonalCapabilities,
  getWorkspaceCapabilities,
  assertCapability,
} = require('../services/capabilities/capabilityService');
const { ForbiddenError } = require('../utils/errors');

test('normalizePlan maps legacy enterprise users onto pro safely', () => {
  assert.equal(normalizePlan('enterprise'), 'pro');
  assert.equal(normalizePlan('standard'), 'standard');
  assert.equal(normalizePlan('unknown-plan'), 'free');
});

test('getPersonalCapabilities enables Agency Brain and TriProposal by plan tier', () => {
  assert.deepEqual(getPersonalCapabilities('free'), {
    normalizedPlan: 'free',
    agencyBrain: false,
    triProposal: false,
    bundleShare: false,
    usageLimit: 10,
  });

  assert.deepEqual(getPersonalCapabilities('standard'), {
    normalizedPlan: 'standard',
    agencyBrain: true,
    triProposal: false,
    bundleShare: false,
    usageLimit: 50,
  });

  assert.deepEqual(getPersonalCapabilities('pro'), {
    normalizedPlan: 'pro',
    agencyBrain: true,
    triProposal: true,
    bundleShare: true,
    usageLimit: 250,
  });
});

test('getWorkspaceCapabilities exposes collaboration by default and plan-gated advanced features', () => {
  assert.deepEqual(getWorkspaceCapabilities('free'), {
    normalizedPlan: 'free',
    agencyBrain: false,
    triProposal: false,
    bundleShare: false,
    comments: true,
    presence: true,
    memberLimit: 2,
  });

  assert.deepEqual(getWorkspaceCapabilities('pro'), {
    normalizedPlan: 'pro',
    agencyBrain: true,
    triProposal: true,
    bundleShare: true,
    comments: true,
    presence: true,
    memberLimit: 10,
  });
});

test('assertCapability throws a ForbiddenError for disabled features', () => {
  assert.throws(
    () => assertCapability(false, 'Upgrade required'),
    (error) => error instanceof ForbiddenError && error.message === 'Upgrade required'
  );

  assert.doesNotThrow(() => assertCapability(true, 'Should not throw'));
});
