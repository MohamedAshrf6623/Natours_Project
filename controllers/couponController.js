const Coupon = require('../models/couponModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// Admin: Create coupon
exports.createCoupon = catchAsync(async (req, res, next) => {
  req.body.createdBy = req.user.id;
  const coupon = await Coupon.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

// Validate a coupon code
exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, tourId, bookingAmount } = req.body;

  if (!code) {
    return next(new AppError('Please provide a coupon code', 400));
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });

  if (!coupon) {
    return next(new AppError('Invalid coupon code', 404));
  }

  // Check if coupon is active
  if (!coupon.active) {
    return next(new AppError('This coupon is no longer active', 400));
  }

  // Check validity dates
  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    return next(new AppError('This coupon has expired or is not yet valid', 400));
  }

  // Check max uses
  if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
    return next(new AppError('This coupon has reached its maximum uses', 400));
  }

  // Check per-user usage limit
  if (coupon.maxUsesPerUser) {
    const userUsageCount = await Booking.countDocuments({
      user: req.user.id,
      coupon: coupon._id
    });
    if (userUsageCount >= coupon.maxUsesPerUser) {
      return next(
        new AppError('You have already used this coupon the maximum number of times', 400)
      );
    }
  }

  // Check applicable tours
  if (coupon.applicableTours.length > 0 && tourId) {
    if (!coupon.applicableTours.includes(tourId)) {
      return next(new AppError('This coupon is not valid for this tour', 400));
    }
  }

  // Check minimum booking amount
  if (bookingAmount && bookingAmount < coupon.minBookingAmount) {
    return next(
      new AppError(
        `Minimum booking amount for this coupon is $${coupon.minBookingAmount}`,
        400
      )
    );
  }

  // Calculate discount
  const discount = coupon.calculateDiscount(bookingAmount || 0);

  res.status(200).json({
    status: 'success',
    data: {
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      originalPrice: bookingAmount || 0,
      discount,
      finalPrice: (bookingAmount || 0) - discount
    }
  });
});

// Apply coupon (increment usage) - used internally after booking
exports.applyCoupon = async (couponCode, userId) => {
  const coupon = await Coupon.findOneAndUpdate(
    { code: couponCode.toUpperCase() },
    { $inc: { currentUses: 1 } },
    { new: true }
  );
  return coupon;
};

// Admin CRUD
exports.getAllCoupons = factory.getAll(Coupon);
exports.getCoupon = factory.getOne(Coupon);
exports.updateCoupon = factory.updateOne(Coupon);
exports.deleteCoupon = factory.deleteOne(Coupon);
