const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    amount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'locked', 'released', 'disputed'],
      default: 'pending',
    },
    releasedAt: { type: Date, default: null },
    deadline: { type: Date, default: null },
  },
  { _id: false }
);

const escrowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    clientDid: { type: String, trim: true, default: '' },
    freelancerDid: { type: String, trim: true, default: '' },

    buyerAddress: { type: String, trim: true, default: '' },
    sellerAddress: { type: String, trim: true, default: '' },
    state: {
      type: String,
      enum: ['CREATED', 'FUNDED', 'MILESTONE_SUBMITTED', 'MILESTONE_APPROVED', 'DISPUTED', 'RESOLVED', 'RELEASED', 'CANCELLED'],
      default: 'CREATED',
      index: true,
    },
    fundedAt: { type: Date, default: null },

    totalAmount: { type: Number, min: 0, default: 0 },
    currency: {
      type: String,
      enum: ['USDC', 'FIXFLOW', 'MATIC'],
      default: 'USDC',
    },
    milestones: {
      type: [milestoneSchema],
      default: [],
    },
    contractAddress: { type: String, trim: true, default: '' },
    chain: { type: String, trim: true, default: 'Polygon Amoy' },
  },
  { timestamps: true }
);

escrowSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Escrow', escrowSchema);
