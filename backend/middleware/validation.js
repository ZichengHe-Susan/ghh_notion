const { body, param, query } = require('express-validator');

const validateRegistration = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase()
];

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const validateEmailVerification = [
  param('token')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid verification token format')
    .matches(/^[a-f0-9]+$/)
    .withMessage('Invalid verification token format')
];

const validateResendVerification = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase()
];

const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

const validateLogout = [
  body('refreshToken')
    .optional()
    .notEmpty()
    .withMessage('Refresh token cannot be empty if provided')
];

const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  body('profile.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('profile.bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  
  body('profile.location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters')
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
];

const validateEmailChange = [
  body('newEmail')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('Current password is required for email change')
];

const validateNotificationPreferences = [
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  
  body('preferences.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean'),
  
  body('preferences.notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be a boolean')
];

const validateItem = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Item title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Item description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  
  body('price')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Price must be a valid number between 0 and 999999.99'),
  
  body('category')
    .isMongoId()
    .withMessage('Category must be a valid category ID'),
  
  body('condition')
    .isIn(['new', 'like_new', 'good', 'fair', 'poor'])
    .withMessage('Condition must be one of: new, like_new, good, fair, poor'),
  
  body('location.address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),
  
  body('location.city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters'),
  
  body('location.state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),
  
  body('location.zipCode')
    .trim()
    .notEmpty()
    .withMessage('ZIP code is required')
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('ZIP code must be in format 12345 or 12345-6789'),
  
  body('shipping.isShippable')
    .optional()
    .isBoolean()
    .withMessage('Shipping availability must be a boolean'),
  
  body('shipping.shippingCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Shipping cost must be a non-negative number'),
  
  body('shipping.estimatedDeliveryDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Estimated delivery days must be between 1 and 30'),
  
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 tags allowed'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Each tag must be between 2 and 20 characters'),
  
  body('specifications.brand')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Brand cannot exceed 50 characters'),
  
  body('specifications.model')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Model cannot exceed 50 characters'),
  
  body('specifications.year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Year must be between 1900 and current year + 1'),
  
  body('specifications.color')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Color cannot exceed 30 characters'),
  
  body('specifications.size')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Size cannot exceed 20 characters'),
  
  body('specifications.weight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Weight must be a non-negative number'),
  
  body('seo.metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),
  
  body('seo.metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters')
];

const validateItemUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Price must be a valid number between 0 and 999999.99'),
  
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid category ID'),
  
  body('condition')
    .optional()
    .isIn(['new', 'like_new', 'good', 'fair', 'poor'])
    .withMessage('Condition must be one of: new, like_new, good, fair, poor'),
  
  body('status')
    .optional()
    .isIn(['draft', 'pending_approval', 'active', 'sold', 'expired', 'rejected'])
    .withMessage('Invalid status value'),
  
  body('availability.quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  
  body('location.address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),
  
  body('location.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters'),
  
  body('location.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),
  
  body('location.zipCode')
    .optional()
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('ZIP code must be in format 12345 or 12345-6789'),
  
  body('shipping.isShippable')
    .optional()
    .isBoolean()
    .withMessage('Shipping availability must be a boolean'),
  
  body('shipping.shippingCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Shipping cost must be a non-negative number'),
  
  body('shipping.estimatedDeliveryDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Estimated delivery days must be between 1 and 30'),
  
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 tags allowed'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Each tag must be between 2 and 20 characters')
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateEmailVerification,
  validateResendVerification,
  validateRefreshToken,
  validateLogout,
  validateProfileUpdate,
  validatePasswordChange,
  validateEmailChange,
  validateNotificationPreferences,
  validateItem,
  validateItemUpdate
};