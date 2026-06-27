const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { validate, validators } = require('../middleware/validateRequest');

const orderLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many order lookup attempts. Please try again later.' }
});

const orderCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many checkout attempts. Please try again later.' }
});

// Public routes
router.post('/', orderCreateLimiter, validate(validators.createOrder), orderController.createOrder);
router.get('/track', orderLookupLimiter, validate(validators.emailQuery), orderController.trackOrders);
router.get('/:uuid/status', orderLookupLimiter, validate(validators.emailQuery), orderController.getOrderStatus);
router.get('/:uuid', orderLookupLimiter, validate(validators.emailQuery), orderController.getOrderDetails);

module.exports = router;
