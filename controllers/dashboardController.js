const { Order, Product, AuditLog, AdminUser, OrderItem } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../models');

// GET /api/admin/dashboard/stats
exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const revenueQuery = async (from) => {
      const result = await Order.findOne({
        where: { payment_status: 'paid', created_at: { [Op.gte]: from } },
        attributes: [[fn('SUM', col('total')), 'revenue']]
      });
      return parseFloat(result?.dataValues?.revenue || 0);
    };

    const [todayRevenue, weekRevenue, monthRevenue] = await Promise.all([
      revenueQuery(startOfDay),
      revenueQuery(startOfWeek),
      revenueQuery(startOfMonth)
    ]);

    // Order status counts
    const statusCounts = await Order.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status']
    });

    // Low stock products
    const lowStockCount = await Product.count({
      where: { stock_quantity: { [Op.lte]: 10 }, status: { [Op.ne]: 'inactive' } }
    });

    // Recent orders
    const recentOrders = await Order.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      attributes: ['uuid', 'order_number', 'customer_name', 'customer_email', 'total', 'status', 'created_at']
    });

    // Total products
    const totalProducts = await Product.count({ where: { status: { [Op.ne]: 'inactive' } } });

    res.json({
      revenue: { today: todayRevenue, week: weekRevenue, month: monthRevenue },
      orders: { statusBreakdown: statusCounts, total: statusCounts.reduce((a, b) => a + parseInt(b.dataValues.count), 0) },
      lowStockCount,
      totalProducts,
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

// GET /api/admin/dashboard/sales-chart?period=daily|weekly|monthly
exports.getSalesChart = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    let groupBy, dateFormat, daysBack;

    if (period === 'monthly') {
      groupBy = fn('DATE_FORMAT', col('created_at'), '%Y-%m');
      dateFormat = '%Y-%m';
      daysBack = 365;
    } else if (period === 'weekly') {
      groupBy = fn('DATE_FORMAT', col('created_at'), '%Y-%u');
      dateFormat = '%Y-%u';
      daysBack = 90;
    } else {
      groupBy = fn('DATE', col('created_at'));
      dateFormat = '%Y-%m-%d';
      daysBack = 30;
    }

    const from = new Date();
    from.setDate(from.getDate() - daysBack);

    const data = await Order.findAll({
      where: { payment_status: 'paid', created_at: { [Op.gte]: from } },
      attributes: [
        [fn('DATE_FORMAT', col('created_at'), dateFormat), 'date'],
        [fn('SUM', col('total')), 'revenue'],
        [fn('COUNT', col('id')), 'orders']
      ],
      group: [fn('DATE_FORMAT', col('created_at'), dateFormat)],
      order: [[fn('DATE_FORMAT', col('created_at'), dateFormat), 'ASC']]
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales chart', error: error.message });
  }
};

// GET /api/admin/dashboard/top-products
exports.getTopProducts = async (req, res) => {
  try {
    const topProducts = await OrderItem.findAll({
      attributes: [
        'product_id',
        'product_name',
        'product_slug',
        [fn('SUM', col('quantity')), 'total_sold'],
        [fn('SUM', literal('quantity * price_at_time')), 'total_revenue']
      ],
      group: ['product_id', 'product_name', 'product_slug'],
      order: [[fn('SUM', col('quantity')), 'DESC']],
      limit: 10
    });

    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top products', error: error.message });
  }
};

// GET /api/admin/inventory/low-stock?threshold=10
exports.getLowStock = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const products = await Product.findAll({
      where: {
        stock_quantity: { [Op.lte]: threshold },
        status: { [Op.ne]: 'inactive' }
      },
      order: [['stock_quantity', 'ASC']]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching low stock', error: error.message });
  }
};

// PUT /api/admin/inventory/restock/:slug
exports.restockProduct = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ message: 'Valid quantity required' });

    const product = await Product.findOne({ where: { slug: req.params.slug } });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const oldQty = product.stock_quantity;
    const newQty = oldQty + parseInt(quantity);

    await product.update({
      stock_quantity: newQty,
      status: newQty > 10 ? 'active' : newQty > 0 ? 'low_stock' : 'out_of_stock'
    });

    await AuditLog.create({
      admin_user_id: req.admin.id,
      action: 'RESTOCK_PRODUCT',
      entity_type: 'product',
      entity_id: product.id,
      old_values: { stock_quantity: oldQty },
      new_values: { stock_quantity: newQty },
      ip_address: req.ip
    });

    res.json({ message: `Restocked ${quantity} units`, product });
  } catch (error) {
    res.status(500).json({ message: 'Error restocking product', error: error.message });
  }
};

// GET /api/admin/audit-logs
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, action, admin_user_id } = req.query;
    const where = {};
    if (action) where.action = { [Op.like]: `%${action}%` };
    if (admin_user_id) where.admin_user_id = admin_user_id;

    const offset = (page - 1) * limit;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [result, todayCount, activeAdmins, actionBreakdown] = await Promise.all([
      AuditLog.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']],
        include: [{ model: AdminUser, as: 'adminUser', attributes: ['name', 'email'] }]
      }),
      AuditLog.count({ where: { created_at: { [Op.gte]: todayStart } } }),
      AuditLog.count({
        distinct: true,
        col: 'admin_user_id',
        where: { created_at: { [Op.gte]: todayStart } }
      }),
      AuditLog.findAll({
        attributes: ['action', [fn('COUNT', col('AuditLog.id')), 'count']],
        where: { created_at: { [Op.gte]: todayStart } },
        group: ['action']
      })
    ]);

    const breakdown = actionBreakdown.reduce((acc, item) => {
      const actionName = item.action || item.get?.('action');
      const count = parseInt(item.dataValues?.count || 0);
      if (actionName.includes('CREATE')) acc.creates += count;
      else if (actionName.includes('UPDATE') || actionName.includes('CHANGE') || actionName.includes('UPLOAD')) acc.updates += count;
      else if (actionName.includes('DELETE') || actionName.includes('CANCEL')) acc.deletes += count;
      else acc.other += count;
      return acc;
    }, { creates: 0, updates: 0, deletes: 0, other: 0 });

    res.json({
      totalItems: result.count,
      logs: result.rows,
      totalPages: Math.ceil(result.count / limit),
      currentPage: parseInt(page),
      summary: {
        todayCount,
        activeAdmins,
        breakdown
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
  }
};
