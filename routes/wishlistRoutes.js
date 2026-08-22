const express = require('express');
const wishlistController = require('../controllers/wishlistController');
const authController = require('../controllers/authController');

const router = express.Router();

// All wishlist routes require authentication
router.use(authController.protect);

router.get('/', wishlistController.getMyWishlist);

router
  .route('/:tourId')
  .post(wishlistController.addToWishlist)
  .delete(wishlistController.removeFromWishlist)
  .get(wishlistController.checkWishlist);

module.exports = router;
