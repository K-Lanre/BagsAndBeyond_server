const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { couponLimiter } = require('../middleware/rateLimiters');
const { validate, validators } = require('../middleware/validateRequest');

// Public coupon validation
router.get('/validate/:code', couponLimiter, validate(validators.couponLookup), couponController.validateCoupon);

module.exports = router;
