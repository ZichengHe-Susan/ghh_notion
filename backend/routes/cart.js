const express = require('express');
const router = express.Router();

// Import controllers
const cartController = require('../controllers/cartController');

// Import middleware
const { auth } = require('../middleware/auth');
const { validateCartOperation, validateCartQuantity } = require('../middleware/validation');
const { body, param } = require('express-validator');

const validateAddToCart = [
  body('itemId').isMongoId().withMessage('Valid item ID is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('deliveryMethod').optional().isString().isIn(['standard', 'express', 'overnight', 'pickup', 'delivery'])
];

const validateRemoveFromCart = [
  body('itemId').isMongoId().withMessage('Valid item ID is required')
];

const validateUpdateItem = [
  body('itemId').isMongoId().withMessage('Valid item ID is required'),
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity cannot be negative'),
  body('deliveryMethod').optional({ nullable: true }).isString().isIn(['standard', 'express', 'overnight', 'pickup', 'delivery'])
];

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', auth, cartController.getCart);

// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/add', auth, validateAddToCart, cartController.addToCart);

// @route   POST /api/cart/remove
// @desc    Remove item from cart
// @access  Private
router.post('/remove', auth, validateRemoveFromCart, cartController.removeFromCart);

// @route   DELETE /api/cart/clear
// @desc    Clear entire cart
// @access  Private
router.delete('/clear', auth, cartController.clearCart);

// @route   PUT /api/cart/update-item
// @desc    Update item quantity and/or delivery method in cart
// @access  Private
router.put('/update-item', auth, validateUpdateItem, cartController.updateItem);

module.exports = router;
