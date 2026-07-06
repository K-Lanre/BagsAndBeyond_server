'use strict';

module.exports = {
  async up(queryInterface) {
    const existingSettingId = await queryInterface.rawSelect(
      'system_settings',
      { where: { key: 'shipping' } },
      ['id']
    );

    if (!existingSettingId) {
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
