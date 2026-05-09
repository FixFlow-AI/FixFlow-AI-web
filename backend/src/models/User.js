const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  DEFAULT_NOTIFICATION_PREFERENCES,
} = require('../services/notifications/notificationPreferences');

const SALT_ROUNDS = 12;
const PERSONAL_PLANS = ['free', 'pro', 'agency', 'solo', 'scale', 'standard', 'enterprise'];
const TEAM_PLANS = ['free', 'pro', 'agency', 'scale', 'standard', 'enterprise'];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
      trim: true,
    },
    avatarKey: {
      type: String,
      default: '',
      trim: true,
    },
    timezone: {
      type: String,
      default: '',
      trim: true,
    },
    theme: {
      type: String,
      enum: ['light', 'modern-dark', 'vscode-dark'],
      default: 'modern-dark',
    },
    plan: {
      type: String,
      enum: PERSONAL_PLANS,
      default: 'free',
    },
    teamPlanPreference: {
      type: String,
      enum: TEAM_PLANS,
      default: 'free',
    },
    defaultEntryMode: {
      type: String,
      enum: ['individual', 'team'],
      default: 'individual',
    },
    currentWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    notificationPreferences: {
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
    usageCount: {
      type: Number,
      default: 0,
    },
    usageLimit: {
      type: Number,
      default: 5,
    },
    proposalLimit: {
      type: Number,
      default: 5,
    },
    proposalsThisMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    resetDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    stripeCustomerId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired'],
      default: 'none',
    },
    subscriptionCurrentPeriodEnd: {
      type: Date,
      default: null,
    },
    subscriptionPriceId: {
      type: String,
      default: '',
      trim: true,
    },
    subscriptionSeats: {
      type: Number,
      default: 1,
      min: 1,
    },
    refreshTokens: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.__v;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
