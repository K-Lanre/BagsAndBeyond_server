const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const isNumberValue = (value) => hasValue(value) && Number.isFinite(Number(value));

const isIntegerValue = (value) => isNumberValue(value) && Number.isInteger(Number(value));

const isBooleanValue = (value) => (
  typeof value === 'boolean' || value === 'true' || value === 'false' || value === '1' || value === '0'
);

const isDateValue = (value) => hasValue(value) && !Number.isNaN(new Date(value).getTime());

const isUrlValue = (value) => {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol);
  } catch (error) {
    return false;
  }
};

const parseJsonField = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return value;
  if (value === '[object Object]') return {};
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const validate = (validator) => (req, res, next) => {
  const errors = validator(req).filter(Boolean);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }
  next();
};

const requireString = (body, field, errors, label = field) => {
  if (!hasValue(body[field])) errors.push(`${label} is required`);
};

const optionalNumber = (body, field, errors, label = field, min = 0) => {
  if (body[field] === undefined || body[field] === null || body[field] === '') return;
  if (!isNumberValue(body[field]) || Number(body[field]) < min) {
    errors.push(`${label} must be a number greater than or equal to ${min}`);
  }
};

const optionalInteger = (body, field, errors, label = field, min = 0) => {
  if (body[field] === undefined || body[field] === null || body[field] === '') return;
  if (!isIntegerValue(body[field]) || Number(body[field]) < min) {
    errors.push(`${label} must be a whole number greater than or equal to ${min}`);
  }
};

const optionalEnum = (body, field, allowed, errors, label = field) => {
  if (!hasValue(body[field])) return;
  if (!allowed.includes(String(body[field]))) {
    errors.push(`${label} must be one of: ${allowed.join(', ')}`);
  }
};

const optionalBoolean = (body, field, errors, label = field) => {
  if (body[field] === undefined || body[field] === null || body[field] === '') return;
  if (!isBooleanValue(body[field])) errors.push(`${label} must be true or false`);
};

const validateProduct = (mode) => (req) => {
  const errors = [];
  const body = req.body || {};
  const required = mode === 'create';

  if (required) {
    requireString(body, 'name', errors, 'Product name');
    requireString(body, 'category', errors, 'Category');
  } else if (body.name !== undefined && !hasValue(body.name)) {
    errors.push('Product name cannot be empty');
  }

  if (required && !hasValue(body.price)) errors.push('Price is required');
  optionalNumber(body, 'price', errors, 'Price');
  optionalInteger(body, 'stock_quantity', errors, 'Stock quantity');
  optionalEnum(body, 'category', ['bags', 'shoes', 'apparel', 'jewelry'], errors, 'Category');
  optionalEnum(body, 'subcategory', ['men', 'women', 'unisex'], errors, 'Subcategory');
  optionalEnum(body, 'status', ['active', 'inactive', 'low_stock', 'out_of_stock'], errors, 'Status');
  optionalNumber(body, 'weight', errors, 'Weight');

  if (body.remove_images !== undefined) {
    const images = parseJsonField(body.remove_images);
    if (!Array.isArray(images) || images.some((item) => typeof item !== 'string')) {
      errors.push('Images to remove must be a list of image names');
    }
  }

  if (body.dimensions !== undefined) {
    const dimensions = parseJsonField(body.dimensions);
    if (dimensions !== undefined && dimensions !== null && !isObject(dimensions)) {
      errors.push('Dimensions must be a valid object');
    } else if (isObject(dimensions)) {
      ['length', 'width', 'height'].forEach((field) => {
        if (dimensions[field] !== undefined && dimensions[field] !== '' && !isNumberValue(dimensions[field])) {
          errors.push(`Dimension ${field} must be a number`);
        }
      });
    }
  }

  return errors;
};

const validateCreateOrder = (req) => {
  const errors = [];
  const body = req.body || {};

  if (!isEmail(body.customer_email)) errors.push('A valid customer email is required');
  requireString(body, 'customer_name', errors, 'Customer name');
  requireString(body, 'customer_phone', errors, 'Customer phone');
  if (!isObject(body.shipping_address)) {
    errors.push('Shipping address is required');
  } else {
    requireString(body.shipping_address, 'country', errors, 'Shipping country');
    requireString(body.shipping_address, 'state', errors, 'Shipping state');
    requireString(body.shipping_address, 'city', errors, 'Shipping city');
    requireString(body.shipping_address, 'street', errors, 'Shipping street address');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('Order must contain at least one item');
  } else {
    body.items.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`Item ${index + 1} must be an object`);
        return;
      }
      if (!hasValue(item.slug)) errors.push(`Item ${index + 1} product slug is required`);
      if (!isIntegerValue(item.quantity) || Number(item.quantity) < 1) {
        errors.push(`Item ${index + 1} quantity must be at least 1`);
      }
    });
  }

  requireString(body, 'payment_method', errors, 'Payment method');
  optionalEnum(body, 'payment_method', ['paystack'], errors, 'Payment method');
  return errors;
};

