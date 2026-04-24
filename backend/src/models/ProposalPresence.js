const mongoose = require('mongoose');

const proposalPresenceSchema = new mongoose.Schema(
  {
    proposalId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
      trim: true,
    },
    avatarInitials: {
      type: String,
      required: true,
      trim: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      expires: 20,
      index: true,
    },
  },
  { timestamps: true }
);

proposalPresenceSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ProposalPresence', proposalPresenceSchema);
