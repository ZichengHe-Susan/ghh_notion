const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Buyer is required']
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller is required']
  },
  items: [{
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    itemSnapshot: {
      title: String,
      description: String,
      images: [String],
      condition: String,
      seller: {
        name: String,
        email: String
      }
    }
  }],
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative']
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative']
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    platformFee: {
      type: Number,
      default: 0,
      min: [0, 'Platform fee cannot be negative']
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'CAD']
    }
  },
  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'pickup'],
      default: 'standard'
    },
    address: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      zipCode: {
        type: String,
        required: true
      },
      country: {
        type: String,
        default: 'US'
      },
      phone: String,
      instructions: String
    },
    trackingNumber: {
      type: String,
      default: null
    },
    carrier: {
      type: String,
      default: null
    },
    estimatedDelivery: {
      type: Date,
      default: null
    },
    actualDelivery: {
      type: Date,
      default: null
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['stripe', 'paypal', 'bank_transfer'],
      required: true
    },
    paymentIntentId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'],
      default: 'pending'
    },
    paidAt: {
      type: Date,
      default: null
    },
    refundedAt: {
      type: Date,
      default: null
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refund amount cannot be negative']
    },
    refundReason: {
      type: String,
      default: null
    }
  },
  escrow: {
    status: {
      type: String,
      enum: ['pending', 'held', 'released', 'disputed', 'refunded'],
      default: 'pending'
    },
    heldAt: {
      type: Date,
      default: null
    },
    releasedAt: {
      type: Date,
      default: null
    },
    autoReleaseAt: {
      type: Date,
      default: function() {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      }
    },
    releaseReason: {
      type: String,
      enum: ['buyer_confirmation', 'auto_release', 'admin_release', 'dispute_resolution'],
      default: null
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  timeline: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  communication: {
    lastMessageAt: {
      type: Date,
      default: null
    },
    messageCount: {
      type: Number,
      default: 0
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    }
  },
  notes: {
    buyer: String,
    seller: String,
    admin: String
  },
  metadata: {
    source: {
      type: String,
      default: 'web'
    },
    userAgent: String,
    ipAddress: String,
    referrer: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for order total items
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for order status display
orderSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Pending Payment',
    confirmed: 'Confirmed',
    paid: 'Paid',
    shipped: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for days since order
orderSchema.virtual('daysSinceOrder').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
// Note: orderNumber index is automatically created by unique: true
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ 'escrow.status': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'payment.paidAt': -1 });
orderSchema.index({ 'escrow.autoReleaseAt': 1 });

// Compound indexes
orderSchema.index({ buyer: 1, status: 1 });
orderSchema.index({ seller: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware
orderSchema.pre('save', function(next) {
  // Generate order number if not provided
  if (!this.orderNumber) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.orderNumber = `ORD-${timestamp}-${random}`.toUpperCase();
  }

  // Add timeline entry when status changes
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      note: `Status changed to ${this.status}`
    });
  }

  // Update escrow status based on payment status
  if (this.isModified('payment.status')) {
    if (this.payment.status === 'succeeded' && this.escrow.status === 'pending') {
      this.escrow.status = 'held';
      this.escrow.heldAt = new Date();
    }
  }

  next();
});

// Instance methods
orderSchema.methods.confirmPayment = function() {
  this.payment.status = 'succeeded';
  this.payment.paidAt = new Date();
  this.status = 'paid';
  this.escrow.status = 'held';
  this.escrow.heldAt = new Date();
  return this.save();
};

orderSchema.methods.markAsShipped = function(trackingNumber, carrier) {
  this.status = 'shipped';
  this.shipping.trackingNumber = trackingNumber;
  this.shipping.carrier = carrier;
  this.shipping.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
  return this.save();
};

orderSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.shipping.actualDelivery = new Date();
  return this.save();
};

orderSchema.methods.completeOrder = function() {
  this.status = 'completed';
  this.escrow.status = 'released';
  this.escrow.releasedAt = new Date();
  this.escrow.releaseReason = 'buyer_confirmation';
  return this.save();
};

orderSchema.methods.initiateDispute = function(reason) {
  this.status = 'disputed';
  this.escrow.status = 'disputed';
  return this.save();
};

orderSchema.methods.processRefund = function(amount, reason) {
  this.payment.status = 'refunded';
  this.payment.refundedAt = new Date();
  this.payment.refundAmount = amount;
  this.payment.refundReason = reason;
  this.status = 'cancelled';
  this.escrow.status = 'refunded';
  return this.save();
};

// Static methods
orderSchema.statics.findByBuyer = function(buyerId) {
  return this.find({ buyer: buyerId }).sort({ createdAt: -1 });
};

orderSchema.statics.findBySeller = function(sellerId) {
  return this.find({ seller: sellerId }).sort({ createdAt: -1 });
};

orderSchema.statics.findPendingEscrowRelease = function() {
  return this.find({
    'escrow.status': 'held',
    'escrow.autoReleaseAt': { $lte: new Date() },
    status: { $in: ['delivered', 'paid'] }
  });
};

orderSchema.statics.findDisputedOrders = function() {
  return this.find({ status: 'disputed' }).sort({ createdAt: -1 });
};

orderSchema.statics.getOrderStats = function(sellerId = null) {
  const matchStage = sellerId ? { seller: mongoose.Types.ObjectId(sellerId) } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$pricing.total' }
      }
    }
  ]);
};

module.exports = mongoose.model('Order', orderSchema);
