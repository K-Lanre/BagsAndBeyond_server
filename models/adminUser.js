'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminUser extends Model {
    static associate(models) {
      AdminUser.hasMany(models.AuditLog, { foreignKey: 'admin_user_id', as: 'auditLogs' });
      AdminUser.hasMany(models.AdminNotificationState, { foreignKey: 'admin_user_id', as: 'notificationStates' });
    }
  }
  AdminUser.init({
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING
    },
    avatar_url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('admin', 'super_admin'),
      defaultValue: 'admin'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login: {
      type: DataTypes.DATE
    },
    reset_password_token_hash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reset_password_expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AdminUser',
    tableName: 'admin_users',
    underscored: true,
  });
  return AdminUser;
};
