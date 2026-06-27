'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Coupon extends Model {
    static associate(models) {
      // define association here
    }
  }
  Coupon.init({
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      set(val) {
        this.setDataValue('code', val.toUpperCase());
      }
    },
    type: {
      type: DataTypes.ENUM('percentage', 'flat', 'free_shipping'),
      defaultValue: 'percentage'
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    min_purchase: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    usage_limit: {
      type: DataTypes.INTEGER,
      defaultValue: 100
    },
    used_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Coupon',
    tableName: 'coupons',
    underscored: true,
  });
  return Coupon;
};
