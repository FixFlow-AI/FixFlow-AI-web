const mongoose = require('mongoose');

const sectionMetricSchema = new mongoose.Schema(
  {
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    dwellMs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const feedbackEntrySchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const portalSchema = new mongoose.Schema(
  {
    proposalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    shareToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    expiryAt: {
      type: Date,
      default: null,
    },
    pinHash: {
      type: String,
      default: '',
      trim: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstViewedAt: {
      type: Date,
      default: null,
    },
    lastViewedAt: {
      type: Date,
      default: null,
    },
    sectionMetrics: {
      summary: { type: sectionMetricSchema, default: () => ({}) },
      features: { type: sectionMetricSchema, default: () => ({}) },
      risks: { type: sectionMetricSchema, default: () => ({}) },
      timeline: { type: sectionMetricSchema, default: () => ({}) },
      effort: { type: sectionMetricSchema, default: () => ({}) },
      market: { type: sectionMetricSchema, default: () => ({}) },
      impact: { type: sectionMetricSchema, default: () => ({}) },
    },
    feedback: {
      type: [feedbackEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

portalSchema.index({ userId: 1, proposalId: 1 });

module.exports = mongoose.model('Portal', portalSchema);
