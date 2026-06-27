const { Coupon, AuditLog } = require('../models');
const { Op } = require('sequelize');

// GET /api/admin/coupons
exports.adminGetCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching coupons', error: error.message });
  }
};

// POST /api/admin/coupons
exports.adminCreateCoupon = async (req, res) => {
  try {
    const { code, type, value, min_purchase, usage_limit, expiry_date } = req.body;
    
    const existing = await Coupon.findOne({ where: { code: code.toUpperCase() } });
    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code,
      type,
      value,
      min_purchase,
      usage_limit,
      expiry_date
    });

    await AuditLog.create({
      admin_user_id: req.admin.id,
      action: 'CREATE_COUPON',
      entity_type: 'coupon',
      entity_id: coupon.id,
      new_values: coupon.toJSON(),
      ip_address: req.ip
    });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(500).json({ message: 'Error creating coupon', error: error.message });
  }
};

// PUT /api/admin/coupons/:id
exports.adminUpdateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, value, min_purchase, usage_limit, expiry_date, is_active } = req.body;
    
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    const oldValues = coupon.toJSON();
    await coupon.update({
      type,
      value,
      min_purchase,
      usage_limit,
      expiry_date,
      is_active
    });

    await AuditLog.create({
      admin_user_id: req.admin.id,
      action: 'UPDATE_COUPON',
      entity_type: 'coupon',
      entity_id: coupon.id,
      old_values: oldValues,
      new_values: coupon.toJSON(),
      ip_address: req.ip
    });

    res.json(coupon);
  } catch (error) {
    res.status(500).json({ message: 'Error updating coupon', error: error.message });
  }
};

// DELETE /api/admin/coupons/:id
exports.adminDeleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    await AuditLog.create({
      admin_user_id: req.admin.id,
      action: 'DELETE_COUPON',
      entity_type: 'coupon',
      entity_id: coupon.id,
      old_values: coupon.toJSON(),
      ip_address: req.ip
    });

    await coupon.destroy();
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting coupon', error: error.message });
  }
};

// Public endpoint to validate coupon
// GET /api/coupons/validate/:code
exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { subtotal } = req.query;

    const coupon = await Coupon.findOne({
      where: {
        code: code.toUpperCase(),
        is_active: true,
        expiry_date: { [Op.gt]: new Date() }
      }
    });

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid or expired coupon code' });
    }

    if (coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    }

    if (subtotal && parseFloat(subtotal) < parseFloat(coupon.min_purchase)) {
      return res.status(400).json({ 
        message: `Minimum purchase of ₦${parseFloat(coupon.min_purchase).toLocaleString()} required for this coupon` 
      });
    }

    res.json({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      message: 'Coupon applied successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error validating coupon', error: error.message });
  }
};
