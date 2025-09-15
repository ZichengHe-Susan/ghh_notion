const express = require('express');
const router = express.Router();

// Import controllers (placeholder for now)
const adminController = require('../controllers/adminController');

// Import middleware
const { auth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// All admin routes require authentication and admin role
router.use(auth);
router.use(authorize('admin', 'super_admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard data
// @access  Private/Admin
router.get('/dashboard', adminController.getDashboard);

// @route   GET /api/admin/analytics
// @desc    Get analytics data
// @access  Private/Admin
router.get('/analytics', adminController.getAnalytics);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private/Admin
router.get('/users', adminController.getUsers);

// @route   GET /api/admin/users/:id
// @desc    Get single user
// @access  Private/Admin
router.get('/users/:id', adminController.getUser);

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private/Admin
router.put('/users/:id', adminController.updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/SuperAdmin
router.delete('/users/:id', authorize('super_admin'), adminController.deleteUser);

// @route   GET /api/admin/items
// @desc    Get all items for moderation
// @access  Private/Admin
router.get('/items', adminController.getItems);

// @route   PUT /api/admin/items/:id
// @desc    Update item (moderation)
// @access  Private/Admin
router.put('/items/:id', adminController.updateItem);

// @route   DELETE /api/admin/items/:id
// @desc    Delete item
// @access  Private/Admin
router.delete('/items/:id', adminController.deleteItem);

// @route   GET /api/admin/orders
// @desc    Get all orders
// @access  Private/Admin
router.get('/orders', adminController.getOrders);

// @route   GET /api/admin/orders/:id
// @desc    Get single order
// @access  Private/Admin
router.get('/orders/:id', adminController.getOrder);

// @route   PUT /api/admin/orders/:id
// @desc    Update order
// @access  Private/Admin
router.put('/orders/:id', adminController.updateOrder);

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs
// @access  Private/Admin
router.get('/audit-logs', adminController.getAuditLogs);

// @route   POST /api/admin/audit-logs
// @desc    Create audit log
// @access  Private/Admin
router.post('/audit-logs', adminController.createAuditLog);

// @route   POST /api/admin/moderate-content
// @desc    Moderate content (approve/reject)
// @access  Private/Admin
router.post('/moderate-content', adminController.moderateContent);

// @route   POST /api/admin/resolve-dispute
// @desc    Resolve payment dispute
// @access  Private/Admin
router.post('/resolve-dispute', adminController.resolveDispute);

// Order Lifecycle Management Routes
// @route   GET /api/admin/order-lifecycle/stats
// @desc    Get order lifecycle statistics
// @access  Private/Admin
router.get('/order-lifecycle/stats', adminController.getOrderLifecycleStats);

// @route   POST /api/admin/order-lifecycle/trigger-processing
// @desc    Manually trigger order lifecycle processing
// @access  Private/Admin
router.post('/order-lifecycle/trigger-processing', adminController.triggerOrderLifecycleProcessing);

// @route   GET /api/admin/order-analytics
// @desc    Get detailed order analytics
// @access  Private/Admin
router.get('/order-analytics', adminController.getOrderAnalytics);

// @route   GET /api/admin/system-health
// @desc    Get system health status
// @access  Private/Admin
router.get('/system-health', adminController.getSystemHealth);

module.exports = router;
