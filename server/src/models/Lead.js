const { Schema, model } = require('mongoose');

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const SOURCES = ['Website', 'Referral', 'Cold Call', 'Event', 'Advertising', 'Other'];

const noteSchema = new Schema(
  {
    text: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    sentiment: {
      label: { type: String, enum: ['positive', 'neutral', 'negative'], default: null },
      confidence: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

const activitySchema = new Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    source: { type: String, enum: SOURCES, default: 'Other' },
    status: { type: String, enum: STATUSES, default: 'New' },
    value: { type: Number, default: 0 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

    ai: {
      score: { type: Number, default: null },
      rationale: { type: String, default: null },
      status: { type: String, enum: ['pending', 'done', 'failed', 'skipped'], default: 'pending' },
      scoredAt: { type: Date, default: null },
      mock: { type: Boolean, default: false },
    },

    notes: [noteSchema],
    activities: [activitySchema],
  },
  { timestamps: true }
);

leadSchema.index({ assignedTo: 1, status: 1 });

module.exports = model('Lead', leadSchema);
