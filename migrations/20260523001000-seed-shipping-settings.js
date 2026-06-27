'use strict';

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM system_settings WHERE `key` = 'shipping' LIMIT 1"
    );

    if (rows.length === 0) {
      await queryInterface.bulkInsert('system_settings', [{
        key: 'shipping',
        value: JSON.stringify({
          freeShippingThreshold: 50000,
          storeCountry: 'Nigeria',
          domesticDefaultShippingFee: 1500,
          internationalDefaultShippingFee: 25000
        }),
        created_at: new Date(),
        updated_at: new Date()
      }]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('system_settings', { key: 'shipping' });
  }
};