const validateShippingCalculation = (req) => {
  const errors = [];
  const body = req.body || {};
  if (!hasValue(body.subtotal)) errors.push('Subtotal is required');
  optionalNumber(body, 'subtotal', errors, 'Subtotal');
  return errors;
};

const validateCoupon = (mode) => (req) => {
  const errors = [];
  const body = req.body || {};

  if (mode === 'create') {
    requireString(body, 'code', errors, 'Coupon code');
    requireString(body, 'expiry_date', errors, 'Expiry date');
  }

  if (hasValue(body.code) && !/^[A-Z0-9_-]{3,30}$/i.test(String(body.code).trim())) {
    errors.push('Coupon code can only contain letters, numbers, hyphens, and underscores');
  }

  optionalEnum(body, 'type', ['percentage', 'flat', 'free_shipping'], errors, 'Coupon type');
  optionalNumber(body, 'value', errors, 'Coupon value');
  optionalNumber(body, 'min_purchase', errors, 'Minimum purchase');
  optionalInteger(body, 'usage_limit', errors, 'Usage limit', 1);
  optionalBoolean(body, 'is_active', errors, 'Coupon active status');

  if (hasValue(body.expiry_date) && !isDateValue(body.expiry_date)) {
    errors.push('Expiry date must be a valid date');
  }

  if (body.type === 'percentage' && isNumberValue(body.value) && Number(body.value) > 100) {
    errors.push('Percentage coupon value cannot be more than 100');
  }

  return errors;
};

const validateShippingZone = (mode) => (req) => {
  const errors = [];
  const body = req.body || {};

  if (mode === 'create') {
    requireString(body, 'name', errors, 'Zone name');
    requireString(body, 'country', errors, 'Country');
    if (!hasValue(body.price)) errors.push('Shipping price is required');
  }

  if (body.name !== undefined && !hasValue(body.name)) errors.push('Zone name cannot be empty');
  if (body.country !== undefined && !hasValue(body.country)) errors.push('Country cannot be empty');
  optionalNumber(body, 'price', errors, 'Shipping price');
  optionalBoolean(body, 'is_active', errors, 'Zone active status');

  return errors;
};

const validateShippingSettings = (req) => {
  const errors = [];
  const body = req.body || {};

  if (body.storeCountry !== undefined && !hasValue(body.storeCountry)) {
    errors.push('Store country is required');
  }

  optionalNumber(body, 'freeShippingThreshold', errors, 'Free shipping threshold');
  optionalNumber(body, 'domesticDefaultShippingFee', errors, 'Domestic default shipping fee');
  optionalNumber(body, 'internationalDefaultShippingFee', errors, 'International default shipping fee');
  optionalNumber(body, 'defaultShippingFee', errors, 'Default shipping fee');

  return errors;
};

const validatePromo = (mode) => (req) => {
  const errors = [];
  const body = req.body || {};

  if (mode === 'create') {
    requireString(body, 'title', errors, 'Promo title');
    requireString(body, 'start_date', errors, 'Start date');
    requireString(body, 'end_date', errors, 'End date');
  }

  if (body.title !== undefined && !hasValue(body.title)) errors.push('Promo title cannot be empty');
  optionalEnum(body, 'position', ['hero', 'featured', 'popup', 'announcement'], errors, 'Promo position');
  optionalBoolean(body, 'is_active', errors, 'Promo active status');

  if (hasValue(body.button_link)) {
    const link = String(body.button_link).trim();
    if (!link.startsWith('/') && !isUrlValue(link)) {
      errors.push('Button link must be an internal path or a valid http/https URL');
    }
  }

  if (hasValue(body.start_date) && !isDateValue(body.start_date)) errors.push('Start date must be a valid date');
  if (hasValue(body.end_date) && !isDateValue(body.end_date)) errors.push('End date must be a valid date');
  if (isDateValue(body.start_date) && isDateValue(body.end_date) && new Date(body.end_date) < new Date(body.start_date)) {
    errors.push('End date cannot be before start date');
  }

  if (body.display_on !== undefined) {
    const displayOn = parseJsonField(body.display_on);
    if (
      !Array.isArray(displayOn) ||
      displayOn.some((item) => !['desktop', 'mobile'].includes(String(item)))
    ) {
      errors.push('Display targets must be desktop, mobile, or both');
    }
  }

  return errors;
};

