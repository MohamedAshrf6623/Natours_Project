const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Notification must belong to a user']
    },
    type: {
      type: String,
      enum: [
        'booking_confirmed',
        'booking_cancelled',
        'review_received',
        'password_changed',
        'promo_code',
        'welcome',
        'system'
      ],
      required: [true, 'Notification must have a type']
    },
    title: {
      type: String,
      required: [true, 'Notification must have a title']
    },
    message: {
      type: String,
      required: [true, 'Notification must have a message']
    },
    read: {
      type: Boolean,
      default: false
    },
    link: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

// Static method to create a notification
notificationSchema.statics.createNotification = async function({
  user,
  type,
  title,
  message,
  link
}) {
  return await this.create({ user, type, title, message, link });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
