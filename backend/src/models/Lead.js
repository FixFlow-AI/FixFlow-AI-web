const mongoose = require('mongoose');

const leadStatuses = ['new', 'qualified', 'contacted', 'replied', 'won', 'lost'];

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
      enum: ['reddit', 'hn', 'upwork', 'direct', 'github'],
      default: 'direct',
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
  leadStatuses,
};
