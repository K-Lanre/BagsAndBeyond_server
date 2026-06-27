const express = require('express');
const router = express.Router();
const adminConfigController = require('../controllers/adminConfigController');

router.get('/active', adminConfigController.getActivePromos);

module.exports = router;
