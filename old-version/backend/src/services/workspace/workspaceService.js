const crypto = require('crypto');
const User = require('../../models/User');
const Workspace = require('../../models/Workspace');
const { normalizePlan, getWorkspaceCapabilities } = require('../capabilities/capabilityService');
const { sendWorkspaceInviteEmail } = require('./inviteEmailService');
const {
  normalizeNotificationPreferences,
} = require('../notifications/notificationPreferences');
const { BadRequestError, ConflictError, ForbiddenError, NotFoundError } = require('../../utils/errors');

const WORKSPACE_PERMISSIONS = Object.freeze([
  'workspace.view',
  'workspace.settings.manage',
  'members.invite',
  'members.remove',
  'members.role.assign',
  'roles.manage',
  'proposals.create',
  'proposals.edit',
  'proposals.comment',
  'proposals.share',
  'freelancer.view',
  'freelancer.manage',
  'slack.manage',
  'notifications.manage',
]);

const OWNER_PERMISSIONS = [...WORKSPACE_PERMISSIONS];
const EDITOR_PERMISSIONS = [
  'workspace.view',
  'members.invite',
  'proposals.create',
  'proposals.edit',
  'proposals.comment',
  'proposals.share',
  'freelancer.view',
  'freelancer.manage',
];
const VIEWER_PERMISSIONS = [
  'workspace.view',
  'proposals.comment',
  'freelancer.view',
];

const DEFAULT_WORKSPACE_ROLES = Object.freeze([
  { roleId: 'owner', name: 'Owner', permissions: OWNER_PERMISSIONS, system: true },
  { roleId: 'editor', name: 'Editor', permissions: EDITOR_PERMISSIONS, system: true },
  { roleId: 'viewer', name: 'Viewer', permissions: VIEWER_PERMISSIONS, system: true },
]);

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function cloneDefaultRoles() {
  return DEFAULT_WORKSPACE_ROLES.map((role) => ({
    roleId: role.roleId,
    name: role.name,
    permissions: [...role.permissions],
    system: role.system,
  }));
}

function normalizePermissions(permissions = []) {
  return [...new Set((Array.isArray(permissions) ? permissions : []).filter((permission) => WORKSPACE_PERMISSIONS.includes(permission)))];
}

function normalizeRoleDefinitions(roleDefinitions = []) {
  const roleMap = new Map();

  cloneDefaultRoles().forEach((role) => roleMap.set(role.roleId, role));

  (Array.isArray(roleDefinitions) ? roleDefinitions : []).forEach((role) => {
    if (!role?.roleId || role.roleId === 'owner') {
      return;
    }

    const isSystem = ['editor', 'viewer'].includes(role.roleId);
    roleMap.set(role.roleId, {
      roleId: String(role.roleId).trim(),
      name: String(role.name || role.roleId).trim().slice(0, 80),
      permissions: normalizePermissions(role.permissions),
      system: isSystem ? true : Boolean(role.system),
    });
  });

  return [...roleMap.values()];
}

function getRoleDefinition(workspace, roleId) {
  const roles = normalizeRoleDefinitions(workspace?.roleDefinitions);
  return roles.find((role) => role.roleId === roleId) || null;
}

function getRolePermissions(workspace, roleId) {
  if (roleId === 'owner') {
    return [...OWNER_PERMISSIONS];
  }

  return normalizePermissions((getRoleDefinition(workspace, roleId) || getRoleDefinition(workspace, 'viewer'))?.permissions || []);
}

function getRoleName(workspace, roleId) {
  return getRoleDefinition(workspace, roleId)?.name || roleId || 'Viewer';
}

function memberHasPermission(workspace, member, permission) {
  if (!member) {
    return false;
  }

  if (member.role === 'owner') {
    return true;
  }

  return getRolePermissions(workspace, member.role).includes(permission);
}

