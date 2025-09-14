const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Item title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Item description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    max: [999999.99, 'Price cannot exceed 999999.99']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller is required']
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
    isPrimary: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  condition: {
    type: String,
    required: [true, 'Condition is required'],
    enum: ['new', 'like_new', 'good', 'fair', 'poor']
  },
  availability: {
    status: {
      type: String,
      enum: ['available', 'sold', 'reserved', 'draft'],
      default: 'draft'
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1']
    },
    reservedUntil: {
      type: Date,
      default: null
    }
  },
  location: {
    address: {
      type: String,
      required: [true, 'Location address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required']
    },
    country: {
      type: String,
      default: 'US'
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    }
  },
  shipping: {
    isShippable: {
      type: Boolean,
      default: true
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative']
    },
    estimatedDeliveryDays: {
      type: Number,
      default: 3,
      min: [1, 'Delivery days must be at least 1']
    },
    shippingMethods: [{
      type: String,
      enum: ['standard', 'express', 'overnight', 'pickup']
    }]
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  specifications: {
    brand: {
      type: String,
      trim: true
    },
    model: {
      type: String,
      trim: true
    },
    year: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear() + 1
    },
    color: {
      type: String,
      trim: true
    },
    size: {
      type: String,
      trim: true
    },
    weight: {
      type: Number,
      min: 0
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    customFields: mongoose.Schema.Types.Mixed
  },
  seo: {
    metaTitle: {
      type: String,
      maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    keywords: [String]
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    favorites: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    inquiries: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'active', 'sold', 'expired', 'rejected'],
    default: 'draft'
  },
  publishedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for primary image
itemSchema.virtual('primaryImage').get(function() {
  const primaryImg = this.images.find(img => img.isPrimary);
  return primaryImg || this.images[0] || null;
});

// Virtual for availability status
itemSchema.virtual('isAvailable').get(function() {
  return this.availability.status === 'available' && this.availability.quantity > 0;
});

// Virtual for full location string
itemSchema.virtual('fullLocation').get(function() {
  return `${this.location.city}, ${this.location.state} ${this.location.zipCode}`;
});

// Indexes for better query performance
itemSchema.index({ title: 'text', description: 'text', tags: 'text' });
itemSchema.index({ category: 1, status: 1 });
itemSchema.index({ seller: 1, status: 1 });
itemSchema.index({ price: 1 });
itemSchema.index({ 'location.city': 1, 'location.state': 1 });
itemSchema.index({ createdAt: -1 });
itemSchema.index({ publishedAt: -1 });
itemSchema.index({ expiresAt: 1 });
itemSchema.index({ isFeatured: 1, publishedAt: -1 });
itemSchema.index({ 'availability.status': 1, 'availability.quantity': 1 });

// Compound indexes for common queries
itemSchema.index({ category: 1, 'availability.status': 1, price: 1 });
itemSchema.index({ seller: 1, createdAt: -1 });
itemSchema.index({ tags: 1, status: 1 });

// Pre-save middleware
itemSchema.pre('save', function(next) {
  // Set publishedAt when status changes to active
  if (this.isModified('status') && this.status === 'active' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Update availability status based on quantity
  if (this.isModified('availability.quantity')) {
    if (this.availability.quantity === 0) {
      this.availability.status = 'sold';
    } else if (this.availability.status === 'sold' && this.availability.quantity > 0) {
      this.availability.status = 'available';
    }
  }
  
  next();
});

// Instance methods
itemSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

itemSchema.methods.addToFavorites = function() {
  this.analytics.favorites += 1;
  return this.save();
};

itemSchema.methods.removeFromFavorites = function() {
  if (this.analytics.favorites > 0) {
    this.analytics.favorites -= 1;
  }
  return this.save();
};

itemSchema.methods.markAsSold = function() {
  this.availability.status = 'sold';
  this.availability.quantity = 0;
  this.status = 'sold';
  return this.save();
};

// Static methods
itemSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active',
    'availability.status': 'available',
    'availability.quantity': { $gt: 0 },
    expiresAt: { $gt: new Date() }
  });
};

itemSchema.statics.findByCategory = function(categoryId) {
  return this.findActive().where('category').equals(categoryId);
};

itemSchema.statics.findBySeller = function(sellerId) {
  return this.find({ seller: sellerId }).sort({ createdAt: -1 });
};

itemSchema.statics.searchItems = function(query, filters = {}) {
  const searchQuery = {
    status: 'active',
    'availability.status': 'available',
    'availability.quantity': { $gt: 0 },
    expiresAt: { $gt: new Date() }
  };

  if (query) {
    searchQuery.$text = { $search: query };
  }

  // Apply filters
  if (filters.category) {
    searchQuery.category = filters.category;
  }
  
  if (filters.minPrice || filters.maxPrice) {
    searchQuery.price = {};
    if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
    if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
  }
  
  if (filters.location) {
    searchQuery['location.city'] = new RegExp(filters.location, 'i');
  }
  
  if (filters.condition) {
    searchQuery.condition = filters.condition;
  }

  return this.find(searchQuery).sort({ score: { $meta: 'textScore' }, createdAt: -1 });
};

module.exports = mongoose.model('Item', itemSchema);
