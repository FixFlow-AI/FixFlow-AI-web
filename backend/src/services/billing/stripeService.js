const Stripe = require('stripe');
const User = require('../../models/User');
const Subscription = require('../../models/Subscription');
const { env } = require('../../config/env');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { getPersonalCapabilities, normalizePlan } = require('../capabilities/capabilityService');
const { buildUsageSummary, resetMonthlyProposalUsage } = require('./planEnforcer');

let stripeClient;

function isStripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

function getStripeClient() {
  if (!isStripeConfigured()) {
    throw new BadRequestError('Stripe billing is not configured on the server.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }

  return stripeClient;
}

function getPriceIdForPlan(plan) {
  const normalized = normalizePlan(plan);
  const priceIds = {
    pro: env.STRIPE_PRO_PRICE_ID,
    agency: env.STRIPE_AGENCY_PRICE_ID,
    solo: env.STRIPE_SOLO_PRICE_ID,
  };
  return priceIds[normalized] || '';
}

function getPlanForPriceId(priceId) {
  if (!priceId) return 'free';
  const map = new Map([
    [env.STRIPE_PRO_PRICE_ID, 'pro'],
    [env.STRIPE_AGENCY_PRICE_ID, 'agency'],
    [env.STRIPE_SOLO_PRICE_ID, 'solo'],
  ]);
  return map.get(priceId) || 'free';
}

async function getOrCreateCustomer(user) {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user._id.toString(),
    },
  });

  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}

async function createCheckoutSession({ userId, plan }) {
  const normalizedPlan = normalizePlan(plan);
  const priceId = getPriceIdForPlan(normalizedPlan);
  if (!priceId) {
    throw new BadRequestError(`Stripe price is not configured for the ${normalizedPlan} plan.`);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  const customerId = await getOrCreateCustomer(user);
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.FRONTEND_URL}/billing?billing=success`,
    cancel_url: `${env.FRONTEND_URL}/billing?billing=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: user._id.toString(),
    metadata: {
      userId: user._id.toString(),
      plan: normalizedPlan,
    },
    subscription_data: {
      metadata: {
        userId: user._id.toString(),
        plan: normalizedPlan,
      },
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

async function createPortalSession({ userId }) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }
  if (!user.stripeCustomerId) {
    throw new BadRequestError('No Stripe customer is connected to this account yet.');
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.FRONTEND_URL}/billing`,
  });

  return { portalUrl: session.url };
}

async function syncSubscriptionToUser({
  user,
  stripeCustomerId,
  stripeSubscriptionId = '',
  stripePriceId = '',
  plan = '',
  status = 'none',
  currentPeriodEnd = null,
  seats = 1,
}) {
  const normalizedPlan = ['active', 'trialing', 'past_due', 'incomplete'].includes(status)
    ? normalizePlan(plan || getPlanForPriceId(stripePriceId))
    : 'free';
  const capabilities = getPersonalCapabilities(normalizedPlan);

  user.stripeCustomerId = stripeCustomerId || user.stripeCustomerId || '';
  user.plan = normalizedPlan;
  user.subscriptionStatus = status || 'none';
  user.subscriptionCurrentPeriodEnd = currentPeriodEnd;
  user.subscriptionPriceId = stripePriceId || '';
  user.subscriptionSeats = Number(seats || 1);
  user.usageLimit = capabilities.usageLimit;
  user.proposalLimit = capabilities.proposalLimit;
  if (['agency', 'scale'].includes(normalizedPlan)) {
    user.teamPlanPreference = normalizedPlan;
  } else if (normalizedPlan === 'pro') {
    user.teamPlanPreference = 'pro';
  }
  await user.save();

  await Subscription.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      plan: normalizedPlan,
      status: user.subscriptionStatus,
      currentPeriodEnd,
      seats: user.subscriptionSeats,
      usageThisMonth: user.proposalsThisMonth || 0,
    },
    { upsert: true, new: true }
  );

  return user;
}

async function syncCheckoutSession(session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  const user = userId ? await User.findById(userId) : await User.findOne({ stripeCustomerId: session.customer });
  if (!user) {
    return null;
  }

  let subscription = null;
  if (session.subscription && isStripeConfigured()) {
    subscription = await getStripeClient().subscriptions.retrieve(session.subscription);
  }

  return syncSubscriptionToUser({
    user,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: subscription?.id || session.subscription || '',
    stripePriceId: subscription?.items?.data?.[0]?.price?.id || getPriceIdForPlan(session.metadata?.plan),
    plan: session.metadata?.plan,
    status: subscription?.status || 'active',
    currentPeriodEnd: subscription?.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    seats: subscription?.items?.data?.[0]?.quantity || 1,
  });
}

async function syncSubscription(subscription) {
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  if (!user) {
    return null;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id || '';
  return syncSubscriptionToUser({
    user,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan: subscription.metadata?.plan || getPlanForPriceId(priceId),
    status: subscription.status || 'none',
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    seats: subscription.items?.data?.[0]?.quantity || 1,
  });
}

async function handleInvoicePaymentSucceeded(invoice) {
  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (!user) {
    return null;
  }

  await resetMonthlyProposalUsage(user);
  await Subscription.findOneAndUpdate(
    { userId: user._id },
    { lastInvoiceStatus: 'paid', usageThisMonth: 0 },
    { upsert: false }
  );
  return user;
}

async function handleInvoicePaymentFailed(invoice) {
  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (!user) {
    return null;
  }

  user.subscriptionStatus = 'past_due';
  await user.save();
  await Subscription.findOneAndUpdate(
    { userId: user._id },
    { status: 'past_due', lastInvoiceStatus: 'payment_failed' },
    { upsert: false }
  );
  return user;
}

async function handleStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      return syncCheckoutSession(event.data.object);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscription(event.data.object);
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(event.data.object);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object);
    default:
      return null;
  }
}

function constructWebhookEvent(rawBody, signature) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new BadRequestError('Stripe webhook secret is not configured.');
  }
  return getStripeClient().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

async function getBillingStatus(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  const subscription = await Subscription.findOne({ userId: user._id }).lean();
  return {
    stripeConfigured: isStripeConfigured(),
    plan: normalizePlan(user.plan),
    subscriptionStatus: user.subscriptionStatus || 'none',
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    stripeCustomerId: user.stripeCustomerId || '',
    subscription,
    usage: buildUsageSummary(user),
    priceIdsConfigured: {
      pro: Boolean(env.STRIPE_PRO_PRICE_ID),
      agency: Boolean(env.STRIPE_AGENCY_PRICE_ID),
      solo: Boolean(env.STRIPE_SOLO_PRICE_ID),
    },
  };
}

function __setStripeClientForTests(client) {
  stripeClient = client;
}

module.exports = {
  __setStripeClientForTests,
  constructWebhookEvent,
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  getPlanForPriceId,
  getPriceIdForPlan,
  handleStripeEvent,
  isStripeConfigured,
  syncSubscriptionToUser,
};
