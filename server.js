const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(__dirname, envFile) });

const validateEnv = require('./utils/validateEnv');
validateEnv();

const app = express();
const { publicApiLimiter } = require('./middleware/rateLimiters');

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '');
const isRenderOrigin = (origin) => /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);

const allowedOrigins = new Set(
  [
    process.env.CLIENT_URL,
    process.env.CORS_ORIGINS,
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map(normalizeOrigin)
    .filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.has(normalizedOrigin) || isRenderOrigin(normalizedOrigin);
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Not allowed by CORS: ${normalizeOrigin(origin)}`));
  },
  credentials: true,
  optionsSuccessStatus: 204
};

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use((req, res, next) => {
  const requestOrigin = normalizeOrigin(req.headers.origin);

  if (isAllowedOrigin(requestOrigin)) {
    if (requestOrigin) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev'));

// Static files (for image uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to BagsAndBeyond API' });
});

// Routes will be imported here
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const shippingRoutes = require('./routes/shipping');
const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const couponRoutes = require('./routes/coupons');
const promoRoutes = require('./routes/promos');

// Webhooks must receive the raw body so provider signatures can be verified.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', publicApiLimiter);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/promos', promoRoutes);

// Database sync and server start
const db = require('./models');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
