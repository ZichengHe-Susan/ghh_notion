const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    overall: {
      type: Number,
      required: [true, 'Overall rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    categories: {
      communication: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      itemCondition: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      shipping: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      value: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      }
    }
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  type: {
    type: String,
    enum: ['buyer_to_seller', 'seller_to_buyer'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'hidden'],
    default: 'pending'
  },
  helpful: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      votedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  response: {
    content: {
      type: String,
      maxlength: [500, 'Response cannot exceed 500 characters']
    },
    respondedAt: {
      type: Date,
      default: null
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  moderation: {
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: {
      type: Date,
      default: null
    },
    moderationNotes: {
      type: String,
      maxlength: [500, 'Moderation notes cannot exceed 500 characters']
    },
    flags: [{
      type: String,
      enum: ['inappropriate', 'spam', 'fake', 'offensive', 'irrelevant']
    }]
  },
  metadata: {
    verifiedPurchase: {
      type: Boolean,
      default: true
    },
    anonymous: {
      type: Boolean,
      default: false
    },
    source: {
      type: String,
      default: 'web'
    },
    ipAddress: String,
    userAgent: String
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    reports: {
      type: Number,
      default: 0
    }
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  editHistory: [{
    previousContent: String,
    editedAt: {
      type: Date,
      default: Date.now
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for average category rating
reviewSchema.virtual('averageCategoryRating').get(function() {
  const categories = Object.values(this.rating.categories).filter(rating => rating !== null);
  if (categories.length === 0) return null;
  
  return categories.reduce((sum, rating) => sum + rating, 0) / categories.length;
});

// Virtual for review age
reviewSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for is helpful by user
reviewSchema.virtual('isHelpfulByUser').get(function() {
  return function(userId) {
    return this.helpful.users.some(h => h.user.toString() === userId.toString());
  };
});

// Indexes for better query performance
reviewSchema.index({ order: 1 });
reviewSchema.index({ item: 1, status: 1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ type: 1, status: 1 });
reviewSchema.index({ 'rating.overall': 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ status: 1 });

// Compound indexes
reviewSchema.index({ reviewee: 1, status: 1, 'rating.overall': -1 });
reviewSchema.index({ item: 1, status: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, reviewee: 1, order: 1 }, { unique: true });

// Pre-save middleware
reviewSchema.pre('save', function(next) {
  // Ensure reviewer and reviewee are different
  if (this.reviewer.toString() === this.reviewee.toString()) {
    return next(new Error('Reviewer and reviewee cannot be the same person'));
  }

  // Set status to approved if no moderation is needed
  if (this.isNew && this.status === 'pending') {
    // Auto-approve if rating and comment meet basic criteria
    if (this.rating.overall >= 1 && this.comment.length >= 10) {
      this.status = 'approved';
    }
  }

  next();
});

// Instance methods
reviewSchema.methods.markAsHelpful = function(userId) {
  const existingVote = this.helpful.users.find(h => h.user.toString() === userId.toString());
  
  if (!existingVote) {
    this.helpful.users.push({
      user: userId,
      votedAt: new Date()
    });
    this.helpful.count += 1;
  }
  
  return this.save();
};

reviewSchema.methods.removeHelpful = function(userId) {
  const initialLength = this.helpful.users.length;
  this.helpful.users = this.helpful.users.filter(h => h.user.toString() !== userId.toString());
  
  if (this.helpful.users.length < initialLength) {
    this.helpful.count -= 1;
  }
  
  return this.save();
};

reviewSchema.methods.addResponse = function(content, respondedBy) {
  this.response = {
    content: content,
    respondedAt: new Date(),
    respondedBy: respondedBy
  };
  
  return this.save();
};

reviewSchema.methods.editReview = function(newContent, editedBy, reason) {
  // Save previous content to history
  this.editHistory.push({
    previousContent: this.comment,
    editedAt: new Date(),
    editedBy: editedBy,
    reason: reason
  });
  
  this.comment = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

reviewSchema.methods.moderate = function(moderatedBy, status, notes = '', flags = []) {
  this.status = status;
  this.moderation = {
    moderatedBy: moderatedBy,
    moderatedAt: new Date(),
    moderationNotes: notes,
    flags: flags
  };
  
  return this.save();
};

reviewSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

reviewSchema.methods.report = function() {
  this.analytics.reports += 1;
  return this.save();
};

// Static methods
reviewSchema.statics.findByReviewee = function(revieweeId, status = 'approved') {
  return this.find({ reviewee: revieweeId, status }).sort({ createdAt: -1 });
};

reviewSchema.statics.findByItem = function(itemId, status = 'approved') {
  return this.find({ item: itemId, status }).sort({ createdAt: -1 });
};

reviewSchema.statics.findByOrder = function(orderId) {
  return this.find({ order: orderId }).sort({ createdAt: -1 });
};

reviewSchema.statics.findPendingModeration = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: -1 });
};

reviewSchema.statics.findByRating = function(minRating, maxRating = 5) {
  return this.find({
    'rating.overall': { $gte: minRating, $lte: maxRating },
    status: 'approved'
  }).sort({ createdAt: -1 });
};

reviewSchema.statics.getAverageRating = function(revieweeId) {
  return this.aggregate([
    { $match: { reviewee: mongoose.Types.ObjectId(revieweeId), status: 'approved' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating.overall' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating.overall'
        }
      }
    }
  ]);
};

reviewSchema.statics.getRatingDistribution = function(revieweeId) {
  return this.aggregate([
    { $match: { reviewee: mongoose.Types.ObjectId(revieweeId), status: 'approved' } },
    {
      $group: {
        _id: '$rating.overall',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

reviewSchema.statics.getReviewStats = function(revieweeId = null) {
  const matchStage = revieweeId ? { reviewee: mongoose.Types.ObjectId(revieweeId) } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        averageRating: { $avg: '$rating.overall' },
        totalHelpful: { $sum: '$helpful.count' }
      }
    }
  ]);
};

reviewSchema.statics.findRecentReviews = function(limit = 10) {
  return this.find({ status: 'approved' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('reviewer', 'firstName lastName avatar')
    .populate('item', 'title images');
};

reviewSchema.statics.findTopRatedReviews = function(limit = 10) {
  return this.find({ 
    status: 'approved',
    'rating.overall': 5,
    'helpful.count': { $gte: 3 }
  })
  .sort({ 'helpful.count': -1, createdAt: -1 })
  .limit(limit)
  .populate('reviewer', 'firstName lastName avatar')
  .populate('item', 'title images');
};

module.exports = mongoose.model('Review', reviewSchema);