async function normalizeWorkspaceRoles(workspace) {
  if (!workspace) {
    return null;
  }

  const normalizedRoles = normalizeRoleDefinitions(workspace.roleDefinitions);
  const validRoleIds = new Set(normalizedRoles.map((role) => role.roleId));
  let changed = JSON.stringify(workspace.roleDefinitions || []) !== JSON.stringify(normalizedRoles);

  workspace.roleDefinitions = normalizedRoles;

  workspace.members.forEach((member) => {
    const expectedOwner = workspace.ownerId?.toString() === member.userId?.toString();
    if (expectedOwner && member.role !== 'owner') {
      member.role = 'owner';
      changed = true;
      return;
    }

    if (!validRoleIds.has(member.role)) {
      member.role = 'viewer';
      changed = true;
    }
  });

  (workspace.invitePending || []).forEach((invite) => {
    if (invite.role === 'owner' || !validRoleIds.has(invite.role)) {
      invite.role = 'viewer';
      changed = true;
    }
  });

  if (changed && typeof workspace.save === 'function') {
    await workspace.save();
  }

  return workspace;
}

function buildWorkspaceSummary(workspace, currentUserId = null) {
  if (!workspace) {
    return null;
  }

  const roles = normalizeRoleDefinitions(workspace.roleDefinitions);
  const member = currentUserId
    ? workspace.members.find((item) => item.userId.toString() === currentUserId.toString())
    : null;
  const permissions = member ? getRolePermissions({ roleDefinitions: roles }, member.role) : [];

  return {
    id: workspace._id.toString(),
    name: workspace.name,
    slug: workspace.slug,
    plan: normalizePlan(workspace.plan),
    ownerId: workspace.ownerId.toString(),
    memberCount: workspace.members.length,
    pendingInviteCount: (workspace.invitePending || []).filter((invite) => invite.status === 'pending').length,
    currentUserRole: member?.role || null,
    currentUserRoleName: member ? getRoleName({ roleDefinitions: roles }, member.role) : null,
    permissions,
    notificationDefaults: normalizeNotificationPreferences(workspace.notificationDefaults),
    capabilities: getWorkspaceCapabilities(workspace.plan),
  };
}

async function getWorkspaceForUser(userId, preferredWorkspaceId = null) {
  if (preferredWorkspaceId) {
    const workspace = await Workspace.findById(preferredWorkspaceId);
    if (workspace && workspace.members.some((member) => member.userId.toString() === userId.toString())) {
      return normalizeWorkspaceRoles(workspace);
    }
  }

  const workspace = await Workspace.findOne({ 'members.userId': userId }).sort({ updatedAt: -1 });
  return normalizeWorkspaceRoles(workspace);
}

async function getCurrentWorkspaceForUser(userOrUserId) {
  const user = typeof userOrUserId === 'string'
    ? await User.findById(userOrUserId)
    : userOrUserId;

  if (!user) {
    return null;
  }

  return getWorkspaceForUser(user._id || user.id, user.currentWorkspaceId || null);
}

async function assertWorkspaceMembership(userId, workspaceId, allowedRoles = null) {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  await normalizeWorkspaceRoles(workspace);

  const member = workspace.members.find((item) => item.userId.toString() === userId.toString());
  if (!member) {
    throw new ForbiddenError('You do not have access to this workspace');
  }

  if (allowedRoles && !allowedRoles.includes(member.role)) {
    throw new ForbiddenError('Your workspace role does not allow this action');
  }

  return {
    workspace,
    member,
  };
}

async function assertWorkspacePermission(userId, workspaceId, permission) {
  const { workspace, member } = await assertWorkspaceMembership(userId, workspaceId);

  if (!memberHasPermission(workspace, member, permission)) {
    throw new ForbiddenError('Your workspace role does not allow this action');
  }

  return {
    workspace,
    member,
    permissions: getRolePermissions(workspace, member.role),
  };
}

