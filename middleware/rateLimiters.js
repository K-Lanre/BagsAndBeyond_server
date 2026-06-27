const rateLimit = require('express-rate-limit');

const createLimiter = ({ windowMinutes, limit, message }) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message }
});

const adminAuthLimiter = createLimiter({
  windowMinutes: 15,
  limit: 8,
  message: 'Too many admin authentication attempts. Please try again later.'
});

const passwordResetLimiter = createLimiter({
  windowMinutes: 15,
  limit: 5,
  message: 'Too many password reset attempts. Please try again later.'
});

const paymentLimiter = createLimiter({
  windowMinutes: 15,
  limit: 20,
  message: 'Too many payment attempts. Please try again later.'
});

const couponLimiter = createLimiter({
  windowMinutes: 15,
  limit: 40,
  message: 'Too many coupon validation attempts. Please try again later.'
});

const shippingLimiter = createLimiter({
  windowMinutes: 15,
  limit: 60,
  message: 'Too many shipping calculation attempts. Please try again later.'
});

const publicApiLimiter = createLimiter({
  windowMinutes: 15,
  limit: 300,
  message: 'Too many requests. Please slow down and try again later.'
});

module.exports = {
  adminAuthLimiter,
  passwordResetLimiter,
  paymentLimiter,
  couponLimiter,
  shippingLimiter,
  publicApiLimiter
};
