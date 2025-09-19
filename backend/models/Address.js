const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  label: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'Label cannot exceed 50 characters']
  },
  type: {
    type: String,
    enum: ['home', 'work', 'billing', 'shipping', 'other'],
    default: 'other'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    apartment: {
      type: String,
      trim: true,
      maxlength: [50, 'Apartment cannot exceed 50 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters']
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required'],
      trim: true,
      maxlength: [20, 'ZIP code cannot exceed 20 characters']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      maxlength: [100, 'Country cannot exceed 100 characters'],
      default: 'USA'
    }
  },
  contactInfo: {
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters']
    }
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [500, 'Delivery instructions cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date
    },
    usageCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address string
addressSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  let fullAddr = addr.street;
  
  if (addr.apartment) {
    fullAddr += `, ${addr.apartment}`;
  }
  
  fullAddr += `, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
  
  return fullAddr;
});

// Virtual for contact name
addressSchema.virtual('contactName').get(function() {
  if (this.contactInfo.firstName && this.contactInfo.lastName) {
    return `${this.contactInfo.firstName} ${this.contactInfo.lastName}`;
  }
  return null;
});

// Indexes for better query performance
addressSchema.index({ user: 1 });
addressSchema.index({ user: 1, isDefault: 1 });
addressSchema.index({ user: 1, type: 1 });
addressSchema.index({ user: 1, isActive: 1 });

// Pre-save middleware to ensure only one default address per user per type
addressSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    try {
      // Remove default status from other addresses of the same type for this user
      await this.constructor.updateMany(
        { 
          user: this.user, 
          type: this.type, 
          _id: { $ne: this._id },
          isDefault: true 
        },
        { isDefault: false }
      );
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Instance methods
addressSchema.methods.markAsUsed = function() {
  this.metadata.lastUsed = new Date();
  this.metadata.usageCount += 1;
  return this.save();
};

addressSchema.methods.getFormattedAddress = function() {
  const addr = this.address;
  const contact = this.contactInfo;
  
  let formatted = '';
  
  if (contact.firstName && contact.lastName) {
    formatted += `${contact.firstName} ${contact.lastName}\n`;
  }
  
  formatted += addr.street;
  if (addr.apartment) {
    formatted += `, ${addr.apartment}`;
  }
  formatted += `\n${addr.city}, ${addr.state} ${addr.zipCode}`;
  
  if (addr.country && addr.country !== 'USA') {
    formatted += `\n${addr.country}`;
  }
  
  if (this.instructions) {
    formatted += `\n\nDelivery Instructions: ${this.instructions}`;
  }
  
  return formatted;
};

// Static methods
addressSchema.statics.getUserAddresses = function(userId, options = {}) {
  const query = { user: userId, isActive: true };
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query).sort({ isDefault: -1, 'metadata.lastUsed': -1 });
};

addressSchema.statics.getDefaultAddress = function(userId, type = 'shipping') {
  return this.findOne({ 
    user: userId, 
    type: type, 
    isDefault: true, 
    isActive: true 
  });
};

addressSchema.statics.createDefaultAddress = async function(userId, addressData) {
  // Check if user already has a default address of this type
  const existingDefault = await this.findOne({ 
    user: userId, 
    type: addressData.type, 
    isDefault: true 
  });
  
  if (!existingDefault) {
    addressData.isDefault = true;
  }
  
  addressData.user = userId;
  return new this(addressData).save();
};

module.exports = mongoose.model('Address', addressSchema);
