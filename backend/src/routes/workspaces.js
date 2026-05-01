const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const {
  workspaceCreateSchema,
  workspaceUpdateSchema,
  workspaceInviteSchema,
  workspaceRoleCreateSchema,
  workspaceRoleUpdateSchema,
  workspaceMemberRoleSchema,
} = require('../models/schemas');
const {
  createWorkspace,
  getCurrentWorkspaceForUser,
  buildWorkspaceSummary,
  assertWorkspaceMembership,
  assertWorkspacePermission,
  inviteToWorkspace,
  previewInvite,
  acceptInvite,
  removeWorkspaceMember,
  createWorkspaceRole,
  updateWorkspaceRole,
  deleteWorkspaceRole,
  assignWorkspaceMemberRole,
  WORKSPACE_PERMISSIONS,
  normalizeRoleDefinitions,
  getRoleName,
  getRolePermissions,
} = require('../services/workspace/workspaceService');
const { buildAuthProfile } = require('../services/auth/profileService');
const { createNotifications } = require('../services/notifications/notificationService');
const { normalizeNotificationPreferences } = require('../services/notifications/notificationPreferences');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

async function buildWorkspaceDetails(workspace) {
  if (!workspace) {
    return null;
  }

  const workspaceObject = workspace.toObject();
  delete workspaceObject.invitePending;
  if (workspaceObject.slack?.webhookUrlEncrypted) {
    delete workspaceObject.slack.webhookUrlEncrypted;
  }

  const memberIds = workspace.members.map((member) => member.userId);
  const inviteActorIds = (workspace.invitePending || [])
    .flatMap((invite) => [invite.inviterId, invite.acceptedBy])
    .filter(Boolean);
  const users = await User.find({ _id: { $in: [...new Set([...memberIds, ...inviteActorIds].map((id) => id.toString()))] } }).lean();
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  return {
    ...workspaceObject,
    notificationDefaults: normalizeNotificationPreferences(workspace.notificationDefaults),
    roles: normalizeRoleDefinitions(workspace.roleDefinitions),
    members: workspace.members.map((member) => ({
      userId: member.userId.toString(),
      role: member.role,
      roleName: getRoleName(workspace, member.role),
      permissions: getRolePermissions(workspace, member.role),
      joinedAt: member.joinedAt,
      invitedBy: member.invitedBy ? member.invitedBy.toString() : null,
      name: userMap.get(member.userId.toString())?.name || 'Workspace member',
      email: userMap.get(member.userId.toString())?.email || '',
      avatar: userMap.get(member.userId.toString())?.avatar || '',
    })),
    invites: [...(workspace.invitePending || [])]
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
      .map((invite) => ({
        inviteId: invite.inviteId,
        email: invite.email,
        role: invite.role,
        roleName: getRoleName(workspace, invite.role),
        status: invite.status || 'pending',
        createdAt: invite.createdAt || null,
        expiresAt: invite.expiresAt || null,
        acceptedAt: invite.acceptedAt || null,
        inviterId: invite.inviterId ? invite.inviterId.toString() : null,
        inviterName: userMap.get(invite.inviterId?.toString())?.name || invite.inviterName || 'Workspace owner',
        acceptedBy: invite.acceptedBy
          ? {
              userId: invite.acceptedBy.toString(),
              name: userMap.get(invite.acceptedBy.toString())?.name || 'Workspace member',
              email: userMap.get(invite.acceptedBy.toString())?.email || invite.email,
            }
          : null,
      })),
  };
}

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const payload = workspaceCreateSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    const workspace = await createWorkspace({ user, name: payload.name, plan: payload.plan });
    const profile = await buildAuthProfile(user);

    res.status(201).json({
      workspace: buildWorkspaceSummary(workspace, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(workspace),
      ...profile,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/current', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    res.json({
      workspace: buildWorkspaceSummary(workspace, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(workspace),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/current', authMiddleware, async (req, res, next) => {
  try {
    const payload = workspaceUpdateSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);

    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }

    const needsNotificationPermission = Boolean(payload.notificationDefaults) && !payload.name && !payload.plan && !payload.defaultEntryMode;
    await assertWorkspacePermission(
      req.user.userId,
      workspace._id,
      needsNotificationPermission ? 'notifications.manage' : 'workspace.settings.manage'
    );

    if (payload.name) {
      workspace.name = payload.name;
    }
    if (payload.plan) {
      workspace.plan = payload.plan;
    }
    if (payload.notificationDefaults) {
      workspace.notificationDefaults = normalizeNotificationPreferences(payload.notificationDefaults);
    }
    await workspace.save();

    if (payload.defaultEntryMode) {
      user.defaultEntryMode = payload.defaultEntryMode;
      await user.save();
    }

    res.json({
      workspace: buildWorkspaceSummary(workspace, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(workspace),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/current/invites', authMiddleware, async (req, res, next) => {
  try {
    const payload = workspaceInviteSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }
    const { workspace: scopedWorkspace } = await assertWorkspacePermission(req.user.userId, workspace._id, 'members.invite');
    const result = await inviteToWorkspace({ workspace: scopedWorkspace, inviter: user, email: payload.email, role: payload.role });

    const existingInvitee = await User.findOne({ email: payload.email.trim().toLowerCase() });
    const inviteRecipients = [
      existingInvitee?._id?.toString(),
      req.user.userId,
    ].filter(Boolean);

    await createNotifications({
      userIds: inviteRecipients,
      workspace: scopedWorkspace,
      type: 'invite',
      title: `Workspace invite sent`,
      body: existingInvitee
        ? `${user.name} invited ${existingInvitee.email} to ${scopedWorkspace.name} as ${payload.role}.`
        : `${payload.email} was invited to join ${scopedWorkspace.name} as ${payload.role}.`,
      metadata: {
        email: payload.email,
        role: payload.role,
      },
    }).catch(() => null);

    res.status(201).json({
      ...result,
      workspace: buildWorkspaceSummary(scopedWorkspace, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(scopedWorkspace),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/join/:token', async (req, res, next) => {
  try {
    const preview = await previewInvite(req.params.token);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

router.post('/join/:token', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const { workspace, invite } = await acceptInvite({ user, rawToken: req.params.token });
    const profile = await buildAuthProfile(user);

    const acceptedRecipients = [...new Set([
      workspace.ownerId?.toString(),
      invite?.inviterId?.toString(),
    ].filter((value) => value && value !== req.user.userId.toString()))];

    await createNotifications({
      userIds: acceptedRecipients,
      workspace,
      type: 'invite',
      title: `Workspace invite accepted`,
      body: `${user.name} joined ${workspace.name} as ${invite?.role || 'member'}.`,
      metadata: {
        acceptedBy: req.user.userId,
        role: invite?.role || 'editor',
      },
    }).catch(() => null);

    res.json({
      workspace: buildWorkspaceSummary(workspace, req.user.userId),
      ...profile,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/current/members/:memberUserId', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }
    const { workspace: scopedWorkspace } = await assertWorkspacePermission(req.user.userId, workspace._id, 'members.remove');
    const updated = await removeWorkspaceMember({ workspace: scopedWorkspace, memberUserId: req.params.memberUserId });

    res.json({
      workspace: buildWorkspaceSummary(updated, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(updated),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/current/roles', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }
    await assertWorkspacePermission(req.user.userId, workspace._id, 'workspace.view');

    res.json({
      permissions: WORKSPACE_PERMISSIONS,
      roles: normalizeRoleDefinitions(workspace.roleDefinitions),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/current/roles', authMiddleware, async (req, res, next) => {
  try {
    const payload = workspaceRoleCreateSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }
    const { workspace: scopedWorkspace } = await assertWorkspacePermission(req.user.userId, workspace._id, 'roles.manage');
    const updated = await createWorkspaceRole({ workspace: scopedWorkspace, ...payload });

    res.status(201).json({
      workspace: buildWorkspaceSummary(updated, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(updated),
      permissions: WORKSPACE_PERMISSIONS,
      roles: normalizeRoleDefinitions(updated.roleDefinitions),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/current/roles/:roleId', authMiddleware, async (req, res, next) => {
  try {
    const payload = workspaceRoleUpdateSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }
    const { workspace: scopedWorkspace } = await assertWorkspacePermission(req.user.userId, workspace._id, 'roles.manage');
    const updated = await updateWorkspaceRole({ workspace: scopedWorkspace, roleId: req.params.roleId, ...payload });

    res.json({
      workspace: buildWorkspaceSummary(updated, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(updated),
      permissions: WORKSPACE_PERMISSIONS,
      roles: normalizeRoleDefinitions(updated.roleDefinitions),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/current/roles/:roleId', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }
    const { workspace: scopedWorkspace } = await assertWorkspacePermission(req.user.userId, workspace._id, 'roles.manage');
    const updated = await deleteWorkspaceRole({ workspace: scopedWorkspace, roleId: req.params.roleId });

    res.json({
      workspace: buildWorkspaceSummary(updated, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(updated),
      permissions: WORKSPACE_PERMISSIONS,
      roles: normalizeRoleDefinitions(updated.roleDefinitions),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/current/members/:memberUserId/role', authMiddleware, async (req, res, next) => {
  try {
    const payload = workspaceMemberRoleSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    const workspace = await getCurrentWorkspaceForUser(user);
    if (!workspace) {
      throw new NotFoundError('No active workspace found.');
    }
    const { workspace: scopedWorkspace } = await assertWorkspacePermission(req.user.userId, workspace._id, 'members.role.assign');
    const updated = await assignWorkspaceMemberRole({
      workspace: scopedWorkspace,
      memberUserId: req.params.memberUserId,
      roleId: payload.role,
    });

    res.json({
      workspace: buildWorkspaceSummary(updated, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(updated),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
