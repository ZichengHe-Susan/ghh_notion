const User = require('../models/User');
const Item = require('../models/Item');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const s3Service = require('../services/s3Service');
const emailService = require('../services/emailService');
const config = require('../config/config');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const userController = {
  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select('-password -refreshTokens -emailVerificationToken -passwordResetToken -passwordResetExpires')
        .populate('verification.documents', 'filename url status uploadedAt')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      console.log('=== getProfile Backend Debug ===');
      console.log('User from database:', {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email
      });
      console.log('Full user object keys:', Object.keys(user));

      const stats = await getUserStats(req.user._id);

      const responseData = {
        success: true,
        data: {
          user,
          stats
        }
      };

      console.log('Response data being sent:', {
        success: responseData.success,
        user: {
          _id: responseData.data.user._id,
          firstName: responseData.data.user.firstName,
          lastName: responseData.data.user.lastName,
          displayName: responseData.data.user.displayName,
          email: responseData.data.user.email
        }
      });

      res.json(responseData);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile'
      });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        firstName,
        lastName,
        displayName,
        phone,
        bio,
        location,
        preferences
      } = req.body;

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (displayName) user.displayName = displayName;
      if (phone) user.profile.phone = phone;
      if (bio) user.profile.bio = bio;
      if (location) user.profile.location = location;

      if (preferences) {
        if (preferences.notifications) {
          user.profile.preferences.notifications = {
            ...user.profile.preferences.notifications,
            ...preferences.notifications
          };
        }
      }

      await user.save();

      await createNotification({
        user: user._id,
        type: 'account_verified',
        title: 'Profile Updated',
        message: 'Your profile has been successfully updated.',
        category: 'account',
        priority: 'normal'
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            email: user.email,
            avatar: user.avatar,
            profile: user.profile,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            verification: user.verification
          }
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  },

  updateUserInfo: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        firstName,
        lastName,
        displayName,
        email,
        password
      } = req.body;

      const user = await User.findById(req.user._id).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // If email is being changed, verify password
      if (email && email !== user.email) {
        if (!password) {
          return res.status(400).json({
            success: false,
            error: 'Password is required to change email address'
          });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid password'
          });
        }

        // Check if email already exists (either as current email or pending email)
        const existingUser = await User.findOne({ 
          $or: [
            { email: email.toLowerCase() },
            { pendingEmail: email.toLowerCase() }
          ]
        });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          return res.status(400).json({
            success: false,
            error: 'Email address is already in use'
          });
        }

        // Store the new email as pending instead of changing immediately
        user.pendingEmail = email.toLowerCase();
        
        // Generate new email verification token for the pending email
        const { generateEmailVerificationToken, hashToken } = require('../utils/jwt');
        const verificationToken = generateEmailVerificationToken();
        user.emailVerificationToken = hashToken(verificationToken);
        
        // Send verification email to the pending email address
        const userWithPendingEmail = { ...user.toObject(), email: user.pendingEmail };
        try {
          await emailService.sendEmailChangeVerificationEmail(userWithPendingEmail, verificationToken);
        } catch (emailError) {
          console.error('Failed to send email change verification email:', emailError);
          // Don't fail the request if email sending fails, but log it
        }
      }

      // Update other fields
      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (displayName !== undefined) user.displayName = displayName;

      await user.save();

      await createNotification({
        user: user._id,
        type: 'account_verified',
        title: 'Account Information Updated',
        message: 'Your account information has been successfully updated.',
        category: 'account',
        priority: 'normal'
      });

      // Determine the appropriate message based on whether email was changed
      const emailChanged = email && email !== req.user.email;
      const message = emailChanged 
        ? 'Email change request submitted successfully. Please check your new email for verification instructions. Your current email will remain active until verification is complete.'
        : 'User information updated successfully';

      res.json({
        success: true,
        message: message,
        data: {
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            email: user.email,
            pendingEmail: user.pendingEmail,
            avatar: user.avatar,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            verification: user.verification
          }
        }
      });
    } catch (error) {
      console.error('Update user info error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user information'
      });
    }
  },

  deleteAccount: async (req, res) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'Password is required to delete account'
        });
      }

      const user = await User.findById(req.user._id).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid password'
        });
      }

      const userItems = await Item.find({ seller: user._id });
      for (const item of userItems) {
        if (item.images && item.images.length > 0) {
          const imageKeys = item.images.map(img => img.key);
          await s3Service.deleteMultipleFiles(imageKeys);
        }
      }
      await Item.deleteMany({ seller: user._id });

      if (user.avatar) {
        try {
          await s3Service.deleteFile(user.avatar);
        } catch (s3Error) {
          console.error('Failed to delete avatar from S3:', s3Error);
        }
      }

      if (user.verification && user.verification.documents) {
        for (const doc of user.verification.documents) {
          try {
            await s3Service.deleteFile(doc.key);
          } catch (s3Error) {
            console.error('Failed to delete verification document from S3:', s3Error);
          }
        }
      }

      await Order.updateMany(
        { $or: [{ buyer: user._id }, { seller: user._id }] },
        { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Account deleted' }
      );

      await Notification.updateMany(
        { user: user._id },
        { isArchived: true, archivedAt: new Date() }
      );

      await User.findByIdAndDelete(user._id);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete account'
      });
    }
  },

  getUserItems: async (req, res) => {
    try {
      const { page = 1, limit = 10, status, category, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      const filter = { seller: req.user._id };
      if (status) filter.status = status;
      if (category) filter.category = category;

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const items = await Item.find(filter)
        .populate('category', 'name slug')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalItems = await Item.countDocuments(filter);

      res.json({
        success: true,
        data: {
          items,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
            hasNext: page * limit < totalItems,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get user items error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user items'
      });
    }
  },

  getUserOrders: async (req, res) => {
    try {
      const { page = 1, limit = 10, status, type = 'all' } = req.query;
      const skip = (page - 1) * limit;

      const filter = {};
      if (type === 'buyer') {
        filter.buyer = req.user._id;
      } else if (type === 'seller') {
        filter.seller = req.user._id;
      } else {
        filter.$or = [{ buyer: req.user._id }, { seller: req.user._id }];
      }

      if (status) filter.status = status;

      const orders = await Order.find(filter)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('items.item', 'title price images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

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
        error: 'Failed to get user orders'
      });
    }
  },

  getUserReviews: async (req, res) => {
    try {
      const { page = 1, limit = 10, type = 'received' } = req.query;
      const skip = (page - 1) * limit;

      const filter = {};
      if (type === 'given') {
        filter.reviewer = req.user._id;
      } else {
        filter.reviewee = req.user._id;
      }

      const reviews = await Review.find(filter)
        .populate('reviewer', 'firstName lastName avatar')
        .populate('reviewee', 'firstName lastName avatar')
        .populate('order', 'orderNumber')
        .populate('item', 'title images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

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
      console.error('Get user reviews error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user reviews'
      });
    }
  },

  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.avatar) {
        try {
          await s3Service.deleteFile(user.avatar);
        } catch (s3Error) {
          console.error('Failed to delete old avatar:', s3Error);
        }
      }

      const avatarKey = `avatars/${user._id}/${Date.now()}-${req.file.originalname}`;
      const avatarUrl = await s3Service.uploadFile(req.file.buffer, avatarKey, req.file.mimetype);

      user.avatar = avatarUrl;
      await user.save();

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatar: avatarUrl
        }
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload avatar'
      });
    }
  },

  getDashboard: async (req, res) => {
    try {
      const userId = req.user._id;

      const stats = await getUserStats(userId);

      const recentItems = await Item.find({ seller: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title price status images createdAt')
        .lean();

      const recentOrders = await Order.find({
        $or: [{ buyer: userId }, { seller: userId }]
      })
        .populate('buyer', 'firstName lastName')
        .populate('seller', 'firstName lastName')
        .populate('items.item', 'title')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const recentReviews = await Review.find({ reviewee: userId })
        .populate('reviewer', 'firstName lastName avatar')
        .populate('item', 'title')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const unreadNotificationsCount = await Notification.countDocuments({
        user: userId,
        'channels.inApp.read': false,
        isArchived: false
      });

      res.json({
        success: true,
        data: {
          stats,
          recentItems,
          recentOrders,
          recentReviews,
          unreadNotificationsCount
        }
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard data'
      });
    }
  },

  submitVerification: async (req, res) => {
    try {
      const { documents } = req.body;

      if (!documents || documents.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Verification documents are required'
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.verification.status === 'verified') {
        return res.status(400).json({
          success: false,
          error: 'User is already verified'
        });
      }

      if (user.verification.status === 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Verification is already pending review'
        });
      }

      user.verification.status = 'pending';
      user.verification.submittedAt = new Date();
      user.verification.documents = documents;

      await user.save();

      await createNotification({
        user: user._id,
        type: 'admin_action',
        title: 'Seller Verification Submitted',
        message: `${user.firstName} ${user.lastName} has submitted documents for seller verification.`,
        category: 'security',
        priority: 'high',
        data: {
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`,
          verificationId: user.verification._id
        }
      });

      try {
        await emailService.sendNotificationEmail(
          user,
          'Verification Submitted',
          'Your seller verification documents have been submitted and are under review. You will be notified once the review is complete.',
          `${config.FRONTEND_URL}/profile`
        );
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      res.json({
        success: true,
        message: 'Verification documents submitted successfully',
        data: {
          verification: user.verification
        }
      });
    } catch (error) {
      console.error('Submit verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit verification'
      });
    }
  },

  getVerificationStatus: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select('verification')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          verification: user.verification
        }
      });
    } catch (error) {
      console.error('Get verification status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get verification status'
      });
    }
  },

  resendEmailChangeVerification: async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!user.pendingEmail) {
        return res.status(400).json({
          success: false,
          error: 'No pending email change found'
        });
      }

      // Generate new verification token
      const { generateEmailVerificationToken, hashToken } = require('../utils/jwt');
      const verificationToken = generateEmailVerificationToken();
      user.emailVerificationToken = hashToken(verificationToken);
      await user.save();

      // Send verification email to the pending email address
      const userWithPendingEmail = { ...user.toObject(), email: user.pendingEmail };
      try {
        await emailService.sendEmailChangeVerificationEmail(userWithPendingEmail, verificationToken);
      } catch (emailError) {
        console.error('Failed to send email change verification email:', emailError);
        return res.status(500).json({
          success: false,
          error: 'Failed to send verification email'
        });
      }

      res.json({
        success: true,
        message: 'Verification email sent successfully to your new email address'
      });
    } catch (error) {
      console.error('Resend email change verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification email'
      });
    }
  }
};

async function getUserStats(userId) {
  try {
    const [
      totalItems,
      activeItems,
      totalOrders,
      totalSales,
      totalReviews,
      averageRating,
      totalRevenue
    ] = await Promise.all([
      Item.countDocuments({ seller: userId }),
      Item.countDocuments({ seller: userId, status: 'active' }),
      Order.countDocuments({ seller: userId }),
      Order.countDocuments({ seller: userId, status: 'completed' }),
      Review.countDocuments({ reviewee: userId }),
      Review.aggregate([
        { $match: { reviewee: userId } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]),
      Order.aggregate([
        { $match: { seller: userId, status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
      ])
    ]);

    return {
      totalItems,
      activeItems,
      totalOrders,
      totalSales,
      totalReviews,
      averageRating: averageRating.length > 0 ? Math.round(averageRating[0].avgRating * 10) / 10 : 0,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0
    };
  } catch (error) {
    console.error('Get user stats error:', error);
    return {
      totalItems: 0,
      activeItems: 0,
      totalOrders: 0,
      totalSales: 0,
      totalReviews: 0,
      averageRating: 0,
      totalRevenue: 0
    };
  }
}

async function createNotification(notificationData) {
  try {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
}

module.exports = userController;
