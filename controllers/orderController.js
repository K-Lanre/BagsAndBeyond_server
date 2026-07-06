const { Order, OrderItem, Product, Coupon } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { calculateShipping } = require('../utils/shippingCalculator');

const generateOrderNumber = () => {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BAB-${rand}`;
};

// POST /api/orders
exports.createOrder = async (req, res) => {
  const { sequelize } = require('../models');
  const t = await sequelize.transaction();
  try {
    const { customer_email, customer_name, customer_phone, shipping_address, items, payment_method, coupon_code } = req.body;

    if (!items || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await Product.findOne({ where: { slug: item.slug }, transaction: t });
      if (!product) {
        await t.rollback();
        return res.status(404).json({ message: `Product "${item.slug}" not found` });
      }
      if (product.stock_quantity < item.quantity) {
        await t.rollback();
        return res.status(400).json({ message: `Not enough stock for "${product.name}"` });
      }

      const itemTotal = parseFloat(product.price) * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_time: product.price,
        product_name: product.name,
        product_slug: product.slug,
        product_image: product.images && product.images.length > 0 ? product.images[0] : null
      });
    }

    const shippingResult = await calculateShipping({
      subtotal,
      country: shipping_address?.country,
      state: shipping_address?.state,
      city: shipping_address?.city,
      models: require('../models'),
      transaction: t
    });
    const shipping_cost = shippingResult.shipping_cost;
    let discount_amount = 0;
    let applied_coupon_id = null;

    if (coupon_code) {
      const coupon = await Coupon.findOne({
        where: {
          code: coupon_code.toUpperCase(),
          is_active: true,
          expiry_date: { [Op.gt]: new Date() }
        },
        transaction: t
      });

      if (coupon && coupon.used_count < coupon.usage_limit && subtotal >= parseFloat(coupon.min_purchase)) {
        if (coupon.type === 'percentage') {
          discount_amount = (subtotal * parseFloat(coupon.value)) / 100;
        } else if (coupon.type === 'flat') {
          discount_amount = parseFloat(coupon.value);
        } else if (coupon.type === 'free_shipping') {
          discount_amount = shipping_cost;
        }
        
        applied_coupon_id = coupon.id;
      }
    }

    const total = Math.max(0, subtotal + shipping_cost - discount_amount);

    const order = await Order.create({
      uuid: uuidv4(),
      order_number: generateOrderNumber(),
      customer_email,
      customer_name,
      customer_phone,
      shipping_address,
      subtotal,
      shipping_cost,
      discount_amount,
      coupon_id: applied_coupon_id,
      total,
      payment_method,
      status: 'pending',
      payment_status: 'pending'
    }, { transaction: t });

    for (const itemData of orderItemsData) {
      await OrderItem.create({ ...itemData, order_id: order.id }, { transaction: t });
    }

    await t.commit();

    // Send confirmation email disabled - only sending email on successful payment
    // try {
    //   const { sendOrderConfirmation } = require('../utils/emailService');
    //   const createdItems = await OrderItem.findAll({ where: { order_id: order.id } });
    //   sendOrderConfirmation(order, createdItems).catch(console.error);
    // } catch (e) { /* email failure must not break order creation */ }

    res.status(201).json({
      message: 'Order created successfully',
      order_number: order.order_number,
      order_uuid: order.uuid,
      total: order.total
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

// GET /api/orders/track?email=...
exports.trackOrders = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email parameter is required' });
    const normalizedEmail = email.trim().toLowerCase();

    const orders = await Order.findAll({
      where: Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.col('customer_email')),
        normalizedEmail
      ),
      attributes: [
        'uuid',
        'order_number',
        'status',
        'payment_status',
        'total',
        'created_at',
        [Sequelize.fn('COUNT', Sequelize.col('items.id')), 'items_count']
      ],
      include: [{ model: OrderItem, as: 'items', attributes: [] }],
      group: ['Order.id'],
      order: [['created_at', 'DESC']]
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error tracking orders', error: error.message });
  }
};

// GET /api/orders/:uuid?email=...
exports.getOrderDetails = async (req, res) => {
  try {
    const { uuid } = req.params;
    const { email } = req.query;

    if (!email) return res.status(400).json({ message: 'Email parameter is required for verification' });

    const order = await Order.findOne({
      where: {
        uuid,
        [Op.and]: Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('customer_email')),
          email.trim().toLowerCase()
        )
      },
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: Coupon, as: 'coupon' }
      ]
    });

    if (!order) return res.status(404).json({ message: 'Order not found or email mismatch' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
};

// GET /api/orders/:uuid/status?email=...
exports.getOrderStatus = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email parameter is required for verification' });

    const order = await Order.findOne({
      where: {
        uuid: req.params.uuid,
        [Op.and]: Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('customer_email')),
          email.trim().toLowerCase()
        )
      },
      attributes: ['uuid', 'order_number', 'status', 'payment_status', 'tracking_number']
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order status', error: error.message });
  }
};

// ─── ADMIN ONLY ─────────────────────────────────────────────────────────────

// GET /api/admin/orders
exports.adminGetOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, payment_status, search } = req.query;
    const { Op } = require('sequelize');
    const where = {};
    if (status) where.status = status;
    if (payment_status) where.payment_status = payment_status;
    if (search) {
      where[Op.or] = [
        { customer_email: { [Op.iLike]: `%${search}%` } },
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { order_number: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Order.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: Coupon, as: 'coupon' }
      ]
    });

    res.json({ totalItems: count, orders: rows, totalPages: Math.ceil(count / limit), currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

// GET /api/admin/orders/:uuid
exports.adminGetOrderByUuid = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { uuid: req.params.uuid },
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: Coupon, as: 'coupon' }
      ]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
};

// Valid status transitions
const STATUS_TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

// PUT /api/admin/orders/:uuid/status
exports.adminUpdateOrderStatus = async (req, res) => {
  try {
    const { status, tracking_number } = req.body;
    const order = await Order.findOne({ where: { uuid: req.params.uuid } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from "${order.status}" to "${status}"`,
        allowed
      });
    }

    const oldStatus = order.status;
    const updates = { status };
    if (status === 'shipped' && tracking_number) updates.tracking_number = tracking_number;

    await order.update(updates);

    // Trigger emails for key status transitions (non-blocking)
    try {
      const {
        sendOrderProcessing,
        sendOrderShipped,
        sendOrderDelivered,
        sendOrderCancelled
      } = require('../utils/emailService');
      if (status === 'processing') sendOrderProcessing(order).catch(console.error);
      if (status === 'shipped') sendOrderShipped(order).catch(console.error);
      if (status === 'delivered') sendOrderDelivered(order).catch(console.error);
      if (status === 'cancelled') sendOrderCancelled(order).catch(console.error);
    } catch (e) { /* non-critical */ }

    const { AuditLog } = require('../models');
    await AuditLog.create({
      admin_user_id: req.admin.id,
      action: 'UPDATE_ORDER_STATUS',
      entity_type: 'order',
      entity_id: order.id,
      old_values: { status: oldStatus },
      new_values: { status },
      ip_address: req.ip
    });

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};

