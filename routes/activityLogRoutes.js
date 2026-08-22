const express = require('express');
const activityLogController = require('../controllers/activityLogController');
const authController = require('../controllers/authController');

const router = express.Router();

// All activity log routes require authentication
router.use(authController.protect);

// User routes
router.get('/me', activityLogController.getMyActivity);

// Admin routes
router.use(authController.restrictTo('admin'));

router.get('/', activityLogController.getAllActivity);
router.get('/stats', activityLogController.getActivityStats);
router.get('/user/:userId', activityLogController.getUserActivity);

module.exports = router;
