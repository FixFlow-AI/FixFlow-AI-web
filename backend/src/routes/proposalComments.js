const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  proposalCommentCreateSchema,
  proposalCommentResolveSchema,
} = require('../models/schemas');
const { getProposalAccessContext, getProposalJSONForRecord } = require('../services/proposal/proposalAccess');
const {
  buildProposalRecipientIds,
  createNotifications,
} = require('../services/notifications/notificationService');
const { ForbiddenError, NotFoundError } = require('../utils/errors');

const router = express.Router();

router.post('/:id/comments', authMiddleware, async (req, res, next) => {
  try {
    const payload = proposalCommentCreateSchema.parse(req.body);
    const { proposal, workspace } = await getProposalAccessContext(req.user.userId, req.params.id);

    if (!workspace && proposal.userId.toString() !== req.user.userId) {
      throw new ForbiddenError('You do not have access to comment on this proposal.');
    }

    proposal.comments.push({
      authorId: req.user.userId,
      authorName: req.user.name || req.user.email,
      section: payload.section,
      type: payload.type,
      body: payload.body,
    });
    await proposal.save();

    const recipientIds = buildProposalRecipientIds({
      proposal,
      workspace,
      excludeUserId: workspace ? req.user.userId : null,
    });
    const proposalJSON = proposal.s3Key ? await getProposalJSONForRecord(proposal) : null;

    await createNotifications({
      userIds: recipientIds,
      workspace,
      proposalId: proposal.proposalId,
      type: payload.type === 'approval' ? 'approval' : 'comment',
      title: payload.type === 'approval' ? 'Approval added to proposal' : 'New proposal comment',
      body: payload.type === 'approval'
        ? `${req.user.name || req.user.email} added an approval note in ${payload.section}.`
        : `${req.user.name || req.user.email} commented in ${payload.section}.`,
      metadata: {
        section: payload.section,
        commentType: payload.type,
      },
      deliveryDefaults: proposalJSON?.delivery_plan?.notificationDefaults,
    }).catch(() => null);

    res.status(201).json({
      comments: proposal.comments,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/comments/:commentId', authMiddleware, async (req, res, next) => {
  try {
    const payload = proposalCommentResolveSchema.parse(req.body);
    const { proposal, role, workspace } = await getProposalAccessContext(req.user.userId, req.params.id);
    const comment = proposal.comments.id(req.params.commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found.');
    }

    const canResolve = ['owner', 'editor'].includes(role)
      || comment.authorId.toString() === req.user.userId.toString();
    if (!canResolve) {
      throw new ForbiddenError('You cannot resolve this comment.');
    }

    comment.resolved = payload.resolved;
    comment.resolvedAt = payload.resolved ? new Date() : null;
    comment.resolvedBy = payload.resolved ? req.user.userId : null;
    await proposal.save();

    if (payload.resolved) {
      const recipientIds = buildProposalRecipientIds({
        proposal,
        workspace,
        excludeUserId: workspace ? req.user.userId : null,
      }).filter((userId) => userId !== req.user.userId.toString());

      await createNotifications({
        userIds: recipientIds,
        workspace,
        proposalId: proposal.proposalId,
        type: 'comment',
        title: 'Proposal comment resolved',
        body: `${req.user.name || req.user.email} resolved a comment in ${comment.section}.`,
        metadata: {
          section: comment.section,
          commentId: comment._id.toString(),
        },
        deliveryDefaults: proposal.s3Key
          ? (await getProposalJSONForRecord(proposal)).delivery_plan?.notificationDefaults
          : null,
      }).catch(() => null);
    }

    res.json({
      comments: proposal.comments,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