async function createWorkspace({ user, name, plan }) {
  const existingOwned = await Workspace.findOne({ ownerId: user._id || user.id });
  if (existingOwned) {
    throw new ConflictError('You already own a workspace. Update the existing workspace instead.');
  }

  const normalizedPlan = normalizePlan(plan || user.teamPlanPreference || user.plan);
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 1;

  while (await Workspace.exists({ slug })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const workspace = await Workspace.create({
    name,
    slug,
    ownerId: user._id || user.id,
    plan: normalizedPlan,
    notificationDefaults: normalizeNotificationPreferences(),
    roleDefinitions: cloneDefaultRoles(),
    members: [
      {
        userId: user._id || user.id,
        role: 'owner',
        joinedAt: new Date(),
        invitedBy: user._id || user.id,
      },
    ],
  });

  user.currentWorkspaceId = workspace._id;
  user.defaultEntryMode = 'team';
  user.teamPlanPreference = normalizedPlan;
  await user.save();

  return workspace;
}

function createInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashInviteToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function getPendingInviteByEmail(workspace, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return (workspace.invitePending || []).find(
    (entry) => entry.email === normalizedEmail && entry.status === 'pending'
  );
}

async function inviteToWorkspace({ workspace, inviter, email, role }) {
  await normalizeWorkspaceRoles(workspace);
  const capabilities = getWorkspaceCapabilities(workspace.plan);

  if (!capabilities.unlimitedMembers && workspace.members.length >= capabilities.memberLimit) {
    throw new BadRequestError(`Your ${workspace.plan} team plan supports up to ${capabilities.memberLimit} members.`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const roleDefinition = getRoleDefinition(workspace, role);
  if (!roleDefinition || roleDefinition.roleId === 'owner') {
    throw new BadRequestError('Choose a valid non-owner role for this invitation.');
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  const alreadyMember = existingUser
    ? workspace.members.some((member) => member.userId.toString() === existingUser._id.toString())
    : false;

  if (alreadyMember) {
    throw new ConflictError('This user is already in the workspace.');
  }

  const rawToken = createInviteToken();
  const inviteFields = {
    email: normalizedEmail,
    role,
    tokenHash: hashInviteToken(rawToken),
    inviterId: inviter._id,
    inviterName: inviter.name,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    status: 'pending',
    acceptedAt: null,
    acceptedBy: null,
  };

  const existingPendingInvite = getPendingInviteByEmail(workspace, normalizedEmail);
  if (existingPendingInvite) {
    Object.assign(existingPendingInvite, inviteFields);
  } else {
    workspace.invitePending.push({
      inviteId: crypto.randomUUID(),
      ...inviteFields,
    });
  }
  await workspace.save();

  const savedInvite = getPendingInviteByEmail(workspace, normalizedEmail);

  const mailResult = await sendWorkspaceInviteEmail({
    to: normalizedEmail,
    inviterName: inviter.name,
    workspaceName: workspace.name,
    role,
    rawToken,
  });

  return {
    invite: {
      inviteId: savedInvite?.inviteId || '',
      email: normalizedEmail,
      role,
      status: 'pending',
      createdAt: savedInvite?.createdAt || inviteFields.createdAt,
      expiresAt: savedInvite?.expiresAt || inviteFields.expiresAt,
      joinUrl: mailResult.joinUrl,
      emailDeliverySkipped: mailResult.skipped,
    },
  };
}

async function findPendingInviteByRawToken(rawToken) {
  const tokenHash = hashInviteToken(rawToken);
  return Workspace.findOne({ 'invitePending.tokenHash': tokenHash });
}

async function previewInvite(rawToken) {
  const workspace = await findPendingInviteByRawToken(rawToken);
  if (!workspace) {
    throw new NotFoundError('Workspace invite not found or expired');
  }
  await normalizeWorkspaceRoles(workspace);

  const invite = workspace.invitePending.find(
    (entry) => entry.tokenHash === hashInviteToken(rawToken) && entry.status === 'pending'
  );
  if (!invite || new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new NotFoundError('Workspace invite not found or expired');
  }

  return {
    workspaceId: workspace._id.toString(),
    workspaceName: workspace.name,
    role: invite.role,
    inviterName: invite.inviterName,
    expiresAt: invite.expiresAt,
  };
}

async function acceptInvite({ user, rawToken }) {
  const workspace = await findPendingInviteByRawToken(rawToken);
  if (!workspace) {
    throw new NotFoundError('Workspace invite not found or expired');
  }
  await normalizeWorkspaceRoles(workspace);

  const tokenHash = hashInviteToken(rawToken);
  const invite = workspace.invitePending.find(
    (entry) => entry.tokenHash === tokenHash && entry.status === 'pending'
  );
  if (!invite || new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new NotFoundError('Workspace invite not found or expired');
  }

  if ((invite.email || '').toLowerCase() !== (user.email || '').toLowerCase()) {
    throw new ForbiddenError('This invitation is for a different email address.');
  }

  if (!workspace.members.some((member) => member.userId.toString() === user._id.toString())) {
    const capabilities = getWorkspaceCapabilities(workspace.plan);
    if (!capabilities.unlimitedMembers && workspace.members.length >= capabilities.memberLimit) {
      throw new BadRequestError(`This workspace has reached the ${workspace.plan} plan member limit.`);
    }

    workspace.members.push({
      userId: user._id,
      role: invite.role,
      joinedAt: new Date(),
      invitedBy: invite.inviterId,
    });
  }

  invite.status = 'accepted';
  invite.acceptedAt = new Date();
  invite.acceptedBy = user._id;
  await workspace.save();

  user.currentWorkspaceId = workspace._id;
  user.defaultEntryMode = 'team';
  await user.save();

  return { workspace, invite };
}

async function removeWorkspaceMember({ workspace, memberUserId }) {
  await normalizeWorkspaceRoles(workspace);
  if (workspace.ownerId.toString() === memberUserId.toString()) {
    throw new BadRequestError('The workspace owner cannot be removed.');
  }

  const before = workspace.members.length;
  workspace.members = workspace.members.filter((member) => member.userId.toString() !== memberUserId.toString());
  if (workspace.members.length === before) {
    throw new NotFoundError('Workspace member not found.');
  }

  await workspace.save();

  await User.updateOne(
    { _id: memberUserId, currentWorkspaceId: workspace._id },
    { $set: { currentWorkspaceId: null, defaultEntryMode: 'individual' } }
  );

  return workspace;
}

function makeCustomRoleId(name) {
  const base = slugify(name) || 'custom-role';
  return `custom-${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function createWorkspaceRole({ workspace, name, permissions }) {
  await normalizeWorkspaceRoles(workspace);
  const roleId = makeCustomRoleId(name);
  workspace.roleDefinitions.push({
    roleId,
    name,
    permissions: normalizePermissions(permissions),
    system: false,
  });
  await workspace.save();
  return workspace;
}

async function updateWorkspaceRole({ workspace, roleId, name, permissions }) {
  await normalizeWorkspaceRoles(workspace);
  const role = workspace.roleDefinitions.find((entry) => entry.roleId === roleId);

  if (!role) {
    throw new NotFoundError('Workspace role not found.');
  }

  if (role.system) {
    throw new BadRequestError('Default workspace roles cannot be edited.');
  }

  if (name) {
    role.name = name;
  }

  if (permissions) {
    role.permissions = normalizePermissions(permissions);
  }

  await workspace.save();
  return workspace;
}

async function deleteWorkspaceRole({ workspace, roleId }) {
  await normalizeWorkspaceRoles(workspace);
  const role = workspace.roleDefinitions.find((entry) => entry.roleId === roleId);

  if (!role) {
    throw new NotFoundError('Workspace role not found.');
  }

  if (role.system) {
    throw new BadRequestError('Default workspace roles cannot be deleted.');
  }

  if (workspace.members.some((member) => member.role === roleId)) {
    throw new BadRequestError('Reassign members before deleting this role.');
  }

  workspace.roleDefinitions = workspace.roleDefinitions.filter((entry) => entry.roleId !== roleId);
  await workspace.save();
  return workspace;
}

async function assignWorkspaceMemberRole({ workspace, memberUserId, roleId }) {
  await normalizeWorkspaceRoles(workspace);
  const role = getRoleDefinition(workspace, roleId);
  if (!role) {
    throw new BadRequestError('Choose a valid workspace role.');
  }

  if (role.roleId === 'owner') {
    throw new BadRequestError('Ownership transfer is not available in this role editor.');
  }

  if (workspace.ownerId.toString() === memberUserId.toString()) {
    throw new BadRequestError('The workspace owner role cannot be changed.');
  }

  const member = workspace.members.find((entry) => entry.userId.toString() === memberUserId.toString());
  if (!member) {
    throw new NotFoundError('Workspace member not found.');
  }

  member.role = role.roleId;
  await workspace.save();
  return workspace;
}

module.exports = {
  slugify,
  buildWorkspaceSummary,
  WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
  cloneDefaultRoles,
  normalizePermissions,
  normalizeRoleDefinitions,
  normalizeWorkspaceRoles,
  getRoleDefinition,
  getRoleName,
  getRolePermissions,
  memberHasPermission,
  getWorkspaceForUser,
  getCurrentWorkspaceForUser,
  assertWorkspaceMembership,
  assertWorkspacePermission,
  createWorkspace,
  createWorkspaceRole,
  updateWorkspaceRole,
  deleteWorkspaceRole,
  assignWorkspaceMemberRole,
  inviteToWorkspace,
  previewInvite,
  acceptInvite,
  removeWorkspaceMember,
};
