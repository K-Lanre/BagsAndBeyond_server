'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('coupons', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      type: {
        type: Sequelize.ENUM('percentage', 'flat', 'free_shipping'),
        defaultValue: 'percentage'
      },
      value: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      min_purchase: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      usage_limit: {
        type: Sequelize.INTEGER,
        defaultValue: 100
      },
      used_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      expiry_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('coupons');
  }
};
