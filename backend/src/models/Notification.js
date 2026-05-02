const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
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
    proposalId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ['personal', 'workspace'],
      default: 'personal',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'invite',
        'comment',
        'approval',
        'assignment',
        'goal_completed',
        'backlog_moved',
        'freelancer_lead',
        'freelancer_niche',
        'freelancer_outreach',
        'freelancer_escrow',
        'rate_limit_near',
        'rate_limit_exceeded',
        'rate_limit_restored',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    emailStatus: {
      type: String,
      enum: ['disabled', 'sent', 'skipped', 'failed'],
      default: 'disabled',
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, scope: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
