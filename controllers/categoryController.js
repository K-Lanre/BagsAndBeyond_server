const { Product } = require('../models');
const { Sequelize } = require('sequelize');

// GET /api/categories
// Get list of available categories with product counts
exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.findAll({
      attributes: [
        'category',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        status: {
          [Sequelize.Op.ne]: 'inactive'
        }
      },
      group: ['category']
    });
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};
