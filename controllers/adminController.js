const { AdminUser, Order, Product, AuditLog, AdminNotificationState } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sendAdminPasswordReset } = require('../utils/emailService');
const { validateAdminPassword } = require('../utils/passwordPolicy');

const publicAdminAttributes = ['id', 'email', 'name', 'avatar_url', 'role', 'is_active', 'last_login'];

const buildAdminPayload = (admin) => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  avatar_url: admin.avatar_url,
  role: admin.role
});

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getModelDate = (model, key) => model?.[key] || model?.get?.(key) || model?.dataValues?.[key] || null;

const logAdminAction = async (req, action, entityType, entityId, oldValues, newValues) => {
  if (!req.admin) return;
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

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const admin = await AdminUser.findOne({ where: { email } });
    
    if (!admin || !admin.is_active) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Update last login
    await admin.update({ last_login: new Date() });
    
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_change_me_in_prod',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: buildAdminPayload(admin)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    res.json(buildAdminPayload(req.admin));
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Error fetching user data', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const genericMessage = 'If an admin account exists for this email, password reset instructions have been sent.';

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const admin = await AdminUser.findOne({ where: { email, is_active: true } });
    if (!admin) {
      return res.json({ message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/admin/reset-password?token=${token}`;

    await admin.update({
      reset_password_token_hash: tokenHash,
      reset_password_expires_at: expiresAt
    });

    const emailResult = await sendAdminPasswordReset(admin, resetLink);

    res.json({
      message: genericMessage,
      resetLink: process.env.NODE_ENV === 'production' || !emailResult.skipped ? undefined : resetLink
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Error preparing password reset', error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    const passwordError = validateAdminPassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const admin = await AdminUser.findOne({
      where: {
        reset_password_token_hash: hashResetToken(token),
        reset_password_expires_at: { [Op.gt]: new Date() },
        is_active: true
      }
    });

    if (!admin) {
      return res.status(400).json({ message: 'Reset link is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await admin.update({
      password_hash: passwordHash,
      reset_password_token_hash: null,
      reset_password_expires_at: null
    });

    res.json({ message: 'Password reset successful. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, avatar_url } = req.body;
    const oldValues = req.admin.toJSON();

    await req.admin.update({
      name: String(name || '').trim() || req.admin.name,
      avatar_url: avatar_url ? String(avatar_url).trim() : null
    });

    await logAdminAction(req, 'UPDATE_ADMIN_PROFILE', 'admin_user', req.admin.id, oldValues, req.admin.toJSON());
    res.json(buildAdminPayload(req.admin));
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Avatar image is required' });
    }

    const avatarUrl = `/uploads/admins/${req.file.filename}`;
    const oldValues = req.admin.toJSON();

    await req.admin.update({ avatar_url: avatarUrl });
    await logAdminAction(req, 'UPLOAD_ADMIN_AVATAR', 'admin_user', req.admin.id, oldValues, req.admin.toJSON());

    res.json({
      avatar_url: avatarUrl,
      user: buildAdminPayload(req.admin)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading avatar', error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const passwordError = validateAdminPassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const valid = await bcrypt.compare(currentPassword, req.admin.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    await req.admin.update({
      password_hash: await bcrypt.hash(newPassword, 10),
      reset_password_token_hash: null,
      reset_password_expires_at: null
    });

    await logAdminAction(req, 'CHANGE_ADMIN_PASSWORD', 'admin_user', req.admin.id, null, { id: req.admin.id });
    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: error.message });
  }
};

exports.createAdminUser = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role === 'super_admin' ? 'super_admin' : 'admin';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const passwordError = validateAdminPassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const existing = await AdminUser.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'An admin with this email already exists' });
    }

    const admin = await AdminUser.create({
      email,
      name: name || email,
      role,
      password_hash: await bcrypt.hash(password, 10),
      is_active: true
    });

    await logAdminAction(req, 'CREATE_ADMIN_USER', 'admin_user', admin.id, null, buildAdminPayload(admin));
    res.status(201).json(buildAdminPayload(admin));
  } catch (error) {
    res.status(500).json({ message: 'Error creating admin user', error: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const [pendingOrders, unpaidOrders, processingOrders, lowStockProducts, recentAuditLogs] = await Promise.all([
      Order.findAll({
        where: { status: 'pending' },
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: ['id', 'uuid', 'order_number', 'customer_name', 'created_at']
      }),
      Order.findAll({
        where: { payment_status: 'pending' },
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: ['id', 'uuid', 'order_number', 'customer_name', 'created_at']
      }),
      Order.findAll({
        where: { status: 'processing', payment_status: 'paid' },
        order: [['updated_at', 'DESC']],
        limit: 5,
        attributes: ['id', 'uuid', 'order_number', 'customer_name', 'updated_at']
      }),
      Product.findAll({
        where: { stock_quantity: { [Op.lte]: 5 }, status: { [Op.ne]: 'inactive' } },
        order: [['stock_quantity', 'ASC']],
        limit: 5,
        attributes: ['id', 'name', 'slug', 'stock_quantity', 'created_at']
      }),
      AuditLog.findAll({
        where: { action: { [Op.in]: ['CREATE_ADMIN_USER', 'CHANGE_ADMIN_PASSWORD'] } },
        order: [['created_at', 'DESC']],
        limit: 3,
        attributes: ['id', 'action', 'entity_type', 'entity_id', 'created_at']
      })
    ]);

    const generatedNotifications = [
      ...pendingOrders.map((order) => ({
        id: `pending-order-${order.id}`,
        type: 'order',
        title: `New pending order ${order.order_number}`,
        message: `${order.customer_name || 'Customer'} is waiting for processing.`,
        href: `/admin/orders/${order.uuid}`,
        createdAt: getModelDate(order, 'createdAt') || getModelDate(order, 'created_at')
      })),
      ...unpaidOrders.map((order) => ({
        id: `payment-${order.id}`,
        type: 'payment',
        title: `Payment pending for ${order.order_number}`,
        message: 'This order has not been paid yet.',
        href: `/admin/orders/${order.uuid}`,
        createdAt: getModelDate(order, 'createdAt') || getModelDate(order, 'created_at')
      })),
      ...processingOrders.map((order) => ({
        id: `paid-order-${order.id}`,
        type: 'order',
        title: `Paid order ${order.order_number}`,
        message: `${order.customer_name || 'Customer'} has completed payment. Prepare this order for fulfillment.`,
        href: `/admin/orders/${order.uuid}`,
        createdAt: getModelDate(order, 'updatedAt') || getModelDate(order, 'updated_at')
      })),
      ...lowStockProducts.map((product) => ({
        id: `stock-${product.id}`,
        type: 'stock',
        title: `${product.name} is low in stock`,
        message: `${product.stock_quantity} item(s) remaining.`,
        href: `/admin/products/${product.slug}`,
        createdAt: getModelDate(product, 'createdAt') || getModelDate(product, 'created_at')
      })),
      ...recentAuditLogs.map((log) => ({
        id: `audit-${log.id}`,
        type: 'security',
        title: log.action === 'CREATE_ADMIN_USER' ? 'New admin account created' : 'Admin password changed',
        message: 'Review recent access-control activity.',
        href: '/admin/audit',
        createdAt: getModelDate(log, 'createdAt') || getModelDate(log, 'created_at')
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);

    const states = await AdminNotificationState.findAll({
      where: {
        admin_user_id: req.admin.id,
        notification_key: { [Op.in]: generatedNotifications.map((item) => item.id) }
      }
    });
    const stateByKey = new Map(states.map((state) => [state.notification_key, state]));
    const notifications = generatedNotifications
      .map((item) => {
        const state = stateByKey.get(item.id);
        return {
          ...item,
          isRead: Boolean(state?.read_at),
          isCleared: Boolean(state?.cleared_at),
          readAt: state?.read_at || null,
          clearedAt: state?.cleared_at || null
        };
      })
      .filter((item) => !item.isCleared);

    res.json({
      unreadCount: notifications.filter((item) => !item.isRead).length,
      notifications
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    const keys = Array.isArray(req.body.keys) ? req.body.keys.filter(Boolean) : [];
    if (keys.length === 0) return res.json({ message: 'No notifications selected' });

    const now = new Date();
    await Promise.all(keys.map(async (key) => {
      const [state] = await AdminNotificationState.findOrCreate({
        where: { admin_user_id: req.admin.id, notification_key: key },
        defaults: { read_at: now }
      });

      if (!state.read_at) {
        await state.update({ read_at: now });
      }
    }));

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notifications as read', error: error.message });
  }
};

exports.clearNotifications = async (req, res) => {
  try {
    const keys = Array.isArray(req.body.keys) ? req.body.keys.filter(Boolean) : [];
    if (keys.length === 0) return res.json({ message: 'No notifications selected' });

    const now = new Date();
    await Promise.all(keys.map(async (key) => {
      const [state] = await AdminNotificationState.findOrCreate({
        where: { admin_user_id: req.admin.id, notification_key: key },
        defaults: { read_at: now, cleared_at: now }
      });

      await state.update({ read_at: state.read_at || now, cleared_at: now });
    }));

    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing notifications', error: error.message });
  }
};
