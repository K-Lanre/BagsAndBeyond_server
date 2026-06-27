'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const password_hash = await bcrypt.hash('admin123', 10);
    
    await queryInterface.bulkInsert('admin_users', [{
      email: 'admin@bagsandbeyond.com',
      password_hash: password_hash,
      name: 'Super Admin',
      role: 'super_admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('admin_users', null, {});
  }
};
