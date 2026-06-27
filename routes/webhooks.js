const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/paystack', express.raw({ type: 'application/json' }), paymentController.paystackWebhook);

module.exports = router;
