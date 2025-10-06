const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'order_created', 'order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled',
      'order_shipping_reminder',
      'payment_received', 'payment_failed', 'payment_refunded',
      'item_sold', 'item_viewed', 'item_favorited', 'item_expired',
      'message_received', 'message_sent',
      'review_received', 'review_approved', 'review_rejected',
      'account_verified', 'password_changed', 'email_verified',
      'system_maintenance', 'system_update', 'feature_announcement',
      'dispute_opened', 'dispute_resolved',
      'admin_action', 'account_suspended', 'account_activated',
      'promotional', 'reminder', 'alert'
    ]
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  data: {
    // Related entity references
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item'
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review'
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    // Additional data
    amount: Number,
    currency: String,
    url: String,
    imageUrl: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  channels: {
    inApp: {
      enabled: {
        type: Boolean,
        default: true
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      read: {
        type: Boolean,
        default: false
      },
      readAt: Date
    },
    email: {
      enabled: {
        type: Boolean,
      default: true
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      delivered: {
        type: Boolean,
        default: false
      },
      deliveredAt: Date,
      opened: {
        type: Boolean,
        default: false
      },
      openedAt: Date,
      clicked: {
        type: Boolean,
        default: false
      },
      clickedAt: Date,
      emailId: String // For tracking email delivery
    },
    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      delivered: {
        type: Boolean,
        default: false
      },
      deliveredAt: Date,
      clicked: {
        type: Boolean,
        default: false
      },
      clickedAt: Date,
      deviceToken: String,
      pushId: String
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      delivered: {
        type: Boolean,
        default: false
      },
      deliveredAt: Date,
      smsId: String
    }
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'cancelled'],
    default: 'pending'
  },
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiration: 30 days for most notifications, 7 days for urgent
      const expirationDays = this.priority === 'urgent' ? 7 : 30;
      return new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    }
  },
  category: {
    type: String,
    enum: ['transaction', 'communication', 'account', 'system', 'marketing', 'security'],
    required: true
  },
  tags: [String],
  metadata: {
    source: {
      type: String,
      default: 'system'
    },
    campaignId: String,
    templateId: String,
    userId: String, // User who triggered the notification
    ipAddress: String,
    userAgent: String
  },
  analytics: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    }
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for notification age
notificationSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual for is read
notificationSchema.virtual('isRead').get(function() {
  return this.channels.inApp.read;
});

// Virtual for click-through rate
notificationSchema.virtual('clickThroughRate').get(function() {
  return this.analytics.impressions > 0 ? 
    (this.analytics.clicks / this.analytics.impressions) * 100 : 0;
});

// Indexes for better query performance
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ category: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ isArchived: 1, createdAt: -1 });

// Compound indexes
notificationSchema.index({ user: 1, status: 1, createdAt: -1 });
notificationSchema.index({ user: 1, 'channels.inApp.read': 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1, createdAt: -1 });
notificationSchema.index({ category: 1, priority: 1, createdAt: -1 });

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Auto-archive expired notifications
  if (!this.isArchived && this.isExpired) {
    this.isArchived = true;
    this.archivedAt = new Date();
  }

  // Set category based on type if not provided
  if (this.isNew && !this.category) {
    const categoryMap = {
      'order_created': 'transaction',
      'order_confirmed': 'transaction',
      'order_shipped': 'transaction',
      'order_delivered': 'transaction',
      'order_cancelled': 'transaction',
      'order_shipping_reminder': 'transaction',
      'payment_received': 'transaction',
      'payment_failed': 'transaction',
      'payment_refunded': 'transaction',
      'item_sold': 'transaction',
      'item_viewed': 'transaction',
      'item_favorited': 'transaction',
      'item_expired': 'transaction',
      'message_received': 'communication',
      'message_sent': 'communication',
      'review_received': 'communication',
      'review_approved': 'communication',
      'review_rejected': 'communication',
      'account_verified': 'account',
      'password_changed': 'account',
      'email_verified': 'account',
      'system_maintenance': 'system',
      'system_update': 'system',
      'feature_announcement': 'system',
      'dispute_opened': 'security',
      'dispute_resolved': 'security',
      'admin_action': 'security',
      'account_suspended': 'security',
      'account_activated': 'security',
      'promotional': 'marketing',
      'reminder': 'marketing',
      'alert': 'security'
    };
    
    this.category = categoryMap[this.type] || 'system';
  }

  next();
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.channels.inApp.read = true;
  this.channels.inApp.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsUnread = function() {
  this.channels.inApp.read = false;
  this.channels.inApp.readAt = null;
  return this.save();
};

