const db = require('../models');
const { calculateShipping: calculateShippingCost } = require('../utils/shippingCalculator');

// POST /api/shipping/calculate
exports.calculateShipping = async (req, res) => {
  try {
    const { subtotal, country, state, city } = req.body;

    if (subtotal === undefined) {
      return res.status(400).json({ message: 'Subtotal is required to calculate shipping' });
    }

    const result = await calculateShippingCost({
      subtotal,
      country,
      state,
      city,
      models: db
    });

    res.json(result);
  } catch (error) {
    console.error('Error calculating shipping:', error);
    res.status(500).json({ message: 'Error calculating shipping', error: error.message });
  }
};
