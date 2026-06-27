'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminNotificationState extends Model {
    static associate(models) {
      AdminNotificationState.belongsTo(models.AdminUser, { foreignKey: 'admin_user_id', as: 'adminUser' });
    }
  }

  AdminNotificationState.init({
    admin_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    notification_key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cleared_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AdminNotificationState',
    tableName: 'admin_notification_states',
    underscored: true,
  });

  return AdminNotificationState;
};
