const Review = require('../models/Review');
const Order = require('../models/Order');
const Item = require('../models/Item');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const mongoose = require('mongoose');

const reviewController = {
  // @desc    Get all reviews with filtering and pagination
  // @route   GET /api/reviews
  // @access  Public
  getReviews: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status = 'approved',
        rating,
        type,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const filter = { status };

      // Apply filters
      if (rating) {
        filter['rating.overall'] = parseInt(rating);
      }
      if (type) {
        filter.type = type;
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const reviews = await Review.find(filter)
        .populate('reviewer', 'firstName lastName avatar')
        .populate('reviewee', 'firstName lastName')
        .populate('item', 'title images')
        .populate('order', 'orderNumber')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const totalReviews = await Review.countDocuments(filter);

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalReviews / limit),
            totalReviews,
            hasNext: page * limit < totalReviews,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reviews',
        error: error.message
      });
    }
  },

  // @desc    Get single review by ID
  // @route   GET /api/reviews/:id
  // @access  Public
  getReview: async (req, res) => {
    try {
      const { id } = req.params;

      const review = await Review.findById(id)
        .populate('reviewer', 'firstName lastName avatar')
        .populate('reviewee', 'firstName lastName')
        .populate('item', 'title images description')
        .populate('order', 'orderNumber')
        .populate('response.respondedBy', 'firstName lastName');

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      // Increment view count
      await review.incrementViews();

      res.json({
        success: true,
        data: review
      });
    } catch (error) {
      console.error('Get review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch review',
        error: error.message
      });
    }
  },

  // @desc    Create new review
  // @route   POST /api/reviews
  // @access  Private
  createReview: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        orderId,
        rating,
        title,
        comment,
        images = [],
        type,
        anonymous = false,
        categoryRatings = {}
      } = req.body;

      const userId = req.user.id;

      // Validate order exists and user is authorized to review
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check if user is buyer or seller
      const isBuyer = order.buyer.toString() === userId;
      const isSeller = order.seller.toString() === userId;

      if (!isBuyer && !isSeller) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to review this order'
        });
      }

      // Check if order is completed
      if (order.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Can only review completed orders'
        });
      }

      // Determine review type and reviewee
      let reviewType, revieweeId;
      if (isBuyer) {
        reviewType = 'buyer_to_seller';
        revieweeId = order.seller;
      } else {
        reviewType = 'seller_to_buyer';
        revieweeId = order.buyer;
      }

      // Check if review already exists
      const existingReview = await Review.findOne({
        order: orderId,
        reviewer: userId,
        type: reviewType
      }).session(session);

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this order'
        });
      }

      // Validate type matches request
      if (type && type !== reviewType) {
        return res.status(400).json({
          success: false,
          message: 'Invalid review type for this order'
        });
      }

      // Create review
      const reviewData = {
        order: orderId,
        item: order.items[0].item, // Assuming single item orders for now
        reviewer: userId,
        reviewee: revieweeId,
        rating: {
          overall: rating,
          categories: {
            communication: categoryRatings.communication || null,
            itemCondition: categoryRatings.itemCondition || null,
            shipping: categoryRatings.shipping || null,
            value: categoryRatings.value || null
          }
        },
        title,
        comment,
        images,
        type: reviewType,
        metadata: {
          verifiedPurchase: true,
          anonymous,
          source: 'web',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      };

      const review = new Review(reviewData);
      await review.save({ session });

      // Update order to mark as reviewed
      order.reviewed = true;
      await order.save({ session });

      await session.commitTransaction();

      // Populate review for response
      await review.populate([
        { path: 'reviewer', select: 'firstName lastName avatar' },
        { path: 'reviewee', select: 'firstName lastName' },
        { path: 'item', select: 'title images' },
        { path: 'order', select: 'orderNumber' }
      ]);

      // Send notification to reviewee
      await notificationService.createNotification({
        user: revieweeId,
        type: 'review_received',
        title: 'New Review Received',
        message: `You received a ${rating}-star review for your order #${order.orderNumber}`,
        data: { reviewId: review._id, orderId: orderId }
      });

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: review
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Create review error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create review',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  },

  // @desc    Update review
  // @route   PUT /api/reviews/:id
  // @access  Private
  updateReview: async (req, res) => {
    try {
      const { id } = req.params;
      const { rating, title, comment, categoryRatings } = req.body;
      const userId = req.user.id;

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      // Check if user is the reviewer
      if (review.reviewer.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit your own reviews'
        });
      }

      // Check if review can be edited (within 24 hours)
      const hoursSinceCreation = (Date.now() - review.createdAt) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return res.status(400).json({
          success: false,
          message: 'Reviews can only be edited within 24 hours of creation'
        });
      }

      // Update review
      if (rating) review.rating.overall = rating;
      if (title) review.title = title;
      if (comment) review.comment = comment;
      if (categoryRatings) {
        Object.keys(categoryRatings).forEach(key => {
          if (review.rating.categories[key] !== undefined) {
            review.rating.categories[key] = categoryRatings[key];
          }
        });
      }

      await review.save();

      res.json({
        success: true,
        message: 'Review updated successfully',
        data: review
      });

    } catch (error) {
      console.error('Update review error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update review',
        error: error.message
      });
    }
  },

  // @desc    Delete review
  // @route   DELETE /api/reviews/:id
  // @access  Private/Admin
  deleteReview: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      // Check permissions
      const isReviewer = review.reviewer.toString() === userId;
      const isAdmin = ['admin', 'super_admin'].includes(userRole);

      if (!isReviewer && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      await Review.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Review deleted successfully'
      });

    } catch (error) {
      console.error('Delete review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete review',
        error: error.message
      });
    }
  },

  // @desc    Get reviews for specific item
  // @route   GET /api/reviews/item/:itemId
  // @access  Public
  getItemReviews: async (req, res) => {
    try {
      const { itemId } = req.params;
      const {
        page = 1,
        limit = 10,
        rating,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const filter = { item: itemId, status: 'approved' };

      if (rating) {
        filter['rating.overall'] = parseInt(rating);
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const reviews = await Review.find(filter)
        .populate('reviewer', 'firstName lastName avatar')
        .populate('reviewee', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const totalReviews = await Review.countDocuments(filter);

      // Get rating statistics
      const ratingStats = await Review.getAverageRating(itemId);

      res.json({
        success: true,
        data: {
          reviews,
          ratingStats: ratingStats[0] || { averageRating: 0, totalReviews: 0 },
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalReviews / limit),
            totalReviews,
            hasNext: page * limit < totalReviews,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Get item reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch item reviews',
        error: error.message
      });
    }
  },

  // @desc    Get reviews by specific user
  // @route   GET /api/reviews/user/:userId
  // @access  Public
  getUserReviews: async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 10,
        type = 'received', // 'given' or 'received'
        status = 'approved'
      } = req.query;

      const skip = (page - 1) * limit;
      const filter = { status };

      if (type === 'given') {
        filter.reviewer = userId;
      } else {
        filter.reviewee = userId;
      }

      const reviews = await Review.find(filter)
        .populate('reviewer', 'firstName lastName avatar')
        .populate('reviewee', 'firstName lastName')
        .populate('item', 'title images')
        .populate('order', 'orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalReviews = await Review.countDocuments(filter);

      // Get user rating statistics
      const ratingStats = await Review.getAverageRating(userId);
      const ratingDistribution = await Review.getRatingDistribution(userId);

      res.json({
        success: true,
        data: {
          reviews,
          ratingStats: ratingStats[0] || { averageRating: 0, totalReviews: 0 },
          ratingDistribution,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalReviews / limit),
            totalReviews,
            hasNext: page * limit < totalReviews,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Get user reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user reviews',
        error: error.message
      });
    }
  },

  // @desc    Mark review as helpful
  // @route   POST /api/reviews/:id/helpful
  // @access  Private
  markHelpful: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      await review.markAsHelpful(userId);

      res.json({
        success: true,
        message: 'Review marked as helpful',
        data: { helpfulCount: review.helpful.count }
      });

    } catch (error) {
      console.error('Mark helpful error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark review as helpful',
        error: error.message
      });
    }
  },

  // @desc    Remove helpful vote from review
  // @route   DELETE /api/reviews/:id/helpful
  // @access  Private
  removeHelpful: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      await review.removeHelpful(userId);

      res.json({
        success: true,
        message: 'Helpful vote removed',
        data: { helpfulCount: review.helpful.count }
      });

    } catch (error) {
      console.error('Remove helpful error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove helpful vote',
        error: error.message
      });
    }
  },

  // @desc    Add response to review
  // @route   POST /api/reviews/:id/response
  // @access  Private
  addResponse: async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      // Check if user is the reviewee
      if (review.reviewee.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the reviewed user can respond'
        });
      }

      // Check if response already exists
      if (review.response.content) {
        return res.status(400).json({
          success: false,
          message: 'Response already exists for this review'
        });
      }

      await review.addResponse(content, userId);

      res.json({
        success: true,
        message: 'Response added successfully',
        data: review.response
      });

    } catch (error) {
      console.error('Add response error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to add response',
        error: error.message
      });
    }
  },

  // @desc    Report review
  // @route   POST /api/reviews/:id/report
  // @access  Private
  reportReview: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      // Check if user already reported this review
      const existingReport = review.analytics.reports;
      await review.report();

      // Create notification for admins
      await notificationService.createNotification({
        user: null, // Admin notification
        type: 'review_reported',
        title: 'Review Reported',
        message: `Review #${id} has been reported: ${reason}`,
        data: { reviewId: id, reporterId: userId, reason }
      });

      res.json({
        success: true,
        message: 'Review reported successfully'
      });

    } catch (error) {
      console.error('Report review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to report review',
        error: error.message
      });
    }
  },

  // @desc    Get review analytics
  // @route   GET /api/reviews/analytics/stats
  // @access  Private/Admin
  getReviewStats: async (req, res) => {
    try {
      const { userId } = req.query;

      const stats = await Review.getReviewStats(userId);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Get review stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch review statistics',
        error: error.message
      });
    }
  },

  // @desc    Get recent reviews
  // @route   GET /api/reviews/recent
  // @access  Public
  getRecentReviews: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const reviews = await Review.findRecentReviews(parseInt(limit));

      res.json({
        success: true,
        data: reviews
      });

    } catch (error) {
      console.error('Get recent reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent reviews',
        error: error.message
      });
    }
  },

  // @desc    Get top rated reviews
  // @route   GET /api/reviews/top-rated
  // @access  Public
  getTopRatedReviews: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const reviews = await Review.findTopRatedReviews(parseInt(limit));

      res.json({
        success: true,
        data: reviews
      });

    } catch (error) {
      console.error('Get top rated reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch top rated reviews',
        error: error.message
      });
    }
  }
};

module.exports = reviewController;
