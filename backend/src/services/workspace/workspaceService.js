const crypto = require('crypto');
const User = require('../../models/User');
const Workspace = require('../../models/Workspace');
const { normalizePlan, getWorkspaceCapabilities } = require('../capabilities/capabilityService');
const { sendWorkspaceInviteEmail } = require('./inviteEmailService');
const { BadRequestError, ConflictError, ForbiddenError, NotFoundError } = require('../../utils/errors');

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildWorkspaceSummary(workspace, currentUserId = null) {
  if (!workspace) {
    return null;
  }

  const member = currentUserId
    ? workspace.members.find((item) => item.userId.toString() === currentUserId.toString())
    : null;

  return {
    id: workspace._id.toString(),
    name: workspace.name,
    slug: workspace.slug,
    plan: normalizePlan(workspace.plan),
    ownerId: workspace.ownerId.toString(),
    memberCount: workspace.members.length,
    currentUserRole: member?.role || null,
    capabilities: getWorkspaceCapabilities(workspace.plan),
  };
}

async function getWorkspaceForUser(userId, preferredWorkspaceId = null) {
  if (preferredWorkspaceId) {
    const workspace = await Workspace.findById(preferredWorkspaceId);
    if (workspace && workspace.members.some((member) => member.userId.toString() === userId.toString())) {
      return workspace;
    }
  }

  return Workspace.findOne({ 'members.userId': userId }).sort({ updatedAt: -1 });
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

async function inviteToWorkspace({ workspace, inviter, email, role }) {
  const capabilities = getWorkspaceCapabilities(workspace.plan);

  if (workspace.members.length >= capabilities.memberLimit) {
    throw new BadRequestError(`Your ${workspace.plan} team plan supports up to ${capabilities.memberLimit} members.`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  const alreadyMember = existingUser
    ? workspace.members.some((member) => member.userId.toString() === existingUser._id.toString())
    : false;

  if (alreadyMember) {
    throw new ConflictError('This user is already in the workspace.');
  }

  const rawToken = createInviteToken();
  const invite = {
    email: normalizedEmail,
    role,
    tokenHash: hashInviteToken(rawToken),
    inviterId: inviter._id,
    inviterName: inviter.name,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  };

  workspace.invitePending = (workspace.invitePending || []).filter((entry) => entry.email !== normalizedEmail);
  workspace.invitePending.push(invite);
  await workspace.save();

  const mailResult = await sendWorkspaceInviteEmail({
    to: normalizedEmail,
    inviterName: inviter.name,
    workspaceName: workspace.name,
    role,
    rawToken,
  });

  return {
    invite: {
      email: normalizedEmail,
      role,
      expiresAt: invite.expiresAt,
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

  const invite = workspace.invitePending.find((entry) => entry.tokenHash === hashInviteToken(rawToken));
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
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

  const tokenHash = hashInviteToken(rawToken);
  const invite = workspace.invitePending.find((entry) => entry.tokenHash === tokenHash);
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new NotFoundError('Workspace invite not found or expired');
  }

  if ((invite.email || '').toLowerCase() !== (user.email || '').toLowerCase()) {
    throw new ForbiddenError('This invitation is for a different email address.');
  }

  if (!workspace.members.some((member) => member.userId.toString() === user._id.toString())) {
    const capabilities = getWorkspaceCapabilities(workspace.plan);
    if (workspace.members.length >= capabilities.memberLimit) {
      throw new BadRequestError(`This workspace has reached the ${workspace.plan} plan member limit.`);
    }

    workspace.members.push({
      userId: user._id,
      role: invite.role,
      joinedAt: new Date(),
      invitedBy: invite.inviterId,
    });
  }

  workspace.invitePending = workspace.invitePending.filter((entry) => entry.tokenHash !== tokenHash);
  await workspace.save();

  user.currentWorkspaceId = workspace._id;
  user.defaultEntryMode = 'team';
  await user.save();

  return workspace;
}

async function removeWorkspaceMember({ workspace, memberUserId }) {
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

module.exports = {
  slugify,
  buildWorkspaceSummary,
  getWorkspaceForUser,
  getCurrentWorkspaceForUser,
  assertWorkspaceMembership,
  createWorkspace,
  inviteToWorkspace,
  previewInvite,
  acceptInvite,
  removeWorkspaceMember,
};
