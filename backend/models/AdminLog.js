const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      'user_created', 'user_updated', 'user_deleted', 'user_suspended', 'user_activated',
      'item_created', 'item_updated', 'item_deleted', 'item_approved', 'item_rejected',
      'order_created', 'order_updated', 'order_cancelled', 'order_refunded',
      'payment_processed', 'payment_refunded', 'payment_failed',
      'review_approved', 'review_rejected', 'review_hidden',
      'conversation_archived', 'conversation_blocked', 'conversation_resolved',
      'category_created', 'category_updated', 'category_deleted',
      'system_config_updated', 'bulk_operation', 'data_export', 'data_import',
      'security_event', 'suspicious_activity', 'login_attempt', 'password_reset',
      'permission_granted', 'permission_revoked', 'role_changed'
    ]
  },
  target: {
    type: {
      type: String,
      enum: ['user', 'item', 'order', 'payment', 'review', 'conversation', 'category', 'system', 'bulk'],
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    name: String, // Human-readable name for the target
    email: String // For user targets
  },
  details: {
    description: {
      type: String,
      required: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    previousValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    reason: {
      type: String,
      maxlength: [200, 'Reason cannot exceed 200 characters']
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['user_management', 'content_moderation', 'order_management', 'payment_processing', 'system_admin', 'security', 'data_management'],
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  outcome: {
    type: String,
    enum: ['success', 'failure', 'partial', 'pending'],
    default: 'success'
  },
  errorDetails: {
    errorCode: String,
    errorMessage: String,
    stackTrace: String
  },
  affectedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    impact: {
      type: String,
      enum: ['direct', 'indirect', 'system_wide']
    }
  }],
  notifications: {
    sent: {
      type: Boolean,
      default: false
    },
    recipients: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      method: {
        type: String,
        enum: ['email', 'push', 'sms']
      },
      sentAt: Date
    }]
  },
  followUp: {
    required: {
      type: Boolean,
      default: false
    },
    dueDate: Date,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    notes: String
  },
  tags: [String],
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  retentionDate: {
    type: Date,
    default: function() {
      // Default retention: 2 years for most logs, 7 years for security events
      const retentionYears = this.category === 'security' ? 7 : 2;
      return new Date(Date.now() + retentionYears * 365 * 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for log age
adminLogSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for is expired (past retention date)
adminLogSchema.virtual('isExpired').get(function() {
  return this.retentionDate && new Date() > this.retentionDate;
});

// Virtual for requires follow-up
adminLogSchema.virtual('requiresFollowUp').get(function() {
  return this.followUp.required && this.followUp.status === 'pending' && 
         this.followUp.dueDate && new Date() > this.followUp.dueDate;
});

// Indexes for better query performance
adminLogSchema.index({ admin: 1, createdAt: -1 });
adminLogSchema.index({ action: 1, createdAt: -1 });
adminLogSchema.index({ 'target.type': 1, 'target.id': 1 });
adminLogSchema.index({ category: 1, createdAt: -1 });
adminLogSchema.index({ severity: 1, createdAt: -1 });
adminLogSchema.index({ outcome: 1, createdAt: -1 });
adminLogSchema.index({ createdAt: -1 });
adminLogSchema.index({ isArchived: 1, retentionDate: 1 });

// Compound indexes
adminLogSchema.index({ category: 1, severity: 1, createdAt: -1 });
adminLogSchema.index({ admin: 1, category: 1, createdAt: -1 });
adminLogSchema.index({ 'target.type': 1, action: 1, createdAt: -1 });
adminLogSchema.index({ isArchived: 1, createdAt: -1 });

// Pre-save middleware
adminLogSchema.pre('save', function(next) {
  // Auto-archive old logs
  if (!this.isArchived && this.isExpired) {
    this.isArchived = true;
    this.archivedAt = new Date();
  }

  // Set severity based on action and category
  if (this.isNew) {
    if (this.category === 'security' || this.action.includes('security') || this.action.includes('suspicious')) {
      this.severity = 'high';
    } else if (this.action.includes('delete') || this.action.includes('suspend')) {
      this.severity = 'high';
    } else if (this.action.includes('bulk') || this.action.includes('export')) {
      this.severity = 'medium';
    }
  }

  next();
});

// Instance methods
adminLogSchema.methods.archive = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

adminLogSchema.methods.addFollowUp = function(assignedTo, dueDate, notes) {
  this.followUp = {
    required: true,
    dueDate: dueDate,
    assignedTo: assignedTo,
    status: 'pending',
    notes: notes
  };
  return this.save();
};

adminLogSchema.methods.updateFollowUp = function(status, notes) {
  this.followUp.status = status;
  if (notes) {
    this.followUp.notes = notes;
  }
  if (status === 'completed') {
    this.followUp.required = false;
  }
  return this.save();
};

adminLogSchema.methods.addAffectedUser = function(userId, impact) {
  const existingUser = this.affectedUsers.find(au => au.user.toString() === userId.toString());
  if (!existingUser) {
    this.affectedUsers.push({
      user: userId,
      impact: impact
    });
  }
  return this.save();
};

adminLogSchema.methods.markNotificationSent = function(userId, method) {
  this.notifications.recipients.push({
    user: userId,
    method: method,
    sentAt: new Date()
  });
  this.notifications.sent = true;
  return this.save();
};

adminLogSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

// Static methods
adminLogSchema.statics.findByAdmin = function(adminId, limit = 50) {
  return this.find({ admin: adminId, isArchived: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('admin', 'firstName lastName email');
};

adminLogSchema.statics.findByAction = function(action, limit = 50) {
  return this.find({ action, isArchived: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('admin', 'firstName lastName email');
};

adminLogSchema.statics.findByCategory = function(category, limit = 50) {
  return this.find({ category, isArchived: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('admin', 'firstName lastName email');
};

adminLogSchema.statics.findBySeverity = function(severity, limit = 50) {
  return this.find({ severity, isArchived: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('admin', 'firstName lastName email');
};

adminLogSchema.statics.findSecurityEvents = function(limit = 100) {
  return this.find({
    category: 'security',
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('admin', 'firstName lastName email');
};

adminLogSchema.statics.findFailedActions = function(limit = 50) {
  return this.find({
    outcome: 'failure',
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('admin', 'firstName lastName email');
};

adminLogSchema.statics.findPendingFollowUps = function() {
  return this.find({
    'followUp.required': true,
    'followUp.status': 'pending',
    isArchived: false
  })
  .sort({ 'followUp.dueDate': 1 })
  .populate('admin', 'firstName lastName email')
  .populate('followUp.assignedTo', 'firstName lastName email');
};

adminLogSchema.statics.getLogStats = function(dateRange = null, adminId = null) {
  const matchStage = { isArchived: false };
  
  if (dateRange) {
    matchStage.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }
  
  if (adminId) {
    matchStage.admin = mongoose.Types.ObjectId(adminId);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        severityBreakdown: {
          $push: '$severity'
        },
        outcomeBreakdown: {
          $push: '$outcome'
        }
      }
    }
  ]);
};

adminLogSchema.statics.getAdminActivity = function(adminId, dateRange = null) {
  const matchStage = { admin: mongoose.Types.ObjectId(adminId), isArchived: false };
  
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
        _id: '$action',
        count: { $sum: 1 },
        lastPerformed: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

adminLogSchema.statics.findExpiredLogs = function() {
  return this.find({
    retentionDate: { $lte: new Date() },
    isArchived: false
  });
};

adminLogSchema.statics.archiveExpiredLogs = function() {
  return this.updateMany(
    {
      retentionDate: { $lte: new Date() },
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

module.exports = mongoose.model('AdminLog', adminLogSchema);
