'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_notification_states', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      admin_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'admin_users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      notification_key: {
        type: Sequelize.STRING,
        allowNull: false
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cleared_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex('admin_notification_states', ['admin_user_id', 'notification_key'], {
      unique: true,
      name: 'admin_notification_states_admin_key_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_notification_states');
  }
};
