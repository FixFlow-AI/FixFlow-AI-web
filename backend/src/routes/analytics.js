const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getAnalytics } = require('../services/analytics/analyticsService');

const router = express.Router();

router.get('/proposals', authMiddleware, async (req, res, next) => {
  try {
    const analytics = await getAnalytics(req.user.userId);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
