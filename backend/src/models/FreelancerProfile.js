const mongoose = require('mongoose');

const agentConfigSchema = new mongoose.Schema(
  {
    leadHunter: { type: Boolean, default: true },
    outreachWriter: { type: Boolean, default: true },
    escrowWatcher: { type: Boolean, default: true },
    credentialMinter: { type: Boolean, default: false },
  },
  { _id: false }
);

const freelancerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    did: {
      type: String,
      trim: true,
      default: '',
    },
    walletAddresses: {
      fixflow: { type: String, trim: true, default: '' },
      usdc: { type: String, trim: true, default: '' },
      matic: { type: String, trim: true, default: '' },
    },
    profiles: {
      upwork: {
        headline: { type: String, trim: true, default: '' },
        summary: { type: String, trim: true, default: '' },
        rate: { type: Number, default: 0 },
      },
      linkedin: {
        headline: { type: String, trim: true, default: '' },
        about: { type: String, trim: true, default: '' },
      },
      personal: {
        tagline: { type: String, trim: true, default: '' },
        bio: { type: String, trim: true, default: '' },
      },
    },
    agentConfig: {
      type: agentConfigSchema,
      default: () => ({}),
    },
    githubScan: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        repos: [],
        languages: [],
        commits: 0,
        scannedAt: null,
      }),
    },
    onboardedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FreelancerProfile', freelancerProfileSchema);
