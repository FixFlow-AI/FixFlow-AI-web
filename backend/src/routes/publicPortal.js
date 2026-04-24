const express = require('express');
const {
  portalVerifySchema,
  portalEventSchema,
  portalFeedbackSchema,
} = require('../models/schemas');
const {
  getPortalPublicMeta,
  verifyPortalAccess,
  recordPortalEvents,
  submitPortalFeedback,
} = require('../services/portal/portalService');

const router = express.Router();

router.get('/:token', async (req, res, next) => {
  try {
    const meta = await getPortalPublicMeta(req.params.token);
    res.json(meta);
  } catch (error) {
    next(error);
  }
});

router.post('/:token/verify', async (req, res, next) => {
  try {
    const payload = portalVerifySchema.parse(req.body || {});
    const result = await verifyPortalAccess(req.params.token, payload.pin);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:token/event', async (req, res, next) => {
  try {
    const payload = portalEventSchema.parse(req.body);
    const portal = await recordPortalEvents(req.params.token, payload.events);
    res.json({ success: true, portal });
  } catch (error) {
    next(error);
  }
});

router.post('/:token/feedback', async (req, res, next) => {
  try {
    const payload = portalFeedbackSchema.parse(req.body);
    const result = await submitPortalFeedback(req.params.token, payload.message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
