const Wishlist = require('../models/wishlistModel');
const Notification = require('../models/notificationModel');
const ActivityLog = require('../models/activityLogModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

exports.addToWishlist = catchAsync(async (req, res, next) => {
  // Check if already in wishlist
  const existing = await Wishlist.findOne({
    user: req.user.id,
    tour: req.params.tourId
  });

  if (existing) {
    return next(new AppError('Tour is already in your wishlist', 400));
  }

  const wishlistItem = await Wishlist.create({
    user: req.user.id,
    tour: req.params.tourId
  });

  // Log activity
  await ActivityLog.logActivity({
    user: req.user.id,
    action: 'wishlist_add',
    description: `Added tour ${req.params.tourId} to wishlist`,
    metadata: { tourId: req.params.tourId },
    req
  });

  res.status(201).json({
    status: 'success',
    data: {
      wishlistItem
    }
  });
});

exports.removeFromWishlist = catchAsync(async (req, res, next) => {
  const wishlistItem = await Wishlist.findOneAndDelete({
    user: req.user.id,
    tour: req.params.tourId
  });

  if (!wishlistItem) {
    return next(new AppError('Tour not found in your wishlist', 404));
  }

  // Log activity
  await ActivityLog.logActivity({
    user: req.user.id,
    action: 'wishlist_remove',
    description: `Removed tour ${req.params.tourId} from wishlist`,
    metadata: { tourId: req.params.tourId },
    req
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getMyWishlist = catchAsync(async (req, res, next) => {
  const wishlist = await Wishlist.find({ user: req.user.id }).sort(
    '-createdAt'
  );

  res.status(200).json({
    status: 'success',
    results: wishlist.length,
    data: {
      wishlist
    }
  });
});

exports.checkWishlist = catchAsync(async (req, res, next) => {
  const item = await Wishlist.findOne({
    user: req.user.id,
    tour: req.params.tourId
  });

  res.status(200).json({
    status: 'success',
    data: {
      isInWishlist: !!item
    }
  });
});
