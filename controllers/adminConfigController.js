const { AdminUser, AuditLog, Product, Promo, ShippingZone, SystemSetting } = require('../models');
const { fn, col, Op } = require('sequelize');
const { DEFAULT_SHIPPING_SETTINGS, normalizeShippingSettings } = require('../utils/shippingCalculator');

const logAdminAction = async (req, action, entityType, entityId, oldValues, newValues) => {
  await AuditLog.create({
    admin_user_id: req.admin.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues || null,
    new_values: newValues || null,
    ip_address: req.ip
  });
};

const readJsonValue = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }
  return value;
};

exports.getShippingZones = async (req, res) => {
  try {
    const zones = await ShippingZone.findAll({ order: [['created_at', 'ASC']] });
    res.json(zones);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching shipping zones', error: error.message });
  }
};

exports.getShippingSettings = async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ where: { key: 'shipping' } });
    res.json(normalizeShippingSettings(setting?.value || DEFAULT_SHIPPING_SETTINGS));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching shipping settings', error: error.message });
  }
};

exports.updateShippingSettings = async (req, res) => {
  try {
    const value = {
      freeShippingThreshold: Number(req.body.freeShippingThreshold ?? DEFAULT_SHIPPING_SETTINGS.freeShippingThreshold),
      storeCountry: String(req.body.storeCountry || DEFAULT_SHIPPING_SETTINGS.storeCountry).trim(),
      domesticDefaultShippingFee: Number(
        req.body.domesticDefaultShippingFee ?? req.body.defaultShippingFee ?? DEFAULT_SHIPPING_SETTINGS.domesticDefaultShippingFee
      ),
      internationalDefaultShippingFee: Number(
        req.body.internationalDefaultShippingFee ?? DEFAULT_SHIPPING_SETTINGS.internationalDefaultShippingFee
      )
    };

    if (!value.storeCountry) {
      return res.status(400).json({ message: 'Store country is required' });
    }

    if (
      value.freeShippingThreshold < 0 ||
      value.domesticDefaultShippingFee < 0 ||
      value.internationalDefaultShippingFee < 0
    ) {
      return res.status(400).json({ message: 'Shipping settings cannot be negative' });
    }

    const [setting] = await SystemSetting.findOrCreate({
      where: { key: 'shipping' },
      defaults: { value }
    });

    const oldValues = setting.toJSON();
    await setting.update({ value });
    await logAdminAction(req, 'UPDATE_SHIPPING_SETTINGS', 'system_setting', setting.id, oldValues, setting.toJSON());

    res.json(value);
  } catch (error) {
    res.status(500).json({ message: 'Error updating shipping settings', error: error.message });
  }
};

exports.createShippingZone = async (req, res) => {
  try {
    const zone = await ShippingZone.create(req.body);
    await logAdminAction(req, 'CREATE_SHIPPING_ZONE', 'shipping_zone', zone.id, null, zone.toJSON());
    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ message: 'Error creating shipping zone', error: error.message });
  }
};

exports.updateShippingZone = async (req, res) => {
  try {
    const zone = await ShippingZone.findByPk(req.params.id);
    if (!zone) return res.status(404).json({ message: 'Shipping zone not found' });

    const oldValues = zone.toJSON();
    await zone.update(req.body);
    await logAdminAction(req, 'UPDATE_SHIPPING_ZONE', 'shipping_zone', zone.id, oldValues, zone.toJSON());
    res.json(zone);
  } catch (error) {
    res.status(500).json({ message: 'Error updating shipping zone', error: error.message });
  }
};

exports.deleteShippingZone = async (req, res) => {
  try {
    const zone = await ShippingZone.findByPk(req.params.id);
    if (!zone) return res.status(404).json({ message: 'Shipping zone not found' });

    const oldValues = zone.toJSON();
    await zone.destroy();
    await logAdminAction(req, 'DELETE_SHIPPING_ZONE', 'shipping_zone', oldValues.id, oldValues, null);
    res.json({ message: 'Shipping zone deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting shipping zone', error: error.message });
  }
};

exports.getPromos = async (req, res) => {
  try {
    const promos = await Promo.findAll({ order: [['created_at', 'DESC']] });
    res.json(promos);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching promos', error: error.message });
  }
};

