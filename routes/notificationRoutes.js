const express = require('express');
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');

const router = express.Router();

// All notification routes require authentication
router.use(authController.protect);

// User routes
router.get('/', notificationController.getMyNotifications);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.delete('/delete-all', notificationController.deleteAllNotifications);

router
  .route('/:id')
  .patch(notificationController.markAsRead)
  .delete(notificationController.deleteNotification);

// Admin routes
router.get(
  '/admin/all',
  authController.restrictTo('admin'),
  notificationController.getAllNotifications
);

module.exports = router;
