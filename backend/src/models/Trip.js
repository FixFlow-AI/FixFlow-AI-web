const mongoose = require('mongoose');

const tripProposalSchema = new mongoose.Schema(
  {
    proposalId: {
      type: String,
      required: true,
      trim: true,
    },
    strategy: {
      type: String,
      enum: ['lean', 'standard', 'premium'],
      required: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['generating', 'complete', 'failed'],
      default: 'generating',
    },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    tripId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
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
    proposals: {
      type: [tripProposalSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
