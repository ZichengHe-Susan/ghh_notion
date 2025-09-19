const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { auth } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware for address creation/update
const addressValidation = [
  body('label')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Label cannot exceed 50 characters'),
  
  body('type')
    .optional()
    .isIn(['home', 'work', 'billing', 'shipping', 'other'])
    .withMessage('Invalid address type'),
  
  body('address.street')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Street address must be between 1 and 200 characters'),
  
  body('address.apartment')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Apartment cannot exceed 50 characters'),
  
  body('address.city')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City must be between 1 and 100 characters'),
  
  body('address.state')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State must be between 1 and 100 characters'),
  
  body('address.zipCode')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('ZIP code must be between 1 and 20 characters'),
  
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),
  
  body('contactInfo.firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  
  body('contactInfo.lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  
  body('contactInfo.phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  
  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Delivery instructions cannot exceed 500 characters')
];

// All routes require authentication
router.use(auth);

// @route   GET /api/addresses
// @desc    Get all addresses for the authenticated user
// @access  Private
router.get('/', addressController.getAddresses);

// @route   GET /api/addresses/default
// @desc    Get default address for the authenticated user
// @access  Private
router.get('/default', addressController.getDefaultAddress);

// @route   GET /api/addresses/:id
// @desc    Get a specific address by ID
// @access  Private
router.get('/:id', addressController.getAddressById);

// @route   POST /api/addresses
// @desc    Create a new address
// @access  Private
router.post('/', addressValidation, addressController.createAddress);

// @route   PUT /api/addresses/:id
// @desc    Update an address
// @access  Private
router.put('/:id', addressValidation, addressController.updateAddress);

// @route   DELETE /api/addresses/:id
// @desc    Delete an address (soft delete)
// @access  Private
router.delete('/:id', addressController.deleteAddress);

// @route   PUT /api/addresses/:id/set-default
// @desc    Set an address as default for its type
// @access  Private
router.put('/:id/set-default', addressController.setDefaultAddress);

// @route   PUT /api/addresses/:id/mark-used
// @desc    Mark an address as used (for tracking)
// @access  Private
router.put('/:id/mark-used', addressController.markAddressAsUsed);

module.exports = router;
