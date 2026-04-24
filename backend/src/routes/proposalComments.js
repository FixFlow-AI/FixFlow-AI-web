const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  proposalCommentCreateSchema,
  proposalCommentResolveSchema,
} = require('../models/schemas');
const { getProposalAccessContext } = require('../services/proposal/proposalAccess');
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
    const { proposal, role } = await getProposalAccessContext(req.user.userId, req.params.id);
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

    res.json({
      comments: proposal.comments,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
