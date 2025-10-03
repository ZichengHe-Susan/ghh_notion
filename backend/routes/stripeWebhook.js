const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyStripeWebhook, logStripeWebhook, handleWebhookIdempotency, validateWebhookEvent, handleWebhookError } = require('../middleware/webhook');

// This route handles Stripe webhook events. It needs to receive the raw request body for signature verification,
// so it uses express.raw() instead of express.json().
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  verifyStripeWebhook,
  logStripeWebhook,
  handleWebhookIdempotency,
  validateWebhookEvent,
  paymentController.handleWebhook,
  handleWebhookError
);

module.exports = router;
