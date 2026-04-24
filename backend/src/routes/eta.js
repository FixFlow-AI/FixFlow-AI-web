const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { proposalEtaSchema, chatEtaSchema } = require('../models/schemas');
const { assertWorkspaceMembership } = require('../services/workspace/workspaceService');
const { getProposalAccessContext } = require('../services/proposal/proposalAccess');
const { buildProposalEta, buildChatEta } = require('../services/eta/etaService');

const router = express.Router();

router.post('/proposal', authMiddleware, async (req, res, next) => {
  try {
    const payload = proposalEtaSchema.parse(req.body);

    if (payload.workspaceId) {
      await assertWorkspaceMembership(req.user.userId, payload.workspaceId, ['owner', 'editor', 'viewer']);
    }

    const eta = await buildProposalEta({
      userId: req.user.userId,
      workspaceId: payload.workspaceId,
      briefText: payload.briefText,
      fileKey: payload.fileKey,
      strategy: payload.strategy,
      isTriMode: payload.isTriMode,
    });

    res.json(eta);
  } catch (error) {
    next(error);
  }
});

router.post('/chat', authMiddleware, async (req, res, next) => {
  try {
    const payload = chatEtaSchema.parse(req.body);
    const { proposal } = await getProposalAccessContext(req.user.userId, payload.proposalId);
    const eta = await buildChatEta({
      proposal,
      message: payload.message,
      intent: payload.intent,
      targetSection: payload.targetSection,
    });

    res.json(eta);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
