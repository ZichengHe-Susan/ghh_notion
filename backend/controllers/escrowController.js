const escrowService = require('../services/escrowService');
const Order = require('../models/Order');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

const escrowController = {
  /**
   * Release escrow funds to seller (buyer confirmation)
   * @route POST /api/escrow/release
   * @access Private
   */
  releaseEscrowToSeller: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { orderId } = req.body;
      const buyerId = req.user.id;

      const result = await escrowService.releaseEscrowToSeller(orderId, buyerId);

      res.json({
        success: true,
        message: 'Escrow funds released to seller successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error releasing escrow to seller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to release escrow funds',
        error: error.message
      });
    }
  },

  /**
   * Auto-release escrow funds after timeout period
   * @route POST /api/escrow/auto-release
   * @access Private (Admin only)
   */
  autoReleaseEscrow: async (req, res) => {
    try {
      const { orderId } = req.body;

      const result = await escrowService.autoReleaseEscrow(orderId);

      res.json({
        success: true,
        message: 'Escrow funds auto-released successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error auto-releasing escrow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to auto-release escrow funds',
        error: error.message
      });
    }
  },

  /**
   * Process escrow refund to buyer
   * @route POST /api/escrow/refund
   * @access Private (Admin only)
   */
  processEscrowRefund: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { orderId, refundAmount, reason } = req.body;
      const adminId = req.user.id;

      const result = await escrowService.processEscrowRefund(orderId, refundAmount, reason, adminId);

      res.json({
        success: true,
        message: 'Escrow refund processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error processing escrow refund:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process escrow refund',
        error: error.message
      });
    }
  },

  /**
   * Initiate a dispute for an order
   * @route POST /api/escrow/dispute
   * @access Private
   */
  initiateDispute: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { orderId, reason, description } = req.body;
      const userId = req.user.id;

      const result = await escrowService.initiateDispute(orderId, userId, reason, description);

      res.json({
        success: true,
        message: 'Dispute initiated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error initiating dispute:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate dispute',
        error: error.message
      });
    }
  },

  /**
   * Resolve a dispute (admin only)
   * @route POST /api/escrow/resolve-dispute
   * @access Private (Admin only)
   */
  resolveDispute: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { orderId, resolution, notes } = req.body;
      const adminId = req.user.id;

      const result = await escrowService.resolveDispute(orderId, resolution, adminId, notes);

      res.json({
        success: true,
        message: 'Dispute resolved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error resolving dispute:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve dispute',
        error: error.message
      });
    }
  },

  /**
   * Get orders pending auto-release
   * @route GET /api/escrow/pending-auto-release
   * @access Private (Admin only)
   */
  getPendingAutoReleaseOrders: async (req, res) => {
    try {
      const orders = await escrowService.getPendingAutoReleaseOrders();

      res.json({
        success: true,
        data: {
          orders,
          count: orders.length
        }
      });

    } catch (error) {
      logger.error('Error getting pending auto-release orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending auto-release orders',
        error: error.message
      });
    }
  },

  /**
   * Process all pending auto-releases
   * @route POST /api/escrow/process-auto-releases
   * @access Private (Admin only)
   */
  processPendingAutoReleases: async (req, res) => {
    try {
      const results = await escrowService.processPendingAutoReleases();

      res.json({
        success: true,
        message: 'Auto-release processing completed',
        data: results
      });

    } catch (error) {
      logger.error('Error processing pending auto-releases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process pending auto-releases',
        error: error.message
      });
    }
  },

  /**
   * Get escrow statistics
   * @route GET /api/escrow/stats
   * @access Private (Admin only)
   */
  getEscrowStats: async (req, res) => {
    try {
      const { sellerId, startDate, endDate } = req.query;

      const stats = await escrowService.getEscrowStats(
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
      logger.error('Error getting escrow stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get escrow statistics',
        error: error.message
      });
    }
  },

  /**
   * Get disputed orders
   * @route GET /api/escrow/disputed-orders
   * @access Private (Admin only)
   */
  getDisputedOrders: async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;

      const query = { status: 'disputed' };
      if (status) {
        query['escrow.status'] = status;
      }

      const orders = await Order.find(query)
        .populate('buyer seller')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Order.countDocuments(query);

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });

    } catch (error) {
      logger.error('Error getting disputed orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get disputed orders',
        error: error.message
      });
    }
  },

  /**
   * Get escrow details for an order
   * @route GET /api/escrow/:orderId
   * @access Private
   */
  getEscrowDetails: async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      if (order.buyer._id.toString() !== userId && 
          order.seller._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          order: {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            escrow: order.escrow,
            pricing: order.pricing,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
          }
        }
      });

    } catch (error) {
      logger.error('Error getting escrow details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get escrow details',
        error: error.message
      });
    }
  },

  /**
   * Get user's escrow orders
   * @route GET /api/escrow/user/orders
   * @access Private
   */
  getUserEscrowOrders: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;

      const query = {
        $or: [
          { buyer: userId },
          { seller: userId }
        ]
      };

      if (status) {
        query['escrow.status'] = status;
      }

      const orders = await Order.find(query)
        .populate('buyer seller')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Order.countDocuments(query);

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });

    } catch (error) {
      logger.error('Error getting user escrow orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user escrow orders',
        error: error.message
      });
    }
  }
};

module.exports = escrowController;
