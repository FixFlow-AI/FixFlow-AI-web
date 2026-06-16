const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getAnalytics } = require('../services/analytics/analyticsService');
const { getEvalTrends } = require('../services/eval/proposalEvalService');

const router = express.Router();

router.get('/proposals', authMiddleware, async (req, res, next) => {
  try {
    const analytics = await getAnalytics(req.user.userId);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

router.get('/eval-trends', authMiddleware, async (req, res, next) => {
  try {
    const trends = await getEvalTrends({
      userId: req.user.userId,
      workspaceId: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : null,
      days: Number(req.query.days || 30),
    });
    res.json(trends);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
