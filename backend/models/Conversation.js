const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['buyer', 'seller'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked', 'resolved'],
    default: 'active'
  },
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text'
    }
  },
  messageCount: {
    type: Number,
    default: 0
  },
  unreadCount: {
    buyer: {
      type: Number,
      default: 0
    },
    seller: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    source: {
      type: String,
      default: 'order'
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    tags: [String],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  settings: {
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    allowImageSharing: {
      type: Boolean,
      default: true
    },
    autoArchiveAfterDays: {
      type: Number,
      default: 30
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },
  archivedAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolution: {
    type: String,
    enum: ['completed', 'cancelled', 'disputed', 'refunded'],
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for buyer participant
conversationSchema.virtual('buyer').get(function() {
  return this.participants.find(p => p.role === 'buyer');
});

// Virtual for seller participant
conversationSchema.virtual('seller').get(function() {
  return this.participants.find(p => p.role === 'seller');
});

// Virtual for total unread messages
conversationSchema.virtual('totalUnread').get(function() {
  return this.unreadCount.buyer + this.unreadCount.seller;
});

// Virtual for conversation duration
conversationSchema.virtual('duration').get(function() {
  return Date.now() - this.createdAt;
});

// Indexes for better query performance
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ order: 1 });
conversationSchema.index({ item: 1 });
conversationSchema.index({ status: 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });
conversationSchema.index({ createdAt: -1 });
conversationSchema.index({ 'metadata.priority': 1 });

// Compound indexes
conversationSchema.index({ 'participants.user': 1, status: 1 });
conversationSchema.index({ order: 1, status: 1 });
conversationSchema.index({ status: 1, 'lastMessage.timestamp': -1 });

// Pre-save middleware
conversationSchema.pre('save', function(next) {
  // Ensure we have exactly one buyer and one seller
  const buyers = this.participants.filter(p => p.role === 'buyer');
  const sellers = this.participants.filter(p => p.role === 'seller');
  
  if (buyers.length !== 1 || sellers.length !== 1) {
    return next(new Error('Conversation must have exactly one buyer and one seller'));
  }

  // Update last message timestamp
  if (this.isModified('lastMessage')) {
    this.lastMessage.timestamp = new Date();
  }

  next();
});

// Instance methods
conversationSchema.methods.addParticipant = function(userId, role) {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      role: role,
      joinedAt: new Date(),
      lastReadAt: new Date(),
      isActive: true
    });
  }
  
  return this.save();
};

conversationSchema.methods.updateLastRead = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.lastReadAt = new Date();
    
    // Reset unread count for this user
    if (participant.role === 'buyer') {
      this.unreadCount.buyer = 0;
    } else {
      this.unreadCount.seller = 0;
    }
  }
  
  return this.save();
};

conversationSchema.methods.incrementUnread = function(excludeUserId) {
  const buyer = this.participants.find(p => p.role === 'buyer');
  const seller = this.participants.find(p => p.role === 'seller');
  
  if (buyer && buyer.user.toString() !== excludeUserId.toString()) {
    this.unreadCount.buyer += 1;
  }
  
  if (seller && seller.user.toString() !== excludeUserId.toString()) {
    this.unreadCount.seller += 1;
  }
  
  return this.save();
};

conversationSchema.methods.updateLastMessage = function(content, senderId, type = 'text') {
  this.lastMessage = {
    content: content.substring(0, 200), // Truncate for preview
    sender: senderId,
    timestamp: new Date(),
    type: type
  };
  
  this.messageCount += 1;
  
  return this.save();
};

conversationSchema.methods.archive = function() {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

conversationSchema.methods.resolve = function(resolvedBy, resolution) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  this.resolution = resolution;
  return this.save();
};

conversationSchema.methods.block = function() {
  this.status = 'blocked';
  return this.save();
};

// Static methods
conversationSchema.statics.findByUser = function(userId) {
  return this.find({
    'participants.user': userId,
    status: { $ne: 'archived' }
  }).sort({ 'lastMessage.timestamp': -1 });
};

conversationSchema.statics.findByOrder = function(orderId) {
  return this.findOne({ order: orderId });
};

conversationSchema.statics.findByItem = function(itemId) {
  return this.find({ item: itemId }).sort({ createdAt: -1 });
};

conversationSchema.statics.findActiveConversations = function() {
  return this.find({ status: 'active' }).sort({ 'lastMessage.timestamp': -1 });
};

conversationSchema.statics.findUnreadConversations = function(userId) {
  return this.find({
    'participants.user': userId,
    $or: [
      { 'unreadCount.buyer': { $gt: 0 } },
      { 'unreadCount.seller': { $gt: 0 } }
    ]
  }).sort({ 'lastMessage.timestamp': -1 });
};

conversationSchema.statics.findArchivedConversations = function(userId) {
  return this.find({
    'participants.user': userId,
    status: 'archived'
  }).sort({ archivedAt: -1 });
};

conversationSchema.statics.getConversationStats = function(userId = null) {
  const matchStage = userId ? { 'participants.user': mongoose.Types.ObjectId(userId) } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalMessages: { $sum: '$messageCount' },
        avgMessages: { $avg: '$messageCount' }
      }
    }
  ]);
};

conversationSchema.statics.findConversationsNeedingArchive = function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  return this.find({
    status: 'active',
    'lastMessage.timestamp': { $lt: thirtyDaysAgo }
  });
};

module.exports = mongoose.model('Conversation', conversationSchema);
