const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Tour',
    required: [true, 'Booking must belong to a Tour!']
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking must belong to a User!']
  },
  price: {
    type: Number,
    require: [true, 'Booking must have a price.']
  },
  originalPrice: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now()
  },
  paid: {
    type: Boolean,
    default: true
  },
  // New fields for cancellation and refund support
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled', 'refunded', 'completed'],
    default: 'confirmed'
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason must be less than 500 characters']
  },
  cancelledAt: Date,
  refundedAt: Date,
  refundAmount: Number,
  stripeSessionId: String,
  stripePaymentIntentId: String,
  stripeRefundId: String,
  // Coupon support
  coupon: {
    type: mongoose.Schema.ObjectId,
    ref: 'Coupon'
  },
  couponCode: String,
  discountAmount: {
    type: Number,
    default: 0
  },
  // Booking details
  startDate: Date,
  numParticipants: {
    type: Number,
    default: 1,
    min: [1, 'Must have at least 1 participant']
  },
  specialRequests: {
    type: String,
    maxlength: [1000, 'Special requests must be less than 1000 characters']
  }
});

bookingSchema.pre(/^find/, function(next) {
  this.populate('user').populate({
    path: 'tour',
    select: 'name'
  });
  next();
});

bookingSchema.index({ user: 1, tour: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
