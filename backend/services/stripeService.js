const Stripe = require('stripe');
const config = require('../config/config');
const logger = require('../config/logger');
const Payment = require('../models/Payment');
const Order = require('../models/Order');

class StripeService {
  constructor() {
    this.stripe = new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    this.webhookSecret = config.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Create a payment intent for an order
   * @param {Object} order - The order object
   * @param {Object} paymentMethod - Payment method details
   * @param {Object} billingDetails - Customer billing information
   * @returns {Promise<Object>} Payment intent and payment record
   */
  async createPaymentIntent(order, paymentMethod = null, billingDetails = null) {
    try {
      // Handle both actual order objects and temporary order data
      const orderId = order._id ? order._id.toString() : 'temp';
      const orderNumber = order.orderNumber || 'TEMP-' + Date.now();
      
      // Calculate platform fee (2.9% + $0.30)
      const platformFee = Math.round((order.pricing.total * 0.029 + 30) * 100) / 100;
      const netAmount = order.pricing.total - platformFee;

      // Create payment intent with Stripe
      const paymentIntentData = {
        amount: Math.round(order.pricing.total * 100), // Convert to cents
        currency: order.pricing.currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: {
          orderId: orderId,
          orderNumber: orderNumber,
          buyerId: order.buyer.toString(),
          sellerId: order.seller.toString(),
          platformFee: platformFee.toString(),
          netAmount: netAmount.toString(),
          itemTitles: order.items.map(item => item.itemSnapshot.title).join(', ')
        },
        description: `Payment for order ${orderNumber}`
      };

      // Add billing details if provided
      if (billingDetails && billingDetails.email) {
        paymentIntentData.receipt_email = billingDetails.email;
      }

      if (billingDetails && billingDetails.name && billingDetails.address) {
        paymentIntentData.shipping = {
          name: billingDetails.name,
          address: {
            line1: billingDetails.address.line1,
            line2: billingDetails.address.line2,
            city: billingDetails.address.city,
            state: billingDetails.address.state,
            postal_code: billingDetails.address.postalCode,
            country: billingDetails.address.country
          }
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      // Only create payment record in database if we have a real order ID
      let payment = null;
      if (order._id) {
        const paymentData = {
          paymentIntentId: paymentIntent.id,
          order: order._id,
          user: order.buyer,
          amount: order.pricing.total,
          currency: order.pricing.currency,
          status: paymentIntent.status,
          fees: {
            stripeFee: platformFee,
            platformFee: platformFee,
            netAmount: netAmount
          },
          metadata: {
            orderNumber: orderNumber,
            itemTitles: order.items.map(item => item.itemSnapshot.title),
            sellerId: order.seller.toString(),
            buyerId: order.buyer.toString(),
            source: 'web'
          }
        };

        // Add optional fields if provided
        if (paymentMethod) {
          paymentData.paymentMethod = {
            type: paymentMethod.type,
            ...paymentMethod
          };
        } else {
          // Provide a default paymentMethod to pass validation, as the type is required.
          paymentData.paymentMethod = {
            type: 'card'
          };
        }

        if (billingDetails) {
          paymentData.billingDetails = billingDetails;
          if (billingDetails.userAgent) {
            paymentData.metadata.userAgent = billingDetails.userAgent;
          }
          if (billingDetails.ipAddress) {
            paymentData.metadata.ipAddress = billingDetails.ipAddress;
          }
        }


        payment = new Payment(paymentData);
        await payment.save();

        logger.info(`Payment intent created for order ${orderNumber}`, {
          paymentIntentId: paymentIntent.id,
          orderId: order._id,
          amount: order.pricing.total
        });
      } 


      return {
        paymentIntent,
        payment,
        clientSecret: paymentIntent.client_secret
      };

    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Confirm a payment intent
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Promise<Object>} Confirmed payment intent
   */
  async confirmPayment(paymentIntentId, paymentMethodId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });

      // Update payment record
      const payment = await Payment.findOne({ paymentIntentId });
      if (payment) {
        payment.status = paymentIntent.status;
        payment.timeline.push({
          status: paymentIntent.status,
          timestamp: new Date(),
          note: 'Payment confirmed'
        });

        if (paymentIntent.status === 'succeeded') {
          payment.charges.push({
            chargeId: paymentIntent.latest_charge,
            amount: paymentIntent.amount,
            status: 'succeeded',
            createdAt: new Date()
          });
        }

        await payment.save();
      }

      logger.info(`Payment confirmed for intent ${paymentIntentId}`, {
        status: paymentIntent.status,
        amount: paymentIntent.amount
      });

      return paymentIntent;

    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw new Error(`Failed to confirm payment: ${error.message}`);
    }
  }

  /**
   * Create a refund for a payment
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {number} amount - Refund amount (optional, defaults to full amount)
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund object
   */
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment must be succeeded to create a refund');
      }

