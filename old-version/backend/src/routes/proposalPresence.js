const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { proposalPresenceSchema } = require('../models/schemas');
const ProposalPresence = require('../models/ProposalPresence');
const { getProposalAccessContext } = require('../services/proposal/proposalAccess');

const router = express.Router();

function getInitials(name = '') {
  return String(name)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';
}

router.post('/:id/presence', authMiddleware, async (req, res, next) => {
  try {
    const payload = proposalPresenceSchema.parse(req.body || {});
    const { proposal } = await getProposalAccessContext(req.user.userId, req.params.id);

    await ProposalPresence.findOneAndUpdate(
      { proposalId: proposal.proposalId, userId: req.user.userId },
      {
        proposalId: proposal.proposalId,
        workspaceId: payload.workspaceId || proposal.workspaceId || null,
        userId: req.user.userId,
        userName: req.user.name || req.user.email,
        avatar: req.user.avatar || '',
        avatarInitials: getInitials(req.user.name || req.user.email),
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/presence', authMiddleware, async (req, res, next) => {
  try {
    const { proposal } = await getProposalAccessContext(req.user.userId, req.params.id);
    const viewers = await ProposalPresence.find({ proposalId: proposal.proposalId }).sort({ lastSeenAt: -1 }).lean();

    res.json({
      viewers: viewers.map((viewer) => ({
        userId: viewer.userId.toString(),
        userName: viewer.userName,
        avatar: viewer.avatar || '',
        avatarInitials: viewer.avatarInitials,
        lastSeenAt: viewer.lastSeenAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
