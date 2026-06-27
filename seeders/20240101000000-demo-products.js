'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('products', [
      {
        name: 'Classic Leather Tote',
        slug: 'classic-leather-tote',
        description: 'A spacious and elegant leather tote bag for everyday use.',
        price: 25000.00,
        stock_quantity: 50,
        category: 'bags',
        images: JSON.stringify(['tote-1.jpg', 'tote-2.jpg']),
        status: 'active',
        sku: 'BAG-TOTE-001',
        weight: 1.2,
        dimensions: JSON.stringify({ height: 30, width: 40, depth: 15 }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Minimalist Crossbody',
        slug: 'minimalist-crossbody',
        description: 'Perfect compact bag for your essentials.',
        price: 15000.00,
        stock_quantity: 8,
        category: 'bags',
        images: JSON.stringify(['crossbody-1.jpg']),
        status: 'low_stock',
        sku: 'BAG-CROSS-002',
        weight: 0.5,
        dimensions: JSON.stringify({ height: 20, width: 25, depth: 8 }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Comfortable Sneakers',
        slug: 'comfortable-sneakers',
        description: 'Everyday lifestyle sneakers with premium cushioning.',
        price: 35000.00,
        stock_quantity: 30,
        category: 'shoes',
        images: JSON.stringify(['sneakers-1.jpg']),
        status: 'active',
        sku: 'SHOE-SNEAK-001',
        weight: 0.8,
        dimensions: JSON.stringify({ height: 12, width: 20, depth: 30 }),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('products', null, {});
  }
};
