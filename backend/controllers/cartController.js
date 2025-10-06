const Cart = require('../models/Cart');
const Item = require('../models/Item');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

const cartController = {
  /**
   * @route   GET /api/cart
   * @desc    Get user's cart with populated items
   * @access  Private
   */
  getCart: async (req, res) => {
    try {
      console.log('=== BACKEND CART CONTROLLER - getCart called ===');
      const userId = req.user.id;
      console.log('User ID:', userId);

      const cart = await Cart.getCartWithItems(userId);
      console.log('Raw cart from DB:', JSON.stringify(cart, null, 2));

      // Filter out items that are no longer available
      const availableItems = cart.items.filter(cartItem => {
        const item = cartItem.itemId;
        const isAvailable = item && 
               item.status === 'active' && 
               item.availability && 
               item.availability.status === 'available' && 
               item.availability.quantity > 0;
        console.log(`Item ${item?._id} availability check:`, isAvailable);
        return isAvailable;
      });

      console.log('Available items count:', availableItems.length);
      console.log('Available items:', JSON.stringify(availableItems, null, 2));

      // Update cart if items were filtered out
      if (availableItems.length !== cart.items.length) {
        cart.items = availableItems;
        await cart.save();
      }

      // Calculate total price
      const totalPrice = await cart.getTotalPrice();
      const itemCount = cart.getItemCount();

      console.log('Final response data:', {
        items: availableItems,
        totalPrice: totalPrice,
        itemCount: itemCount,
        cartId: cart._id
      });

      res.json({
        success: true,
        data: {
          items: availableItems,
          totalPrice: totalPrice,
          itemCount: itemCount,
          cartId: cart._id
        }
      });

    } catch (error) {
      logger.error('Get cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cart'
      });
    }
  },

  /**
   * @route   POST /api/cart/add
   * @desc    Add item to cart
   * @access  Private
   */
  addToCart: async (req, res) => {
    try {
      console.log('=== BACKEND CART CONTROLLER - addToCart called ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('User ID:', req.user.id);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { itemId, quantity = 1, deliveryMethod, shipping } = req.body;
      const userId = req.user.id;
      
      console.log('Extracted data:');
      console.log('- itemId:', itemId);
      console.log('- quantity:', quantity);
      console.log('- deliveryMethod:', deliveryMethod);
      console.log('- shipping:', JSON.stringify(shipping, null, 2));

      // Check if item exists and is available
      const item = await Item.findById(itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      if (item.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Item is not available for purchase'
        });
      }

      if (!item.availability || item.availability.status !== 'available') {
        return res.status(400).json({
          success: false,
          error: 'Item is currently unavailable'
        });
      }

      if (item.availability.quantity < quantity) {
        return res.status(400).json({
          success: false,
          error: `Only ${item.availability.quantity} items available`
        });
      }

      if (deliveryMethod && !item.shipping.shippingMethods.includes(deliveryMethod)) {
        return res.status(400).json({
          success: false,
          error: 'Selected delivery method is not available for this item'
        });
      }

      // Check if user is trying to add their own item
      if (item.seller.toString() === userId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot add your own item to cart'
        });
      }

      // Get or create cart
      const cart = await Cart.findOrCreateByUserId(userId);

      // Check if item already exists in cart
      const existingItem = cart.items.find(cartItem => 
        cartItem.itemId.toString() === itemId
      );

      console.log('Existing item in cart:', existingItem ? 'Found' : 'Not found');

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > item.availability.quantity) {
          return res.status(400).json({
            success: false,
            error: `Cannot add ${quantity} more items. Only ${item.availability.quantity - existingItem.quantity} available`
          });
        }
        existingItem.quantity = newQuantity;
        if (deliveryMethod) {
          existingItem.deliveryMethod = deliveryMethod;
        }
        console.log('Updated existing cart item:', JSON.stringify(existingItem, null, 2));
      } else {
        const newCartItem = {
          itemId: itemId,
          quantity: quantity,
          deliveryMethod: deliveryMethod,
          shipping: shipping,
          addedAt: new Date()
        };
        console.log('Creating new cart item:', JSON.stringify(newCartItem, null, 2));
        cart.items.push(newCartItem);
      }

      console.log('Saving cart with items:', cart.items.length);
      await cart.save();
      console.log('Cart saved successfully');

      // Populate the cart with item details for response
      const populatedCart = await Cart.findById(cart._id)
        .populate({
          path: 'items.itemId',
          model: 'Item',
          select: 'title price images seller status availability shipping'
        });

      const totalPrice = await cart.getTotalPrice();
      const itemCount = cart.getItemCount();

      res.json({
        success: true,
        data: {
          items: populatedCart.items,
          totalPrice: totalPrice,
          itemCount: itemCount,
          cartId: cart._id
        },
        message: 'Item added to cart successfully'
      });

    } catch (error) {
      logger.error('Add to cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add item to cart'
      });
    }
  },

  /**
   * @route   POST /api/cart/remove
   * @desc    Remove item from cart
   * @access  Private
   */
  removeFromCart: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { itemId } = req.body;
      const userId = req.user.id;

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      const itemExists = cart.items.some(cartItem => 
        cartItem.itemId.toString() === itemId
      );

      if (!itemExists) {
        return res.status(404).json({
          success: false,
          error: 'Item not found in cart'
        });
      }

      await cart.removeItem(itemId);

      // Populate the cart with item details for response
      const populatedCart = await Cart.findById(cart._id)
        .populate({
          path: 'items.itemId',
          model: 'Item',
          select: 'title price images seller status availability shipping'
        });

      const totalPrice = await cart.getTotalPrice();
      const itemCount = cart.getItemCount();

      res.json({
        success: true,
        data: {
          items: populatedCart.items,
          totalPrice: totalPrice,
          itemCount: itemCount,
          cartId: cart._id
        },
        message: 'Item removed from cart successfully'
      });

    } catch (error) {
      logger.error('Remove from cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove item from cart'
      });
    }
  },

  /**
   * @route   DELETE /api/cart/clear
   * @desc    Clear entire cart
   * @access  Private
   */
  clearCart: async (req, res) => {
    try {
      const userId = req.user.id;

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      await cart.clearCart();

      res.json({
        success: true,
        data: {
          items: [],
          totalPrice: 0,
          itemCount: 0,
          cartId: cart._id
        },
        message: 'Cart cleared successfully'
      });

    } catch (error) {
      logger.error('Clear cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cart'
      });
    }
  },

  /**
   * @route   PUT /api/cart/update-item
   * @desc    Update item quantity and delivery method in cart
   * @access  Private
   */
  updateItem: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { itemId, quantity, deliveryMethod } = req.body;
      const userId = req.user.id;

      if (quantity !== undefined && quantity < 0) {
        return res.status(400).json({
          success: false,
          error: 'Quantity cannot be negative'
        });
      }

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      const cartItem = cart.items.find(item => 
        item.itemId.toString() === itemId
      );

      if (!cartItem) {
        return res.status(404).json({
          success: false,
          error: 'Item not found in cart'
        });
      }

      const item = await Item.findById(itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item details not found'
        });
      }

      if (quantity !== undefined) {
        if (quantity > (item.availability?.quantity || 0)) {
          return res.status(400).json({
            success: false,
            error: `Only ${item.availability?.quantity || 0} items available`
          });
        }
        if (quantity === 0) {
          await cart.removeItem(itemId);
        } else {
          cartItem.quantity = quantity;
        }
      }

      if (deliveryMethod !== undefined) {
        if (deliveryMethod && !item.shipping.shippingMethods.includes(deliveryMethod)) {
          return res.status(400).json({
            success: false,
            error: 'Selected delivery method is not available for this item'
          });
        }
        cartItem.deliveryMethod = deliveryMethod;
      }

      await cart.save();

      // Populate the cart with item details for response
      const populatedCart = await Cart.findById(cart._id)
        .populate({
          path: 'items.itemId',
          model: 'Item',
          select: 'title price images seller status availability shipping'
        });

      const totalPrice = await cart.getTotalPrice();
      const itemCount = cart.getItemCount();

      res.json({
        success: true,
        data: {
          items: populatedCart.items,
          totalPrice: totalPrice,
          itemCount: itemCount,
          cartId: cart._id
        },
        message: 'Cart item updated successfully'
      });

    } catch (error) {
      logger.error('Update item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update item in cart'
      });
    }
  }
};

module.exports = cartController;
