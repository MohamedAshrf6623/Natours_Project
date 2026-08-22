const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Wishlist item must belong to a user']
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Wishlist item must reference a tour']
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

// Each user can only add a tour once to their wishlist
wishlistSchema.index({ user: 1, tour: 1 }, { unique: true });

wishlistSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'tour',
    select: 'name imageCover price ratingsAverage summary duration'
  });
  next();
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;
