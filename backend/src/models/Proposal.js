const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    proposalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    s3Key: {
      type: String,
      trim: true,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    projectSummary: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['generating', 'complete', 'failed'],
      default: 'generating',
    },
    dealStatus: {
      type: String,
      enum: ['pending', 'negotiating', 'won', 'lost'],
      default: 'pending',
      index: true,
    },
    dealStatusUpdatedAt: {
      type: Date,
      default: null,
    },
    lossReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    briefScore: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    wonOutcome: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    lostOutcome: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    versionCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    inputType: {
      type: String,
      enum: ['text', 'pdf', 'docx', 'txt'],
      default: 'text',
    },
    generationTimeMs: {
      type: Number,
      default: null,
    },
    generationError: {
      type: String,
      default: '',
      trim: true,
    },
    sourceFileKey: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

proposalSchema.index({ userId: 1, createdAt: -1 });
proposalSchema.index({ userId: 1, proposalId: 1 });
proposalSchema.index({ userId: 1, dealStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Proposal', proposalSchema);
