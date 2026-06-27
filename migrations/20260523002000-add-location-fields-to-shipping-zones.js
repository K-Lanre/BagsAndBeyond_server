'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('shipping_zones');

    if (!table.country) {
      await queryInterface.addColumn('shipping_zones', 'country', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Nigeria'
      });
    }

    if (!table.state) {
      await queryInterface.addColumn('shipping_zones', 'state', {
        type: Sequelize.STRING
      });
    }

    if (!table.city) {
      await queryInterface.addColumn('shipping_zones', 'city', {
        type: Sequelize.STRING
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE shipping_zones
      SET country = CASE
        WHEN name LIKE '%International%' OR name LIKE '%United Kingdom%' OR description LIKE '%DHL%' THEN 'United Kingdom'
        ELSE 'Nigeria'
      END,
      state = CASE
        WHEN name LIKE '%Lagos%' THEN 'Lagos'
        WHEN name LIKE '%Oyo%' OR name LIKE '%Southwest%' THEN 'Oyo'
        ELSE state
      END,
      city = CASE
        WHEN name LIKE '%Lagos%' THEN 'Lagos'
        ELSE city
      END
    `);

    const value = JSON.stringify({
      freeShippingThreshold: 50000,
      storeCountry: 'Nigeria',
      domesticDefaultShippingFee: 1500,
      internationalDefaultShippingFee: 25000
    });

    await queryInterface.sequelize.query(
      `UPDATE system_settings SET value = :value, updated_at = :updatedAt WHERE \`key\` = 'shipping'`,
      { replacements: { value, updatedAt: new Date() } }
    );
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('shipping_zones');

    if (table.city) await queryInterface.removeColumn('shipping_zones', 'city');
    if (table.state) await queryInterface.removeColumn('shipping_zones', 'state');
    if (table.country) await queryInterface.removeColumn('shipping_zones', 'country');
  }
};
