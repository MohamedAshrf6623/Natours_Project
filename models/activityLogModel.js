const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Activity log must belong to a user']
  },
  action: {
    type: String,
    required: [true, 'Activity log must have an action'],
    enum: [
      'login',
      'logout',
      'signup',
      'oauth_login',
      'password_change',
      'password_reset',
      'profile_update',
      'photo_upload',
      'tour_create',
      'tour_update',
      'tour_delete',
      'booking_create',
      'booking_cancel',
      'review_create',
      'review_update',
      'review_delete',
      'wishlist_add',
      'wishlist_remove',
      'coupon_apply',
      '2fa_enable',
      '2fa_disable',
      'account_deactivate'
    ]
  },
  description: {
    type: String,
    required: [true, 'Activity log must have a description']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

// Static method to log activity
activityLogSchema.statics.logActivity = async function({
  user,
  action,
  description,
  metadata,
  req
}) {
  return await this.create({
    user,
    action,
    description,
    metadata,
    ipAddress: req ? req.ip : undefined,
    userAgent: req ? req.headers['user-agent'] : undefined
  });
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
