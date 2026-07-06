const { Coupon, Order, OrderItem, Payment, Product, sequelize } = require('../models');
const crypto = require('crypto');

const hasPaystackSecret = () => {
  return Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_SECRET_KEY.startsWith('sk_'));
};

const shouldUseMockPayments = () => {
  return process.env.PAYMENT_PROVIDER_MODE === 'mock' || !hasPaystackSecret();
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const buildVerifiedOrderPayload = (order) => ({
  order_number: order.order_number,
  order_uuid: order.uuid,
  total: order.total,
  email: order.customer_email
});

const verifyPaystackSignature = (rawBody, signature) => {
  if (!hasPaystackSecret()) return true;
  if (!signature || !Buffer.isBuffer(rawBody)) return false;

  const computed = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  const computedBuffer = Buffer.from(computed, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  return computedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(computedBuffer, signatureBuffer);
};

const buildCallbackUrl = (providedUrl, order, reference) => {
  const fallbackBase = process.env.CLIENT_URL || 'http://localhost:5173';
  const rawUrl = providedUrl || `${fallbackBase}/order-success?order=${encodeURIComponent(order.uuid)}&email=${encodeURIComponent(order.customer_email)}`;
  const url = new URL(rawUrl);
  url.searchParams.set('reference', reference);
  return url.toString();
};

const markPaymentSuccessful = async (payment, metadata = {}) => {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(payment.order_id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!order) return null;

    const items = await OrderItem.findAll({
      where: { order_id: order.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (payment.status === 'success' || order.payment_status === 'paid') {
      if (payment.status !== 'success') {
        await payment.update({ status: 'success', metadata }, { transaction });
      }
      order.setDataValue('items', items);
      return order;
    }

    for (const item of items) {
      const product = await Product.findByPk(item.product_id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!product) {
        const error = new Error(`Product "${item.product_name}" no longer exists`);
        error.statusCode = 409;
        throw error;
      }

      if (product.stock_quantity < item.quantity) {
        const error = new Error(`Not enough stock for "${item.product_name}"`);
        error.statusCode = 409;
        throw error;
      }

      await product.update({
        stock_quantity: product.stock_quantity - item.quantity
      }, { transaction });
    }

    if (order.coupon_id) {
      const coupon = await Coupon.findByPk(order.coupon_id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!coupon) {
        const error = new Error('Applied coupon no longer exists');
        error.statusCode = 409;
        throw error;
      }

      if (!coupon.is_active || coupon.expiry_date <= new Date() || coupon.used_count >= coupon.usage_limit) {
        const error = new Error(`Coupon "${coupon.code}" is no longer available`);
        error.statusCode = 409;
        throw error;
      }

      await coupon.increment('used_count', { by: 1, transaction });
    }

    await payment.update({ status: 'success', metadata }, { transaction });
    await order.update({ payment_status: 'paid', status: 'processing' }, { transaction });
    order.setDataValue('items', items);

    return order;
  });
};

exports.initializePaystack = async (req, res) => {
  try {
    const { order_uuid, order_id, email, callback_url } = req.body;
    
    if ((!order_uuid && !order_id) || !email) {
      return res.status(400).json({ message: 'Order and email are required' });
    }
    
    const order = order_uuid
      ? await Order.findOne({ where: { uuid: order_uuid } })
      : await Order.findByPk(order_id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.customer_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ message: 'Email does not match this order' });
    }

    if (order.payment_status === 'paid') {
      return res.status(400).json({ message: 'This order has already been paid' });
    }

    const useMockPayment = shouldUseMockPayments();
    const reference = `${useMockPayment ? 'MOCK' : 'PAY'}-${Date.now()}-${order.id}`;
    const amount = parseFloat(order.total);

    const payment = await Payment.create({
      order_id: order.id,
      provider: 'paystack',
      reference,
      amount,
      status: 'pending'
    });
    
    await order.update({ payment_reference: reference, payment_method: 'paystack' });

    const callbackUrl = buildCallbackUrl(callback_url, order, reference);

    if (useMockPayment) {
      return res.json({
        authorization_url: callbackUrl,
        access_code: 'mock_access_code',
        reference
      });
    }

    const paystackResponse = await fetchWithTimeout('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: order.customer_email,
        amount: Math.round(amount * 100),
        reference,
        callback_url: callbackUrl,
        metadata: {
          order_uuid: order.uuid,
          order_number: order.order_number
        }
      })
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      return res.status(502).json({
        message: paystackData.message || 'Could not initialize Paystack payment'
      });
    }

    return res.json({
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    res.status(500).json({ message: 'Error initializing payment', error: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    
    const payment = await Payment.findOne({ where: { reference } });
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment reference not found' });
    }

    if (payment.status === 'success') {
      const order = await Order.findByPk(payment.order_id);
      if (!order) {
        return res.status(404).json({ message: 'Order for this payment was not found' });
      }

      return res.json({
        message: 'Payment already verified',
        status: 'success',
        order: buildVerifiedOrderPayload(order)
      });
    }

    let status = 'failed';
    let metadata = {};

    if (reference.startsWith('MOCK-')) {
      status = 'success';
      metadata = { provider: 'mock', reference };
    } else if (hasPaystackSecret()) {
      const response = await fetchWithTimeout(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      });

      const data = await response.json();
      if (!response.ok || !data.status) {
        return res.status(502).json({ message: data.message || 'Could not verify payment' });
      }

      status = data.data.status;
      metadata = data.data;
    }

    let order = null;
    if (status === 'success') {
      order = await markPaymentSuccessful(payment, metadata);
      if (order) {
        try {
          const { sendPaymentSuccess } = require('../utils/emailService');
          sendPaymentSuccess(order).catch(console.error);
        } catch (e) { /* non-critical */ }
      }
    } else {
      await payment.update({ status: 'failed', metadata });
    }
    
    res.json({
      message: status === 'success' ? 'Payment verified' : 'Payment not successful',
      status,
      order: order ? buildVerifiedOrderPayload(order) : null
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(error.statusCode || 500).json({ message: 'Error verifying payment', error: error.message });
  }
};

exports.paystackWebhook = async (req, res) => {
  try {
    if (!verifyPaystackSignature(req.body, req.headers['x-paystack-signature'])) {
      return res.status(400).send('Invalid signature');
    }

    const event = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body;
    
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      
      const payment = await Payment.findOne({ where: { reference } });
      if (payment) {
        const order = await markPaymentSuccessful(payment, event.data);
        if (order) {
          try {
            const { sendPaymentSuccess } = require('../utils/emailService');
            sendPaymentSuccess(order).catch(console.error);
          } catch (e) { /* non-critical */ }
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook Error');
  }
};
