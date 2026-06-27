'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add slug to products
    await queryInterface.addColumn('products', 'slug', {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true,
      after: 'name'
    });

    // Add uuid to orders for public tracking
    await queryInterface.addColumn('orders', 'uuid', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      unique: true,
      allowNull: true,
      after: 'id'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'slug');
    await queryInterface.removeColumn('orders', 'uuid');
  }
};
