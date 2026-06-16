const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  analyzeAgencyPatterns,
  getLatestAgencyPatterns,
  buildCalibrationPayload,
} = require('../services/agencyBrain/agencyBrainService');
const { getPersonalCapabilities, getWorkspaceCapabilities, assertCapability } = require('../services/capabilities/capabilityService');
const { assertWorkspaceMembership } = require('../services/workspace/workspaceService');

const router = express.Router();

async function assertAgencyBrainAccess(userId, workspaceId, currentPlan) {
  if (workspaceId) {
    const { workspace } = await assertWorkspaceMembership(userId, workspaceId, ['owner', 'editor', 'viewer']);
    assertCapability(
      getWorkspaceCapabilities(workspace.plan).agencyBrain,
      'Your workspace plan does not include Agency Brain.'
    );
    return workspace;
  }

  assertCapability(
    getPersonalCapabilities(currentPlan).agencyBrain,
    'Your personal plan does not include Agency Brain.'
  );
  return null;
}

router.post('/analyze', authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.body?.workspaceId || null;
    await assertAgencyBrainAccess(req.user.userId, workspaceId, req.user.plan || 'free');
    const analysis = await analyzeAgencyPatterns({ userId: req.user.userId, workspaceId });
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

router.get('/insights', authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query?.workspaceId || null;
    await assertAgencyBrainAccess(req.user.userId, workspaceId, req.user.plan || 'free');
    const patterns = await getLatestAgencyPatterns({ userId: req.user.userId, workspaceId });
    res.json({
      insights: patterns?.insights || [],
      sampleSize: patterns?.sampleSize || 0,
      analyzedAt: patterns?.analyzedAt || null,
      patterns: patterns?.patterns || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/calibration', authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.body?.workspaceId || null;
    await assertAgencyBrainAccess(req.user.userId, workspaceId, req.user.plan || 'free');
    const payload = await buildCalibrationPayload({
      userId: req.user.userId,
      workspaceId,
      briefText: req.body?.briefText || '',
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
