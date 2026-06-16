const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { planningActionSchema } = require('../models/schemas');
const {
  getProposalAccessContext,
  getProposalJSONForRecord,
  upsertEmbeddedProposalVersion,
} = require('../services/proposal/proposalAccess');
const { applyPlanningOperation } = require('../services/proposal/deliveryPlanService');
const s3Service = require('../services/storage/s3');
const {
  buildProposalRecipientIds,
  createNotifications,
} = require('../services/notifications/notificationService');
const { memberHasPermission } = require('../services/workspace/workspaceService');
const { ForbiddenError } = require('../utils/errors');

const router = express.Router();

router.get('/:id/planning', authMiddleware, async (req, res, next) => {
  try {
    const { proposal } = await getProposalAccessContext(req.user.userId, req.params.id);
    const proposalJSON = await getProposalJSONForRecord(proposal);

    res.json({
      deliveryPlan: proposalJSON.delivery_plan,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/planning', authMiddleware, async (req, res, next) => {
  try {
    const action = planningActionSchema.parse(req.body);
    const { proposal, role, workspace } = await getProposalAccessContext(req.user.userId, req.params.id);

    if (workspace && !memberHasPermission(workspace, { role }, 'proposals.edit')) {
      throw new ForbiddenError('Your workspace role does not allow planning updates.');
    }

    const proposalJSON = await getProposalJSONForRecord(proposal);
    const { proposalJSON: updatedProposalJSON, event } = applyPlanningOperation(proposalJSON, action);

    const newVersion = proposal.versionCount + 1;
    const s3Key = await s3Service.uploadProposalJSON(
      proposal.userId.toString(),
      proposal.proposalId,
      newVersion,
      updatedProposalJSON
    );

    proposal.s3Key = s3Key;
    proposal.versionCount = newVersion;
    proposal.status = 'complete';
    upsertEmbeddedProposalVersion(proposal, newVersion, updatedProposalJSON, s3Key);
    await proposal.save();

    if (event) {
      const recipientIds = buildProposalRecipientIds({
        proposal,
        workspace,
        excludeUserId: workspace ? req.user.userId : null,
      });

      if (event.type === 'goal_completed') {
        await createNotifications({
          userIds: recipientIds,
          workspace,
          proposalId: proposal.proposalId,
          type: 'goal_completed',
          title: `${event.weekLabel} goals completed`,
          body: `${event.weekLabel} has all planned tasks marked complete in ${proposal.title}.`,
          metadata: event,
          deliveryDefaults: updatedProposalJSON.delivery_plan?.notificationDefaults,
        }).catch(() => null);
      }

      if (event.type === 'backlog_moved') {
        await createNotifications({
          userIds: recipientIds,
          workspace,
          proposalId: proposal.proposalId,
          type: 'backlog_moved',
          title: 'Task moved to backlog',
          body: `${event.title} moved from ${event.weekLabel} into the backlog for ${proposal.title}.`,
          metadata: event,
          deliveryDefaults: updatedProposalJSON.delivery_plan?.notificationDefaults,
        }).catch(() => null);
      }
    }

    res.json({
      deliveryPlan: updatedProposalJSON.delivery_plan,
      version: newVersion,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
