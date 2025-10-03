const stripeService = require('../services/stripeService');
const User = require('../models/User');
const logger = require('../config/logger');

const stripeConnectController = {
  /**
   * Create Stripe Connect account for seller onboarding
   * @route POST /api/stripe-connect/create-account
   * @access Private
   */
  createConnectAccount: async (req, res) => {
    try {
      const userId = req.user.id;
      const { country, businessType, phone, address } = req.body;

      // Check if user already has a Connect account
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.stripeConnectAccount.accountId) {
        return res.status(400).json({
          success: false,
          error: 'User already has a Stripe Connect account'
        });
      }

      // Create Connect account
      const result = await stripeService.createConnectAccount(user, {
        country,
        businessType,
        phone,
        address
      });

      // Update user with Connect account info
      user.stripeConnectAccount = {
        accountId: result.accountId,
        onboardingStatus: 'incomplete',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirements: {
          currentlyDue: [],
          eventuallyDue: [],
          pastDue: [],
          pendingVerification: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await user.save();

      res.json({
        success: true,
        data: {
          onboardingUrl: result.onboardingUrl,
          accountId: result.accountId
        }
      });

    } catch (error) {
      logger.error('Create Connect account error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create Connect account';
      let statusCode = 500;
      
      if (error.message.includes('Stripe Connect is not enabled')) {
        errorMessage = error.message;
        statusCode = 400;
      } else if (error.message.includes('Invalid Stripe API key')) {
        errorMessage = error.message;
        statusCode = 500;
      } else if (error.message.includes('test mode')) {
        errorMessage = error.message;
        statusCode = 400;
      } else if (error.message.includes('not a valid phone number')) {
        errorMessage = error.message;
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    }
  },

  /**
   * Get Connect account status
   * @route GET /api/stripe-connect/account-status
   * @access Private
   */
  getAccountStatus: async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!user.stripeConnectAccount.accountId) {
        return res.status(404).json({
          success: false,
          error: 'No Stripe Connect account found'
        });
      }

      // Get fresh status from Stripe
      const status = await stripeService.getConnectAccountStatus(user.stripeConnectAccount.accountId);

      // Update user's Connect account info
      user.stripeConnectAccount = {
        ...user.stripeConnectAccount,
        ...status,
        updatedAt: new Date()
      };

      await user.save();

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Get account status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get account status'
      });
    }
  },

  /**
   * Create account link for onboarding or updates
   * @route POST /api/stripe-connect/create-link
   * @access Private
   */
  createAccountLink: async (req, res) => {
    try {
      const userId = req.user.id;
      const { type = 'account_onboarding' } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!user.stripeConnectAccount.accountId) {
        return res.status(404).json({
          success: false,
          error: 'No Stripe Connect account found'
        });
      }

      const result = await stripeService.createAccountLink(user.stripeConnectAccount.accountId, type);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Create account link error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create account link'
      });
    }
  },

  /**
   * Check if user can sell (has complete Connect account)
   * @route GET /api/stripe-connect/can-sell
   * @access Private
   */
  canSell: async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const canSell = user.stripeConnectAccount.accountId && 
                     user.stripeConnectAccount.chargesEnabled && 
                     user.stripeConnectAccount.payoutsEnabled &&
                     user.stripeConnectAccount.detailsSubmitted;

      res.json({
        success: true,
        data: {
          canSell,
          accountStatus: user.stripeConnectAccount.onboardingStatus,
          chargesEnabled: user.stripeConnectAccount.chargesEnabled,
          payoutsEnabled: user.stripeConnectAccount.payoutsEnabled,
          detailsSubmitted: user.stripeConnectAccount.detailsSubmitted,
          requirements: user.stripeConnectAccount.requirements
        }
      });

    } catch (error) {
      logger.error('Check can sell error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check sell eligibility'
      });
    }
  }
};

module.exports = stripeConnectController;