exports.getActivePromos = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const promos = await Promo.findAll({
      where: {
        is_active: true,
        start_date: { [Op.lte]: today },
        end_date: { [Op.gte]: today }
      },
      order: [['created_at', 'DESC']]
    });

    res.json(promos);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active promos', error: error.message });
  }
};

exports.createPromo = async (req, res) => {
  try {
    const promo = await Promo.create(req.body);
    await logAdminAction(req, 'CREATE_PROMO', 'promo', promo.id, null, promo.toJSON());
    res.status(201).json(promo);
  } catch (error) {
    res.status(500).json({ message: 'Error creating promo', error: error.message });
  }
};

exports.updatePromo = async (req, res) => {
  try {
    const promo = await Promo.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found' });

    const oldValues = promo.toJSON();
    await promo.update(req.body);
    await logAdminAction(req, 'UPDATE_PROMO', 'promo', promo.id, oldValues, promo.toJSON());
    res.json(promo);
  } catch (error) {
    res.status(500).json({ message: 'Error updating promo', error: error.message });
  }
};

exports.deletePromo = async (req, res) => {
  try {
    const promo = await Promo.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found' });

    const oldValues = promo.toJSON();
    await promo.destroy();
    await logAdminAction(req, 'DELETE_PROMO', 'promo', oldValues.id, oldValues, null);
    res.json({ message: 'Promo deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting promo', error: error.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const [storeSetting, shippingZones, adminUsers] = await Promise.all([
      SystemSetting.findOne({ where: { key: 'store' } }),
      ShippingZone.findAll({ order: [['created_at', 'ASC']] }),
      AdminUser.findAll({ attributes: ['id', 'name', 'email', 'avatar_url', 'role', 'is_active', 'last_login'], order: [['created_at', 'ASC']] })
    ]);

    res.json({
      store: readJsonValue(storeSetting?.value, {
        name: 'BagsAndBeyond',
        email: 'support@bagsandbeyond.com',
        description: '',
        maintenanceMode: false
      }),
      paystack: {
        active: Boolean(process.env.PAYSTACK_SECRET_KEY),
        publicKey: process.env.PAYSTACK_PUBLIC_KEY ? 'configured' : '',
        secretKey: process.env.PAYSTACK_SECRET_KEY ? 'configured' : '',
        webhooks: Boolean(process.env.PAYSTACK_SECRET_KEY),
        sandbox: process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test') || false
      },
      shippingZones,
      teamMembers: adminUsers
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
};

exports.updateStoreSettings = async (req, res) => {
  try {
    const [setting] = await SystemSetting.findOrCreate({
      where: { key: 'store' },
      defaults: { value: req.body }
    });

    const oldValues = setting.toJSON();
    await setting.update({ value: req.body });
    await logAdminAction(req, 'UPDATE_STORE_SETTINGS', 'system_setting', setting.id, oldValues, setting.toJSON());
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings', error: error.message });
  }
};

exports.getInventorySummary = async (req, res) => {
  try {
    const [totalItems, valuationResult, lowStockCount, criticalAlerts, categoryBreakdown] = await Promise.all([
      Product.sum('stock_quantity', { where: { status: { [Op.ne]: 'inactive' } } }),
      Product.findOne({ attributes: [[fn('SUM', col('price')), 'valuation']] }),
      Product.count({ where: { stock_quantity: { [Op.lte]: 10 }, status: { [Op.ne]: 'inactive' } } }),
      Product.findAll({
        where: { stock_quantity: { [Op.lte]: 10 }, status: { [Op.ne]: 'inactive' } },
        order: [['stock_quantity', 'ASC']],
        limit: 8
      }),
      Product.findAll({
        attributes: ['category', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('stock_quantity')), 'stock']],
        group: ['category']
      })
    ]);

    res.json({
      stats: {
        totalItems: parseInt(totalItems || 0),
        totalValuation: parseFloat(valuationResult?.dataValues?.valuation || 0),
        lowStockAlerts: lowStockCount
      },
      criticalAlerts,
      categoryBreakdown
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory summary', error: error.message });
  }
};
