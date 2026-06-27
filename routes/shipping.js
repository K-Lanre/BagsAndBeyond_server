const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shippingController');
const { shippingLimiter } = require('../middleware/rateLimiters');
const { validate, validators } = require('../middleware/validateRequest');

// Calculate shipping cost
router.post('/calculate', shippingLimiter, validate(validators.calculateShipping), shippingController.calculateShipping);

module.exports = router;