notificationSchema.methods.markEmailSent = function(emailId) {
  this.channels.email.sent = true;
  this.channels.email.sentAt = new Date();
  this.channels.email.emailId = emailId;
  this.status = 'sent';
  return this.save();
};

notificationSchema.methods.markEmailDelivered = function() {
  this.channels.email.delivered = true;
  this.channels.email.deliveredAt = new Date();
  return this.save();
};

notificationSchema.methods.markEmailOpened = function() {
  this.channels.email.opened = true;
  this.channels.email.openedAt = new Date();
  this.analytics.impressions += 1;
  return this.save();
};

notificationSchema.methods.markEmailClicked = function() {
  this.channels.email.clicked = true;
  this.channels.email.clickedAt = new Date();
  this.analytics.clicks += 1;
  return this.save();
};

notificationSchema.methods.markPushSent = function(pushId, deviceToken) {
  this.channels.push.sent = true;
  this.channels.push.sentAt = new Date();
  this.channels.push.pushId = pushId;
  this.channels.push.deviceToken = deviceToken;
  this.status = 'sent';
  return this.save();
};

notificationSchema.methods.markPushDelivered = function() {
  this.channels.push.delivered = true;
  this.channels.push.deliveredAt = new Date();
  return this.save();
};

notificationSchema.methods.markPushClicked = function() {
  this.channels.push.clicked = true;
  this.channels.push.clickedAt = new Date();
  this.analytics.clicks += 1;
  return this.save();
};

notificationSchema.methods.markSmsSent = function(smsId) {
  this.channels.sms.sent = true;
  this.channels.sms.sentAt = new Date();
  this.channels.sms.smsId = smsId;
  this.status = 'sent';
  return this.save();
};

notificationSchema.methods.markSmsDelivered = function() {
  this.channels.sms.delivered = true;
  this.channels.sms.deliveredAt = new Date();
  return this.save();
};

notificationSchema.methods.archive = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

notificationSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

// Static methods
notificationSchema.statics.findByUser = function(userId, limit = 50) {
  return this.find({
    user: userId,
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('user', 'firstName lastName email');
};

notificationSchema.statics.findUnreadByUser = function(userId) {
  return this.find({
    user: userId,
    'channels.inApp.read': false,
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .populate('user', 'firstName lastName email');
};

notificationSchema.statics.findByType = function(type, limit = 100) {
  return this.find({
    type: type,
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('user', 'firstName lastName email');
};

notificationSchema.statics.findPendingNotifications = function() {
  return this.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() },
    isArchived: false
  })
  .sort({ priority: -1, scheduledFor: 1 });
};

notificationSchema.statics.findExpiredNotifications = function() {
  return this.find({
    expiresAt: { $lte: new Date() },
    isArchived: false
  });
};

notificationSchema.statics.findByPriority = function(priority, limit = 50) {
  return this.find({
    priority: priority,
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('user', 'firstName lastName email');
};

notificationSchema.statics.getNotificationStats = function(userId = null, dateRange = null) {
  const matchStage = { isArchived: false };
  
  if (userId) {
    matchStage.user = new mongoose.Types.ObjectId(userId);
  }
  
  if (dateRange) {
    matchStage.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        readCount: {
          $sum: { $cond: ['$channels.inApp.read', 1, 0] }
        },
        clickCount: { $sum: '$analytics.clicks' },
        avgClickThroughRate: {
          $avg: {
            $cond: [
              { $gt: ['$analytics.impressions', 0] },
              { $multiply: [{ $divide: ['$analytics.clicks', '$analytics.impressions'] }, 100] },
              0
            ]
          }
        }
      }
    }
  ]);
};

notificationSchema.statics.archiveExpiredNotifications = function() {
  return this.updateMany(
    {
      expiresAt: { $lte: new Date() },
      isArchived: false
    },
    {
      $set: {
        isArchived: true,
        archivedAt: new Date()
      }
    }
  );
};

notificationSchema.statics.findByCampaign = function(campaignId) {
  return this.find({
    'metadata.campaignId': campaignId,
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .populate('user', 'firstName lastName email');
};

module.exports = mongoose.model('Notification', notificationSchema);