// PUT /api/admin/orders/:uuid/cancel
exports.adminCancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findOne({
      where: { uuid: req.params.uuid },
      include: [{ model: OrderItem, as: 'items' }]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: `Cannot cancel an order that is "${order.status}"` });
    }

    const oldStatus = order.status;
    const shouldRestoreStock = order.payment_status === 'paid';
    const shouldRestoreCoupon = shouldRestoreStock && order.coupon_id;

    if (shouldRestoreStock) {
      for (const item of order.items) {
        await Product.increment('stock_quantity', { by: item.quantity, where: { id: item.product_id } });
      }
    }

    if (shouldRestoreCoupon) {
      await Coupon.decrement('used_count', {
        by: 1,
        where: {
          id: order.coupon_id,
          used_count: { [Op.gt]: 0 }
        }
      });
    }

    await order.update({ status: 'cancelled', notes: reason || order.notes });

    try {
      const { sendOrderCancelled } = require('../utils/emailService');
      sendOrderCancelled(order, reason).catch(console.error);
    } catch (e) { /* non-critical */ }

    const { AuditLog } = require('../models');
    await AuditLog.create({
      admin_user_id: req.admin.id,
      action: 'CANCEL_ORDER',
      entity_type: 'order',
      entity_id: order.id,
      old_values: { status: oldStatus },
      new_values: {
        status: 'cancelled',
        reason,
        stock_restored: shouldRestoreStock,
        coupon_restored: Boolean(shouldRestoreCoupon)
      },
      ip_address: req.ip
    });

    res.json({
      message: shouldRestoreStock
        ? 'Order cancelled and stock restored'
        : 'Order cancelled'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling order', error: error.message });
  }
};
