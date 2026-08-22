const express = require('express');
const couponController = require('../controllers/couponController');
const authController = require('../controllers/authController');

const router = express.Router();

// All coupon routes require authentication
router.use(authController.protect);

// User routes
router.post('/validate', couponController.validateCoupon);

// Admin routes
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(couponController.getAllCoupons)
  .post(couponController.createCoupon);

router
  .route('/:id')
  .get(couponController.getCoupon)
  .patch(couponController.updateCoupon)
  .delete(couponController.deleteCoupon);

module.exports = router;
