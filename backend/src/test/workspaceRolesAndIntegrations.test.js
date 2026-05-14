const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-16';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-16';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
process.env.INTEGRATION_SECRET = process.env.INTEGRATION_SECRET || 'test-integration-secret-at-least-16';

const {
  decryptSecret,
  encryptSecret,
  signState,
  verifyState,
} = require('../services/integrations/secretCrypto');
const {
  buildSlackMessage,
  validateSlackState,
} = require('../services/integrations/slackService');
const s3Service = require('../services/storage/s3');
const {
  memberHasPermission,
  normalizePermissions,
  normalizeRoleDefinitions,
  normalizeWorkspaceRoles,
} = require('../services/workspace/workspaceService');

test('workspace role normalization preserves defaults and custom permissions', async () => {
  const workspace = {
    ownerId: { toString: () => 'owner-1' },
    roleDefinitions: [
      { roleId: 'custom-qa', name: 'QA Lead', permissions: ['workspace.view', 'proposals.comment', 'unknown'] },
    ],
    members: [
      { userId: { toString: () => 'owner-1' }, role: 'viewer' },
      { userId: { toString: () => 'member-1' }, role: 'custom-qa' },
      { userId: { toString: () => 'member-2' }, role: 'missing-role' },
    ],
    invitePending: [{ role: 'missing-role' }],
  };

  await normalizeWorkspaceRoles(workspace);

  const roles = normalizeRoleDefinitions(workspace.roleDefinitions);
  assert.ok(roles.some((role) => role.roleId === 'owner'));
  assert.ok(roles.some((role) => role.roleId === 'custom-qa'));
  assert.deepEqual(normalizePermissions(['workspace.view', 'unknown']), ['workspace.view']);
  assert.equal(workspace.members[0].role, 'owner');
  assert.equal(workspace.members[2].role, 'viewer');
  assert.equal(workspace.invitePending[0].role, 'viewer');
  assert.equal(memberHasPermission(workspace, workspace.members[1], 'proposals.comment'), true);
  assert.equal(memberHasPermission(workspace, workspace.members[1], 'roles.manage'), false);
});

test('avatar upload helpers enforce image ownership and supported types', async () => {
  assert.doesNotThrow(() => s3Service.assertOwnedAvatarKey('user-1', 'avatars/user-1/123.webp'));
  assert.throws(() => s3Service.assertOwnedAvatarKey('user-1', 'avatars/user-2/123.webp'));
  await assert.rejects(() => s3Service.generateAvatarUploadUrl('user-1', 'application/octet-stream', 'avatar.png'));
  assert.equal(s3Service.getAvatarMimeTypeFromKey('avatars/user-1/123.png'), 'image/png');
  assert.equal(s3Service.buildAvatarUrl('user-1', 'avatars/user-1/123.jpg'), '/api/auth/avatar/user-1/123.jpg');
});

test('integration secrets encrypt and signed state round-trips', () => {
  const encrypted = encryptSecret('https://hooks.slack.com/services/T/B/X');
  assert.notEqual(encrypted, 'https://hooks.slack.com/services/T/B/X');
  assert.equal(decryptSecret(encrypted), 'https://hooks.slack.com/services/T/B/X');

  const state = signState({ workspaceId: 'workspace-1', userId: 'user-1' });
  assert.deepEqual(verifyState(state), { workspaceId: 'workspace-1', userId: 'user-1' });
  assert.throws(() => verifyState(`${state}tampered`));
});

test('Slack message builder includes accessible fallback text and action link', () => {
  const message = buildSlackMessage({
    title: 'Proposal assignment updated',
    body: 'Roadmap is ready for review.',
    metadata: { proposal: 'Roadmap', status: 'assigned' },
    frontendPath: '/workspace',
  });

  assert.match(message.text, /Proposal assignment updated/);
  assert.ok(message.blocks.some((block) => block.type === 'actions'));
  assert.equal(message.unfurl_links, false);
});

test('Slack state validation rejects expired install state', () => {
  const now = Date.now();
  const validState = signState({ workspaceId: 'workspace-1', userId: 'user-1', createdAt: now });
  assert.deepEqual(validateSlackState(validState, now), {
    workspaceId: 'workspace-1',
    userId: 'user-1',
    createdAt: now,
  });

  const expiredState = signState({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    createdAt: now - 11 * 60 * 1000,
  });
  assert.throws(() => validateSlackState(expiredState, now), /expired/);
});
