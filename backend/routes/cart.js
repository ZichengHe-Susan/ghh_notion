const express = require('express');
const router = express.Router();

// Import controllers
const cartController = require('../controllers/cartController');

// Import middleware
const { auth } = require('../middleware/auth');
const { validateCartOperation, validateCartQuantity } = require('../middleware/validation');

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', auth, cartController.getCart);

// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/add', auth, validateCartOperation, cartController.addToCart);

// @route   POST /api/cart/remove
// @desc    Remove item from cart
// @access  Private
router.post('/remove', auth, validateCartOperation, cartController.removeFromCart);

// @route   DELETE /api/cart/clear
// @desc    Clear entire cart
// @access  Private
router.delete('/clear', auth, cartController.clearCart);

// @route   PUT /api/cart/update-quantity
// @desc    Update item quantity in cart
// @access  Private
router.put('/update-quantity', auth, validateCartQuantity, cartController.updateQuantity);

module.exports = router;
