const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { paymentLimiter } = require('../middleware/rateLimiters');
const { validate, validators } = require('../middleware/validateRequest');

// Initialize Paystack payment
router.post('/paystack/initialize', paymentLimiter, validate(validators.initializePayment), paymentController.initializePaystack);

// Verify payment
router.get('/verify/:reference', paymentLimiter, paymentController.verifyPayment);

module.exports = router;
