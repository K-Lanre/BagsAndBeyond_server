'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
      after: 'shipping_cost'
    });
    await queryInterface.addColumn('orders', 'coupon_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'coupons',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'discount_amount'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'coupon_id');
    await queryInterface.removeColumn('orders', 'discount_amount');
  }
};
