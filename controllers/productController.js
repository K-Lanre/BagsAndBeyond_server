const { Product, OrderItem } = require('../models');
const { Op } = require('sequelize');
const { generateUniqueSlug } = require('../utils/slugify');
const upload = require('../middleware/upload');
const path = require('path');

// Helper to generate SKU
const generateSKU = (category, name) => {
  const prefix = category.substring(0, 3).toUpperCase();
  const namePart = name.replace(/\s+/g, '').substring(0, 5).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${namePart}-${rand}`;
};

const parseJsonField = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const normalizeDimensions = (dimensions) => {
  const parsed = parseJsonField(dimensions, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  return {
    length: parsed.length ?? '',
    width: parsed.width ?? '',
    height: parsed.height ?? ''
  };
};

const normalizeNumberField = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildProductPayload = (body) => ({
  name: body.name,
  description: body.description,
  price: normalizeNumberField(body.price),
  stock_quantity: normalizeNumberField(body.stock_quantity, 0),
  category: body.category,
  subcategory: body.subcategory,
  status: body.status,
  weight: normalizeNumberField(body.weight),
  dimensions: normalizeDimensions(body.dimensions)
});

// GET /api/products  - public paginated list
exports.getProducts = async (req, res) => {
  try {
    const { category, subcategory, page = 1, limit = 10, sort = 'newest', search, min_price, max_price } = req.query;

    const where = { status: { [Op.ne]: 'inactive' } };

    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
        { subcategory: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (min_price || max_price) {
      where.price = {};
      if (min_price) where.price[Op.gte] = min_price;
      if (max_price) where.price[Op.lte] = max_price;
    }

    const offset = (page - 1) * limit;
    const order = sort === 'price_asc' ? [['price', 'ASC']] : sort === 'price_desc' ? [['price', 'DESC']] : [['created_at', 'DESC']];

    const { count, rows } = await Product.findAndCountAll({ where, limit: parseInt(limit), offset, order });

    res.json({ totalItems: count, products: rows, totalPages: Math.ceil(count / limit), currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

// GET /api/products/:slug  - public single product by slug
exports.getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ where: { slug: req.params.slug, status: { [Op.ne]: 'inactive' } } });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
};

// ─── ADMIN ONLY ─────────────────────────────────────────────────────────────

// GET /api/admin/products
exports.adminGetProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, status, search } = req.query;
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
        { subcategory: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Product.findAndCountAll({ where, limit: parseInt(limit), offset, order: [['created_at', 'DESC']] });
    res.json({ totalItems: count, products: rows, totalPages: Math.ceil(count / limit), currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

// POST /api/admin/products
exports.adminCreateProduct = async (req, res) => {
  try {
    const payload = buildProductPayload(req.body);

    // Handle uploaded images
    const images = req.files ? req.files.map(f => f.filename) : [];

    const slug = await generateUniqueSlug(payload.name, Product);
    const sku = generateSKU(payload.category, payload.name);

    const product = await Product.create({
      ...payload,
      slug,
      images,
      status: payload.status || 'active',
      sku
    });

    // Audit log
    if (req.admin) {
      const { AuditLog } = require('../models');
      await AuditLog.create({
        admin_user_id: req.admin.id,
        action: 'CREATE_PRODUCT',
        entity_type: 'product',
        entity_id: product.id,
        new_values: product.toJSON(),
        ip_address: req.ip
      });
    }

    res.status(201).json({ message: 'Product created', product });
  } catch (error) {
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
};

// PUT /api/admin/products/:slug
exports.adminUpdateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ where: { slug: req.params.slug } });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const oldValues = product.toJSON();
    const payload = buildProductPayload(req.body);

    // Handle new image uploads
    let images = product.images || [];
    if (req.files && req.files.length > 0) {
      images = [...images, ...req.files.map(f => f.filename)];
    }

    // Optionally remove images
    if (req.body.remove_images) {
      const toRemove = parseJsonField(req.body.remove_images, []);
      images = images.filter(img => !toRemove.includes(img));
    }

    await product.update({ ...payload, images });

    // Audit log
    if (req.admin) {
      const { AuditLog } = require('../models');
      await AuditLog.create({
        admin_user_id: req.admin.id,
        action: 'UPDATE_PRODUCT',
        entity_type: 'product',
        entity_id: product.id,
        old_values: oldValues,
        new_values: product.toJSON(),
        ip_address: req.ip
      });
    }

    res.json({ message: 'Product updated', product });
  } catch (error) {
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};

// PATCH /api/admin/products/:slug/status
exports.adminUpdateProductStatus = async (req, res) => {
  try {
    const product = await Product.findOne({ where: { slug: req.params.slug } });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const requestedStatus = String(req.body.status || '').trim().toLowerCase();
    if (!['active', 'inactive'].includes(requestedStatus)) {
      return res.status(400).json({ message: 'Status must be either active or inactive' });
    }

    const oldValues = product.toJSON();
    const nextStatus = requestedStatus === 'inactive'
      ? 'inactive'
      : product.stock_quantity === 0
        ? 'out_of_stock'
        : product.stock_quantity < 10
          ? 'low_stock'
          : 'active';

    await product.update({ status: nextStatus });

    if (req.admin) {
      const { AuditLog } = require('../models');
      await AuditLog.create({
        admin_user_id: req.admin.id,
        action: nextStatus === 'inactive' ? 'DEACTIVATE_PRODUCT' : 'REACTIVATE_PRODUCT',
        entity_type: 'product',
        entity_id: product.id,
        old_values: oldValues,
        new_values: product.toJSON(),
        ip_address: req.ip
      });
    }

    res.json({
      message: nextStatus === 'inactive' ? 'Product deactivated successfully' : 'Product reactivated successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating product status', error: error.message });
  }
};

// DELETE /api/admin/products/:slug  (soft delete)
exports.adminDeleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ where: { slug: req.params.slug } });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.status !== 'inactive') {
      return res.status(400).json({ message: 'Deactivate this product before clearing it permanently' });
    }

    const existingOrderItems = await OrderItem.count({ where: { product_id: product.id } });
    if (existingOrderItems > 0) {
      return res.status(409).json({
        message: 'This product cannot be permanently deleted because it is linked to existing orders'
      });
    }

    const oldValues = product.toJSON();
    await product.destroy();

    // Audit log
    if (req.admin) {
      const { AuditLog } = require('../models');
      await AuditLog.create({
        admin_user_id: req.admin.id,
        action: 'CLEAR_PRODUCT',
        entity_type: 'product',
        entity_id: product.id,
        old_values: oldValues,
        new_values: null,
        ip_address: req.ip
      });
    }

    res.json({ message: 'Product permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};
