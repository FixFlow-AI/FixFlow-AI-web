const mongoose = require('mongoose');

const agencyInsightSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    recommendation: {
      type: String,
      required: true,
      trim: true,
    },
    calibrationText: {
      type: String,
      required: true,
      trim: true,
    },
    sampleSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    strength: {
      type: String,
      enum: ['Anecdotal', 'Emerging', 'Confirmed'],
      default: 'Anecdotal',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const agencyPatternSchema = new mongoose.Schema(
  {
    scopeType: {
      type: String,
      enum: ['personal', 'workspace'],
      required: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    sampleSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
    patterns: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    insights: {
      type: [agencyInsightSchema],
      default: [],
    },
  },
  { timestamps: true }
);

agencyPatternSchema.index(
  { scopeType: 1, ownerUserId: 1 },
  { unique: true, partialFilterExpression: { scopeType: 'personal', ownerUserId: { $type: 'objectId' } } }
);
agencyPatternSchema.index(
  { scopeType: 1, workspaceId: 1 },
  { unique: true, partialFilterExpression: { scopeType: 'workspace', workspaceId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('AgencyPattern', agencyPatternSchema);
