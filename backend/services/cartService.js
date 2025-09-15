const Cart = require('../models/Cart');
const Item = require('../models/Item');
const logger = require('../config/logger');

class CartService {
  /**
   * Validate item availability for cart operations
   * @param {string} itemId - Item ID to validate
   * @param {number} quantity - Quantity to check
   * @returns {Object} Validation result
   */
  async validateItemAvailability(itemId, quantity = 1) {
    try {
      const item = await Item.findById(itemId);
      
      if (!item) {
        return {
          isValid: false,
          error: 'Item not found'
        };
      }

      if (item.status !== 'active') {
        return {
          isValid: false,
          error: 'Item is not available for purchase'
        };
      }

      if (!item.availability || item.availability.status !== 'available') {
        return {
          isValid: false,
          error: 'Item is currently unavailable'
        };
      }

      if (item.availability.quantity < quantity) {
        return {
          isValid: false,
          error: `Only ${item.availability.quantity} items available`
        };
      }

      return {
        isValid: true,
        item: item
      };
    } catch (error) {
      logger.error('Error validating item availability:', error);
      return {
        isValid: false,
        error: 'Failed to validate item availability'
      };
    }
  }

  /**
   * Check if user can add item to cart (not their own item)
   * @param {string} itemId - Item ID
   * @param {string} userId - User ID
   * @returns {Object} Validation result
   */
  async validateUserCanAddItem(itemId, userId) {
    try {
      const item = await Item.findById(itemId).select('seller');
      
      if (!item) {
        return {
          isValid: false,
          error: 'Item not found'
        };
      }

      if (item.seller.toString() === userId) {
        return {
          isValid: false,
          error: 'Cannot add your own item to cart'
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      logger.error('Error validating user can add item:', error);
      return {
        isValid: false,
        error: 'Failed to validate user permissions'
      };
    }
  }

  /**
   * Get cart with populated items and validation
   * @param {string} userId - User ID
   * @returns {Object} Cart data
   */
  async getCartWithValidation(userId) {
    try {
      const cart = await Cart.getCartWithItems(userId);

      // Filter out unavailable items
      const availableItems = cart.items.filter(cartItem => {
        const item = cartItem.itemId;
        return item && 
               item.status === 'active' && 
               item.availability && 
               item.availability.status === 'available' && 
               item.availability.quantity > 0;
      });

      // Update cart if items were filtered out
      if (availableItems.length !== cart.items.length) {
        cart.items = availableItems;
        await cart.save();
        logger.info(`Filtered out ${cart.items.length - availableItems.length} unavailable items from cart for user ${userId}`);
      }

      const totalPrice = await cart.getTotalPrice();
      const itemCount = cart.getItemCount();

      return {
        success: true,
        data: {
          items: availableItems,
          totalPrice: totalPrice,
          itemCount: itemCount,
          cartId: cart._id
        }
      };
    } catch (error) {
      logger.error('Error getting cart with validation:', error);
      return {
        success: false,
        error: 'Failed to fetch cart'
      };
    }
  }

  /**
   * Add item to cart with comprehensive validation
   * @param {string} userId - User ID
   * @param {string} itemId - Item ID
   * @param {number} quantity - Quantity to add
   * @returns {Object} Operation result
   */
  async addItemToCart(userId, itemId, quantity = 1) {
    try {
      // Validate item availability
      const availabilityCheck = await this.validateItemAvailability(itemId, quantity);
      if (!availabilityCheck.isValid) {
        return {
          success: false,
          error: availabilityCheck.error
        };
      }

      // Validate user can add item
      const userCheck = await this.validateUserCanAddItem(itemId, userId);
      if (!userCheck.isValid) {
        return {
          success: false,
          error: userCheck.error
        };
      }

      // Get or create cart
      const cart = await Cart.findOrCreateByUserId(userId);

      // Check if item already exists in cart
      const existingItem = cart.items.find(cartItem => 
        cartItem.itemId.toString() === itemId
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        
        // Check if new quantity exceeds availability
        if (newQuantity > availabilityCheck.item.availability.quantity) {
          return {
            success: false,
            error: `Cannot add ${quantity} more items. Only ${availabilityCheck.item.availability.quantity - existingItem.quantity} available`
          };
        }
        
        existingItem.quantity = newQuantity;
      } else {
        cart.items.push({
          itemId: itemId,
          quantity: quantity,
          addedAt: new Date()
        });
      }

      await cart.save();

      // Return updated cart data
      return await this.getCartWithValidation(userId);
    } catch (error) {
      logger.error('Error adding item to cart:', error);
      return {
        success: false,
        error: 'Failed to add item to cart'
      };
    }
  }

  /**
   * Remove item from cart
   * @param {string} userId - User ID
   * @param {string} itemId - Item ID
   * @returns {Object} Operation result
   */
  async removeItemFromCart(userId, itemId) {
    try {
      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return {
          success: false,
          error: 'Cart not found'
        };
      }

      const itemExists = cart.items.some(cartItem => 
        cartItem.itemId.toString() === itemId
      );

      if (!itemExists) {
        return {
          success: false,
          error: 'Item not found in cart'
        };
      }

      await cart.removeItem(itemId);

      // Return updated cart data
      return await this.getCartWithValidation(userId);
    } catch (error) {
      logger.error('Error removing item from cart:', error);
      return {
        success: false,
        error: 'Failed to remove item from cart'
      };
    }
  }

  /**
   * Update item quantity in cart
   * @param {string} userId - User ID
   * @param {string} itemId - Item ID
   * @param {number} quantity - New quantity
   * @returns {Object} Operation result
   */
  async updateItemQuantity(userId, itemId, quantity) {
    try {
      if (quantity < 0) {
        return {
          success: false,
          error: 'Quantity cannot be negative'
        };
      }

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return {
          success: false,
          error: 'Cart not found'
        };
      }

      const cartItem = cart.items.find(item => 
        item.itemId.toString() === itemId
      );

      if (!cartItem) {
        return {
          success: false,
          error: 'Item not found in cart'
        };
      }

      // If quantity is 0, remove the item
      if (quantity === 0) {
        return await this.removeItemFromCart(userId, itemId);
      }

      // Check item availability if increasing quantity
      if (quantity > cartItem.quantity) {
        const availabilityCheck = await this.validateItemAvailability(itemId, quantity);
        if (!availabilityCheck.isValid) {
          return {
            success: false,
            error: availabilityCheck.error
          };
        }
      }

      await cart.updateItemQuantity(itemId, quantity);

      // Return updated cart data
      return await this.getCartWithValidation(userId);
    } catch (error) {
      logger.error('Error updating item quantity:', error);
      return {
        success: false,
        error: 'Failed to update item quantity'
      };
    }
  }

