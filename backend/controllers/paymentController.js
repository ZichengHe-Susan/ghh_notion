const stripeService = require('../services/stripeService');
const escrowService = require('../services/escrowService');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

const paymentController = {
  /**
   * Create a payment intent for an order
   * @route POST /api/payments/create-intent
   * @access Private
   */
  createPaymentIntent: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { orderId, paymentMethod, billingDetails } = req.body;
      const userId = req.user.id;

      const order = await Order.findById(orderId).populate('buyer seller items.item');
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      if (order.buyer._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only the buyer can create payment intent'
        });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Order is not in pending status'
        });
      }
      const existingPayment = await Payment.findOne({ order: orderId });
      if (existingPayment) {
        return res.status(400).json({
          success: false,
          message: 'Payment intent already exists for this order'
        });
      }

      billingDetails.userAgent = req.get('User-Agent');
      billingDetails.ipAddress = req.ip;

      const result = await stripeService.createPaymentIntent(order, paymentMethod, billingDetails);

      res.status(201).json({
        success: true,
        message: 'Payment intent created successfully',
        data: {
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntent.id,
          amount: order.pricing.total,
          currency: order.pricing.currency
        }
      });

    } catch (error) {
      logger.error('Error creating payment intent:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
        error: error.message
      });
    }
  },

  /**
   * Confirm a payment intent
   * @route POST /api/payments/confirm
   * @access Private
   */
  confirmPayment: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { paymentIntentId, paymentMethodId } = req.body;
      const userId = req.user.id;

      const payment = await Payment.findOne({ paymentIntentId }).populate('order');
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.user.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only the buyer can confirm payment'
        });
      }

      const paymentIntent = await stripeService.confirmPayment(paymentIntentId, paymentMethodId);

      if (paymentIntent.status === 'succeeded') {
        await escrowService.initializeEscrow(payment.order._id);
      }

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: {
          status: paymentIntent.status,
          orderId: payment.order._id,
          orderNumber: payment.order.orderNumber
        }
      });

    } catch (error) {
      logger.error('Error confirming payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment',
        error: error.message
      });
    }
  },

  /**
   * Handle Stripe webhooks
   * @route POST /api/payments/webhook
   * @access Public (Stripe only)
   */
  handleWebhook: async (req, res) => {
    try {
      const signature = req.get('stripe-signature');
      const payload = JSON.stringify(req.body);

      const event = stripeService.verifyWebhookSignature(payload, signature);

      const result = await stripeService.handleWebhookEvent(event);

      res.json({
        success: true,
        message: 'Webhook processed successfully',
        processed: result.processed
      });

    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.status(400).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message
      });
    }
  },

  /**
   * Get user's payment methods
   * @route GET /api/payments/methods
   * @access Private
   */
  getPaymentMethods: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user.stripeCustomerId) {
        return res.json({
          success: true,
          data: {
            paymentMethods: []
          }
        });
      }

      const paymentMethods = await stripeService.listPaymentMethods(user.stripeCustomerId);

      res.json({
        success: true,
        data: {
          paymentMethods: paymentMethods.data
        }
      });

    } catch (error) {
      logger.error('Error getting payment methods:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment methods',
        error: error.message
      });
    }
  },

  /**
   * Add a payment method
   * @route POST /api/payments/methods
   * @access Private
   */
  addPaymentMethod: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { paymentMethodId } = req.body;
      const userId = req.user.id;

      let user = await User.findById(userId);
      if (!user.stripeCustomerId) {
        const customer = await stripeService.createCustomer({
          email: user.email,
          name: user.name,
          metadata: {
            userId: userId
          }
        });
        user.stripeCustomerId = customer.id;
        await user.save();
      }

      await stripeService.attachPaymentMethod(paymentMethodId, user.stripeCustomerId);

      res.json({
        success: true,
        message: 'Payment method added successfully'
      });

    } catch (error) {
      logger.error('Error adding payment method:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add payment method',
        error: error.message
      });
    }
  },

  /**
   * Remove a payment method
   * @route DELETE /api/payments/methods/:paymentMethodId
   * @access Private
   */
  removePaymentMethod: async (req, res) => {
    try {
      const { paymentMethodId } = req.params;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user.stripeCustomerId) {
        return res.status(404).json({
          success: false,
          message: 'No payment methods found'
        });
      }

      const paymentMethods = await stripeService.listPaymentMethods(user.stripeCustomerId);
      const paymentMethod = paymentMethods.data.find(pm => pm.id === paymentMethodId);

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found'
        });
      }

      await stripeService.detachPaymentMethod(paymentMethodId);

      res.json({
        success: true,
        message: 'Payment method removed successfully'
      });

    } catch (error) {
      logger.error('Error removing payment method:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove payment method',
        error: error.message
      });
    }
  },

  /**
   * Process a refund
   * @route POST /api/payments/refund
   * @access Private (Admin only)
   */
  processRefund: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { orderId, amount, reason } = req.body;
      const adminId = req.user.id;

      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const result = await escrowService.processEscrowRefund(orderId, amount, reason, adminId);

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error processing refund:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: error.message
      });
    }
  },

  /**
   * Get payment details
   * @route GET /api/payments/:paymentIntentId
   * @access Private
   */
  getPaymentDetails: async (req, res) => {
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

      if (payment.user.toString() !== userId && 
          payment.order.buyer.toString() !== userId && 
          payment.order.seller.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          payment: payment,
          order: payment.order
        }
      });

    } catch (error) {
      logger.error('Error getting payment details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment details',
        error: error.message
      });
    }
  },

  /**
   * Get user's payment history
   * @route GET /api/payments/history
   * @access Private
   */
  getPaymentHistory: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;

      const query = { user: userId };
      if (status) {
        query.status = status;
      }

      const payments = await Payment.find(query)
        .populate('order')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Payment.countDocuments(query);

      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });

    } catch (error) {
      logger.error('Error getting payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment history',
        error: error.message
      });
    }
  },

  /**
   * Get payment statistics (Admin only)
   * @route GET /api/payments/stats
   * @access Private (Admin only)
   */
  getPaymentStats: async (req, res) => {
    try {
      const { sellerId, startDate, endDate } = req.query;

      const stats = await stripeService.getPaymentStats(
        sellerId,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );

      res.json({
        success: true,
        data: {
          stats
        }
      });

    } catch (error) {
      logger.error('Error getting payment stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment statistics',
        error: error.message
      });
    }
  }
};

module.exports = paymentController;
