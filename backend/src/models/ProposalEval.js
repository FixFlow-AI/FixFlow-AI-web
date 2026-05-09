const mongoose = require('mongoose');

const proposalEvalSchema = new mongoose.Schema(
  {
    proposalId: {
      type: String,
      required: true,
      index: true,
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
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    modelUsed: {
      type: String,
      default: '',
      trim: true,
    },
    briefScoreAtGeneration: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    evalScores: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    totalEvalScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    briefLength: {
      type: Number,
      default: 0,
      min: 0,
    },
    generationTimeMs: {
      type: Number,
      default: null,
    },
    inputTokens: {
      type: Number,
      default: 0,
    },
    outputTokens: {
      type: Number,
      default: 0,
    },
    estimatedCostUsd: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

proposalEvalSchema.index({ userId: 1, generatedAt: -1 });
proposalEvalSchema.index({ workspaceId: 1, generatedAt: -1 });
proposalEvalSchema.index({ proposalId: 1, generatedAt: -1 });

module.exports = mongoose.model('ProposalEval', proposalEvalSchema);