      const refundData = {
        payment_intent: paymentIntentId,
        reason: reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      const refund = await this.stripe.refunds.create(refundData);

      // Update payment record
      const payment = await Payment.findOne({ paymentIntentId });
      if (payment) {
        payment.addRefund(refund.id, amount || payment.amount, reason);
        await payment.save();
      }

      logger.info(`Refund created for payment ${paymentIntentId}`, {
        refundId: refund.id,
        amount: refund.amount,
        reason: refund.reason
      });

      return refund;

    } catch (error) {
      logger.error('Error creating refund:', error);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Retrieve payment intent details
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Promise<Object>} Payment intent object
   */
  async getPaymentIntent(paymentIntentId) {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Error retrieving payment intent:', error);
      throw new Error(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  /**
   * Create a payment method
   * @param {Object} paymentMethodData - Payment method data
   * @returns {Promise<Object>} Payment method object
   */
  async createPaymentMethod(paymentMethodData) {
    try {
      return await this.stripe.paymentMethods.create(paymentMethodData);
    } catch (error) {
      logger.error('Error creating payment method:', error);
      throw new Error(`Failed to create payment method: ${error.message}`);
    }
  }

  /**
   * Attach payment method to customer
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Payment method object
   */
  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      return await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } catch (error) {
      logger.error('Error attaching payment method:', error);
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }

  /**
   * Detach payment method from customer
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Promise<Object>} Payment method object
   */
  async detachPaymentMethod(paymentMethodId) {
    try {
      return await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      logger.error('Error detaching payment method:', error);
      throw new Error(`Failed to detach payment method: ${error.message}`);
    }
  }

  /**
   * List customer payment methods
   * @param {string} customerId - Customer ID
   * @param {string} type - Payment method type (default: 'card')
   * @returns {Promise<Object>} Payment methods list
   */
  async listPaymentMethods(customerId, type = 'card') {
    try {
      return await this.stripe.paymentMethods.list({
        customer: customerId,
        type: type
      });
    } catch (error) {
      logger.error('Error listing payment methods:', error);
      throw new Error(`Failed to list payment methods: ${error.message}`);
    }
  }

  /**
   * Create a customer
   * @param {Object} customerData - Customer data
   * @returns {Promise<Object>} Customer object
   */
  async createCustomer(customerData) {
    try {
      return await this.stripe.customers.create(customerData);
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Retrieve customer details
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Customer object
   */
  async getCustomer(customerId) {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      logger.error('Error retrieving customer:', error);
      throw new Error(`Failed to retrieve customer: ${error.message}`);
    }
  }

  /**
   * Update customer details
   * @param {string} customerId - Customer ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated customer object
   */
  async updateCustomer(customerId, updateData) {
    try {
      return await this.stripe.customers.update(customerId, updateData);
    } catch (error) {
      logger.error('Error updating customer:', error);
      throw new Error(`Failed to update customer: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} Parsed event object
   */
  verifyWebhookSignature(payload, signature) {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Handle webhook events
   * @param {Object} event - Stripe webhook event
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhookEvent(event) {
    try {
      const { id: eventId, type: eventType, data } = event;
      
      logger.info(`Processing webhook event: ${eventType}`, { eventId });

      // Find payment record
      const paymentIntentId = data.object.payment_intent || data.object.id;
      const payment = await Payment.findOne({ paymentIntentId });

      if (!payment) {
        logger.warn(`Payment not found for webhook event ${eventId}`, { paymentIntentId });
        return { processed: false, reason: 'Payment not found' };
      }

      // Add webhook event to payment record
      await payment.addWebhookEvent(eventId, eventType, data.object);

      let processed = false;
      let result = {};

      switch (eventType) {
        case 'payment_intent.succeeded':
          result = await this.handlePaymentSucceeded(payment, data.object);
          processed = true;
          break;

        case 'payment_intent.payment_failed':
          result = await this.handlePaymentFailed(payment, data.object);
          processed = true;
          break;

        case 'payment_intent.canceled':
          result = await this.handlePaymentCanceled(payment, data.object);
          processed = true;
          break;

        case 'charge.dispute.created':
          result = await this.handleDisputeCreated(payment, data.object);
          processed = true;
          break;

        case 'refund.created':
          result = await this.handleRefundCreated(payment, data.object);
          processed = true;
          break;

        default:
          logger.info(`Unhandled webhook event type: ${eventType}`, { eventId });
          result = { processed: false, reason: 'Unhandled event type' };
      }

      // Mark webhook as processed
      await payment.markWebhookProcessed(eventId);

      logger.info(`Webhook event processed: ${eventType}`, { 
        eventId, 
        paymentIntentId, 
        processed 
      });

      return { processed, ...result };

    } catch (error) {
      logger.error('Error handling webhook event:', error);
      throw new Error(`Failed to handle webhook event: ${error.message}`);
    }
  }

  /**
   * Handle payment succeeded event
   * @param {Object} payment - Payment record
   * @param {Object} paymentIntent - Stripe payment intent
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentSucceeded(payment, paymentIntent) {
    try {
      // Update payment status
      payment.status = 'succeeded';
      payment.timeline.push({
        status: 'succeeded',
        timestamp: new Date(),
        note: 'Payment completed successfully'
      });

      // Add charge information
      if (paymentIntent.latest_charge) {
        payment.charges.push({
          chargeId: paymentIntent.latest_charge,
          amount: paymentIntent.amount,
          status: 'succeeded',
          createdAt: new Date()
        });
      }

      await payment.save();

      // Update order status
      const order = await Order.findById(payment.order);
      if (order) {
        await order.confirmPayment();
      }

      return { 
        success: true, 
        message: 'Payment succeeded and order updated' 
      };

    } catch (error) {
      logger.error('Error handling payment succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle payment failed event
   * @param {Object} payment - Payment record
   * @param {Object} paymentIntent - Stripe payment intent
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentFailed(payment, paymentIntent) {
    try {
      payment.status = 'failed';
      payment.timeline.push({
        status: 'failed',
        timestamp: new Date(),
        note: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
      });

      await payment.save();

      return { 
        success: true, 
        message: 'Payment failure recorded' 
      };

    } catch (error) {
      logger.error('Error handling payment failed:', error);
      throw error;
    }
  }

  /**
   * Handle payment canceled event
   * @param {Object} payment - Payment record
   * @param {Object} paymentIntent - Stripe payment intent
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentCanceled(payment, paymentIntent) {
    try {
      payment.status = 'canceled';
      payment.timeline.push({
        status: 'canceled',
        timestamp: new Date(),
        note: 'Payment was canceled'
      });

      await payment.save();

      return { 
        success: true, 
        message: 'Payment cancellation recorded' 
      };

    } catch (error) {
      logger.error('Error handling payment canceled:', error);
      throw error;
    }
  }

  /**
   * Handle dispute created event
   * @param {Object} payment - Payment record
   * @param {Object} dispute - Stripe dispute
   * @returns {Promise<Object>} Processing result
   */
  async handleDisputeCreated(payment, dispute) {
    try {
      // Update order to disputed status
      const order = await Order.findById(payment.order);
      if (order) {
        await order.initiateDispute(`Stripe dispute: ${dispute.reason}`);
      }

      return { 
        success: true, 
        message: 'Dispute created and order updated' 
      };

    } catch (error) {
      logger.error('Error handling dispute created:', error);
      throw error;
    }
  }

  /**
   * Handle refund created event
   * @param {Object} payment - Payment record
   * @param {Object} refund - Stripe refund
   * @returns {Promise<Object>} Processing result
   */
  async handleRefundCreated(payment, refund) {
    try {
      await payment.updateRefundStatus(refund.id, refund.status, refund.failure_reason);

      // If full refund, update order status
      if (refund.amount === payment.amount) {
        const order = await Order.findById(payment.order);
        if (order) {
          await order.processRefund(refund.amount / 100, refund.reason);
        }
      }

      return { 
        success: true, 
        message: 'Refund processed and order updated' 
      };

    } catch (error) {
      logger.error('Error handling refund created:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   * @param {string} sellerId - Optional seller ID filter
   * @param {Date} startDate - Start date filter
   * @param {Date} endDate - End date filter
   * @returns {Promise<Object>} Payment statistics
   */
  async getPaymentStats(sellerId = null, startDate = null, endDate = null) {
    try {
      const matchStage = {};
      
      if (sellerId) {
        matchStage['metadata.sellerId'] = sellerId;
      }
      
      if (startDate && endDate) {
        matchStage.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }

      const stats = await Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalFees: { $sum: '$fees.platformFee' },
            totalNetAmount: { $sum: '$fees.netAmount' }
          }
        }
      ]);

      return stats;

    } catch (error) {
      logger.error('Error getting payment stats:', error);
      throw new Error(`Failed to get payment stats: ${error.message}`);
    }
  }
}

module.exports = new StripeService();
