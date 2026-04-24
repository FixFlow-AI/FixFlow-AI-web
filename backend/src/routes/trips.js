const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { tripBundlePortalSchema } = require('../models/schemas');
const { getOwnedTrip } = require('../services/trips/tripService');
const { getProposalAccessContext, getProposalJSONForRecord } = require('../services/proposal/proposalAccess');
const { upsertBundlePortal } = require('../services/portal/portalService');
const { getPersonalCapabilities, getWorkspaceCapabilities, assertCapability } = require('../services/capabilities/capabilityService');

const router = express.Router();

router.get('/:tripId', authMiddleware, async (req, res, next) => {
  try {
    const trip = await getOwnedTrip(req.params.tripId, req.user.userId);
    const proposals = await Promise.all(
      trip.proposals.map(async (entry) => {
        const { proposal, workspace } = await getProposalAccessContext(req.user.userId, entry.proposalId);
        const data = proposal.s3Key ? await getProposalJSONForRecord(proposal) : null;
        return {
          proposalId: proposal.proposalId,
          title: proposal.title,
          strategy: proposal.strategy || entry.strategy,
          status: proposal.status,
          workspace: workspace
            ? { id: workspace._id.toString(), name: workspace.name, plan: workspace.plan }
            : null,
          data,
        };
      })
    );

    res.json({
      tripId: trip.tripId,
      proposals,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:tripId/portal', authMiddleware, async (req, res, next) => {
  try {
    const payload = tripBundlePortalSchema.parse(req.body);
    const trip = await getOwnedTrip(req.params.tripId, req.user.userId);
    const selectedEntries = trip.proposals.filter((entry) => payload.proposalIds.includes(entry.proposalId));
    const accessContexts = await Promise.all(
      selectedEntries.map((entry) => getProposalAccessContext(req.user.userId, entry.proposalId))
    );

    const workspace = accessContexts[0]?.workspace || null;
    const capabilities = workspace
      ? getWorkspaceCapabilities(workspace.plan)
      : getPersonalCapabilities(req.user.plan);

    assertCapability(
      capabilities.bundleShare,
      'Your current plan does not include multi-strategy portal sharing.'
    );

    const portal = await upsertBundlePortal({
      userId: req.user.userId,
      tripId: trip.tripId,
      proposalIds: selectedEntries.map((entry) => entry.proposalId),
      strategySelection: selectedEntries.map((entry) => entry.strategy),
      expiryDays: payload.expiryDays,
      pinEnabled: payload.pinEnabled,
      pin: payload.pin,
      workspaceId: workspace?._id || trip.workspaceId || null,
    });

    res.status(201).json({ portal });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
