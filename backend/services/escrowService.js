const logger = require('../config/logger');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const stripeService = require('./stripeService');

class EscrowService {
  constructor() {
    this.autoReleaseDays = 7; // Default auto-release period
    this.platformFeePercentage = 0.029; // 2.9%
    this.platformFeeFixed = 0.30; // $0.30
  }

  /**
   * Initialize escrow for an order after successful payment
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Escrow initialization result
   */
  async initializeEscrow(orderId) {
    try {
      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.payment.status !== 'succeeded') {
        throw new Error('Payment must be succeeded to initialize escrow');
      }

      if (order.escrow.status !== 'pending') {
        throw new Error('Escrow already initialized');
      }

      // Calculate platform fee
      const platformFee = this.calculatePlatformFee(order.pricing.total);
      const netAmount = order.pricing.total - platformFee;

      // Update escrow status
      order.escrow.status = 'held';
      order.escrow.heldAt = new Date();
      order.escrow.autoReleaseAt = new Date(Date.now() + this.autoReleaseDays * 24 * 60 * 60 * 1000);

      // Update order status
      order.status = 'paid';

      await order.save();

      // Create notifications
      await this.createEscrowNotifications(order, 'held');

      logger.info(`Escrow initialized for order ${order.orderNumber}`, {
        orderId: order._id,
        amount: order.pricing.total,
        platformFee,
        netAmount,
        autoReleaseAt: order.escrow.autoReleaseAt
      });

      return {
        success: true,
        escrow: order.escrow,
        platformFee,
        netAmount,
        autoReleaseAt: order.escrow.autoReleaseAt
      };

    } catch (error) {
      logger.error('Error initializing escrow:', error);
      throw new Error(`Failed to initialize escrow: ${error.message}`);
    }
  }

  /**
   * Release escrow funds to seller (buyer confirmation)
   * @param {string} orderId - Order ID
   * @param {string} buyerId - Buyer ID (for verification)
   * @returns {Promise<Object>} Escrow release result
   */
  async releaseEscrowToSeller(orderId, buyerId) {
    try {
      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.buyer._id.toString() !== buyerId) {
        throw new Error('Unauthorized: Only the buyer can confirm receipt');
      }

      if (order.escrow.status !== 'held') {
        throw new Error('Escrow is not in held status');
      }

      if (order.status !== 'delivered') {
        throw new Error('Order must be delivered before releasing escrow');
      }

      // Update escrow status
      order.escrow.status = 'released';
      order.escrow.releasedAt = new Date();
      order.escrow.releaseReason = 'buyer_confirmation';
      order.status = 'completed';

      await order.save();

      // Create notifications
      await this.createEscrowNotifications(order, 'released');

      logger.info(`Escrow released to seller for order ${order.orderNumber}`, {
        orderId: order._id,
        sellerId: order.seller._id,
        amount: order.pricing.total
      });

      return {
        success: true,
        message: 'Escrow funds released to seller',
        escrow: order.escrow
      };

    } catch (error) {
      logger.error('Error releasing escrow to seller:', error);
      throw new Error(`Failed to release escrow: ${error.message}`);
    }
  }

  /**
   * Auto-release escrow funds after timeout period
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Auto-release result
   */
  async autoReleaseEscrow(orderId) {
    try {
      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.escrow.status !== 'held') {
        throw new Error('Escrow is not in held status');
      }

      if (new Date() < order.escrow.autoReleaseAt) {
        throw new Error('Auto-release time has not been reached');
      }

      // Update escrow status
      order.escrow.status = 'released';
      order.escrow.releasedAt = new Date();
      order.escrow.releaseReason = 'auto_release';
      order.status = 'completed';

      await order.save();

      // Create notifications
      await this.createEscrowNotifications(order, 'auto_released');

      logger.info(`Escrow auto-released for order ${order.orderNumber}`, {
        orderId: order._id,
        sellerId: order.seller._id,
        amount: order.pricing.total,
        autoReleaseAt: order.escrow.autoReleaseAt
      });

      return {
        success: true,
        message: 'Escrow funds auto-released to seller',
        escrow: order.escrow
      };

    } catch (error) {
      logger.error('Error auto-releasing escrow:', error);
      throw new Error(`Failed to auto-release escrow: ${error.message}`);
    }
  }

  /**
   * Process escrow refund to buyer
   * @param {string} orderId - Order ID
   * @param {number} refundAmount - Refund amount (optional, defaults to full amount)
   * @param {string} reason - Refund reason
   * @param {string} adminId - Admin ID processing the refund
   * @returns {Promise<Object>} Refund result
   */
  async processEscrowRefund(orderId, refundAmount = null, reason = 'dispute_resolution', adminId = null) {
    try {
      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.escrow.status === 'refunded') {
        throw new Error('Escrow has already been refunded');
      }

      const amount = refundAmount || order.pricing.total;

      // Process refund through Stripe
      const payment = await Payment.findOne({ order: orderId });
      if (payment) {
        await stripeService.createRefund(payment.paymentIntentId, amount, reason);
      }

      // Update escrow and order status
      order.escrow.status = 'refunded';
      order.escrow.releaseReason = 'dispute_resolution';
      order.status = 'cancelled';
      order.payment.status = 'refunded';
      order.payment.refundedAt = new Date();
      order.payment.refundAmount = amount;
      order.payment.refundReason = reason;

      await order.save();

      // Create notifications
      await this.createEscrowNotifications(order, 'refunded');

      logger.info(`Escrow refunded for order ${order.orderNumber}`, {
        orderId: order._id,
        buyerId: order.buyer._id,
        amount,
        reason,
        adminId
      });

      return {
        success: true,
        message: 'Escrow funds refunded to buyer',
        refundAmount: amount,
        escrow: order.escrow
      };

    } catch (error) {
      logger.error('Error processing escrow refund:', error);
      throw new Error(`Failed to process escrow refund: ${error.message}`);
    }
  }

  /**
   * Initiate a dispute for an order
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID initiating dispute
   * @param {string} reason - Dispute reason
   * @param {string} description - Detailed description
   * @returns {Promise<Object>} Dispute initiation result
   */
  async initiateDispute(orderId, userId, reason, description) {
    try {
      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.buyer._id.toString() !== userId && order.seller._id.toString() !== userId) {
        throw new Error('Unauthorized: Only buyer or seller can initiate dispute');
      }

      if (order.escrow.status !== 'held') {
        throw new Error('Escrow must be held to initiate dispute');
      }

      // Update order and escrow status
      order.status = 'disputed';
      order.escrow.status = 'disputed';
      order.notes.admin = `Dispute initiated by ${userId}: ${reason} - ${description}`;

      await order.save();

      // Create notifications for admin
      await this.createDisputeNotifications(order, reason, description);

      logger.info(`Dispute initiated for order ${order.orderNumber}`, {
        orderId: order._id,
        userId,
        reason,
        description
      });

      return {
        success: true,
        message: 'Dispute initiated successfully',
        order: order
      };

    } catch (error) {
      logger.error('Error initiating dispute:', error);
      throw new Error(`Failed to initiate dispute: ${error.message}`);
    }
  }

  /**
   * Resolve a dispute (admin only)
   * @param {string} orderId - Order ID
   * @param {string} resolution - Resolution type ('release_to_seller' or 'refund_to_buyer')
   * @param {string} adminId - Admin ID resolving the dispute
   * @param {string} notes - Admin notes
   * @returns {Promise<Object>} Dispute resolution result
   */
  async resolveDispute(orderId, resolution, adminId, notes) {
    try {
      const order = await Order.findById(orderId).populate('buyer seller');
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'disputed') {
        throw new Error('Order is not in disputed status');
      }

      let result;

      if (resolution === 'release_to_seller') {
        result = await this.releaseEscrowToSeller(orderId, order.buyer._id.toString());
        order.escrow.releaseReason = 'admin_release';
        order.notes.admin = `${order.notes.admin}\nAdmin resolution (${adminId}): Release to seller - ${notes}`;
      } else if (resolution === 'refund_to_buyer') {
        result = await this.processEscrowRefund(orderId, null, 'admin_dispute_resolution', adminId);
        order.notes.admin = `${order.notes.admin}\nAdmin resolution (${adminId}): Refund to buyer - ${notes}`;
      } else {
        throw new Error('Invalid resolution type');
      }

      await order.save();

      logger.info(`Dispute resolved for order ${order.orderNumber}`, {
        orderId: order._id,
        resolution,
        adminId,
        notes
      });

      return {
        success: true,
        message: `Dispute resolved: ${resolution}`,
        resolution,
        ...result
      };

    } catch (error) {
      logger.error('Error resolving dispute:', error);
      throw new Error(`Failed to resolve dispute: ${error.message}`);
    }
  }

  /**
   * Get orders pending auto-release
   * @returns {Promise<Array>} Orders pending auto-release
   */
  async getPendingAutoReleaseOrders() {
    try {
      return await Order.findPendingEscrowRelease().populate('buyer seller');
    } catch (error) {
      logger.error('Error getting pending auto-release orders:', error);
      throw new Error(`Failed to get pending auto-release orders: ${error.message}`);
    }
  }

  /**
   * Process all pending auto-releases
   * @returns {Promise<Object>} Processing results
   */
  async processPendingAutoReleases() {
    try {
      const pendingOrders = await this.getPendingAutoReleaseOrders();
      const results = {
        processed: 0,
        failed: 0,
        errors: []
      };

      for (const order of pendingOrders) {
        try {
          await this.autoReleaseEscrow(order._id.toString());
          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            error: error.message
          });
        }
      }

      logger.info(`Processed pending auto-releases`, results);

      return results;

    } catch (error) {
      logger.error('Error processing pending auto-releases:', error);
      throw new Error(`Failed to process pending auto-releases: ${error.message}`);
    }
  }

  /**
   * Get escrow statistics
   * @param {string} sellerId - Optional seller ID filter
   * @param {Date} startDate - Start date filter
   * @param {Date} endDate - End date filter
   * @returns {Promise<Object>} Escrow statistics
   */
  async getEscrowStats(sellerId = null, startDate = null, endDate = null) {
    try {
      const matchStage = {};
      
      if (sellerId) {
        matchStage.seller = sellerId;
      }
      
      if (startDate && endDate) {
        matchStage.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }

      const stats = await Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$escrow.status',
            count: { $sum: 1 },
            totalValue: { $sum: '$pricing.total' },
            avgValue: { $avg: '$pricing.total' }
          }
        }
      ]);

      return stats;

    } catch (error) {
      logger.error('Error getting escrow stats:', error);
      throw new Error(`Failed to get escrow stats: ${error.message}`);
    }
  }

  /**
   * Calculate platform fee
   * @param {number} amount - Order amount
   * @returns {number} Platform fee
   */
  calculatePlatformFee(amount) {
    return Math.round((amount * this.platformFeePercentage + this.platformFeeFixed) * 100) / 100;
  }

  /**
   * Create escrow-related notifications
   * @param {Object} order - Order object
   * @param {string} eventType - Event type
   * @returns {Promise<void>}
   */
  async createEscrowNotifications(order, eventType) {
    try {
      const notifications = [];

      switch (eventType) {
        case 'held':
          notifications.push(
            {
              user: order.buyer._id,
              type: 'escrow_held',
              title: 'Payment Held in Escrow',
              message: `Your payment of $${order.pricing.total} for order ${order.orderNumber} has been held in escrow.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            },
            {
              user: order.seller._id,
              type: 'escrow_held',
              title: 'Payment Received - Ship Item',
              message: `Payment of $${order.pricing.total} for order ${order.orderNumber} has been held in escrow. Please ship the item.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            }
          );
          break;

        case 'released':
          notifications.push(
            {
              user: order.buyer._id,
              type: 'escrow_released',
              title: 'Payment Released to Seller',
              message: `Your payment for order ${order.orderNumber} has been released to the seller.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            },
            {
              user: order.seller._id,
              type: 'escrow_released',
              title: 'Payment Released',
              message: `Payment of $${order.pricing.total} for order ${order.orderNumber} has been released to your account.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            }
          );
          break;

        case 'auto_released':
          notifications.push(
            {
              user: order.buyer._id,
              type: 'escrow_auto_released',
              title: 'Payment Auto-Released',
              message: `Payment for order ${order.orderNumber} has been automatically released to the seller after 7 days.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            },
            {
              user: order.seller._id,
              type: 'escrow_auto_released',
              title: 'Payment Auto-Released',
              message: `Payment of $${order.pricing.total} for order ${order.orderNumber} has been automatically released to your account.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            }
          );
          break;

        case 'refunded':
          notifications.push(
            {
              user: order.buyer._id,
              type: 'escrow_refunded',
              title: 'Payment Refunded',
              message: `Your payment for order ${order.orderNumber} has been refunded.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            },
            {
              user: order.seller._id,
              type: 'escrow_refunded',
              title: 'Payment Refunded',
              message: `Payment for order ${order.orderNumber} has been refunded to the buyer.`,
              data: { orderId: order._id, orderNumber: order.orderNumber }
            }
          );
          break;
      }

      // Create notifications
      for (const notificationData of notifications) {
        const notification = new Notification(notificationData);
        await notification.save();
      }

    } catch (error) {
      logger.error('Error creating escrow notifications:', error);
      // Don't throw error as this is not critical to the main flow
    }
  }

  /**
   * Create dispute-related notifications
   * @param {Object} order - Order object
   * @param {string} reason - Dispute reason
   * @param {string} description - Dispute description
   * @returns {Promise<void>}
   */
  async createDisputeNotifications(order, reason, description) {
    try {
      // Notify admins about new dispute
      const adminUsers = await User.find({ role: { $in: ['admin', 'super_admin'] } });
      
      for (const admin of adminUsers) {
        const notification = new Notification({
          user: admin._id,
          type: 'dispute_created',
          title: 'New Dispute Created',
          message: `A dispute has been created for order ${order.orderNumber}. Reason: ${reason}`,
          data: { 
            orderId: order._id, 
            orderNumber: order.orderNumber,
            reason,
            description
          }
        });
        await notification.save();
      }

      // Notify the other party about the dispute
      const otherPartyId = order.buyer._id.toString() === order.buyer._id.toString() 
        ? order.seller._id 
        : order.buyer._id;

      const otherPartyNotification = new Notification({
        user: otherPartyId,
        type: 'dispute_created',
        title: 'Dispute Created',
        message: `A dispute has been created for order ${order.orderNumber}. Reason: ${reason}`,
        data: { 
          orderId: order._id, 
          orderNumber: order.orderNumber,
          reason,
          description
        }
      });
      await otherPartyNotification.save();

    } catch (error) {
      logger.error('Error creating dispute notifications:', error);
      // Don't throw error as this is not critical to the main flow
    }
  }
}

module.exports = new EscrowService();
