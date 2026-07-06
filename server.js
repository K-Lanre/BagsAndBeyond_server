const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const validateEnv = require('./utils/validateEnv');
validateEnv();

const app = express();
const { publicApiLimiter } = require('./middleware/rateLimiters');

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
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
