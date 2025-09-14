const express = require('express');
const router = express.Router();

// Import controllers (placeholder for now)
const orderController = require('../controllers/orderController');

// Import middleware
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// @route   GET /api/orders
// @desc    Get all orders (admin only)
// @access  Private/Admin
router.get('/', auth, authorize('admin', 'super_admin'), orderController.getOrders);

// @route   GET /api/orders/user/:userId
// @desc    Get user's orders
// @access  Private
router.get('/user/:userId', auth, orderController.getUserOrders);

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get('/:id', auth, orderController.getOrder);

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post('/', auth, orderController.createOrder);

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.put('/:id/status', auth, orderController.updateOrderStatus);

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private
router.put('/:id/cancel', auth, orderController.cancelOrder);

module.exports = router;
