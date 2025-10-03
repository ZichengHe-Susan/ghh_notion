const express = require('express');
const router = express.Router();

// Import controllers
const stripeConnectController = require('../controllers/stripeConnectController');

// Import middleware
const { auth } = require('../middleware/auth');

// @route   POST /api/stripe-connect/create-account
// @desc    Create Stripe Connect account for seller onboarding
// @access  Private
router.post('/create-account', auth, stripeConnectController.createConnectAccount);

// @route   GET /api/stripe-connect/account-status
// @desc    Get Connect account status and requirements
// @access  Private
router.get('/account-status', auth, stripeConnectController.getAccountStatus);

// @route   POST /api/stripe-connect/create-link
// @desc    Create account link for onboarding or updates
// @access  Private
router.post('/create-link', auth, stripeConnectController.createAccountLink);

// @route   GET /api/stripe-connect/can-sell
// @desc    Check if user can sell (has complete Connect account)
// @access  Private
router.get('/can-sell', auth, stripeConnectController.canSell);

module.exports = router;
