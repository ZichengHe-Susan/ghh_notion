const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('./emailService');

class NotificationService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
  }

  async createNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      
      // Send real-time notification via Socket.IO
      this.sendRealtimeNotification(notification);
      
      if (!this.isProcessing) {
        this.startProcessing();
      }
      
      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  async createBulkNotifications(notificationsData) {
    try {
      const notifications = await Notification.insertMany(notificationsData);
      
      // Send real-time notifications for each
      notifications.forEach(notification => {
        this.sendRealtimeNotification(notification);
      });
      
      if (!this.isProcessing) {
        this.startProcessing();
      }
      
      return notifications;
    } catch (error) {
      console.error('Create bulk notifications error:', error);
      throw error;
    }
  }

  // Send real-time notification via Socket.IO
  sendRealtimeNotification(notification) {
    try {
      if (global.io) {
        global.io.to(`user_${notification.user}`).emit('new_notification', {
          notification: {
            _id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            category: notification.category,
            priority: notification.priority,
            createdAt: notification.createdAt,
            data: notification.data
          }
        });
      }
    } catch (error) {
      console.error('Send realtime notification error:', error);
    }
  }

  async getUserNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        category,
        priority,
        unreadOnly = false,
        includeArchived = false
      } = options;

      const skip = (page - 1) * limit;
      const filter = { user: userId };

      if (!includeArchived) {
        filter.isArchived = false;
      }

      if (type) filter.type = type;
      if (category) filter.category = category;
      if (priority) filter.priority = priority;
      if (unreadOnly) filter['channels.inApp.read'] = false;

      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('data.order', 'orderNumber totalAmount')
        .populate('data.item', 'title price images')
        .populate('data.payment', 'amount currency')
        .populate('data.review', 'rating comment')
        .lean();

      const totalNotifications = await Notification.countDocuments(filter);

      return {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalNotifications / limit),
          totalNotifications,
          hasNext: page * limit < totalNotifications,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Get user notifications error:', error);
      throw error;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        user: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();
      return notification;
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  async markMultipleAsRead(notificationIds, userId) {
    try {
      const result = await Notification.updateMany(
        {
          _id: { $in: notificationIds },
          user: userId
        },
        {
          $set: {
            'channels.inApp.read': true,
            'channels.inApp.readAt': new Date()
          }
        }
      );

      return result;
    } catch (error) {
      console.error('Mark multiple as read error:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        {
          user: userId,
          'channels.inApp.read': false,
          isArchived: false
        },
        {
          $set: {
            'channels.inApp.read': true,
            'channels.inApp.readAt': new Date()
          }
        }
      );

      return result;
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  }

  async archiveNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        user: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.archive();
      return notification;
    } catch (error) {
      console.error('Archive notification error:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        user: userId,
        'channels.inApp.read': false,
        isArchived: false
      });

      return count;
    } catch (error) {
      console.error('Get unread count error:', error);
      throw error;
    }
  }

  async getNotificationStats(userId = null, dateRange = null) {
    try {
      return await Notification.getNotificationStats(userId, dateRange);
    } catch (error) {
      console.error('Get notification stats error:', error);
      throw error;
    }
  }

  async sendEmailNotification(notification) {
    try {
      const user = await User.findById(notification.user);
      if (!user || !user.profile.preferences.notifications.email) {
        return false;
      }

      const emailSent = await emailService.sendNotificationEmail(
        user,
        notification.title,
        notification.message,
        notification.data.url || null
      );

      if (emailSent) {
        await notification.markEmailSent(emailSent.messageId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Send email notification error:', error);
      return false;
    }
  }

  async sendPushNotification(notification) {
    try {
      const user = await User.findById(notification.user);
      if (!user || !user.profile.preferences.notifications.push) {
        return false;
      }

      console.log('Push notification would be sent:', {
        userId: user._id,
        title: notification.title,
        message: notification.message
      });

      await notification.markPushSent('placeholder-push-id', 'placeholder-device-token');
      return true;
    } catch (error) {
      console.error('Send push notification error:', error);
      return false;
    }
  }

  async sendSmsNotification(notification) {
    try {
      const user = await User.findById(notification.user);
      if (!user || !user.profile.preferences.notifications.sms) {
        return false;
      }

      console.log('SMS notification would be sent:', {
        userId: user._id,
        phone: user.profile.phone,
        message: notification.message
      });

      await notification.markSmsSent('placeholder-sms-id');
      return true;
    } catch (error) {
      console.error('Send SMS notification error:', error);
      return false;
    }
  }

  async processPendingNotifications() {
    try {
      this.isProcessing = true;
      
      const pendingNotifications = await Notification.findPendingNotifications();
      
      for (const notification of pendingNotifications) {
        try {
          const promises = [];

          if (notification.channels.email.enabled && !notification.channels.email.sent) {
            promises.push(this.sendEmailNotification(notification));
          }

          if (notification.channels.push.enabled && !notification.channels.push.sent) {
            promises.push(this.sendPushNotification(notification));
          }

          if (notification.channels.sms.enabled && !notification.channels.sms.sent) {
            promises.push(this.sendSmsNotification(notification));
          }

          await Promise.allSettled(promises);

          notification.status = 'sent';
          await notification.save();

        } catch (error) {
          console.error(`Failed to process notification ${notification._id}:`, error);
          
          if (notification.retryCount >= 3) {
            notification.status = 'failed';
            await notification.save();
          }
        }
      }

    } catch (error) {
      console.error('Process pending notifications error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  startProcessing() {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processPendingNotifications();
    }, 30000); 

    this.processPendingNotifications();
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
  }

  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.archiveExpiredNotifications();
      console.log(`Archived ${result.modifiedCount} expired notifications`);
      return result;
    } catch (error) {
      console.error('Cleanup expired notifications error:', error);
      throw error;
    }
  }

  async createOrderNotification(order, type, additionalData = {}) {
    const notificationData = {
      user: order.seller,
      type: type,
      category: 'transaction',
      priority: 'high',
      data: {
        order: order._id,
        amount: order.pricing.total,
        currency: order.currency || 'USD',
        ...additionalData
      }
    };

    switch (type) {
      case 'order_created':
        notificationData.title = 'New Order Received';
        notificationData.message = `You have received a new order for $${order.pricing.total}`;
        break;
      case 'order_confirmed':
        notificationData.title = 'Order Confirmed';
        notificationData.message = `Order #${order.orderNumber} has been confirmed`;
        break;
      case 'order_shipped':
        notificationData.title = 'Order Shipped';
        notificationData.message = `Order #${order.orderNumber} has been shipped`;
        break;
      case 'order_delivered':
        notificationData.title = 'Order Delivered';
        notificationData.message = `Order #${order.orderNumber} has been delivered`;
        break;
      case 'order_cancelled':
        notificationData.title = 'Order Cancelled';
        notificationData.message = `Order #${order.orderNumber} has been cancelled`;
        break;
      case 'order_shipping_reminder':
        notificationData.title = 'Reminder to Ship Your Order';
        notificationData.message = `Please remember to ship order #${order.orderNumber}.`;
        break;
    }

    return await this.createNotification(notificationData);
  }

  async createItemNotification(item, type, additionalData = {}) {
    const notificationData = {
      user: item.seller,
      type: type,
      category: 'transaction',
      priority: 'normal',
      data: {
        item: item._id,
        ...additionalData
      }
    };

    switch (type) {
      case 'item_sold':
        notificationData.title = 'Item Sold';
        notificationData.message = `Your item "${item.title}" has been sold`;
        break;
      case 'item_viewed':
        notificationData.title = 'Item Viewed';
        notificationData.message = `Your item "${item.title}" has been viewed`;
        break;
      case 'item_favorited':
        notificationData.title = 'Item Favorited';
        notificationData.message = `Your item "${item.title}" has been favorited`;
        break;
      case 'item_expired':
        notificationData.title = 'Item Expired';
        notificationData.message = `Your item "${item.title}" has expired`;
        break;
    }

    return await this.createNotification(notificationData);
  }

  async createReviewNotification(review, type, additionalData = {}) {
    const notificationData = {
      user: review.reviewee,
      type: type,
      category: 'communication',
      priority: 'normal',
      data: {
        review: review._id,
        ...additionalData
      }
    };

    switch (type) {
      case 'review_received':
        notificationData.title = 'New Review Received';
        notificationData.message = `You received a ${review.rating}-star review`;
        break;
      case 'review_approved':
        notificationData.title = 'Review Approved';
        notificationData.message = 'Your review has been approved';
        break;
      case 'review_rejected':
        notificationData.title = 'Review Rejected';
        notificationData.message = 'Your review has been rejected';
        break;
    }

    return await this.createNotification(notificationData);
  }

  async createAccountNotification(user, type, additionalData = {}) {
    const notificationData = {
      user: user._id,
      type: type,
      category: 'account',
      priority: 'normal',
      data: additionalData
    };

    switch (type) {
      case 'account_verified':
        notificationData.title = 'Account Verified';
        notificationData.message = 'Your account has been verified';
        break;
      case 'password_changed':
        notificationData.title = 'Password Changed';
        notificationData.message = 'Your password has been successfully changed';
        break;
      case 'email_verified':
        notificationData.title = 'Email Verified';
        notificationData.message = 'Your email has been verified';
        break;
    }

    return await this.createNotification(notificationData);
  }

  async createSystemNotification(user, type, additionalData = {}) {
    const notificationData = {
      user: user._id,
      type: type,
      category: 'system',
      priority: 'normal',
      data: additionalData
    };

    switch (type) {
      case 'system_maintenance':
        notificationData.title = 'System Maintenance';
        notificationData.message = 'The system will be under maintenance';
        notificationData.priority = 'high';
        break;
      case 'system_update':
        notificationData.title = 'System Update';
        notificationData.message = 'The system has been updated';
        break;
      case 'feature_announcement':
        notificationData.title = 'New Feature';
        notificationData.message = 'A new feature is now available';
        break;
    }

    return await this.createNotification(notificationData);
  }

  // Chat-specific notification methods
  async createChatNotification(conversation, message, type, additionalData = {}) {
    const otherParticipant = conversation.participants.find(
      p => p.user.toString() !== message.sender.toString()
    );

    if (!otherParticipant) return null;

    const notificationData = {
      user: otherParticipant.user,
      type: type,
      category: 'communication',
      priority: 'normal',
      data: {
        conversation: conversation._id,
        message: message._id,
        sender: message.sender,
        ...additionalData
      }
    };

    switch (type) {
      case 'new_message':
        notificationData.title = 'New Message';
        notificationData.message = `You have a new message in "${conversation.subject}"`;
        break;
      case 'message_reaction':
        notificationData.title = 'Message Reaction';
        notificationData.message = `Someone reacted to your message`;
        break;
      case 'conversation_created':
        notificationData.title = 'New Conversation';
        notificationData.message = `A new conversation has been started: "${conversation.subject}"`;
        break;
      case 'order_update_in_chat':
        notificationData.title = 'Order Update';
        notificationData.message = `Order status updated in conversation`;
        notificationData.priority = 'high';
        break;
    }

    return await this.createNotification(notificationData);
  }

  async createTypingNotification(conversationId, userId, isTyping) {
    try {
      if (global.io) {
        global.io.to(`conversation_${conversationId}`).emit('typing_indicator', {
          userId,
          isTyping,
          conversationId
        });
      }
    } catch (error) {
      console.error('Send typing notification error:', error);
    }
  }

  async createOnlineStatusNotification(userId, isOnline) {
    try {
      if (global.io) {
        const event = isOnline ? 'user_online' : 'user_offline';
        global.io.emit(event, {
          userId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Send online status notification error:', error);
    }
  }
}

const notificationService = new NotificationService();

module.exports = notificationService;
