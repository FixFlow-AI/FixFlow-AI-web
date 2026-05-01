const mongoose = require('mongoose');

const nicheEvidenceSchema = new mongoose.Schema(
  {
    repo: { type: String, trim: true, required: true },
    commits: { type: Number, default: 0 },
    stars: { type: Number, default: 0 },
    signal: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const nicheSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    depth: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    rateCeiling: {
      type: Number,
      min: 0,
      default: 0,
    },
    evidence: {
      type: [nicheEvidenceSchema],
      default: [],
    },
    reasoning: {
      type: String,
      trim: true,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    accepted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

nicheSchema.index({ userId: 1, depth: -1 });

module.exports = mongoose.model('Niche', nicheSchema);
