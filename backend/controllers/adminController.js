const orderLifecycleService = require('../services/orderLifecycleService');
const ReviewService = require('../services/reviewService');
const Order = require('../models/Order');
const User = require('../models/User');
const Item = require('../models/Item');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
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
  },

  // Review Moderation Endpoints

  // @desc    Get reviews pending moderation
  // @route   GET /api/admin/reviews/pending
  // @access  Private/Admin
  getPendingReviews: async (req, res) => {
    try {
      const { rating, type, limit = 20 } = req.query;
      
      const reviews = await ReviewService.getPendingModeration({
        rating,
        type,
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: reviews
      });
    } catch (error) {
      console.error('Get pending reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending reviews',
        error: error.message
      });
    }
  },

  // @desc    Moderate a review
  // @route   PUT /api/admin/reviews/:id/moderate
  // @access  Private/Admin
  moderateReview: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, moderationNotes, flags } = req.body;
      const adminId = req.user.id;

      const review = await ReviewService.moderateReview(
        id, 
        adminId, 
        status, 
        moderationNotes, 
        flags
      );

      res.json({
        success: true,
        message: 'Review moderated successfully',
        data: review
      });
    } catch (error) {
      console.error('Moderate review error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to moderate review',
        error: error.message
      });
    }
  },

  // @desc    Get review analytics for admin dashboard
  // @route   GET /api/admin/reviews/analytics
  // @access  Private/Admin
  getReviewAnalytics: async (req, res) => {
    try {
      const insights = await ReviewService.generateReviewInsights();

      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      console.error('Get review analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch review analytics',
        error: error.message
      });
    }
  },

  // @desc    Get user review analytics
  // @route   GET /api/admin/reviews/user/:userId/analytics
  // @access  Private/Admin
  getUserReviewAnalytics: async (req, res) => {
    try {
      const { userId } = req.params;
      
      const analytics = await ReviewService.calculateUserAnalytics(userId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get user review analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user review analytics',
        error: error.message
      });
    }
  },

  // @desc    Get seller performance summary
  // @route   GET /api/admin/sellers/:sellerId/performance
  // @access  Private/Admin
  getSellerPerformance: async (req, res) => {
    try {
      const { sellerId } = req.params;
      
      const performance = await ReviewService.getSellerPerformanceSummary(sellerId);

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Get seller performance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch seller performance',
        error: error.message
      });
    }
  },

  // @desc    Bulk moderate reviews
  // @route   POST /api/admin/reviews/bulk-moderate
  // @access  Private/Admin
  bulkModerateReviews: async (req, res) => {
    try {
      const { reviewIds, status, moderationNotes, flags } = req.body;
      const adminId = req.user.id;

      if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Review IDs array is required'
        });
      }

      const results = [];
      const errors = [];

      for (const reviewId of reviewIds) {
        try {
          const review = await ReviewService.moderateReview(
            reviewId, 
            adminId, 
            status, 
            moderationNotes, 
            flags
          );
          results.push({ reviewId, success: true, review });
        } catch (error) {
          errors.push({ reviewId, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk moderation completed. ${results.length} successful, ${errors.length} failed.`,
        data: {
          successful: results,
          failed: errors
        }
      });
    } catch (error) {
      console.error('Bulk moderate reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk moderate reviews',
        error: error.message
      });
    }
  },

  // @desc    Get flagged reviews
  // @route   GET /api/admin/reviews/flagged
  // @access  Private/Admin
  getFlaggedReviews: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const reviews = await Review.find({ 'analytics.reports': { $gt: 0 } })
        .populate('reviewer', 'firstName lastName email')
        .populate('reviewee', 'firstName lastName email')
        .populate('item', 'title images')
        .populate('order', 'orderNumber')
        .sort({ 'analytics.reports': -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalFlagged = await Review.countDocuments({ 'analytics.reports': { $gt: 0 } });

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalFlagged / limit),
            totalFlagged,
            hasNext: page * limit < totalFlagged,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get flagged reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch flagged reviews',
        error: error.message
      });
    }
  },

  // @desc    Get review moderation statistics
  // @route   GET /api/admin/reviews/moderation-stats
  // @access  Private/Admin
  getModerationStats: async (req, res) => {
    try {
      const [
        pendingCount,
        approvedCount,
        rejectedCount,
        hiddenCount,
        flaggedCount,
        recentModerations
      ] = await Promise.all([
        Review.countDocuments({ status: 'pending' }),
        Review.countDocuments({ status: 'approved' }),
        Review.countDocuments({ status: 'rejected' }),
        Review.countDocuments({ status: 'hidden' }),
        Review.countDocuments({ 'analytics.reports': { $gt: 0 } }),
        Review.find({ 'moderation.moderatedAt': { $exists: true } })
          .sort({ 'moderation.moderatedAt': -1 })
          .limit(10)
          .populate('moderation.moderatedBy', 'firstName lastName')
          .populate('reviewer', 'firstName lastName')
      ]);

      res.json({
        success: true,
        data: {
          counts: {
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
            hidden: hiddenCount,
            flagged: flaggedCount
          },
          recentModerations: recentModerations.map(review => ({
            id: review._id,
            status: review.status,
            moderatedBy: review.moderation.moderatedBy,
            reviewer: review.reviewer,
            moderatedAt: review.moderation.moderatedAt,
            moderationNotes: review.moderation.moderationNotes
          }))
        }
      });
    } catch (error) {
      console.error('Get moderation stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch moderation statistics',
        error: error.message
      });
    }
  }
};

module.exports = adminController;
