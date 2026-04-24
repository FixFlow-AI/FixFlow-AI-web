const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const {
  workspaceCreateSchema,
  workspaceUpdateSchema,
  workspaceInviteSchema,
} = require('../models/schemas');
const {
  createWorkspace,
  getCurrentWorkspaceForUser,
  buildWorkspaceSummary,
  assertWorkspaceMembership,
  inviteToWorkspace,
  previewInvite,
  acceptInvite,
  removeWorkspaceMember,
} = require('../services/workspace/workspaceService');
const { buildAuthProfile } = require('../services/auth/profileService');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

async function buildWorkspaceDetails(workspace) {
  if (!workspace) {
    return null;
  }

  const memberIds = workspace.members.map((member) => member.userId);
  const inviteActorIds = (workspace.invitePending || [])
    .flatMap((invite) => [invite.inviterId, invite.acceptedBy])
    .filter(Boolean);
  const users = await User.find({ _id: { $in: [...new Set([...memberIds, ...inviteActorIds].map((id) => id.toString()))] } }).lean();
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  return {
    ...workspace.toObject(),
    members: workspace.members.map((member) => ({
      userId: member.userId.toString(),
      role: member.role,
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

    await assertWorkspaceMembership(req.user.userId, workspace._id, ['owner']);

    if (payload.name) {
      workspace.name = payload.name;
    }
    if (payload.plan) {
      workspace.plan = payload.plan;
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
    const { workspace: scopedWorkspace } = await assertWorkspaceMembership(req.user.userId, workspace._id, ['owner', 'editor']);
    const result = await inviteToWorkspace({ workspace: scopedWorkspace, inviter: user, email: payload.email, role: payload.role });
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
    const workspace = await acceptInvite({ user, rawToken: req.params.token });
    const profile = await buildAuthProfile(user);

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
    const { workspace: scopedWorkspace } = await assertWorkspaceMembership(req.user.userId, workspace._id, ['owner']);
    const updated = await removeWorkspaceMember({ workspace: scopedWorkspace, memberUserId: req.params.memberUserId });

    res.json({
      workspace: buildWorkspaceSummary(updated, req.user.userId),
      fullWorkspace: await buildWorkspaceDetails(updated),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
