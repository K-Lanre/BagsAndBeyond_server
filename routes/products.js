const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { validate, validators } = require('../middleware/validateRequest');

// Public routes
router.get('/', validate(validators.productQuery), productController.getProducts);
router.get('/:slug', productController.getProductBySlug);

module.exports = router;
