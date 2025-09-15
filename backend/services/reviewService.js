const Review = require('../models/Review');
const User = require('../models/User');
const Item = require('../models/Item');
const Order = require('../models/Order');
const mongoose = require('mongoose');

class ReviewService {
  /**
   * Calculate comprehensive review analytics for a user
   * @param {string} userId - User ID to calculate analytics for
   * @returns {Object} Analytics data
   */
  static async calculateUserAnalytics(userId) {
    try {
      const [
        ratingStats,
        ratingDistribution,
        reviewStats,
        recentReviews,
        categoryBreakdown
      ] = await Promise.all([
        Review.getAverageRating(userId),
        Review.getRatingDistribution(userId),
        Review.getReviewStats(userId),
        Review.findByReviewee(userId, 'approved').limit(5),
        this.getCategoryRatingBreakdown(userId)
      ]);

      const stats = ratingStats[0] || { averageRating: 0, totalReviews: 0 };
      const distribution = ratingDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      return {
        overall: {
          averageRating: Math.round(stats.averageRating * 10) / 10,
          totalReviews: stats.totalReviews,
          ratingDistribution: distribution
        },
        categoryBreakdown,
        recentReviews: recentReviews.map(review => ({
          id: review._id,
          rating: review.rating.overall,
          title: review.title,
          createdAt: review.createdAt,
          reviewer: review.reviewer
        })),
        trends: await this.calculateTrends(userId),
        performance: await this.calculatePerformanceMetrics(userId)
      };
    } catch (error) {
      console.error('Calculate user analytics error:', error);
      throw error;
    }
  }

  /**
   * Calculate category rating breakdown
   * @param {string} userId - User ID
   * @returns {Object} Category breakdown
   */
  static async getCategoryRatingBreakdown(userId) {
    try {
      const breakdown = await Review.aggregate([
        { $match: { reviewee: mongoose.Types.ObjectId(userId), status: 'approved' } },
        {
          $group: {
            _id: null,
            communication: { $avg: '$rating.categories.communication' },
            itemCondition: { $avg: '$rating.categories.itemCondition' },
            shipping: { $avg: '$rating.categories.shipping' },
            value: { $avg: '$rating.categories.value' }
          }
        }
      ]);

      const result = breakdown[0] || {};
      return {
        communication: result.communication ? Math.round(result.communication * 10) / 10 : null,
        itemCondition: result.itemCondition ? Math.round(result.itemCondition * 10) / 10 : null,
        shipping: result.shipping ? Math.round(result.shipping * 10) / 10 : null,
        value: result.value ? Math.round(result.value * 10) / 10 : null
      };
    } catch (error) {
      console.error('Get category breakdown error:', error);
      return {};
    }
  }

