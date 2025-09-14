const notificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');

const notificationController = {
  getNotifications: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        type: req.query.type,
        category: req.query.category,
        priority: req.query.priority,
        unreadOnly: req.query.unreadOnly === 'true',
        includeArchived: req.query.includeArchived === 'true'
      };

      const result = await notificationService.getUserNotifications(req.user._id, options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notifications'
      });
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      const count = await notificationService.getUnreadCount(req.user._id);

      res.json({
        success: true,
        data: {
          unreadCount: count
        }
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get unread count'
      });
    }
  },

  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await notificationService.markAsRead(id, req.user._id);

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: {
          notification
        }
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark notification as read'
      });
    }
  },

  markAllAsRead: async (req, res) => {
    try {
      const result = await notificationService.markAllAsRead(req.user._id);

      res.json({
        success: true,
        message: 'All notifications marked as read',
        data: {
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read'
      });
    }
  },

  markMultipleAsRead: async (req, res) => {
    try {
      const { notificationIds } = req.body;

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({
          success: false,
          error: 'Notification IDs array is required'
        });
      }

      const result = await notificationService.markMultipleAsRead(notificationIds, req.user._id);

      res.json({
        success: true,
        message: 'Notifications marked as read',
        data: {
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('Mark multiple as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notifications as read'
      });
    }
  },

  archiveNotification: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await notificationService.archiveNotification(id, req.user._id);

      res.json({
        success: true,
        message: 'Notification archived',
        data: {
          notification
        }
      });
    } catch (error) {
      console.error('Archive notification error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to archive notification'
      });
    }
  },

  getNotificationStats: async (req, res) => {
    try {
      const { dateRange } = req.query;
      
      let dateRangeObj = null;
      if (dateRange) {
        const dates = dateRange.split(',');
        if (dates.length === 2) {
          dateRangeObj = {
            start: new Date(dates[0]),
            end: new Date(dates[1])
          };
        }
      }

      const stats = await notificationService.getNotificationStats(req.user._id, dateRangeObj);

      res.json({
        success: true,
        data: {
          stats
        }
      });
    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notification statistics'
      });
    }
  }
};

module.exports = notificationController;
