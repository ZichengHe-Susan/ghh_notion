const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: function() {
      return this.type === 'text' || this.type === 'system';
    },
    maxlength: [2000, 'Message content cannot exceed 2000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'order_update', 'payment_update'],
    default: 'text'
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date,
      default: null
    },
    originalContent: String,
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    orderUpdate: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      },
      previousStatus: String,
      newStatus: String,
      note: String
    },
    paymentUpdate: {
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
      },
      previousStatus: String,
      newStatus: String,
      amount: Number,
      note: String
    }
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deleteReason: {
    type: String,
    enum: ['user_deleted', 'admin_deleted', 'system_deleted', 'spam'],
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for message age
messageSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Virtual for is read by all participants
messageSchema.virtual('isReadByAll').get(function() {
  // This would need to be populated with conversation participants
  return this.readBy.length > 0;
});

// Virtual for reaction count by emoji
messageSchema.virtual('reactionCounts').get(function() {
  const counts = {};
  this.reactions.forEach(reaction => {
    counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
  });
  return counts;
});

// Indexes for better query performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ type: 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ isDeleted: 1 });

// Compound indexes
messageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 });
messageSchema.index({ sender: 1, type: 1 });
messageSchema.index({ conversation: 1, status: 1 });

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Set delivered status if not already set
  if (this.isNew && this.status === 'sent') {
    // In a real-time system, this would be updated when the message is delivered
    this.status = 'delivered';
  }

  // Mark as edited if content changed
  if (this.isModified('content') && !this.isNew) {
    this.metadata.isEdited = true;
    this.metadata.editedAt = new Date();
    if (!this.metadata.originalContent) {
      this.metadata.originalContent = this.content;
    }
  }

  next();
});

// Instance methods
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(r => r.user.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    
    // Update status to read if all participants have read it
    // This would need conversation participants to be populated
    this.status = 'read';
  }
  
  return this.save();
};

messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji
  });
  
  return this.save();
};

messageSchema.methods.removeReaction = function(userId, emoji) {
  this.reactions = this.reactions.filter(r => 
    !(r.user.toString() === userId.toString() && r.emoji === emoji)
  );
  
  return this.save();
};

messageSchema.methods.editContent = function(newContent) {
  if (!this.metadata.originalContent) {
    this.metadata.originalContent = this.content;
  }
  
  this.content = newContent;
  this.metadata.isEdited = true;
  this.metadata.editedAt = new Date();
  
  return this.save();
};

messageSchema.methods.softDelete = function(deletedBy, reason = 'user_deleted') {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deleteReason = reason;
  
  // Clear sensitive content
  this.content = '[Message deleted]';
  this.attachments = [];
  
  return this.save();
};

messageSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  this.deleteReason = null;
  
  // Restore original content if available
  if (this.metadata.originalContent) {
    this.content = this.metadata.originalContent;
  }
  
  return this.save();
};

// Static methods
messageSchema.statics.findByConversation = function(conversationId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({
    conversation: conversationId,
    isDeleted: false
  })
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .populate('sender', 'firstName lastName avatar')
  .populate('replyTo', 'content sender createdAt');
};

messageSchema.statics.findUnreadMessages = function(userId, conversationId = null) {
  const query = {
    sender: { $ne: userId },
    'readBy.user': { $ne: userId },
    isDeleted: false
  };
  
  if (conversationId) {
    query.conversation = conversationId;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

messageSchema.statics.findByType = function(type) {
  return this.find({ type, isDeleted: false }).sort({ createdAt: -1 });
};

messageSchema.statics.findSystemMessages = function(conversationId) {
  return this.find({
    conversation: conversationId,
    type: 'system',
    isDeleted: false
  }).sort({ createdAt: -1 });
};

messageSchema.statics.findOrderUpdates = function(orderId) {
  return this.find({
    'metadata.orderUpdate.orderId': orderId,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

messageSchema.statics.findPaymentUpdates = function(paymentId) {
  return this.find({
    'metadata.paymentUpdate.paymentId': paymentId,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

messageSchema.statics.getMessageStats = function(conversationId = null, userId = null) {
  const matchStage = { isDeleted: false };
  
  if (conversationId) {
    matchStage.conversation = mongoose.Types.ObjectId(conversationId);
  }
  
  if (userId) {
    matchStage.sender = mongoose.Types.ObjectId(userId);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgLength: { $avg: { $strLenCP: '$content' } }
      }
    }
  ]);
};

messageSchema.statics.findMessagesWithAttachments = function(conversationId) {
  return this.find({
    conversation: conversationId,
    'attachments.0': { $exists: true },
    isDeleted: false
  }).sort({ createdAt: -1 });
};

messageSchema.statics.findDeletedMessages = function(conversationId = null) {
  const query = { isDeleted: true };
  
  if (conversationId) {
    query.conversation = conversationId;
  }
  
  return this.find(query).sort({ deletedAt: -1 });
};

module.exports = mongoose.model('Message', messageSchema);
