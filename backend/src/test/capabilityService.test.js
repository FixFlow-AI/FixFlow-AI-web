const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePlan,
  migrateLegacyPlan,
  getPersonalCapabilities,
  getWorkspaceCapabilities,
  assertCapability,
} = require('../services/capabilities/capabilityService');
const { ForbiddenError } = require('../utils/errors');

test('normalizePlan maps legacy and unknown plan values safely', () => {
  assert.equal(normalizePlan('enterprise'), 'scale');
  assert.equal(normalizePlan('standard'), 'pro');
  assert.equal(normalizePlan('unknown-plan'), 'free');
  assert.equal(migrateLegacyPlan('pro'), 'agency');
});

test('getPersonalCapabilities enables Agency Brain and TriProposal by plan tier', () => {
  assert.deepEqual(getPersonalCapabilities('free'), {
    normalizedPlan: 'free',
    agencyBrain: false,
    triProposal: false,
    bundleShare: false,
    dealRoom: false,
    freelancerOS: false,
    whiteLabel: false,
    apiAccess: false,
    auditLog: false,
    usageLimit: 5,
    proposalLimit: 5,
    unlimitedProposals: false,
  });

  assert.deepEqual(getPersonalCapabilities('pro'), {
    normalizedPlan: 'pro',
    agencyBrain: true,
    triProposal: true,
    bundleShare: true,
    dealRoom: true,
    freelancerOS: false,
    whiteLabel: false,
    apiAccess: false,
    auditLog: false,
    usageLimit: 50,
    proposalLimit: 50,
    unlimitedProposals: false,
  });

  assert.equal(getPersonalCapabilities('agency').proposalLimit, null);
  assert.equal(getPersonalCapabilities('solo').freelancerOS, true);
});

test('getWorkspaceCapabilities exposes collaboration by default and plan-gated advanced features', () => {
  assert.deepEqual(getWorkspaceCapabilities('free'), {
    normalizedPlan: 'free',
    agencyBrain: false,
    triProposal: false,
    bundleShare: false,
    dealRoom: false,
    freelancerOS: false,
    whiteLabel: false,
    apiAccess: false,
    auditLog: false,
    comments: true,
    presence: true,
    memberLimit: 2,
    unlimitedMembers: false,
  });

  assert.deepEqual(getWorkspaceCapabilities('pro'), {
    normalizedPlan: 'pro',
    agencyBrain: true,
    triProposal: true,
    bundleShare: true,
    dealRoom: true,
    freelancerOS: false,
    whiteLabel: false,
    apiAccess: false,
    auditLog: false,
    comments: true,
    presence: true,
    memberLimit: 5,
    unlimitedMembers: false,
  });

  assert.equal(getWorkspaceCapabilities('agency').memberLimit, null);
  assert.equal(getWorkspaceCapabilities('agency').unlimitedMembers, true);
});

test('assertCapability throws a ForbiddenError for disabled features', () => {
  assert.throws(
    () => assertCapability(false, 'Upgrade required'),
    (error) => error instanceof ForbiddenError && error.message === 'Upgrade required'
  );

  assert.doesNotThrow(() => assertCapability(true, 'Should not throw'));
});
