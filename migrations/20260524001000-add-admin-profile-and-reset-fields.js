'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('admin_users', 'avatar_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('admin_users', 'reset_password_token_hash', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('admin_users', 'reset_password_expires_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('admin_users', 'reset_password_expires_at');
    await queryInterface.removeColumn('admin_users', 'reset_password_token_hash');
    await queryInterface.removeColumn('admin_users', 'avatar_url');
  }
};
