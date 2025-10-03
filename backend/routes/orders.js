const express = require('express');
const router = express.Router();

// Import controllers
const orderController = require('../controllers/orderController');

// Import middleware
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validateOrder, validateOrderStatusUpdate, validateRefund } = require('../middleware/validation');

// @route   GET /api/orders
// @desc    Get all orders (admin only)
// @access  Private/Admin
router.get('/', auth, authorize('admin', 'super_admin'), orderController.getOrders);

// @route   GET /api/orders/user/:userId
// @desc    Get user's orders
// @access  Private
router.get('/user/:userId', auth, orderController.getUserOrders);

// @route   GET /api/orders/:id/tracking
// @desc    Get order tracking information
// @access  Private
router.get('/:id/tracking', auth, orderController.getOrderTracking);

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get('/:id', auth, orderController.getOrder);

// @route   POST /api/orders/calculate-fees
// @desc    Calculate order fees and pricing
// @access  Private
router.post('/calculate-fees', auth, orderController.calculateOrderFees);

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post('/', auth, validateOrder, orderController.createOrder);

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.put('/:id/status', auth, validateOrderStatusUpdate, orderController.updateOrderStatus);

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private
router.put('/:id/cancel', auth, orderController.cancelOrder);

// @route   POST /api/orders/:id/refund
// @desc    Process refund for order (admin only)
// @access  Private/Admin
router.post('/:id/refund', auth, authorize('admin', 'super_admin'), validateRefund, orderController.processRefund);

module.exports = router;
