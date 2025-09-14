const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentIntentId: {
    type: String,
    required: true,
    unique: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD']
  },
  status: {
    type: String,
    enum: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled', 'failed'],
    required: true
  },
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'bank_transfer', 'digital_wallet'],
      required: true
    },
    card: {
      brand: String,
      last4: String,
      expMonth: Number,
      expYear: Number,
      funding: String
    },
    bankAccount: {
      bankName: String,
      last4: String,
      routingNumber: String
    },
    wallet: {
      type: String,
      enum: ['apple_pay', 'google_pay', 'paypal']
    }
  },
  billingDetails: {
    name: String,
    email: String,
    phone: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    }
  },
  charges: [{
    chargeId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'canceled'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    failureCode: String,
    failureMessage: String
  }],
  refunds: [{
    refundId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      enum: ['duplicate', 'fraudulent', 'requested_by_customer'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'canceled'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    processedAt: Date,
    failureReason: String
  }],
  fees: {
    stripeFee: {
      type: Number,
      default: 0
    },
    platformFee: {
      type: Number,
      default: 0
    },
    netAmount: {
      type: Number,
      required: true
    }
  },
  metadata: {
    orderNumber: String,
    itemTitles: [String],
    sellerId: String,
    buyerId: String,
    source: {
      type: String,
      default: 'web'
    },
    userAgent: String,
    ipAddress: String
  },
  webhookEvents: [{
    eventId: {
      type: String,
      required: true
    },
    eventType: {
      type: String,
      required: true
    },
    processed: {
      type: Boolean,
      default: false
    },
    processedAt: Date,
    data: mongoose.Schema.Types.Mixed,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
    metadata: mongoose.Schema.Types.Mixed
  }],
  errorLog: [{
    errorCode: String,
    errorMessage: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    context: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds.reduce((total, refund) => {
    return refund.status === 'succeeded' ? total + refund.amount : total;
  }, 0);
});

// Virtual for net amount after refunds
paymentSchema.virtual('netAmountAfterRefunds').get(function() {
  return this.amount - this.totalRefunded;
});

// Virtual for payment status display
paymentSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    requires_payment_method: 'Payment Method Required',
    requires_confirmation: 'Confirmation Required',
    requires_action: 'Action Required',
    processing: 'Processing',
    succeeded: 'Completed',
    canceled: 'Canceled',
    failed: 'Failed'
  };
  return statusMap[this.status] || this.status;
});

// Indexes for better query performance
// Note: paymentIntentId index is automatically created by unique: true
paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ 'metadata.orderNumber': 1 });
paymentSchema.index({ 'metadata.sellerId': 1, createdAt: -1 });
paymentSchema.index({ 'metadata.buyerId': 1, createdAt: -1 });

// Compound indexes
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ user: 1, status: 1 });

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Add timeline entry when status changes
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      note: `Payment status changed to ${this.status}`
    });
  }

  // Calculate net amount
  if (this.isModified('amount') || this.isModified('fees.stripeFee') || this.isModified('fees.platformFee')) {
    this.fees.netAmount = this.amount - this.fees.stripeFee - this.fees.platformFee;
  }

  next();
});

// Instance methods
paymentSchema.methods.addWebhookEvent = function(eventId, eventType, data) {
  this.webhookEvents.push({
    eventId,
    eventType,
    data,
    processed: false
  });
  return this.save();
};

paymentSchema.methods.markWebhookProcessed = function(eventId) {
  const event = this.webhookEvents.find(e => e.eventId === eventId);
  if (event) {
    event.processed = true;
    event.processedAt = new Date();
  }
  return this.save();
};

paymentSchema.methods.addRefund = function(refundId, amount, reason) {
  this.refunds.push({
    refundId,
    amount,
    reason,
    status: 'pending'
  });
  return this.save();
};

paymentSchema.methods.updateRefundStatus = function(refundId, status, failureReason = null) {
  const refund = this.refunds.find(r => r.refundId === refundId);
  if (refund) {
    refund.status = status;
    if (status === 'succeeded') {
      refund.processedAt = new Date();
    }
    if (failureReason) {
      refund.failureReason = failureReason;
    }
  }
  return this.save();
};

paymentSchema.methods.logError = function(errorCode, errorMessage, context = {}) {
  this.errorLog.push({
    errorCode,
    errorMessage,
    context
  });
  return this.save();
};

// Static methods
paymentSchema.statics.findByUser = function(userId) {
  return this.find({ user: userId }).sort({ createdAt: -1 });
};

paymentSchema.statics.findByOrder = function(orderId) {
  return this.findOne({ order: orderId });
};

paymentSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

paymentSchema.statics.findPendingWebhooks = function() {
  return this.find({
    'webhookEvents.processed': false
  });
};

paymentSchema.statics.getPaymentStats = function(userId = null, dateRange = null) {
  const matchStage = {};
  
  if (userId) {
    matchStage.user = mongoose.Types.ObjectId(userId);
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
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);
};

paymentSchema.statics.findFailedPayments = function() {
  return this.find({
    $or: [
      { status: 'failed' },
      { 'charges.status': 'failed' }
    ]
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Payment', paymentSchema);
