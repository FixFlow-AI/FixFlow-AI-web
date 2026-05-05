const mongoose = require('mongoose');

const leadStatuses = ['new', 'qualified', 'contacted', 'replied', 'won', 'lost'];
const leadSources = [
  'reddit',
  'hn',
  'upwork',
  'fiverr',
  'freelancer',
  'peopleperhour',
  'contra',
  'guru',
  'wellfound',
  'linkedin',
  'direct',
  'github',
  'tavily',
  'brave',
  'serpapi',
  'apify',
  'manual',
  'unknown',
];

const draftMessageSchema = new mongoose.Schema(
  {
    subject: { type: String, trim: true, default: '' },
    body: { type: String, trim: true, default: '' },
    wordCount: { type: Number, default: 0 },
    tokens: { type: [String], default: [] },
    tone: { type: String, trim: true, default: 'warm-direct' },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: leadStatuses,
      default: 'new',
      index: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },
    source: {
      type: String,
      enum: leadSources,
      default: 'direct',
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: '',
    },
    externalId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    discoveredAt: {
      type: Date,
      default: null,
    },
    projectDescription: {
      type: String,
      trim: true,
      default: '',
    },
    budget: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    match: {
      score: { type: Number, min: 0, max: 100, default: 0 },
      threshold: { type: Number, min: 0, max: 100, default: 70 },
      eligible: { type: Boolean, default: false },
      skillsMatched: { type: [String], default: [] },
      skillsMissing: { type: [String], default: [] },
      githubEvidence: { type: [String], default: [] },
      rationale: { type: [String], default: [] },
      evaluatedAt: { type: Date, default: null },
    },
    bid: {
      status: {
        type: String,
        enum: ['not_ready', 'drafted', 'ready', 'submitted', 'accepted', 'rejected'],
        default: 'not_ready',
      },
      draft: { type: String, trim: true, default: '' },
      submittedAt: { type: Date, default: null },
    },
    reasoning: {
      type: [String],
      default: [],
    },
    company: {
      name: { type: String, trim: true, required: true },
      stack: { type: [String], default: [] },
      size: { type: String, trim: true, default: '' },
      logo: { type: String, trim: true, default: '' },
      mission: { type: String, trim: true, default: '' },
    },
    role: {
      type: String,
      trim: true,
      required: true,
    },
    rateRange: {
      type: [Number],
      default: [0, 0],
    },
    draftMessage: {
      type: draftMessageSchema,
      default: () => ({}),
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

leadSchema.index({ userId: 1, status: 1, score: -1 });

module.exports = {
  Lead: mongoose.model('Lead', leadSchema),
  leadSources,
  leadStatuses,
};
