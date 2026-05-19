const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  dealRoomAnnotationSchema,
  dealRoomTierSelectionSchema,
} = require('../models/schemas');
const {
  createAnnotation,
  getTierSelection,
  listAnnotations,
  listAnnotationsForProposal,
  setTierSelection,
} = require('../services/portal/dealRoomService');
const { getProposalAccessContext } = require('../services/proposal/proposalAccess');
const { publicPortalLimiter } = require('../middleware/rateLimit');

const publicDealRoomRouter = express.Router();
const proposalDealRoomRouter = express.Router();

publicDealRoomRouter.use(publicPortalLimiter);

publicDealRoomRouter.get('/:token/deal-room/annotations', async (req, res, next) => {
  try {
    res.json(await listAnnotations(req.params.token));
  } catch (error) {
    next(error);
  }
});

publicDealRoomRouter.post('/:token/deal-room/annotations', async (req, res, next) => {
  try {
    const payload = dealRoomAnnotationSchema.parse(req.body);
    res.status(201).json(await createAnnotation(req.params.token, payload));
  } catch (error) {
    next(error);
  }
});

publicDealRoomRouter.get('/:token/deal-room/tier-selection', async (req, res, next) => {
  try {
    res.json(await getTierSelection(req.params.token));
  } catch (error) {
    next(error);
  }
});

publicDealRoomRouter.post('/:token/deal-room/tier-selection', async (req, res, next) => {
  try {
    const payload = dealRoomTierSelectionSchema.parse(req.body);
    res.json(await setTierSelection(req.params.token, payload));
  } catch (error) {
    next(error);
  }
});

proposalDealRoomRouter.get('/:proposalId/deal-room/annotations', authMiddleware, async (req, res, next) => {
  try {
    await getProposalAccessContext(req.user.userId, req.params.proposalId);
    res.json(await listAnnotationsForProposal(req.params.proposalId));
  } catch (error) {
    next(error);
  }
});

module.exports = {
  publicDealRoomRouter,
  proposalDealRoomRouter,
};
