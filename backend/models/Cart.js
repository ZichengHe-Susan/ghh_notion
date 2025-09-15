const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Item ID is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [100, 'Quantity cannot exceed 100']
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true // Each user can have only one cart
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
cartSchema.index({ userId: 1 });
cartSchema.index({ 'items.itemId': 1 });

// Instance methods
cartSchema.methods.addItem = function(itemId, quantity = 1) {
  const existingItem = this.items.find(item => item.itemId.toString() === itemId.toString());
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({
      itemId: itemId,
      quantity: quantity,
      addedAt: new Date()
    });
  }
  
  return this.save();
};

cartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item.itemId.toString() !== itemId.toString());
  return this.save();
};

cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.find(item => item.itemId.toString() === itemId.toString());
  
  if (item) {
    if (quantity <= 0) {
      return this.removeItem(itemId);
    } else {
      item.quantity = quantity;
      return this.save();
    }
  }
  
  return Promise.resolve(this);
};

cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

cartSchema.methods.getItemCount = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
};

cartSchema.methods.getTotalPrice = async function() {
  const Item = mongoose.model('Item');
  let total = 0;
  
  for (const cartItem of this.items) {
    const item = await Item.findById(cartItem.itemId).select('price');
    if (item) {
      total += item.price * cartItem.quantity;
    }
  }
  
  return total;
};

// Static methods
cartSchema.statics.findOrCreateByUserId = async function(userId) {
  let cart = await this.findOne({ userId });
  
  if (!cart) {
    cart = new this({ userId, items: [] });
    await cart.save();
  }
  
  return cart;
};

cartSchema.statics.getCartWithItems = async function(userId) {
  const cart = await this.findOne({ userId })
    .populate({
      path: 'items.itemId',
      model: 'Item',
      select: 'title price images seller status availability'
    });
  
  if (!cart) {
    return await this.findOrCreateByUserId(userId);
  }
  
  return cart;
};

module.exports = mongoose.model('Cart', cartSchema);
