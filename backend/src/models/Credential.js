const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    skill: {
      type: String,
      required: true,
      trim: true,
    },
    proof: {
      type: String,
      trim: true,
      default: '',
    },
    issuerDid: {
      type: String,
      trim: true,
      default: '',
    },
    subjectDid: {
      type: String,
      trim: true,
      default: '',
    },
    evidence: {
      escrowTx: { type: String, trim: true, default: '' },
      githubCommit: { type: String, trim: true, default: '' },
      leadName: { type: String, trim: true, default: '' },
    },
    mintedAt: {
      type: Date,
      default: Date.now,
    },
    soulbound: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['ready', 'minted', 'pending'],
      default: 'ready',
    },
  },
  { timestamps: true }
);

credentialSchema.index({ userId: 1, mintedAt: -1 });

module.exports = mongoose.model('Credential', credentialSchema);
