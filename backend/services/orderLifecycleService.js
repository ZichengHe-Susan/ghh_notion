const Order = require('../models/Order');
const Item = require('../models/Item');
const escrowService = require('./escrowService');
const notificationService = require('./notificationService');
const logger = require('../config/logger');

class OrderLifecycleService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
  }

  /**
   * Process pending escrow releases
   * Auto-release funds after 7 days if no dispute
   */
  async processPendingEscrowReleases() {
    try {
      this.isProcessing = true;
      
      const pendingOrders = await Order.findPendingEscrowRelease();
      
      for (const order of pendingOrders) {
        try {
          // Check if order is still in delivered status
          if (order.status === 'delivered') {
            // Auto-release escrow funds
            await escrowService.autoReleaseEscrow(order._id);
            
            // Update order status to completed
            await order.completeOrder();
            
            // Send notifications
            await notificationService.createOrderNotification(order, 'order_completed');
            
            logger.info(`Auto-released escrow for order ${order.orderNumber}`);
          }
        } catch (error) {
          logger.error(`Failed to process escrow release for order ${order.orderNumber}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Error processing pending escrow releases:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process expired reservations
   * Release inventory for orders that haven't been paid within 30 minutes
   */
  async processExpiredReservations() {
    try {
      const expiredTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      
      const expiredOrders = await Order.find({
        status: 'pending',
        'payment.status': 'pending',
        createdAt: { $lte: expiredTime }
      }).populate('items.item');

      for (const order of expiredOrders) {
        try {
          // Release reserved inventory
          for (const orderItem of order.items) {
            await Item.findByIdAndUpdate(
              orderItem.item,
              {
                $inc: { 'availability.quantity': orderItem.quantity },
                $set: { 
                  'availability.status': 'available',
                  'availability.reservedUntil': null
                }
              }
            );
          }

          // Cancel the order
          order.status = 'cancelled';
          order.payment.status = 'cancelled';
          await order.save();

          // Send notification
          await notificationService.createOrderNotification(order, 'order_cancelled');

          logger.info(`Released expired reservation for order ${order.orderNumber}`);
        } catch (error) {
          logger.error(`Failed to process expired reservation for order ${order.orderNumber}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error processing expired reservations:', error);
    }
  }

  /**
   * Process overdue shipments
   * Send reminders for orders that should have been shipped
   */
  async processOverdueShipments() {
    try {
      const overdueTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      
      const overdueOrders = await Order.find({
        status: 'paid',
        'payment.paidAt': { $lte: overdueTime }
      }).populate('seller');

      for (const order of overdueOrders) {
        try {
          // Send reminder notification to seller
          await notificationService.createOrderNotification(order, 'order_shipping_reminder');
          
          logger.info(`Sent shipping reminder for order ${order.orderNumber}`);
        } catch (error) {
          logger.error(`Failed to send shipping reminder for order ${order.orderNumber}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error processing overdue shipments:', error);
    }
  }

  /**
   * Process overdue deliveries
   * Send reminders for orders that should have been delivered
   */
  async processOverdueDeliveries() {
    try {
      const overdueTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      
      const overdueOrders = await Order.find({
        status: 'shipped',
        'shipping.estimatedDelivery': { $lte: overdueTime }
      }).populate('buyer');

      for (const order of overdueOrders) {
        try {
          // Send reminder notification to buyer
          await notificationService.createOrderNotification(order, 'order_delivery_reminder');
          
          logger.info(`Sent delivery reminder for order ${order.orderNumber}`);
        } catch (error) {
          logger.error(`Failed to send delivery reminder for order ${order.orderNumber}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error processing overdue deliveries:', error);
    }
  }

  /**
   * Process all lifecycle tasks
   */
  async processLifecycleTasks() {
    try {
      await Promise.all([
        this.processPendingEscrowReleases(),
        this.processExpiredReservations(),
        // this.processOverdueShipments(),
        this.processOverdueDeliveries()
      ]);
    } catch (error) {
      logger.error('Error processing lifecycle tasks:', error);
    }
  }

  /**
   * Start the lifecycle processing service
   */
  startProcessing() {
    if (this.processingInterval) {
      return;
    }

    // Process every hour
    this.processingInterval = setInterval(() => {
      this.processLifecycleTasks();
    }, 60 * 60 * 1000);

    // Process immediately
    this.processLifecycleTasks();
  }

  /**
   * Stop the lifecycle processing service
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
  }

  /**
   * Get order lifecycle statistics
   */
  async getLifecycleStats() {
    try {
      const stats = await Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$pricing.total' },
            avgValue: { $avg: '$pricing.total' }
          }
        }
      ]);

      const escrowStats = await Order.aggregate([
        {
          $group: {
            _id: '$escrow.status',
            count: { $sum: 1 },
            totalValue: { $sum: '$pricing.total' }
          }
        }
      ]);

      return {
        orderStats: stats,
        escrowStats: escrowStats,
        processingStatus: {
          isProcessing: this.isProcessing,
          hasInterval: !!this.processingInterval
        }
      };
    } catch (error) {
      logger.error('Error getting lifecycle stats:', error);
      throw error;
    }
  }

  /**
   * Manually trigger lifecycle processing
   */
  async triggerProcessing() {
    if (this.isProcessing) {
      throw new Error('Lifecycle processing is already in progress');
    }

    await this.processLifecycleTasks();
    return { message: 'Lifecycle processing completed' };
  }
}

const orderLifecycleService = new OrderLifecycleService();

module.exports = orderLifecycleService;
