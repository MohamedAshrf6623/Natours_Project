const Notification = require('../models/notificationModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

exports.getMyNotifications = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 20;
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({ user: req.user.id })
    .sort('-createdAt')
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments({ user: req.user.id });
  const unreadCount = await Notification.countDocuments({
    user: req.user.id,
    read: false
  });

  res.status(200).json({
    status: 'success',
    results: notifications.length,
    total,
    unreadCount,
    data: {
      notifications
    }
  });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      notification
    }
  });
});

exports.markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    { user: req.user.id, read: false },
    { read: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read'
  });
});

exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id
  });

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.deleteAllNotifications = catchAsync(async (req, res, next) => {
  await Notification.deleteMany({ user: req.user.id });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Helper: Create notification for a user (used internally)
exports.createNotification = async ({ user, type, title, message, link }) => {
  try {
    await Notification.createNotification({
      user,
      type,
      title,
      message,
      link
    });
  } catch (err) {
    console.error('Error creating notification:', err.message);
  }
};

// Admin: Get all notifications
exports.getAllNotifications = factory.getAll(Notification);
