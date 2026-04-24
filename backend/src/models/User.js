const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;
const PERSONAL_PLANS = ['free', 'standard', 'pro', 'enterprise'];
const TEAM_PLANS = ['free', 'standard', 'pro'];

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
    usageCount: {
      type: Number,
      default: 0,
    },
    usageLimit: {
      type: Number,
      default: 10,
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
        ret.plan = ret.plan === 'enterprise' ? 'pro' : ret.plan;
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
