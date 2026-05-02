const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { briefScoreRequestSchema } = require('../models/schemas');
const { hydrateBriefText } = require('../services/brief/briefHydrationService');
const { scoreBrief, buildTooShortBriefScore } = require('../services/brief/briefScoreService');

const router = express.Router();

router.post('/score', authMiddleware, async (req, res, next) => {
  try {
    const payload = briefScoreRequestSchema.parse(req.body);
    const briefText = await hydrateBriefText(req.user.userId, payload.briefText, payload.fileKey);
    const wordCount = String(briefText || '').trim().split(/\s+/).filter(Boolean).length;

    if (wordCount < 50) {
      res.json(buildTooShortBriefScore());
      return;
    }

    const score = await scoreBrief(briefText, { userId: req.user.userId });
    res.json(score);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
