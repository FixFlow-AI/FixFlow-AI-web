const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
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
    clientName: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      enum: ['USD', 'USDC', 'FIXFLOW', 'MATIC'],
      default: 'USDC',
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'overdue'],
      default: 'pending',
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ userId: 1, dueDate: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
