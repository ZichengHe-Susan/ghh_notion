const express = require('express');
const router = express.Router();

// Import controllers (placeholder for now)
const itemController = require('../controllers/itemController');

// Import middleware
const { auth, requireEmailVerification } = require('../middleware/auth');

// @route   GET /api/items
// @desc    Get all items with pagination and filtering
// @access  Public
router.get('/', itemController.getItems);

// @route   GET /api/items/search
// @desc    Search items
// @access  Public
router.get('/search', itemController.searchItems);

// @route   GET /api/items/categories
// @desc    Get item categories
// @access  Public
router.get('/categories', itemController.getItemCategories);

// @route   GET /api/items/:id
// @desc    Get single item
// @access  Public
router.get('/:id', itemController.getItem);

// @route   POST /api/items
// @desc    Create new item
// @access  Private
router.post('/', auth, requireEmailVerification, itemController.createItem);

// @route   PUT /api/items/:id
// @desc    Update item
// @access  Private
router.put('/:id', auth, itemController.updateItem);

// @route   DELETE /api/items/:id
// @desc    Delete item
// @access  Private
router.delete('/:id', auth, itemController.deleteItem);

// @route   POST /api/items/:id/images
// @desc    Upload item images
// @access  Private
router.post('/:id/images', auth, itemController.uploadItemImages);

module.exports = router;