  /**
   * Calculate rating trends over time
   * @param {string} userId - User ID
   * @returns {Array} Trend data
   */
  static async calculateTrends(userId) {
    try {
      const trends = await Review.aggregate([
        { $match: { reviewee: mongoose.Types.ObjectId(userId), status: 'approved' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            averageRating: { $avg: '$rating.overall' },
            reviewCount: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]);

      return trends.map(trend => ({
        period: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
        averageRating: Math.round(trend.averageRating * 10) / 10,
        reviewCount: trend.reviewCount
      }));
    } catch (error) {
      console.error('Calculate trends error:', error);
      return [];
    }
  }

  /**
   * Calculate performance metrics
   * @param {string} userId - User ID
   * @returns {Object} Performance metrics
   */
  static async calculatePerformanceMetrics(userId) {
    try {
      const metrics = await Review.aggregate([
        { $match: { reviewee: mongoose.Types.ObjectId(userId), status: 'approved' } },
        {
          $group: {
            _id: null,
            totalHelpful: { $sum: '$helpful.count' },
            totalViews: { $sum: '$analytics.views' },
            averageHelpfulPerReview: { $avg: '$helpful.count' },
            averageViewsPerReview: { $avg: '$analytics.views' },
            fiveStarReviews: {
              $sum: { $cond: [{ $eq: ['$rating.overall', 5] }, 1, 0] }
            },
            fourStarReviews: {
              $sum: { $cond: [{ $eq: ['$rating.overall', 4] }, 1, 0] }
            },
            threeStarReviews: {
              $sum: { $cond: [{ $eq: ['$rating.overall', 3] }, 1, 0] }
            },
            twoStarReviews: {
              $sum: { $cond: [{ $eq: ['$rating.overall', 2] }, 1, 0] }
            },
            oneStarReviews: {
              $sum: { $cond: [{ $eq: ['$rating.overall', 1] }, 1, 0] }
            }
          }
        }
      ]);

      const result = metrics[0] || {};
      const totalReviews = result.fiveStarReviews + result.fourStarReviews + 
                          result.threeStarReviews + result.twoStarReviews + result.oneStarReviews;

      return {
        totalHelpful: result.totalHelpful || 0,
        totalViews: result.totalViews || 0,
        averageHelpfulPerReview: Math.round((result.averageHelpfulPerReview || 0) * 10) / 10,
        averageViewsPerReview: Math.round((result.averageViewsPerReview || 0) * 10) / 10,
        positiveReviews: result.fiveStarReviews + result.fourStarReviews,
        neutralReviews: result.threeStarReviews,
        negativeReviews: result.twoStarReviews + result.oneStarReviews,
        positivePercentage: totalReviews > 0 ? 
          Math.round(((result.fiveStarReviews + result.fourStarReviews) / totalReviews) * 100) : 0
      };
    } catch (error) {
      console.error('Calculate performance metrics error:', error);
      return {};
    }
  }

  /**
   * Get review recommendations for a user
   * @param {string} userId - User ID
   * @returns {Array} Recommended reviews to write
   */
  static async getReviewRecommendations(userId) {
    try {
      // Find completed orders that haven't been reviewed yet
      const orders = await Order.find({
        $or: [
          { buyer: userId },
          { seller: userId }
        ],
        status: 'completed',
        reviewed: { $ne: true }
      })
      .populate('items.item', 'title images')
      .populate('buyer', 'firstName lastName')
      .populate('seller', 'firstName lastName')
      .sort({ completedAt: -1 })
      .limit(10);

      return orders.map(order => {
        const isBuyer = order.buyer._id.toString() === userId;
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          item: order.items[0].item,
          otherParty: isBuyer ? order.seller : order.buyer,
          reviewType: isBuyer ? 'buyer_to_seller' : 'seller_to_buyer',
          completedAt: order.completedAt,
          canReview: true
        };
      });
    } catch (error) {
      console.error('Get review recommendations error:', error);
      return [];
    }
  }

  /**
   * Get seller performance summary
   * @param {string} sellerId - Seller ID
   * @returns {Object} Performance summary
   */
  static async getSellerPerformanceSummary(sellerId) {
    try {
      const [
        analytics,
        recentOrders,
        topItems
      ] = await Promise.all([
        this.calculateUserAnalytics(sellerId),
        Order.find({ seller: sellerId, status: 'completed' })
          .sort({ completedAt: -1 })
          .limit(5)
          .populate('buyer', 'firstName lastName'),
        this.getTopRatedItems(sellerId)
      ]);

      return {
        analytics,
        recentOrders: recentOrders.map(order => ({
          id: order._id,
          orderNumber: order.orderNumber,
          buyer: order.buyer,
          completedAt: order.completedAt,
          total: order.pricing.total
        })),
        topItems
      };
    } catch (error) {
      console.error('Get seller performance summary error:', error);
      throw error;
    }
  }

  /**
   * Get top rated items for a seller
   * @param {string} sellerId - Seller ID
   * @returns {Array} Top rated items
   */
  static async getTopRatedItems(sellerId) {
    try {
      const topItems = await Review.aggregate([
        { $match: { reviewee: mongoose.Types.ObjectId(sellerId), status: 'approved' } },
        {
          $group: {
            _id: '$item',
            averageRating: { $avg: '$rating.overall' },
            reviewCount: { $sum: 1 },
            totalHelpful: { $sum: '$helpful.count' }
          }
        },
        { $sort: { averageRating: -1, reviewCount: -1 } },
        { $limit: 5 }
      ]);

      // Populate item details
      const itemIds = topItems.map(item => item._id);
      const items = await Item.find({ _id: { $in: itemIds } })
        .select('title images price condition');

      return topItems.map(item => {
        const itemDetails = items.find(i => i._id.toString() === item._id.toString());
        return {
          item: itemDetails,
          averageRating: Math.round(item.averageRating * 10) / 10,
          reviewCount: item.reviewCount,
          totalHelpful: item.totalHelpful
        };
      });
    } catch (error) {
      console.error('Get top rated items error:', error);
      return [];
    }
  }

  /**
   * Generate review insights for admin dashboard
   * @returns {Object} Review insights
   */
  static async generateReviewInsights() {
    try {
      const [
        totalReviews,
        pendingReviews,
        averageRating,
        topReviewers,
        recentActivity,
        flaggedReviews
      ] = await Promise.all([
        Review.countDocuments(),
        Review.countDocuments({ status: 'pending' }),
        Review.aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: null, average: { $avg: '$rating.overall' } } }
        ]),
        Review.aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: '$reviewer', reviewCount: { $sum: 1 } } },
          { $sort: { reviewCount: -1 } },
          { $limit: 5 }
        ]),
        Review.find({ status: 'approved' })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('reviewer', 'firstName lastName')
          .populate('item', 'title'),
        Review.countDocuments({ 'analytics.reports': { $gt: 0 } })
      ]);

      return {
        overview: {
          totalReviews,
          pendingReviews,
          averageRating: averageRating[0]?.average ? 
            Math.round(averageRating[0].average * 10) / 10 : 0,
          flaggedReviews
        },
        topReviewers: await this.populateTopReviewers(topReviewers),
        recentActivity: recentActivity.map(review => ({
          id: review._id,
          rating: review.rating.overall,
          title: review.title,
          reviewer: review.reviewer,
          item: review.item,
          createdAt: review.createdAt
        })),
        trends: await this.calculateGlobalTrends()
      };
    } catch (error) {
      console.error('Generate review insights error:', error);
      throw error;
    }
  }

  /**
   * Populate top reviewers with user details
   * @param {Array} topReviewers - Top reviewers data
   * @returns {Array} Populated top reviewers
   */
  static async populateTopReviewers(topReviewers) {
    try {
      const userIds = topReviewers.map(reviewer => reviewer._id);
      const users = await User.find({ _id: { $in: userIds } })
        .select('firstName lastName avatar');

      return topReviewers.map(reviewer => {
        const user = users.find(u => u._id.toString() === reviewer._id.toString());
        return {
          user: user || { firstName: 'Unknown', lastName: 'User' },
          reviewCount: reviewer.reviewCount
        };
      });
    } catch (error) {
      console.error('Populate top reviewers error:', error);
      return [];
    }
  }

  /**
   * Calculate global review trends
   * @returns {Array} Global trends
   */
  static async calculateGlobalTrends() {
    try {
      const trends = await Review.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            reviewCount: { $sum: 1 },
            averageRating: { $avg: '$rating.overall' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]);

      return trends.map(trend => ({
        period: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
        reviewCount: trend.reviewCount,
        averageRating: Math.round(trend.averageRating * 10) / 10
      }));
    } catch (error) {
      console.error('Calculate global trends error:', error);
      return [];
    }
  }

  /**
   * Moderate review (admin function)
   * @param {string} reviewId - Review ID
   * @param {string} adminId - Admin ID
   * @param {string} status - New status
   * @param {string} notes - Moderation notes
   * @param {Array} flags - Moderation flags
   * @returns {Object} Updated review
   */
  static async moderateReview(reviewId, adminId, status, notes = '', flags = []) {
    try {
      const review = await Review.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      await review.moderate(adminId, status, notes, flags);

      // If approved, send notification to reviewer
      if (status === 'approved') {
        const notificationService = require('./notificationService');
        await notificationService.createNotification({
          user: review.reviewer,
          type: 'review_approved',
          title: 'Review Approved',
          message: 'Your review has been approved and is now visible to other users.',
          data: { reviewId: review._id }
        });
      }

      return review;
    } catch (error) {
      console.error('Moderate review error:', error);
      throw error;
    }
  }

  /**
   * Get reviews pending moderation
   * @param {Object} filters - Filter options
   * @returns {Array} Pending reviews
   */
  static async getPendingModeration(filters = {}) {
    try {
      const query = { status: 'pending' };
      
      if (filters.rating) {
        query['rating.overall'] = parseInt(filters.rating);
      }
      
      if (filters.type) {
        query.type = filters.type;
      }

      const reviews = await Review.find(query)
        .populate('reviewer', 'firstName lastName email')
        .populate('reviewee', 'firstName lastName email')
        .populate('item', 'title images')
        .populate('order', 'orderNumber')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 20);

      return reviews;
    } catch (error) {
      console.error('Get pending moderation error:', error);
      throw error;
    }
  }
}

module.exports = ReviewService;
