const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    stripePriceId: {
      type: String,
      default: '',
      trim: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'agency', 'solo', 'scale'],
      default: 'free',
      index: true,
    },
    status: {
      type: String,
      enum: ['none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired'],
      default: 'none',
      index: true,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    seats: {
      type: Number,
      default: 1,
      min: 1,
    },
    usageThisMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastInvoiceStatus: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ userId: 1, stripeSubscriptionId: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
