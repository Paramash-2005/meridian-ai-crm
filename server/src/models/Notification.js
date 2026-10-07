const { Schema, model } = require('mongoose');

const notificationSchema = new Schema(
  {
    // null recipient = broadcast to admins (see routes/queries).
    recipient: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    audience: { type: String, enum: ['user', 'admins', 'all'], default: 'user' },
    type: { type: String, required: true },
    message: { type: String, required: true },
    lead: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('Notification', notificationSchema);