  /**
   * Clear entire cart
   * @param {string} userId - User ID
   * @returns {Object} Operation result
   */
  async clearCart(userId) {
    try {
      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return {
          success: false,
          error: 'Cart not found'
        };
      }

      await cart.clearCart();

      return {
        success: true,
        data: {
          items: [],
          totalPrice: 0,
          itemCount: 0,
          cartId: cart._id
        },
        message: 'Cart cleared successfully'
      };
    } catch (error) {
      logger.error('Error clearing cart:', error);
      return {
        success: false,
        error: 'Failed to clear cart'
      };
    }
  }

  /**
   * Validate cart before checkout
   * @param {string} userId - User ID
   * @returns {Object} Validation result
   */
  async validateCartForCheckout(userId) {
    try {
      const cart = await Cart.getCartWithItems(userId);
      
      if (!cart || cart.items.length === 0) {
        return {
          isValid: false,
          error: 'Cart is empty'
        };
      }

      const validationErrors = [];
      
      for (const cartItem of cart.items) {
        const item = cartItem.itemId;
        
        // Check if item still exists and is available
        if (!item) {
          validationErrors.push(`Item ${cartItem.itemId} no longer exists`);
          continue;
        }

        if (item.status !== 'active') {
          validationErrors.push(`Item "${item.title}" is no longer available`);
          continue;
        }

        if (!item.availability || item.availability.status !== 'available') {
          validationErrors.push(`Item "${item.title}" is currently unavailable`);
          continue;
        }

        if (item.availability.quantity < cartItem.quantity) {
          validationErrors.push(`Only ${item.availability.quantity} of "${item.title}" available (${cartItem.quantity} requested)`);
          continue;
        }

        // Check if user is trying to buy their own item
        if (item.seller.toString() === userId) {
          validationErrors.push(`Cannot purchase your own item "${item.title}"`);
        }
      }

      if (validationErrors.length > 0) {
        return {
          isValid: false,
          errors: validationErrors
        };
      }

      return {
        isValid: true,
        cart: cart
      };
    } catch (error) {
      logger.error('Error validating cart for checkout:', error);
      return {
        isValid: false,
        error: 'Failed to validate cart for checkout'
      };
    }
  }
}

module.exports = new CartService();