const validateStoreSettings = (req) => {
  const errors = [];
  const body = req.body || {};

  if (body.name !== undefined && !hasValue(body.name)) errors.push('Store name cannot be empty');
  if (body.email !== undefined && hasValue(body.email) && !isEmail(body.email)) {
    errors.push('Store email must be valid');
  }
  optionalBoolean(body, 'maintenanceMode', errors, 'Maintenance mode');

  return errors;
};

const validateCreateAdmin = (req) => {
  const errors = [];
  const body = req.body || {};

  if (!isEmail(body.email)) errors.push('A valid admin email is required');
  requireString(body, 'password', errors, 'Password');
  optionalEnum(body, 'role', ['admin', 'super_admin'], errors, 'Role');

  return errors;
};

const validateAdminProfile = (req) => {
  const errors = [];
  const body = req.body || {};
  if (body.name !== undefined && !hasValue(body.name)) errors.push('Name cannot be empty');
  return errors;
};

const validateOrderStatus = (req) => {
  const errors = [];
  const body = req.body || {};
  requireString(body, 'status', errors, 'Order status');
  optionalEnum(body, 'status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], errors, 'Order status');
  return errors;
};

const validateRestock = (req) => {
  const errors = [];
  const body = req.body || {};
  if (!isIntegerValue(body.quantity) || Number(body.quantity) < 1) {
    errors.push('Restock quantity must be at least 1');
  }
  return errors;
};

const validatePaymentInitialize = (req) => {
  const errors = [];
  const body = req.body || {};

  if (!hasValue(body.order_uuid) && !hasValue(body.order_id)) {
    errors.push('Order identifier is required');
  }
  if (!isEmail(body.email)) errors.push('A valid email is required');
  if (hasValue(body.callback_url) && !isUrlValue(body.callback_url)) {
    errors.push('Callback URL must be a valid http/https URL');
  }

  return errors;
};

const validateProductQuery = (req) => {
  const errors = [];
  const query = req.query || {};

  optionalEnum(query, 'category', ['bags', 'shoes', 'apparel', 'jewelry'], errors, 'Category');
  optionalEnum(query, 'subcategory', ['men', 'women', 'unisex'], errors, 'Subcategory');
  optionalEnum(query, 'sort', ['newest', 'price_asc', 'price_desc'], errors, 'Sort');
  optionalInteger(query, 'page', errors, 'Page', 1);
  optionalInteger(query, 'limit', errors, 'Limit', 1);
  optionalNumber(query, 'min_price', errors, 'Minimum price');
  optionalNumber(query, 'max_price', errors, 'Maximum price');

  if (
    isNumberValue(query.min_price) &&
    isNumberValue(query.max_price) &&
    Number(query.max_price) < Number(query.min_price)
  ) {
    errors.push('Maximum price cannot be less than minimum price');
  }

  return errors;
};

const validateAdminProductQuery = (req) => {
  const errors = validateProductQuery(req);
  optionalEnum(req.query || {}, 'status', ['active', 'inactive', 'low_stock', 'out_of_stock'], errors, 'Status');
  return errors;
};

const validateEmailQuery = (req) => {
  const errors = [];
  if (!isEmail(req.query?.email)) errors.push('A valid email query parameter is required');
  return errors;
};

const validateCouponLookup = (req) => {
  const errors = [];
  if (!hasValue(req.params?.code)) errors.push('Coupon code is required');
  optionalNumber(req.query || {}, 'subtotal', errors, 'Subtotal');
  return errors;
};

module.exports = {
  validate,
  validators: {
    createProduct: validateProduct('create'),
    updateProduct: validateProduct('update'),
    createOrder: validateCreateOrder,
    calculateShipping: validateShippingCalculation,
    createCoupon: validateCoupon('create'),
    updateCoupon: validateCoupon('update'),
    createShippingZone: validateShippingZone('create'),
    updateShippingZone: validateShippingZone('update'),
    updateShippingSettings: validateShippingSettings,
    createPromo: validatePromo('create'),
    updatePromo: validatePromo('update'),
    updateStoreSettings: validateStoreSettings,
    createAdmin: validateCreateAdmin,
    updateAdminProfile: validateAdminProfile,
    updateOrderStatus: validateOrderStatus,
    restockProduct: validateRestock,
    initializePayment: validatePaymentInitialize,
    productQuery: validateProductQuery,
    adminProductQuery: validateAdminProductQuery,
    emailQuery: validateEmailQuery,
    couponLookup: validateCouponLookup
  }
};
