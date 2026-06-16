const bcrypt = require('bcryptjs');
const { createDynamoModel } = require('../db/dynamoModel');
const {
  DEFAULT_NOTIFICATION_PREFERENCES,
} = require('../services/notifications/notificationPreferences');

const SALT_ROUNDS = 12;
const PERSONAL_PLANS = ['free', 'pro', 'agency', 'solo', 'scale', 'standard', 'enterprise'];
const TEAM_PLANS = ['free', 'pro', 'agency', 'scale', 'standard', 'enterprise'];

function buildResetDate() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function buildNotificationDefaults() {
  return {
    enabled: DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    channels: [...DEFAULT_NOTIFICATION_PREFERENCES.channels],
    events: [...DEFAULT_NOTIFICATION_PREFERENCES.events],
  };
}

async function hashPasswordIfNeeded(user) {
  if (!user.passwordHash) return;
  if (typeof user.passwordHash === 'string' && user.passwordHash.startsWith('$2')) return;
  user.passwordHash = await bcrypt.hash(user.passwordHash, SALT_ROUNDS);
}

const User = createDynamoModel({
  modelName: 'User',
  defaults: () => ({
    role: 'client',
    selectedPlan: 'free',
    authProvider: 'email',
    githubId: '',
    githubUsername: '',
    googleId: '',
    avatar: '',
    avatarKey: '',
    timezone: '',
    theme: 'modern-dark',
    plan: PERSONAL_PLANS[0],
    teamPlanPreference: TEAM_PLANS[0],
    defaultEntryMode: 'individual',
    currentWorkspaceId: null,
    notificationPreferences: buildNotificationDefaults(),
    usageCount: 0,
    usageLimit: 5,
    proposalLimit: 5,
    proposalsThisMonth: 0,
    resetDate: buildResetDate(),
    stripeCustomerId: '',
    subscriptionStatus: 'none',
    subscriptionCurrentPeriodEnd: null,
    subscriptionPriceId: '',
    subscriptionSeats: 1,
    refreshTokens: [],
    isAdmin: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    tokenVersion: 0,
  }),
  hiddenFields: ['passwordHash', 'refreshTokens'],
  methods: {
    async comparePassword(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.passwordHash || '');
    },
  },
  beforeSave: hashPasswordIfNeeded,
});

module.exports = User;
