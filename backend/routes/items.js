const express = require('express');
const router = express.Router();

// Import controllers (to be created)
const {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
  getItemCategories,
  uploadItemImages
} = require('../controllers/itemController');

// Import middleware
const auth = require('../middleware/auth');
const { validateItem } = require('../middleware/validation');

// @route   GET /api/items
// @desc    Get all items with pagination and filtering
// @access  Public
router.get('/', getItems);

// @route   GET /api/items/search
// @desc    Search items
// @access  Public
router.get('/search', searchItems);

// @route   GET /api/items/categories
// @desc    Get item categories
// @access  Public
router.get('/categories', getItemCategories);

// @route   GET /api/items/:id
// @desc    Get single item
// @access  Public
router.get('/:id', getItem);

// @route   POST /api/items
// @desc    Create new item
// @access  Private
router.post('/', auth, validateItem, createItem);

// @route   PUT /api/items/:id
// @desc    Update item
// @access  Private
router.put('/:id', auth, validateItem, updateItem);

// @route   DELETE /api/items/:id
// @desc    Delete item
// @access  Private
router.delete('/:id', auth, deleteItem);

// @route   POST /api/items/:id/images
// @desc    Upload item images
// @access  Private
router.post('/:id/images', auth, uploadItemImages);

module.exports = router;
