const orderLifecycleService = require('../services/orderLifecycleService');
const Order = require('../models/Order');
const User = require('../models/User');
const Item = require('../models/Item');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

const adminController = {
  getDashboard: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getDashboard endpoint not implemented yet' });
  },
  getUsers: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getUsers endpoint not implemented yet' });
  },
  getUser: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getUser endpoint not implemented yet' });
  },
  updateUser: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - updateUser endpoint not implemented yet' });
  },
  deleteUser: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - deleteUser endpoint not implemented yet' });
  },
  getItems: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getItems endpoint not implemented yet' });
  },
  updateItem: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - updateItem endpoint not implemented yet' });
  },
  deleteItem: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - deleteItem endpoint not implemented yet' });
  },
  getOrders: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getOrders endpoint not implemented yet' });
  },
  getOrder: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getOrder endpoint not implemented yet' });
  },
  updateOrder: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - updateOrder endpoint not implemented yet' });
  },
  getAnalytics: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getAnalytics endpoint not implemented yet' });
  },
  getAuditLogs: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - getAuditLogs endpoint not implemented yet' });
  },
  createAuditLog: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - createAuditLog endpoint not implemented yet' });
  },
  moderateContent: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - moderateContent endpoint not implemented yet' });
  },
  resolveDispute: async (req, res) => {
    res.status(501).json({ message: 'Admin controller - resolveDispute endpoint not implemented yet' });
  },

  // Order Lifecycle Management
  getOrderLifecycleStats: async (req, res) => {
    try {
      const stats = await orderLifecycleService.getLifecycleStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get order lifecycle stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order lifecycle stats',
        error: error.message
      });
    }
  },

  triggerOrderLifecycleProcessing: async (req, res) => {
    try {
      const result = await orderLifecycleService.triggerProcessing();
      
      res.json({
        success: true,
        message: 'Order lifecycle processing triggered successfully',
        data: result
      });
    } catch (error) {
      console.error('Trigger order lifecycle processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger order lifecycle processing',
        error: error.message
      });
    }
  },

  getOrderAnalytics: async (req, res) => {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      const matchStage = {};
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const groupFormat = groupBy === 'day' ? '%Y-%m-%d' : 
                         groupBy === 'month' ? '%Y-%m' : 
                         groupBy === 'year' ? '%Y' : '%Y-%m-%d';

      const analytics = await Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupFormat,
                date: '$createdAt'
              }
            },
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.total' },
            avgOrderValue: { $avg: '$pricing.total' },
            ordersByStatus: {
              $push: {
                status: '$status',
                value: '$pricing.total'
              }
            }
          }
        },
        {
          $addFields: {
            statusBreakdown: {
              $reduce: {
                input: ['pending', 'confirmed', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'],
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [
                        [{
                          k: '$$this',
                          v: {
                            $size: {
                              $filter: {
                                input: '$ordersByStatus',
                                cond: { $eq: ['$$item.status', '$$this'] }
                              }
                            }
                          }
                        }]
                      ]
                    }
                  ]
                }
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: {
          analytics,
          summary: {
            totalOrders: analytics.reduce((sum, item) => sum + item.totalOrders, 0),
            totalRevenue: analytics.reduce((sum, item) => sum + item.totalRevenue, 0),
            avgOrderValue: analytics.length > 0 ? 
              analytics.reduce((sum, item) => sum + item.avgOrderValue, 0) / analytics.length : 0
          }
        }
      });
    } catch (error) {
      console.error('Get order analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order analytics',
        error: error.message
      });
    }
  },

  getSystemHealth: async (req, res) => {
    try {
      const [
        totalUsers,
        totalItems,
        totalOrders,
        pendingOrders,
        activeEscrows,
        recentOrders
      ] = await Promise.all([
        User.countDocuments(),
        Item.countDocuments(),
        Order.countDocuments(),
        Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'paid'] } }),
        Order.countDocuments({ 'escrow.status': 'held' }),
        Order.find().sort({ createdAt: -1 }).limit(10).populate('buyer seller', 'firstName lastName email')
      ]);

      const lifecycleStats = await orderLifecycleService.getLifecycleStats();

      res.json({
        success: true,
        data: {
          system: {
            totalUsers,
            totalItems,
            totalOrders,
            pendingOrders,
            activeEscrows
          },
          recentOrders,
          lifecycleStats,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system health',
        error: error.message
      });
    }
  }
};

module.exports = adminController;
