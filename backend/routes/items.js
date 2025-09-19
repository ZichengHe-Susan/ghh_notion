const express = require('express');
const router = express.Router();

// Import controllers
const itemController = require('../controllers/itemController');

// Import middleware
const { auth, requireEmailVerification } = require('../middleware/auth');
const { uploadMultiple, validateUploadedFiles, processUploadedFiles } = require('../middleware/upload');
const { validateItem, validateItemUpdate } = require('../middleware/validation');

// @route   GET /api/items
// @desc    Get all items with pagination and filtering
// @access  Private
router.get('/', auth, itemController.getItems);

// @route   GET /api/items/search
// @desc    Search items
// @access  Private
router.get('/search', auth, itemController.searchItems);

// @route   GET /api/items/categories
// @desc    Get item categories
// @access  Private
router.get('/categories', auth, itemController.getItemCategories);

// @route   GET /api/items/seller/:sellerId
// @desc    Get items by seller
// @access  Private
router.get('/seller/:sellerId', auth, itemController.getItemsBySeller);

// @route   GET /api/items/:id
// @desc    Get single item
// @access  Private
router.get('/:id', auth, itemController.getItem);

// @route   POST /api/items
// @desc    Create new item
// @access  Private
router.post('/', auth, requireEmailVerification, validateItem, itemController.createItem);

// @route   PUT /api/items/:id
// @desc    Update item
// @access  Private
router.put('/:id', auth, validateItemUpdate, itemController.updateItem);

// @route   DELETE /api/items/:id
// @desc    Delete item
// @access  Private
router.delete('/:id', auth, itemController.deleteItem);

// @route   POST /api/items/:id/images
// @desc    Upload item images
// @access  Private
router.post('/:id/images', 
  auth, 
  uploadMultiple('images', 10), 
  validateUploadedFiles, 
  processUploadedFiles, 
  itemController.uploadItemImages
);

// @route   DELETE /api/items/:id/images/:imageId
// @desc    Delete specific item image
// @access  Private
router.delete('/:id/images/:imageId', auth, itemController.deleteItemImage);

module.exports = router;
