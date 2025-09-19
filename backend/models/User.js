const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  stripeCustomerId: {
    type: String,
    default: null
    // Removed unique constraint to avoid null value conflicts
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 2592000 // 30 days
    }
  }],
  profile: {
    phone: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    location: {
      type: String,
      trim: true
    },
    preferences: {
      notifications: {
        email: {
          type: Boolean,
          default: true
        },
        push: {
          type: Boolean,
          default: true
        },
        sms: {
          type: Boolean,
          default: false
        }
      }
    }
  },
  stats: {
    totalItemsSold: {
      type: Number,
      default: 0
    },
    totalItemsBought: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  verification: {
    status: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified'
    },
    submittedAt: {
      type: Date
    },
    reviewedAt: {
      type: Date
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters']
    },
    documents: [{
      filename: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      },
      key: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['id', 'passport', 'driver_license', 'utility_bill', 'bank_statement', 'other'],
        required: true
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      reviewedAt: {
        type: Date
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      rejectionReason: {
        type: String,
        maxlength: [200, 'Rejection reason cannot exceed 200 characters']
      }
    }],
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  // Address book references
  addresses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  }],
  // Default addresses for quick access
  defaultAddresses: {
    shipping: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address'
    },
    billing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Index for better query performance
// Note: email index is automatically created by unique: true
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Set displayName if not provided
userSchema.pre('save', function(next) {
  if (!this.displayName && this.firstName && this.lastName) {
    this.displayName = `${this.firstName} ${this.lastName}`;
  }
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  return token;
};

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return token;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Instance methods for address management
userSchema.methods.addAddress = async function(addressId) {
  if (!this.addresses.includes(addressId)) {
    this.addresses.push(addressId);
    return this.save();
  }
  return this;
};

userSchema.methods.removeAddress = async function(addressId) {
  this.addresses = this.addresses.filter(addr => addr.toString() !== addressId.toString());
  
  // Remove from default addresses if it was set as default
  if (this.defaultAddresses.shipping && this.defaultAddresses.shipping.toString() === addressId.toString()) {
    this.defaultAddresses.shipping = undefined;
  }
  if (this.defaultAddresses.billing && this.defaultAddresses.billing.toString() === addressId.toString()) {
    this.defaultAddresses.billing = undefined;
  }
  
  return this.save();
};

userSchema.methods.setDefaultAddress = async function(addressId, type = 'shipping') {
  if (type === 'shipping') {
    this.defaultAddresses.shipping = addressId;
  } else if (type === 'billing') {
    this.defaultAddresses.billing = addressId;
  }
  return this.save();
};

userSchema.methods.getAddresses = async function() {
  const Address = mongoose.model('Address');
  return Address.find({ user: this._id, isActive: true }).sort({ isDefault: -1, 'metadata.lastUsed': -1 });
};

userSchema.methods.getDefaultAddress = async function(type = 'shipping') {
  const Address = mongoose.model('Address');
  return Address.findOne({ 
    user: this._id, 
    type: type, 
    isDefault: true, 
    isActive: true 
  });
};

module.exports = mongoose.model('User', userSchema);
