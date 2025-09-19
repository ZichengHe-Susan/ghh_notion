const Order = require('../models/Order');
const Item = require('../models/Item');
const User = require('../models/User');
const Payment = require('../models/Payment');
const notificationService = require('../services/notificationService');
const escrowService = require('../services/escrowService');
const stripeService = require('../services/stripeService');
const mongoose = require('mongoose');

const orderController = {
  // @desc    Get all orders (admin only)
  // @route   GET /api/orders
  // @access  Private/Admin
  getOrders: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        seller,
        buyer,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const filter = {};

      // Apply filters
      if (status) filter.status = status;
      if (seller) filter.seller = seller;
      if (buyer) filter.buyer = buyer;
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const orders = await Order.find(filter)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('items.item', 'title images condition')
        .populate('shipping.address', 'address contactInfo label')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const totalOrders = await Order.countDocuments(filter);

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders,
            hasNext: page * limit < totalOrders,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders',
        error: error.message
      });
    }
  },

  // @desc    Get single order
  // @route   GET /api/orders/:id
  // @access  Private
  getOrder: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const order = await Order.findById(id)
        .populate('buyer', 'firstName lastName email phone')
        .populate('seller', 'firstName lastName email phone')
        .populate('items.item', 'title description images condition specifications')
        .populate('shipping.address', 'address contactInfo label')
        .populate('communication.conversationId', 'participants lastMessageAt');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check if user has access to this order
      if (order.buyer._id.toString() !== userId && 
          order.seller._id.toString() !== userId && 
          !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('Get order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order',
        error: error.message
      });
    }
  },

  // @desc    Create new order
  // @route   POST /api/orders
  // @access  Private
  createOrder: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        items,
        shippingAddressId,
        shippingMethod = 'standard',
        paymentMethod = 'stripe',
        notes
      } = req.body;

      const buyerId = req.user.id;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items are required'
        });
      }

      if (!shippingAddressId) {
        return res.status(400).json({
          success: false,
          message: 'Shipping address ID is required'
        });
      }

      // Validate shipping address belongs to buyer
      const Address = require('../models/Address');
      const shippingAddress = await Address.findOne({
        _id: shippingAddressId,
        user: buyerId,
        isActive: true
      });

      if (!shippingAddress) {
        return res.status(400).json({
          success: false,
          message: 'Invalid shipping address'
        });
      }

      // Validate and fetch items with inventory check
      const orderItems = [];
      let subtotal = 0;
      let totalShippingCost = 0;
      const sellerIds = new Set();

      for (const itemData of items) {
        const item = await Item.findById(itemData.itemId).session(session);
        
        if (!item) {
          throw new Error(`Item ${itemData.itemId} not found`);
        }

        if (item.availability.status !== 'available' || item.availability.quantity < itemData.quantity) {
          throw new Error(`Insufficient inventory for item: ${item.title}`);
        }

        if (item.seller.toString() === buyerId) {
          throw new Error('Cannot purchase your own item');
        }

        sellerIds.add(item.seller.toString());
        
        const itemTotal = item.price * itemData.quantity;
        subtotal += itemTotal;
        totalShippingCost += item.shipping.shippingCost || 0;

        orderItems.push({
          item: item._id,
          quantity: itemData.quantity,
          price: item.price,
          itemSnapshot: {
            title: item.title,
            description: item.description,
            images: item.images.map(img => img.url),
            condition: item.condition,
            seller: {
              name: `${item.seller.firstName} ${item.seller.lastName}`,
              email: item.seller.email
            }
          }
        });
      }

      // For multi-seller orders, we'll create separate orders
      if (sellerIds.size > 1) {
        throw new Error('Multi-seller orders not supported yet. Please create separate orders for different sellers.');
      }

      const sellerId = Array.from(sellerIds)[0];
      const platformFee = subtotal * 0.05; // 5% platform fee
      const tax = (subtotal + totalShippingCost) * 0.08; // 8% tax
      const total = subtotal + totalShippingCost + tax + platformFee;

      // Create order
      const orderData = {
        buyer: buyerId,
        seller: sellerId,
        items: orderItems,
        pricing: {
          subtotal,
          shippingCost: totalShippingCost,
          tax,
          platformFee,
          total,
          currency: 'USD'
        },
        shipping: {
          method: shippingMethod,
          address: shippingAddressId
        },
        payment: {
          method: paymentMethod,
          paymentIntentId: '', // Will be set when payment is processed
          status: 'pending'
        },
        notes: {
          buyer: notes
        },
        metadata: {
          source: 'web',
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      };

      const order = new Order(orderData);
      await order.save({ session });

      // Reserve inventory (atomic operation)
      for (const itemData of items) {
        await Item.findByIdAndUpdate(
          itemData.itemId,
          {
            $inc: { 'availability.quantity': -itemData.quantity },
            $set: { 
              'availability.status': 'reserved',
              'availability.reservedUntil': new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
            }
          },
          { session }
        );
      }

      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: Math.round(total * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          orderId: order._id.toString(),
          buyerId: buyerId,
          sellerId: sellerId
        }
      });

      order.payment.paymentIntentId = paymentIntent.id;
      await order.save({ session });

      await session.commitTransaction();

      // Send notifications
      await notificationService.createOrderNotification(order, 'order_created');

      res.status(201).json({
        success: true,
        data: {
          order,
          paymentIntent: {
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
          }
        }
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Create order error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create order',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  },

  // @desc    Update order status
  // @route   PUT /api/orders/:id/status
  // @access  Private
  updateOrderStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, trackingNumber, carrier, note } = req.body;
      const userId = req.user.id;

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check permissions
      const isBuyer = order.buyer.toString() === userId;
      const isSeller = order.seller.toString() === userId;
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

      if (!isBuyer && !isSeller && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Validate status transition
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['paid', 'cancelled'],
        'paid': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'cancelled'],
        'delivered': ['completed', 'disputed'],
        'completed': [],
        'cancelled': [],
        'disputed': ['completed', 'cancelled']
      };

      if (!validTransitions[order.status]?.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${order.status} to ${status}`
        });
      }

      // Update order based on status
      switch (status) {
        case 'confirmed':
          if (!isSeller && !isAdmin) {
            return res.status(403).json({
              success: false,
              message: 'Only seller can confirm order'
            });
          }
          order.status = 'confirmed';
          break;

        case 'shipped':
          if (!isSeller && !isAdmin) {
            return res.status(403).json({
              success: false,
              message: 'Only seller can mark as shipped'
            });
          }
          if (!trackingNumber || !carrier) {
            return res.status(400).json({
              success: false,
              message: 'Tracking number and carrier are required for shipping'
            });
          }
          await order.markAsShipped(trackingNumber, carrier);
          break;

        case 'delivered':
          if (!isBuyer && !isAdmin) {
            return res.status(403).json({
              success: false,
              message: 'Only buyer can mark as delivered'
            });
          }
          await order.markAsDelivered();
          break;

        case 'completed':
          if (!isBuyer && !isAdmin) {
            return res.status(403).json({
              success: false,
              message: 'Only buyer can complete order'
            });
          }
          await order.completeOrder();
          // Release escrow funds
          await escrowService.releaseEscrow(order._id, 'buyer_confirmation');
          break;

        case 'cancelled':
          await order.processRefund(order.pricing.total, 'Order cancelled');
          // Release inventory
          await this.releaseInventory(order);
          break;

        case 'disputed':
          if (!isBuyer && !isSeller) {
            return res.status(403).json({
              success: false,
              message: 'Only buyer or seller can initiate dispute'
            });
          }
          await order.initiateDispute(note);
          break;
      }

      // Add timeline entry
      order.timeline.push({
        status: order.status,
        timestamp: new Date(),
        note: note || `Status changed to ${status}`,
        updatedBy: userId
      });

      await order.save();

      // Send notifications
      await notificationService.createOrderNotification(order, `order_${status}`);

      res.json({
        success: true,
        data: order
      });

    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update order status',
        error: error.message
      });
    }
  },

  // @desc    Cancel order
  // @route   PUT /api/orders/:id/cancel
  // @access  Private
  cancelOrder: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check permissions
      const isBuyer = order.buyer.toString() === userId;
      const isSeller = order.seller.toString() === userId;
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

      if (!isBuyer && !isSeller && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check if order can be cancelled
      if (!['pending', 'confirmed', 'paid'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: `Order cannot be cancelled in ${order.status} status`
        });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Cancel order
        await order.processRefund(order.pricing.total, reason || 'Order cancelled by user');
        
        // Release inventory
        await this.releaseInventory(order, session);

        // Cancel payment intent if not already processed
        if (order.payment.paymentIntentId && order.payment.status === 'pending') {
          await stripeService.cancelPaymentIntent(order.payment.paymentIntentId);
        }

        await session.commitTransaction();

        // Send notifications
        await notificationService.createOrderNotification(order, 'order_cancelled');

        res.json({
          success: true,
          data: order
        });

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message
      });
    }
  },

  // @desc    Get user's orders
  // @route   GET /api/orders/user/:userId
  // @access  Private
  getUserOrders: async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;
      const { 
        page = 1, 
        limit = 20, 
        status, 
        role = 'buyer' // 'buyer', 'seller', or 'all'
      } = req.query;

      // Check permissions
      if (userId !== currentUserId && !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const skip = (page - 1) * limit;
      const filter = {};

      // Apply role filter
      if (role === 'buyer') {
        filter.buyer = userId;
      } else if (role === 'seller') {
        filter.seller = userId;
      } else if (role === 'all') {
        filter.$or = [
          { buyer: userId },
          { seller: userId }
        ];
      }

      if (status) filter.status = status;

      const orders = await Order.find(filter)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('items.item', 'title images condition')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalOrders = await Order.countDocuments(filter);

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders,
            hasNext: page * limit < totalOrders,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Get user orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user orders',
        error: error.message
      });
    }
  },

  // @desc    Get order tracking information
  // @route   GET /api/orders/:id/tracking
  // @access  Private
  getOrderTracking: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const order = await Order.findById(id)
        .populate('buyer', 'firstName lastName')
        .populate('seller', 'firstName lastName');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check permissions
      const isBuyer = order.buyer._id.toString() === userId;
      const isSeller = order.seller._id.toString() === userId;
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

      if (!isBuyer && !isSeller && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const trackingInfo = {
        orderNumber: order.orderNumber,
        status: order.status,
        statusDisplay: order.statusDisplay,
        timeline: order.timeline,
        shipping: {
          method: order.shipping.method,
          trackingNumber: order.shipping.trackingNumber,
          carrier: order.shipping.carrier,
          estimatedDelivery: order.shipping.estimatedDelivery,
          actualDelivery: order.shipping.actualDelivery,
          address: order.shipping.address
        },
        escrow: {
          status: order.escrow.status,
          autoReleaseAt: order.escrow.autoReleaseAt,
          releaseReason: order.escrow.releaseReason
        },
        payment: {
          status: order.payment.status,
          paidAt: order.payment.paidAt,
          refundedAt: order.payment.refundedAt
        }
      };

      res.json({
        success: true,
        data: trackingInfo
      });

    } catch (error) {
      console.error('Get order tracking error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order tracking',
        error: error.message
      });
    }
  },

  // @desc    Process refund for order
  // @route   POST /api/orders/:id/refund
  // @access  Private/Admin
  processRefund: async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, reason, refundType = 'full' } = req.body;

      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      if (order.payment.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Order payment not succeeded, cannot process refund'
        });
      }

      const refundAmount = refundType === 'full' ? order.pricing.total : amount;
      
      if (refundAmount > order.pricing.total) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount cannot exceed order total'
        });
      }

      // Process refund with Stripe
      const refund = await stripeService.createRefund({
        paymentIntent: order.payment.paymentIntentId,
        amount: Math.round(refundAmount * 100), // Convert to cents
        reason: 'requested_by_customer',
        metadata: {
          orderId: order._id.toString(),
          reason: reason
        }
      });

      // Update order
      await order.processRefund(refundAmount, reason);

      // Release inventory if full refund
      if (refundType === 'full') {
        await this.releaseInventory(order);
      }

      // Send notifications
      await notificationService.createOrderNotification(order, 'order_cancelled');

      res.json({
        success: true,
        data: {
          order,
          refund: {
            id: refund.id,
            amount: refundAmount,
            reason: reason
          }
        }
      });

    } catch (error) {
      console.error('Process refund error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: error.message
      });
    }
  },

  // Helper method to release inventory
  releaseInventory: async (order, session = null) => {
    try {
      for (const orderItem of order.items) {
        const updateQuery = {
          $inc: { 'availability.quantity': orderItem.quantity },
          $set: { 
            'availability.status': 'available',
            'availability.reservedUntil': null
          }
        };

        if (session) {
          await Item.findByIdAndUpdate(orderItem.item, updateQuery, { session });
        } else {
          await Item.findByIdAndUpdate(orderItem.item, updateQuery);
        }
      }
    } catch (error) {
      console.error('Release inventory error:', error);
      throw error;
    }
  }
};

module.exports = orderController;
