const express = require('express');
const router = express.Router();

// Import controllers
const notificationController = require('../controllers/notificationController');

// Import middleware
const { auth } = require('../middleware/auth');
const { validateNotificationQuery } = require('../middleware/validation');

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', auth, validateNotificationQuery, notificationController.getNotifications);

// @route   GET /api/notifications/unread-count
// @desc    Get unread notifications count
// @access  Private
router.get('/unread-count', auth, notificationController.getUnreadCount);

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, notificationController.markAsRead);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, notificationController.markAllAsRead);

// @route   PUT /api/notifications/read-multiple
// @desc    Mark multiple notifications as read
// @access  Private
router.put('/read-multiple', auth, notificationController.markMultipleAsRead);

// @route   PUT /api/notifications/:id/archive
// @desc    Archive notification
// @access  Private
router.put('/:id/archive', auth, notificationController.archiveNotification);

// @route   GET /api/notifications/stats
// @desc    Get notification statistics
// @access  Private
router.get('/stats', auth, notificationController.getNotificationStats);

module.exports = router;
