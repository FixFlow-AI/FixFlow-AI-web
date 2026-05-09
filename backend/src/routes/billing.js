const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { billingCheckoutSchema } = require('../models/schemas');
const {
  constructWebhookEvent,
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  handleStripeEvent,
} = require('../services/billing/stripeService');

const billingRouter = express.Router();
const billingWebhookRouter = express.Router();

billingRouter.get('/status', authMiddleware, async (req, res, next) => {
  try {
    res.json(await getBillingStatus(req.user.userId));
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/checkout-session', authMiddleware, async (req, res, next) => {
  try {
    const payload = billingCheckoutSchema.parse(req.body);
    res.json(await createCheckoutSession({ userId: req.user.userId, plan: payload.plan }));
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/portal-session', authMiddleware, async (req, res, next) => {
  try {
    res.json(await createPortalSession({ userId: req.user.userId }));
  } catch (error) {
    next(error);
  }
});

billingWebhookRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = constructWebhookEvent(req.body, signature);
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  billingRouter,
  billingWebhookRouter,
};
