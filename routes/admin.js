const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const dashboardController = require('../controllers/dashboardController');
const couponController = require('../controllers/couponController');
const adminConfigController = require('../controllers/adminConfigController');
const { verifyToken, isAdmin, isSuperAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const adminUpload = require('../middleware/adminUpload');
const { adminAuthLimiter, passwordResetLimiter } = require('../middleware/rateLimiters');
const { validate, validators } = require('../middleware/validateRequest');

// Public admin routes (no auth required)
router.post('/auth/login', adminAuthLimiter, adminController.login);
router.post('/auth/forgot-password', passwordResetLimiter, adminController.forgotPassword);
router.post('/auth/reset-password', passwordResetLimiter, adminController.resetPassword);

// All routes below require JWT + admin role
router.use(verifyToken);
router.use(isAdmin);

// ─── Auth ────────────────────────────────────────────────────────────────────
router.get('/auth/me', adminController.getMe);
router.put('/auth/profile', validate(validators.updateAdminProfile), adminController.updateProfile);
router.post('/auth/avatar', adminUpload.single('avatar'), adminController.uploadAvatar);
router.put('/auth/password', adminController.changePassword);
router.get('/notifications', adminController.getNotifications);
router.put('/notifications/read', adminController.markNotificationsRead);
router.put('/notifications/clear', adminController.clearNotifications);

// ─── Products ────────────────────────────────────────────────────────────────
router.get('/products', validate(validators.adminProductQuery), productController.adminGetProducts);
router.post('/products', upload.array('images', 10), validate(validators.createProduct), productController.adminCreateProduct);
router.patch('/products/:slug/status', productController.adminUpdateProductStatus);
router.put('/products/:slug', upload.array('images', 10), validate(validators.updateProduct), productController.adminUpdateProduct);
router.patch('/products/:slug', upload.array('images', 10), validate(validators.updateProduct), productController.adminUpdateProduct);
router.delete('/products/:slug', isSuperAdmin, productController.adminDeleteProduct);

// ─── Orders ──────────────────────────────────────────────────────────────────
router.get('/orders', orderController.adminGetOrders);
router.get('/orders/:uuid', orderController.adminGetOrderByUuid);
router.put('/orders/:uuid/status', validate(validators.updateOrderStatus), orderController.adminUpdateOrderStatus);
router.put('/orders/:uuid/cancel', isSuperAdmin, orderController.adminCancelOrder);

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard/stats', dashboardController.getStats);
router.get('/dashboard/sales-chart', dashboardController.getSalesChart);
router.get('/dashboard/top-products', dashboardController.getTopProducts);

// ─── Inventory ───────────────────────────────────────────────────────────────
router.get('/inventory/low-stock', dashboardController.getLowStock);
router.get('/inventory/summary', adminConfigController.getInventorySummary);
router.put('/inventory/restock/:slug', validate(validators.restockProduct), dashboardController.restockProduct);

// ─── Audit Logs ──────────────────────────────────────────────────────────────
router.get('/audit-logs', dashboardController.getAuditLogs);

// ─── Coupons ─────────────────────────────────────────────────────────────────
router.get('/coupons', couponController.adminGetCoupons);
router.post('/coupons', isSuperAdmin, validate(validators.createCoupon), couponController.adminCreateCoupon);
router.put('/coupons/:id', isSuperAdmin, validate(validators.updateCoupon), couponController.adminUpdateCoupon);
router.delete('/coupons/:id', isSuperAdmin, couponController.adminDeleteCoupon);

// Configurable admin resources
router.get('/shipping-zones', adminConfigController.getShippingZones);
router.post('/shipping-zones', isSuperAdmin, validate(validators.createShippingZone), adminConfigController.createShippingZone);
router.put('/shipping-zones/:id', isSuperAdmin, validate(validators.updateShippingZone), adminConfigController.updateShippingZone);
router.delete('/shipping-zones/:id', isSuperAdmin, adminConfigController.deleteShippingZone);
router.get('/shipping-settings', adminConfigController.getShippingSettings);
router.put('/shipping-settings', isSuperAdmin, validate(validators.updateShippingSettings), adminConfigController.updateShippingSettings);

router.get('/promos', adminConfigController.getPromos);
router.post('/promos', isSuperAdmin, validate(validators.createPromo), adminConfigController.createPromo);
router.put('/promos/:id', isSuperAdmin, validate(validators.updatePromo), adminConfigController.updatePromo);
router.delete('/promos/:id', isSuperAdmin, adminConfigController.deletePromo);

router.get('/settings', adminConfigController.getSettings);
router.put('/settings/store', isSuperAdmin, validate(validators.updateStoreSettings), adminConfigController.updateStoreSettings);
router.post('/settings/admin-users', isSuperAdmin, validate(validators.createAdmin), adminController.createAdminUser);

module.exports = router;
