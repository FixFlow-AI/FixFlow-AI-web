const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  portalUpsertSchema,
  dealStatusSchema,
  outcomeRequestSchema,
  outcomeSendSchema,
} = require('../models/schemas');
const { getPortalForProposal, upsertPortal } = require('../services/portal/portalService');
const { generateOutcome, sendOutcomeEmail } = require('../services/proposal/outcomeService');
const { getEditableProposal } = require('../services/proposal/proposalAccess');
const { refreshAgencyPatternsForProposal } = require('../services/agencyBrain/agencyBrainService');

const router = express.Router();

router.get('/:id/portal', authMiddleware, async (req, res, next) => {
  try {
    const portal = await getPortalForProposal(req.user.userId, req.params.id);
    res.json({ portal });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/portal', authMiddleware, async (req, res, next) => {
  try {
    const payload = portalUpsertSchema.parse(req.body);
    const portal = await upsertPortal({
      userId: req.user.userId,
      proposalId: req.params.id,
      ...payload,
    });
    res.json({ portal });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/deal-status', authMiddleware, async (req, res, next) => {
  try {
    const payload = dealStatusSchema.parse(req.body);
    const proposal = await getEditableProposal(req.user.userId, req.params.id);

    proposal.dealStatus = payload.dealStatus;
    proposal.dealStatusUpdatedAt = new Date();
    proposal.lossReason = payload.dealStatus === 'lost' ? payload.lossReason : '';

    if (payload.dealStatus !== 'won') {
      proposal.wonOutcome = null;
    }

    if (payload.dealStatus !== 'lost') {
      proposal.lostOutcome = null;
    }

    await proposal.save();
    await refreshAgencyPatternsForProposal(proposal).catch(() => null);

    res.json({
      success: true,
      proposal: {
        proposalId: proposal.proposalId,
        dealStatus: proposal.dealStatus,
        dealStatusUpdatedAt: proposal.dealStatusUpdatedAt,
        lossReason: proposal.lossReason,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/outcome', authMiddleware, async (req, res, next) => {
  try {
    const payload = outcomeRequestSchema.parse(req.body);
    const result = await generateOutcome({
      userId: req.user.userId,
      proposalId: req.params.id,
      ...payload,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/outcome/send', authMiddleware, async (req, res, next) => {
  try {
    const payload = outcomeSendSchema.parse(req.body);
    const result = await sendOutcomeEmail({
      userId: req.user.userId,
      proposalId: req.params.id,
      ...payload,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
