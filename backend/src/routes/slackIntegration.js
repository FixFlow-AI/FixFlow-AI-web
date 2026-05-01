const express = require('express');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { authMiddleware } = require('../middleware/auth');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { buildFrontendUrl } = require('../utils/frontendOrigin');
const {
  assertWorkspacePermission,
  getCurrentWorkspaceForUser,
} = require('../services/workspace/workspaceService');
const {
  buildSlackInstallUrl,
  buildSlackMessage,
  buildSlackStatus,
  exchangeSlackCode,
  installSlackOnWorkspace,
  sendSlackWebhook,
  verifyState,
} = require('../services/integrations/slackService');
const { decryptSecret } = require('../services/integrations/secretCrypto');

const router = express.Router();

async function getScopedWorkspace(userId) {
  const user = await User.findById(userId);
  const workspace = await getCurrentWorkspaceForUser(user);
  if (!workspace) {
    throw new NotFoundError('No active workspace found.');
  }
  return workspace;
}

router.get('/install-url', authMiddleware, async (req, res, next) => {
  try {
    const workspace = await getScopedWorkspace(req.user.userId);
    await assertWorkspacePermission(req.user.userId, workspace._id, 'slack.manage');
    res.json({
      installUrl: buildSlackInstallUrl({
        workspaceId: workspace._id,
        userId: req.user.userId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    if (typeof req.query.error === 'string') {
      throw new BadRequestError(`Slack OAuth failed: ${req.query.error}`);
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      throw new BadRequestError('Missing Slack OAuth callback fields.');
    }

    const payload = verifyState(state);
    const workspace = await Workspace.findById(payload.workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found.');
    }
    await assertWorkspacePermission(payload.userId, workspace._id, 'slack.manage');

    const oauthPayload = await exchangeSlackCode(code);
    await installSlackOnWorkspace({
      workspace,
      installerId: payload.userId,
      oauthPayload,
    });

    res.redirect(302, buildFrontendUrl('/workspace/settings', { slack: 'connected' }));
  } catch (error) {
    if (res.headersSent) {
      next(error);
      return;
    }

    res.redirect(302, buildFrontendUrl('/workspace/settings', {
      slack_error: error.message || 'Slack connection failed',
    }));
  }
});

router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const workspace = await getScopedWorkspace(req.user.userId);
    await assertWorkspacePermission(req.user.userId, workspace._id, 'workspace.view');
    res.json({ slack: buildSlackStatus(workspace) });
  } catch (error) {
    next(error);
  }
});

router.post('/test', authMiddleware, async (req, res, next) => {
  try {
    const workspace = await getScopedWorkspace(req.user.userId);
    await assertWorkspacePermission(req.user.userId, workspace._id, 'slack.manage');
    if (!workspace.slack?.webhookUrlEncrypted) {
      throw new BadRequestError('Slack is not connected for this workspace.');
    }

    const message = buildSlackMessage({
      title: 'FixFlowAI Slack test',
      body: `${req.user.name || req.user.email} sent a test notification from ${workspace.name}.`,
      metadata: {
        workspace: workspace.name,
        channel: workspace.slack.channelName || workspace.slack.channelId,
      },
      frontendPath: '/workspace/settings',
    });

    const result = await sendSlackWebhook(decryptSecret(workspace.slack.webhookUrlEncrypted), message);
    workspace.slack.status = 'connected';
    workspace.slack.lastDeliveryStatus = result;
    workspace.slack.lastDeliveryAt = new Date();
    await workspace.save();

    res.json({ slack: buildSlackStatus(workspace) });
  } catch (error) {
    next(error);
  }
});

router.delete('/', authMiddleware, async (req, res, next) => {
  try {
    const workspace = await getScopedWorkspace(req.user.userId);
    await assertWorkspacePermission(req.user.userId, workspace._id, 'slack.manage');
    workspace.slack = {
      status: 'disconnected',
      teamId: '',
      teamName: '',
      channelId: '',
      channelName: '',
      webhookUrlEncrypted: '',
      installedBy: null,
      installedAt: null,
      lastDeliveryStatus: '',
      lastDeliveryAt: null,
    };
    await workspace.save();
    res.json({ slack: buildSlackStatus(workspace) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
