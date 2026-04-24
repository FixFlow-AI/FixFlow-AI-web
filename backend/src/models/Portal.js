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
      default: '',
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    portalType: {
      type: String,
      enum: ['single', 'bundle'],
      default: 'single',
      index: true,
    },
    tripId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    proposalIds: {
      type: [String],
      default: [],
    },
    strategySelection: {
      type: [String],
      default: [],
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

portalSchema.index(
  { userId: 1, proposalId: 1, portalType: 1 },
  { unique: true, partialFilterExpression: { portalType: 'single', proposalId: { $type: 'string', $ne: '' } } }
);
portalSchema.index(
  { userId: 1, tripId: 1, portalType: 1 },
  { unique: true, partialFilterExpression: { portalType: 'bundle', tripId: { $type: 'string', $ne: '' } } }
);

module.exports = mongoose.model('Portal', portalSchema);
