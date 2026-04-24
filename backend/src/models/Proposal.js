const mongoose = require('mongoose');

const proposalCommentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['review', 'approval', 'question', 'edit_note'],
      default: 'review',
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

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
    briefSnapshot: {
      type: String,
      default: '',
      trim: true,
      maxlength: 6000,
    },
    briefSignals: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        industries: [],
        tech: [],
        keywords: [],
      }),
    },
    status: {
      type: String,
      enum: ['generating', 'complete', 'failed'],
      default: 'generating',
    },
    strategy: {
      type: String,
      enum: ['lean', 'standard', 'premium'],
      default: 'standard',
      index: true,
    },
    tripId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
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
    comments: {
      type: [proposalCommentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

proposalSchema.index({ userId: 1, createdAt: -1 });
proposalSchema.index({ userId: 1, proposalId: 1 });
proposalSchema.index({ userId: 1, dealStatus: 1, createdAt: -1 });
proposalSchema.index({ workspaceId: 1, createdAt: -1 });
proposalSchema.index({ workspaceId: 1, dealStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Proposal', proposalSchema);
