const stripeService = require('../services/stripeService');
const logger = require('../config/logger');

/**
 * Middleware to verify Stripe webhook signature
 * This middleware should be used for Stripe webhook endpoints
 */
const verifyStripeWebhook = (req, res, next) => {
  try {
    const signature = req.get('stripe-signature');
    
    if (!signature) {
      logger.warn('Stripe webhook signature missing', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(400).json({
        success: false,
        message: 'Stripe signature header missing'
      });
    }

    // Store raw body for signature verification
    const payload = req.body;
    
    try {
      // Verify the webhook signature
      const event = stripeService.verifyWebhookSignature(payload, signature);
      
      // Attach the verified event to the request object
      req.stripeEvent = event;
      
      logger.info('Stripe webhook signature verified', {
        eventId: event.id,
        eventType: event.type,
        ip: req.ip
      });
      
      next();
      
    } catch (error) {
      logger.error('Stripe webhook signature verification failed', {
        error: error.message,
        signature: signature.substring(0, 20) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid Stripe signature'
      });
    }
    
  } catch (error) {
    logger.error('Error in Stripe webhook middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook verification error'
    });
  }
};

/**
 * Middleware to handle raw body parsing for Stripe webhooks
 * This should be used before verifyStripeWebhook middleware
 */
const parseStripeWebhookBody = (req, res, next) => {
  try {
    // Ensure we have raw body for signature verification
    if (req.is('application/json')) {
      // Body is already parsed by express.json()
      // We need to reconstruct it for signature verification
      req.rawBody = JSON.stringify(req.body);
    } else {
      req.rawBody = req.body;
    }
    
    next();
  } catch (error) {
    logger.error('Error parsing Stripe webhook body:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook body'
    });
  }
};

/**
 * Middleware to log webhook events for debugging
 */
const logStripeWebhook = (req, res, next) => {
  if (req.stripeEvent) {
    logger.info('Processing Stripe webhook', {
      eventId: req.stripeEvent.id,
      eventType: req.stripeEvent.type,
      created: req.stripeEvent.created,
      livemode: req.stripeEvent.livemode
    });
  }
  next();
};

/**
 * Middleware to handle webhook event idempotency
 * Prevents processing the same webhook event multiple times
 */
const handleWebhookIdempotency = async (req, res, next) => {
  try {
    if (!req.stripeEvent) {
      return next();
    }

    const eventId = req.stripeEvent.id;
    
    // Check if we've already processed this event
    const Payment = require('../models/Payment');
    const existingEvent = await Payment.findOne({
      'webhookEvents.eventId': eventId
    });

    if (existingEvent) {
      logger.info('Stripe webhook event already processed', {
        eventId,
        eventType: req.stripeEvent.type
      });
      
      return res.json({
        success: true,
        message: 'Event already processed',
        processed: true
      });
    }

    next();
  } catch (error) {
    logger.error('Error handling webhook idempotency:', error);
    next(); // Continue processing even if idempotency check fails
  }
};

/**
 * Middleware to validate webhook event structure
 */
const validateWebhookEvent = (req, res, next) => {
  try {
    if (!req.stripeEvent) {
      return next();
    }

    const event = req.stripeEvent;
    
    // Validate required fields
    if (!event.id || !event.type || !event.data) {
      logger.warn('Invalid Stripe webhook event structure', {
        eventId: event.id,
        eventType: event.type,
        hasData: !!event.data
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook event structure'
      });
    }

    // Validate event object
    if (!event.data.object) {
      logger.warn('Missing event data object', {
        eventId: event.id,
        eventType: event.type
      });
      
      return res.status(400).json({
        success: false,
        message: 'Missing event data object'
      });
    }

    next();
  } catch (error) {
    logger.error('Error validating webhook event:', error);
    return res.status(400).json({
      success: false,
      message: 'Webhook event validation error'
    });
  }
};

/**
 * Middleware to handle webhook processing errors
 */
const handleWebhookError = (error, req, res, next) => {
  logger.error('Stripe webhook processing error:', {
    error: error.message,
    stack: error.stack,
    eventId: req.stripeEvent?.id,
    eventType: req.stripeEvent?.type,
    ip: req.ip
  });

  // Return success to Stripe to prevent retries for certain errors
  if (error.message.includes('already processed') || 
      error.message.includes('not found') ||
      error.message.includes('invalid status')) {
    return res.json({
      success: true,
      message: 'Event processed with warnings',
      error: error.message
    });
  }

  // Return error for other cases
  res.status(500).json({
    success: false,
    message: 'Webhook processing failed',
    error: error.message
  });
};

module.exports = {
  verifyStripeWebhook,
  parseStripeWebhookBody,
  logStripeWebhook,
  handleWebhookIdempotency,
  validateWebhookEvent,
  handleWebhookError
};
