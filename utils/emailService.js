const nodemailer = require('nodemailer');

const BRAND_NAME = 'Bags & Beyond';
const FALLBACK_IMAGE = '/landing/Bags%20Collection.png';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const hasSmtpCredentials = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const trimTrailingSlash = (value) => String(value || '').replace(/\/$/, '');

const getClientUrl = () => trimTrailingSlash(process.env.CLIENT_URL || 'http://localhost:5173');

const getServerUrl = () =>
  trimTrailingSlash(process.env.SERVER_URL || process.env.API_URL || 'http://localhost:5000');

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const formatCurrency = (amount = 0) =>
  `NGN ${parseFloat(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const formatShipping = (amount = 0) =>
  parseFloat(amount || 0) === 0 ? 'FREE' : formatCurrency(amount);

const buildImageUrl = (image) => {
  if (!image) return `${getClientUrl()}${FALLBACK_IMAGE}`;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/uploads/')) return `${getServerUrl()}${image}`;
  if (image.startsWith('/landing/')) return `${getClientUrl()}${image.replace(/ /g, '%20')}`;
  if (image.startsWith('/')) return `${getClientUrl()}${image}`;
  if (image.includes('/')) return `${getServerUrl()}/uploads/${image}`;

  const uploadFolder = image.startsWith('images-') ? 'products/' : '';
  return `${getServerUrl()}/uploads/${uploadFolder}${image}`;
};

const getTrackOrderUrl = (order) => {
  const uuid = encodeURIComponent(order.uuid || order.id || '');
  const email = encodeURIComponent(order.customer_email || '');
  return `${getClientUrl()}/orders/${uuid}?email=${email}`;
};

const sendMail = async ({ to, subject, html }) => {
  if (!hasSmtpCredentials()) {
    console.warn(`SMTP credentials are not configured. Email "${subject}" was not sent.`);
    return { skipped: true };
  }

  await transporter.sendMail({
    from: `"${BRAND_NAME}" <${process.env.SMTP_SENDER || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });

  return { skipped: false };
};

