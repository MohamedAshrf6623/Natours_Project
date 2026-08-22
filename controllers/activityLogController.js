const ActivityLog = require('../models/activityLogModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

// Get my activity logs
exports.getMyActivity = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 20;
  const skip = (page - 1) * limit;

  const filter = { user: req.user.id };

  // Optional filter by action type
  if (req.query.action) {
    filter.action = req.query.action;
  }

  const logs = await ActivityLog.find(filter)
    .sort('-createdAt')
    .skip(skip)
    .limit(limit);

  const total = await ActivityLog.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: logs.length,
    total,
    data: {
      logs
    }
  });
});

// Admin: Get all activity logs
exports.getAllActivity = factory.getAll(ActivityLog);

// Admin: Get activity logs for a specific user
exports.getUserActivity = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 50;
  const skip = (page - 1) * limit;

  const logs = await ActivityLog.find({ user: req.params.userId })
    .sort('-createdAt')
    .skip(skip)
    .limit(limit);

  const total = await ActivityLog.countDocuments({ user: req.params.userId });

  res.status(200).json({
    status: 'success',
    results: logs.length,
    total,
    data: {
      logs
    }
  });
});

// Admin: Get activity summary/stats
exports.getActivityStats = catchAsync(async (req, res, next) => {
  const stats = await ActivityLog.aggregate([
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$createdAt' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const dailyStats = await ActivityLog.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        totalActions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' }
      }
    },
    {
      $addFields: {
        uniqueUsersCount: { $size: '$uniqueUsers' }
      }
    },
    {
      $project: {
        uniqueUsers: 0
      }
    },
    {
      $sort: { _id: -1 }
    },
    {
      $limit: 30
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      actionStats: stats,
      dailyStats
    }
  });
});
