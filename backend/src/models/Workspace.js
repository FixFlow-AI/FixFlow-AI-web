const mongoose = require('mongoose');
const {
  DEFAULT_NOTIFICATION_PREFERENCES,
} = require('../services/notifications/notificationPreferences');

const workspaceMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const workspaceInviteSchema = new mongoose.Schema(
  {
    inviteId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    tokenHash: {
      type: String,
      required: true,
      trim: true,
    },
    inviterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inviterName: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const workspaceRoleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    system: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'standard', 'pro'],
      default: 'free',
    },
    notificationDefaults: {
      enabled: {
        type: Boolean,
        default: DEFAULT_NOTIFICATION_PREFERENCES.enabled,
      },
      channels: {
        type: [String],
        default: () => [...DEFAULT_NOTIFICATION_PREFERENCES.channels],
      },
      events: {
        type: [String],
        default: () => [...DEFAULT_NOTIFICATION_PREFERENCES.events],
      },
    },
    roleDefinitions: {
      type: [workspaceRoleSchema],
      default: [],
    },
    slack: {
      teamId: {
        type: String,
        default: '',
        trim: true,
      },
      teamName: {
        type: String,
        default: '',
        trim: true,
      },
      channelId: {
        type: String,
        default: '',
        trim: true,
      },
      channelName: {
        type: String,
        default: '',
        trim: true,
      },
      webhookUrlEncrypted: {
        type: String,
        default: '',
      },
      installedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      installedAt: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        enum: ['disconnected', 'connected', 'error'],
        default: 'disconnected',
      },
      lastDeliveryStatus: {
        type: String,
        default: '',
        trim: true,
      },
      lastDeliveryAt: {
        type: Date,
        default: null,
      },
    },
    members: {
      type: [workspaceMemberSchema],
      default: [],
    },
    invitePending: {
      type: [workspaceInviteSchema],
      default: [],
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
