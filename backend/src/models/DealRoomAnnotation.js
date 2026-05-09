const mongoose = require('mongoose');

const dealRoomAnnotationSchema = new mongoose.Schema(
  {
    portalToken: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    proposalId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    sectionName: {
      type: String,
      enum: ['summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact'],
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ['question', 'concern', 'approval'],
      default: 'question',
    },
    clientEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

dealRoomAnnotationSchema.index({ proposalId: 1, createdAt: -1 });

module.exports = mongoose.model('DealRoomAnnotation', dealRoomAnnotationSchema);
