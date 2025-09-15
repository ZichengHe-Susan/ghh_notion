const { body, param, query, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Validation middleware for payment operations
 */

/**
 * Validate create payment intent request
 */
const validateCreatePaymentIntent = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required')
    .custom(async (value) => {
      const order = await Order.findById(value);
      if (!order) {
        throw new Error('Order not found');
      }
      return true;
    }),
  
  body('paymentMethod.type')
    .isIn(['card', 'bank_transfer', 'digital_wallet'])
    .withMessage('Valid payment method type is required'),
  
  body('paymentMethod.card.brand')
    .optional()
    .isString()
    .isLength({ min: 2, max: 20 }),
  
  body('paymentMethod.card.last4')
    .optional()
    .isString()
    .isLength({ min: 4, max: 4 })
    .matches(/^\d{4}$/),
  
  body('paymentMethod.card.expMonth')
    .optional()
    .isInt({ min: 1, max: 12 }),
  
  body('paymentMethod.card.expYear')
    .optional()
    .isInt({ min: new Date().getFullYear() }),
  
  body('billingDetails.name')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name is required'),
  
  body('billingDetails.email')
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('billingDetails.phone')
    .optional()
    .isString()
    .isLength({ min: 10, max: 20 }),
  
  body('billingDetails.address.line1')
    .isString()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address line 1 is required'),
  
  body('billingDetails.address.line2')
    .optional()
    .isString()
    .isLength({ max: 200 }),
  
  body('billingDetails.address.city')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('City is required'),
  
  body('billingDetails.address.state')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('State is required'),
  
  body('billingDetails.address.postalCode')
    .isString()
    .isLength({ min: 3, max: 20 })
    .withMessage('Postal code is required'),
  
  body('billingDetails.address.country')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country is required')
];

/**
 * Validate confirm payment request
 */
const validateConfirmPayment = [
  body('paymentIntentId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Payment intent ID is required')
    .custom(async (value) => {
      const payment = await Payment.findOne({ paymentIntentId: value });
      if (!payment) {
        throw new Error('Payment intent not found');
      }
      return true;
    }),
  
  body('paymentMethodId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Payment method ID is required')
];

/**
 * Validate add payment method request
 */
const validateAddPaymentMethod = [
  body('paymentMethodId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Payment method ID is required')
];

/**
 * Validate process refund request
 */
const validateProcessRefund = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required')
    .custom(async (value) => {
      const order = await Order.findById(value);
      if (!order) {
        throw new Error('Order not found');
      }
      return true;
    }),
  
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  
  body('reason')
    .optional()
    .isIn(['duplicate', 'fraudulent', 'requested_by_customer', 'admin_dispute_resolution'])
    .withMessage('Valid refund reason is required')
];

/**
 * Validate payment history query parameters
 */
const validatePaymentHistory = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled', 'failed'])
    .withMessage('Valid status is required')
];

/**
 * Validate payment statistics query parameters
 */
const validatePaymentStats = [
  query('sellerId')
    .optional()
    .isMongoId()
    .withMessage('Valid seller ID is required')
    .custom(async (value) => {
      if (value) {
        const user = await User.findById(value);
        if (!user) {
          throw new Error('Seller not found');
        }
      }
      return true;
    }),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
];

/**
 * Validate escrow release request
 */
const validateEscrowRelease = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required')
    .custom(async (value) => {
      const order = await Order.findById(value);
      if (!order) {
        throw new Error('Order not found');
      }
      if (order.escrow.status !== 'held') {
        throw new Error('Order escrow is not in held status');
      }
      return true;
    })
];

/**
 * Validate escrow refund request
 */
const validateEscrowRefund = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required')
    .custom(async (value) => {
      const order = await Order.findById(value);
      if (!order) {
        throw new Error('Order not found');
      }
      return true;
    }),
  
  body('refundAmount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be greater than 0'),
  
  body('reason')
    .optional()
    .isIn(['duplicate', 'fraudulent', 'requested_by_customer', 'admin_dispute_resolution'])
    .withMessage('Valid refund reason is required')
];

/**
 * Validate dispute initiation request
 */
const validateDisputeInitiation = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required')
    .custom(async (value) => {
      const order = await Order.findById(value);
      if (!order) {
        throw new Error('Order not found');
      }
      if (order.escrow.status !== 'held') {
        throw new Error('Order escrow must be held to initiate dispute');
      }
      return true;
    }),
  
  body('reason')
    .isString()
    .isLength({ min: 5, max: 200 })
    .withMessage('Dispute reason is required'),
  
  body('description')
    .isString()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Dispute description is required')
];

/**
 * Validate dispute resolution request
 */
const validateDisputeResolution = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required')
    .custom(async (value) => {
      const order = await Order.findById(value);
      if (!order) {
        throw new Error('Order not found');
      }
      if (order.status !== 'disputed') {
        throw new Error('Order is not in disputed status');
      }
      return true;
    }),
  
  body('resolution')
    .isIn(['release_to_seller', 'refund_to_buyer'])
    .withMessage('Valid resolution is required'),
  
  body('notes')
    .isString()
    .isLength({ min: 5, max: 500 })
    .withMessage('Resolution notes are required')
];

/**
 * Validate escrow statistics query parameters
 */
const validateEscrowStats = [
  query('sellerId')
    .optional()
    .isMongoId()
    .withMessage('Valid seller ID is required'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
];

/**
 * Validate pagination parameters
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Validate MongoDB ObjectId parameter
 */
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Valid ${paramName} is required`)
];

/**
 * Middleware to check validation results
 */
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      errors: errors.array(),
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Middleware to validate user authorization for order access
 */
const validateOrderAccess = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if user is buyer or seller
    if (order.buyer.toString() !== userId && order.seller.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Access denied'
      });
    }
    
    req.order = order;
    next();
  } catch (error) {
    logger.error('Error validating order access:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating order access'
    });
  }
};

/**
 * Middleware to validate payment access
 */
const validatePaymentAccess = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;
    
    const payment = await Payment.findOne({ paymentIntentId }).populate('order');
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check if user has access to this payment
    if (payment.user.toString() !== userId && 
        payment.order.buyer.toString() !== userId && 
        payment.order.seller.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Access denied'
      });
    }
    
    req.payment = payment;
    next();
  } catch (error) {
    logger.error('Error validating payment access:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating payment access'
    });
  }
};

module.exports = {
  validateCreatePaymentIntent,
  validateConfirmPayment,
  validateAddPaymentMethod,
  validateProcessRefund,
  validatePaymentHistory,
  validatePaymentStats,
  validateEscrowRelease,
  validateEscrowRefund,
  validateDisputeInitiation,
  validateDisputeResolution,
  validateEscrowStats,
  validatePagination,
  validateObjectId,
  checkValidation,
  validateOrderAccess,
  validatePaymentAccess
};
