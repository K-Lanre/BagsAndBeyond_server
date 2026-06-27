'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.AdminUser, { foreignKey: 'admin_user_id', as: 'adminUser' });
    }
  }
  AuditLog.init({
    admin_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entity_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    old_values: {
      type: DataTypes.JSON
    },
    new_values: {
      type: DataTypes.JSON
    },
    ip_address: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    underscored: true,
    updatedAt: false // Only created_at is needed
  });
  return AuditLog;
};
