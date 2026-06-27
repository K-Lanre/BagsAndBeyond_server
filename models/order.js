'use strict';
const { Model } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items' });
      Order.hasMany(models.Payment, { foreignKey: 'order_id', as: 'payments' });
      Order.belongsTo(models.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
    }
  }
  Order.init({
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true
    },
    order_number: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    customer_email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customer_name: {
      type: DataTypes.STRING
    },
    customer_phone: {
      type: DataTypes.STRING
    },
    shipping_address: {
      type: DataTypes.JSON
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2)
    },
    shipping_cost: {
      type: DataTypes.DECIMAL(10, 2)
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    coupon_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    total: {
      type: DataTypes.DECIMAL(10, 2)
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
      defaultValue: 'pending'
    },
    payment_method: {
      type: DataTypes.ENUM('paystack', 'monnify', 'opay')
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    payment_reference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tracking_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    underscored: true,
    hooks: {
      beforeCreate: (order) => {
        if (!order.uuid) {
          order.uuid = uuidv4();
        }
      }
    }
  });
  return Order;
};
