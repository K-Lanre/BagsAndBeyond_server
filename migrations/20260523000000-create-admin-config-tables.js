'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shipping_zones', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING },
      country: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Nigeria' },
      state: { type: Sequelize.STRING },
      city: { type: Sequelize.STRING },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      icon: { type: Sequelize.STRING, defaultValue: 'map-pin' },
      estimated_days: { type: Sequelize.STRING },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE }
    });

    await queryInterface.createTable('promos', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      title: { type: Sequelize.STRING, allowNull: false },
      subtitle: { type: Sequelize.STRING },
      description: { type: Sequelize.TEXT },
      image: { type: Sequelize.STRING },
      button_text: { type: Sequelize.STRING, defaultValue: 'Shop Now' },
      button_link: { type: Sequelize.STRING, defaultValue: '/shop' },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      position: { type: Sequelize.ENUM('hero', 'featured', 'popup', 'announcement'), defaultValue: 'hero' },
      display_on: { type: Sequelize.JSON },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE }
    });

    await queryInterface.createTable('system_settings', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      key: { type: Sequelize.STRING, allowNull: false, unique: true },
      value: { type: Sequelize.JSON, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE }
    });

    const now = new Date();
    await queryInterface.bulkInsert('shipping_zones', [
      { name: 'Lagos Metro', description: 'Domestic Express Delivery (1-2 days)', country: 'Nigeria', state: 'Lagos', city: 'Lagos', price: 2500, icon: 'map-pin', estimated_days: '1-2', is_active: true, created_at: now, updated_at: now },
      { name: 'Oyo State', description: 'Interstate Road Freight (3-5 days)', country: 'Nigeria', state: 'Oyo', city: null, price: 5000, icon: 'truck', estimated_days: '3-5', is_active: true, created_at: now, updated_at: now },
      { name: 'United Kingdom', description: 'DHL Global Priority (5-7 days)', country: 'United Kingdom', state: null, city: null, price: 25000, icon: 'plane', estimated_days: '5-7', is_active: true, created_at: now, updated_at: now }
    ]);

    await queryInterface.bulkInsert('promos', [
      {
        title: 'Christmas Collection',
        subtitle: 'Up to 30% off on luxury items',
        description: 'Discover our curated holiday selection. Limited time offer on exclusive artisanal pieces.',
        image: '/landing/Bags Collection.png',
        button_text: 'Shop Now',
        button_link: '/shop',
        is_active: true,
        start_date: '2026-12-01',
        end_date: '2026-12-26',
        position: 'hero',
        display_on: JSON.stringify(['desktop', 'mobile']),
        created_at: now,
        updated_at: now
      }
    ]);

    await queryInterface.bulkInsert('system_settings', [
      {
        key: 'store',
        value: JSON.stringify({
          name: 'BagsAndBeyond',
          email: 'support@bagsandbeyond.com',
          description: 'A curated collection of bags, shoes, and fashion essentials.',
          maintenanceMode: false
        }),
        created_at: now,
        updated_at: now
      },
      {
        key: 'shipping',
        value: JSON.stringify({
          freeShippingThreshold: 50000,
          storeCountry: 'Nigeria',
          domesticDefaultShippingFee: 1500,
          internationalDefaultShippingFee: 25000
        }),
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('system_settings');
    await queryInterface.dropTable('promos');
    await queryInterface.dropTable('shipping_zones');
  }
};