const buildLayout = ({ title, preheader, body, cta }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f7f1f3;padding:28px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#24181c;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
      ${escapeHtml(preheader || title)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border-collapse:collapse;background:#fff;border:1px solid #eadde1;border-radius:24px;overflow:hidden;box-shadow:0 18px 45px rgba(36,24,28,0.08);">
            <tr>
              <td style="background:#24181c;padding:28px 30px;text-align:left;">
                <p style="margin:0 0 8px;color:#f7c4cf;font-size:12px;letter-spacing:2px;text-transform:uppercase;">${BRAND_NAME}</p>
                <h1 style="margin:0;color:#fff;font-family:Georgia,serif;font-size:30px;line-height:1.2;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                ${body}
                ${cta ? `
                  <div style="margin-top:28px;">
                    <a href="${cta.href}" style="display:inline-block;background:#d94f70;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;">
                      ${escapeHtml(cta.label)}
                    </a>
                  </div>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td style="background:#fbf7f8;border-top:1px solid #eadde1;padding:20px 30px;color:#7d6870;font-size:12px;line-height:1.7;">
                <strong style="color:#24181c;">${BRAND_NAME}</strong><br />
                Premium bags and shoes, delivered with care.<br />
                If you need help, reply to this email and our team will follow up.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const summaryRows = (order) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:20px;background:#fbf7f8;border:1px solid #eadde1;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:12px 16px;color:#7d6870;">Subtotal</td>
      <td align="right" style="padding:12px 16px;font-weight:700;">${formatCurrency(order.subtotal)}</td>
    </tr>
    <tr>
      <td style="padding:12px 16px;color:#7d6870;border-top:1px solid #eadde1;">Shipping</td>
      <td align="right" style="padding:12px 16px;font-weight:700;border-top:1px solid #eadde1;">${formatShipping(order.shipping_cost)}</td>
    </tr>
    <tr>
      <td style="padding:14px 16px;color:#24181c;border-top:1px solid #eadde1;font-weight:800;">Total</td>
      <td align="right" style="padding:14px 16px;color:#d94f70;border-top:1px solid #eadde1;font-size:18px;font-weight:900;">${formatCurrency(order.total)}</td>
    </tr>
  </table>`;

const itemPrice = (item) => item.price_at_time || item.price || 0;

const buildItemsSection = (items = []) => {
  if (!items.length) return '';

  const rows = items.map((item) => {
    const image = buildImageUrl(item.product_image || item.image || item.product?.images?.[0]);
    const name = escapeHtml(item.product_name || item.name || item.product?.name || 'Product');
    const quantity = item.quantity || 1;
    const price = parseFloat(itemPrice(item) || 0) * quantity;

    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #eadde1;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td width="74" style="vertical-align:top;">
                <img src="${image}" alt="${name}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:14px;border:1px solid #eadde1;background:#f7f1f3;" />
              </td>
              <td style="vertical-align:top;padding-left:8px;">
                <p style="margin:0 0 6px;font-weight:800;color:#24181c;">${name}</p>
                <p style="margin:0;color:#7d6870;font-size:13px;">Quantity: ${quantity}</p>
              </td>
              <td align="right" style="vertical-align:top;font-weight:800;color:#24181c;white-space:nowrap;">
                ${formatCurrency(price)}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="margin-top:24px;">
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:#24181c;">Items in this order</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>`;
};

const getOrderItems = async (order, providedItems) => {
  if (Array.isArray(providedItems)) return providedItems;
  if (order && Array.isArray(order.items)) return order.items;
  if (!order?.id) return [];

  const { OrderItem } = require('../models');
  return OrderItem.findAll({ where: { order_id: order.id } });
};

const orderIntro = (order, message) => `
  <p style="margin:0 0 18px;color:#7d6870;font-size:15px;line-height:1.7;">
    Hi ${escapeHtml(order.customer_name || 'there')},
  </p>
  <p style="margin:0 0 20px;color:#24181c;font-size:16px;line-height:1.7;">
    ${message}
  </p>
  <div style="background:#fbf7f8;border:1px solid #eadde1;border-radius:16px;padding:16px;margin:18px 0;">
    <p style="margin:0;color:#7d6870;font-size:12px;text-transform:uppercase;letter-spacing:1.2px;">Order number</p>
    <p style="margin:5px 0 0;color:#24181c;font-size:20px;font-weight:900;">${escapeHtml(order.order_number)}</p>
  </div>`;

const sendAdminPasswordReset = async (admin, resetLink) => sendMail({
  to: admin.email,
  subject: `Reset your ${BRAND_NAME} admin password`,
  html: buildLayout({
    title: 'Admin Password Reset',
    preheader: 'Use this secure link to reset your admin password.',
    body: `
      <p style="margin:0 0 16px;color:#7d6870;font-size:15px;line-height:1.7;">Hi ${escapeHtml(admin.name || admin.email)},</p>
      <p style="margin:0;color:#24181c;font-size:16px;line-height:1.7;">Use the button below to set a new admin password. This link expires in 30 minutes.</p>
      <p style="margin:20px 0 0;color:#7d6870;font-size:13px;">If you did not request this, you can ignore this email.</p>
    `,
    cta: { label: 'Reset password', href: resetLink },
  }),
});

const sendOrderConfirmation = async (order, items) => {
  const orderItems = await getOrderItems(order, items);

  return sendMail({
    to: order.customer_email,
    subject: `Order confirmed - ${order.order_number}`,
    html: buildLayout({
      title: 'Order Confirmed',
      preheader: `We received your order ${order.order_number}.`,
      body: `
        ${orderIntro(order, `Your order has been received. We will let you know as soon as payment and fulfilment updates are available.`)}
        ${buildItemsSection(orderItems)}
        ${summaryRows(order)}
      `,
      cta: { label: 'View order', href: getTrackOrderUrl(order) },
    }),
  });
};

const sendPaymentSuccess = async (order, items) => {
  const orderItems = await getOrderItems(order, items);

  return sendMail({
    to: order.customer_email,
    subject: `Payment received - ${order.order_number}`,
    html: buildLayout({
      title: 'Payment Received',
      preheader: `Payment received for order ${order.order_number}.`,
      body: `
        ${orderIntro(order, `We have received your payment of <strong>${formatCurrency(order.total)}</strong>. Your order is now ready for processing.`)}
        ${buildItemsSection(orderItems)}
        ${summaryRows(order)}
      `,
      cta: { label: 'Track order', href: getTrackOrderUrl(order) },
    }),
  });
};

const sendOrderProcessing = async (order) => sendMail({
  to: order.customer_email,
  subject: `Order processing - ${order.order_number}`,
  html: buildLayout({
    title: 'Order Processing',
    preheader: `Your order ${order.order_number} is being prepared.`,
    body: orderIntro(order, 'Your order is now being prepared by our team. We will send another update when it ships.'),
    cta: { label: 'Track order', href: getTrackOrderUrl(order) },
  }),
});

const sendOrderShipped = async (order, items) => {
  const orderItems = await getOrderItems(order, items);
  const tracking = order.tracking_number
    ? `<p style="margin:0 0 16px;color:#24181c;font-size:15px;line-height:1.7;">Tracking number: <strong>${escapeHtml(order.tracking_number)}</strong></p>`
    : '';

  return sendMail({
    to: order.customer_email,
    subject: `Your order has shipped - ${order.order_number}`,
    html: buildLayout({
      title: 'Your Order Has Shipped',
      preheader: `Order ${order.order_number} is on its way.`,
      body: `
        ${orderIntro(order, 'Your package is on its way. Here is what we are sending out to you.')}
        ${tracking}
        ${buildItemsSection(orderItems)}
      `,
      cta: { label: 'Track order', href: getTrackOrderUrl(order) },
    }),
  });
};

const sendOrderCancelled = async (order, reason) => sendMail({
  to: order.customer_email,
  subject: `Order cancelled - ${order.order_number}`,
  html: buildLayout({
    title: 'Order Cancelled',
    preheader: `Order ${order.order_number} has been cancelled.`,
    body: `
      ${orderIntro(order, 'Your order has been cancelled.')}
      ${reason ? `<p style="margin:0 0 16px;color:#7d6870;font-size:15px;line-height:1.7;">Reason: <strong>${escapeHtml(reason)}</strong></p>` : ''}
      <p style="margin:0;color:#7d6870;font-size:15px;line-height:1.7;">If payment has already been made, our support team will follow up about the next steps.</p>
    `,
  }),
});

const sendOrderDelivered = async (order) => sendMail({
  to: order.customer_email,
  subject: `Order delivered - ${order.order_number}`,
  html: buildLayout({
    title: 'Order Delivered',
    preheader: `Order ${order.order_number} has been delivered.`,
    body: orderIntro(order, 'Your order has been delivered. Thank you for shopping with Bags & Beyond. We hope you love it.'),
    cta: { label: 'Shop again', href: `${getClientUrl()}/shop` },
  }),
});

module.exports = {
  sendOrderConfirmation,
  sendPaymentSuccess,
  sendOrderProcessing,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled,
  sendAdminPasswordReset,
};
