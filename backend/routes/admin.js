const express = require('express');
const router = express.Router();

// Import controllers (to be created)
const {
  getDashboard,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getItems,
  updateItem,
  deleteItem,
  getOrders,
  getOrder,
  updateOrder,
  getAnalytics,
  getAuditLogs,
  createAuditLog,
  moderateContent,
  resolveDispute
} = require('../controllers/adminController');

// Import middleware
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All admin routes require authentication and admin role
router.use(auth);
router.use(authorize('admin', 'super_admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard data
// @access  Private/Admin
router.get('/dashboard', getDashboard);

// @route   GET /api/admin/analytics
// @desc    Get analytics data
// @access  Private/Admin
router.get('/analytics', getAnalytics);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private/Admin
router.get('/users', getUsers);

// @route   GET /api/admin/users/:id
// @desc    Get single user
// @access  Private/Admin
router.get('/users/:id', getUser);

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private/Admin
router.put('/users/:id', updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/SuperAdmin
router.delete('/users/:id', authorize('super_admin'), deleteUser);

// @route   GET /api/admin/items
// @desc    Get all items for moderation
// @access  Private/Admin
router.get('/items', getItems);

// @route   PUT /api/admin/items/:id
// @desc    Update item (moderation)
// @access  Private/Admin
router.put('/items/:id', updateItem);

// @route   DELETE /api/admin/items/:id
// @desc    Delete item
// @access  Private/Admin
router.delete('/items/:id', deleteItem);

// @route   GET /api/admin/orders
// @desc    Get all orders
// @access  Private/Admin
router.get('/orders', getOrders);

// @route   GET /api/admin/orders/:id
// @desc    Get single order
// @access  Private/Admin
router.get('/orders/:id', getOrder);

// @route   PUT /api/admin/orders/:id
// @desc    Update order
// @access  Private/Admin
router.put('/orders/:id', updateOrder);

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs
// @access  Private/Admin
router.get('/audit-logs', getAuditLogs);

// @route   POST /api/admin/audit-logs
// @desc    Create audit log
// @access  Private/Admin
router.post('/audit-logs', createAuditLog);

// @route   POST /api/admin/moderate-content
// @desc    Moderate content (approve/reject)
// @access  Private/Admin
router.post('/moderate-content', moderateContent);

// @route   POST /api/admin/resolve-dispute
// @desc    Resolve payment dispute
// @access  Private/Admin
router.post('/resolve-dispute', resolveDispute);

module.exports = router;
