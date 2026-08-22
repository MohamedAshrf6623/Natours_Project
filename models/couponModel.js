const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon must have a code'],
      unique: true,
      uppercase: true,
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Coupon must have a description']
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Coupon must have a discount type']
    },
    discountValue: {
      type: Number,
      required: [true, 'Coupon must have a discount value'],
      min: [0, 'Discount value must be positive']
    },
    minBookingAmount: {
      type: Number,
      default: 0
    },
    maxDiscountAmount: {
      type: Number,
      default: null
    },
    validFrom: {
      type: Date,
      required: [true, 'Coupon must have a start date']
    },
    validUntil: {
      type: Date,
      required: [true, 'Coupon must have an expiry date']
    },
    maxUses: {
      type: Number,
      default: null
    },
    currentUses: {
      type: Number,
      default: 0
    },
    maxUsesPerUser: {
      type: Number,
      default: 1
    },
    applicableTours: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Tour'
      }
    ],
    active: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
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

couponSchema.index({ code: 1 });
couponSchema.index({ validUntil: 1 });

// Virtual to check if coupon is currently valid
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return (
    this.active &&
    now >= this.validFrom &&
    now <= this.validUntil &&
    (this.maxUses === null || this.currentUses < this.maxUses)
  );
});

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(originalPrice) {
  let discount;
  if (this.discountType === 'percentage') {
    discount = (originalPrice * this.discountValue) / 100;
  } else {
    discount = this.discountValue;
  }

  // Apply max discount cap
  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    discount = this.maxDiscountAmount;
  }

  return Math.min(discount, originalPrice);
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
