const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const Coupon = require('../models/couponModel');
const Notification = require('../models/notificationModel');
const ActivityLog = require('../models/activityLogModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get the currently booked tour
  const tour = await Tour.findById(req.params.tourId);
  // console.log(tour);

  let finalPrice = tour.price;
  let couponDoc = null;
  let discountAmount = 0;

  // 2) Apply coupon if provided
  if (req.query.coupon) {
    couponDoc = await Coupon.findOne({
      code: req.query.coupon.toUpperCase(),
      active: true
    });

    if (couponDoc && couponDoc.isValid) {
      discountAmount = couponDoc.calculateDiscount(tour.price);
      finalPrice = tour.price - discountAmount;

      // Increment coupon usage
      couponDoc.currentUses += 1;
      await couponDoc.save({ validateBeforeSave: false });
    }
  }

  // 3) Create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    // success_url: `${req.protocol}://${req.get('host')}/my-tours/?tour=${
    //   req.params.tourId
    // }&user=${req.user.id}&price=${tour.price}`,
    success_url: `${req.protocol}://${req.get('host')}/my-tours?alert=booking`,
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.tourId,
    line_items: [
      {
        name: `${tour.name} Tour`,
        description: tour.summary,
        images: [
          `${req.protocol}://${req.get('host')}/img/tours/${tour.imageCover}`
        ],
        amount: Math.round(finalPrice * 100),
        currency: 'usd',
        quantity: 1
      }
    ],
    metadata: {
      couponCode: couponDoc ? couponDoc.code : '',
      couponId: couponDoc ? couponDoc._id.toString() : '',
      discountAmount: discountAmount.toString(),
      originalPrice: tour.price.toString()
    }
  });

  // 4) Create session as response
  res.status(200).json({
    status: 'success',
    session
  });
});

const createBookingCheckout = async session => {
  const tour = session.client_reference_id;
  const user = (await User.findOne({ email: session.customer_email })).id;
  const price = session.display_items[0].amount / 100;
  const metadata = session.metadata || {};

  const bookingData = {
    tour,
    user,
    price,
    originalPrice: metadata.originalPrice
      ? parseFloat(metadata.originalPrice)
      : price,
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
    status: 'confirmed'
  };

  // Add coupon info if used
  if (metadata.couponCode) {
    bookingData.couponCode = metadata.couponCode;
    bookingData.coupon = metadata.couponId;
    bookingData.discountAmount = parseFloat(metadata.discountAmount) || 0;
  }

  const booking = await Booking.create(bookingData);

  // Create notification for the user
  await Notification.createNotification({
    user,
    type: 'booking_confirmed',
    title: 'Booking Confirmed! 🎉',
    message: `Your booking has been confirmed. Amount: $${price}`,
    link: '/my-tours'
  });

  // Log activity
  await ActivityLog.logActivity({
    user,
    action: 'booking_create',
    description: `Created booking for tour ${tour}`,
    metadata: { bookingId: booking._id, price }
  });
};

exports.webhookCheckout = (req, res, next) => {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed')
    createBookingCheckout(event.data.object);

  res.status(200).json({ received: true });
};

// Cancel a booking
exports.cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Check if the user owns this booking or is admin
  if (
    booking.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You do not have permission to cancel this booking', 403)
    );
  }

  if (booking.status === 'cancelled' || booking.status === 'refunded') {
    return next(new AppError('This booking has already been cancelled', 400));
  }

  // Update booking status
  booking.status = 'cancelled';
  booking.cancellationReason = req.body.reason || 'User requested cancellation';
  booking.cancelledAt = Date.now();
  await booking.save({ validateBeforeSave: false });

  // Create notification
  await Notification.createNotification({
    user: booking.user._id,
    type: 'booking_cancelled',
    title: 'Booking Cancelled',
    message: `Your booking has been cancelled. ${
      booking.paid ? 'A refund will be processed shortly.' : ''
    }`,
    link: '/my-tours'
  });

  // Log activity
  await ActivityLog.logActivity({
    user: req.user.id,
    action: 'booking_cancel',
    description: `Cancelled booking ${booking._id}`,
    metadata: {
      bookingId: booking._id,
      reason: booking.cancellationReason
    },
    req
  });

  res.status(200).json({
    status: 'success',
    data: {
      booking
    }
  });
});

// Process refund for a cancelled booking
exports.refundBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  if (booking.status !== 'cancelled') {
    return next(new AppError('Only cancelled bookings can be refunded', 400));
  }

  if (booking.status === 'refunded') {
    return next(new AppError('This booking has already been refunded', 400));
  }

  let refund;
  // Process Stripe refund if payment intent exists
  if (booking.stripePaymentIntentId) {
    try {
      refund = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: Math.round(booking.price * 100)
      });
    } catch (err) {
      return next(
        new AppError(`Refund failed: ${err.message}`, 500)
      );
    }
  }

  // Update booking
  booking.status = 'refunded';
  booking.refundedAt = Date.now();
  booking.refundAmount = booking.price;
  if (refund) booking.stripeRefundId = refund.id;
  await booking.save({ validateBeforeSave: false });

  // Notify user
  await Notification.createNotification({
    user: booking.user._id,
    type: 'booking_cancelled',
    title: 'Refund Processed 💰',
    message: `Your refund of $${booking.price} has been processed. It may take 5-10 business days to appear on your statement.`,
    link: '/my-tours'
  });

  res.status(200).json({
    status: 'success',
    data: {
      booking
    }
  });
});

// Get my bookings (with enhanced status info)
exports.getMyBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id }).sort(
    '-createdAt'
  );

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings
    }
  });
});

// Get booking stats (admin)
exports.getBookingStats = catchAsync(async (req, res, next) => {
  const stats = await Booking.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$price' },
        avgPrice: { $avg: '$price' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const monthlyRevenue = await Booking.aggregate([
    {
      $match: { status: { $in: ['confirmed', 'completed'] } }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$price' },
        bookings: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1 }
    },
    {
      $limit: 12
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
      monthlyRevenue
    }
  });
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
