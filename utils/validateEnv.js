const DEFAULT_JWT_SECRET = 'your_jwt_secret_key_change_me_in_prod';

const requireStrongValue = (name, value, options = {}) => {
  const minLength = options.minLength || 1;
  const forbidden = options.forbidden || [];

  if (!value || String(value).trim().length < minLength) {
    throw new Error(`${name} must be set and at least ${minLength} characters long.`);
  }

  if (forbidden.includes(value)) {
    throw new Error(`${name} is using an unsafe default value.`);
  }
};

const validateEnv = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) return;

  requireStrongValue('JWT_SECRET', process.env.JWT_SECRET, {
    minLength: 32,
    forbidden: [DEFAULT_JWT_SECRET]
  });

  requireStrongValue('CLIENT_URL', process.env.CLIENT_URL);
  requireStrongValue('DB_NAME', process.env.DB_NAME);
  requireStrongValue('DB_USER', process.env.DB_USER);
  requireStrongValue('DB_PASSWORD', process.env.DB_PASSWORD, { minLength: 8 });

  if (process.env.PAYSTACK_SECRET_KEY) {
    requireStrongValue('PAYSTACK_SECRET_KEY', process.env.PAYSTACK_SECRET_KEY, { minLength: 12 });
  }

  if (process.env.SMTP_USER || process.env.SMTP_PASS) {
    requireStrongValue('SMTP_USER', process.env.SMTP_USER);
    requireStrongValue('SMTP_PASS', process.env.SMTP_PASS, { minLength: 8 });
  }
};

module.exports = validateEnv;
